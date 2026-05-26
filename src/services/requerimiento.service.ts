import { requerimientoRepository, RequerimientoFilters } from "@/repositories/requerimiento.repository";
import {
  Requerimiento,
  RequerimientoDTO,
  EstadoRequerimiento,
  VecinoData,
  TipoRequerimiento,
  DocumentoRequerimiento,
  RespuestaVecinoInput,
  AdminAsignadoRespuesta,
} from "@/types/requerimiento.types";
import { r2Service } from "@/services/r2.service";

// Input type that accepts Zod-parsed data (Zod v4 infers enums as string)
interface CreateInput {
  vecino: Omit<VecinoData, 'tipoInmueble'> & { tipoInmueble: string };
  tipoRequerimiento: string;
  direccionMunicipal?: string;
  direccionMunicipalLabel?: string;
  categoria?: string;
  descripcion: string;
  documentos?: DocumentoRequerimiento[];
}
type UpdateDataInput = CreateInput;
import { generateNumeroSeguimiento } from "@/lib/utils/numero-seguimiento";
import {
  calcularFechaLimite,
  extenderFechaLimiteSemanas,
  reducirFechaLimiteSemanas,
  getDiasHabilesRestantes,
  isVencido,
} from "@/lib/utils/dias-habiles";
import { getDireccionLabel } from "@/constants/direcciones";
import { buildDashboardChartsPayload } from "@/lib/dashboard/chart-analytics";
import type { DashboardChartsPayload } from "@/types/dashboard-charts.types";
import { notificacionService } from "@/services/notificacion.service";
import logger from "@/lib/logger";
import { Timestamp } from "firebase-admin/firestore";
import { cached, invalidateCacheByPrefix } from "@/lib/server-cache";
import { dashboardMetricsService } from "@/services/dashboard-metrics.service";

function timestampToString(ts: Timestamp | Date | string | undefined): string {
  if (!ts) return "";
  if (typeof ts === "string") return ts;
  if (ts instanceof Date) return ts.toISOString();
  if ("toDate" in ts) return ts.toDate().toISOString();
  return "";
}

function toDateFromAny(value: Date | string | { toDate?: () => Date }): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string") return new Date(value);
  if (value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date();
}

function invalidateDashboardAndListCaches(): void {
  invalidateCacheByPrefix("requerimientos:list:");
  invalidateCacheByPrefix("dashboard:stats:");
  invalidateCacheByPrefix("dashboard:highlights:");
  invalidateCacheByPrefix("dashboard:charts:");
  invalidateCacheByPrefix("dashboard:urgentes:");
  invalidateCacheByPrefix("reports:data:");
}

/**
 * Calcula la nueva fecha límite cuando un cambio de estado debe afectar el plazo.
 * - Avanzar a en_espera_1 o en_espera_2: extiende 2 semanas hábiles.
 * - Volver desde un en_espera_* hacia un estado anterior: NO se devuelve aquí
 *   automáticamente; la compensación se hace solo en `revertirEstado` para que
 *   las idas y vueltas por error en transición directa no recorten plazos sin querer.
 * - Cualquier otro cambio: sin efecto.
 *
 * Retorna null cuando no hay que modificar la fecha.
 */
function computeNuevaFechaLimitePorTransicion(
  fechaLimiteActual: Date,
  estadoActual: EstadoRequerimiento,
  estadoDestino: EstadoRequerimiento
): Date | null {
  if (estadoDestino === "en_espera_1" && estadoActual !== "en_espera_1" && estadoActual !== "en_espera_2") {
    return extenderFechaLimiteSemanas(fechaLimiteActual, 2);
  }
  if (estadoDestino === "en_espera_2" && estadoActual === "en_espera_1") {
    return extenderFechaLimiteSemanas(fechaLimiteActual, 2);
  }
  if (estadoDestino === "en_espera_2" && estadoActual !== "en_espera_1" && estadoActual !== "en_espera_2") {
    // Salto directo a espera 2 (caso excepcional admin/superadmin): solo 2 semanas extra.
    return extenderFechaLimiteSemanas(fechaLimiteActual, 2);
  }
  return null;
}

function getTimeFromDateLike(value: string | Date | undefined): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

function toRequerimientoDTO(req: Requerimiento): RequerimientoDTO {
  const fechaLimite = req.fechaLimite
    ? typeof req.fechaLimite === "string"
      ? new Date(req.fechaLimite)
      : req.fechaLimite instanceof Date
        ? req.fechaLimite
        : (req.fechaLimite as Timestamp).toDate()
    : new Date();

  return {
    id: req.id,
    numeroSeguimiento: req.numeroSeguimiento,
    vecino: req.vecino,
    tipoRequerimiento: req.tipoRequerimiento,
    direccionMunicipal: req.direccionMunicipal,
    direccionMunicipalLabel: req.direccionMunicipalLabel,
    categoria: req.categoria,
    descripcion: req.descripcion,
    documentos: req.documentos || [],
    estado: req.estado,
    historialEstados: (req.historialEstados || []).map((h) => ({
      estado: h.estado,
      fecha: timestampToString(h.fecha),
      usuarioId: h.usuarioId,
      nota: h.nota,
    })),
    notas: (req.notas || []).map((n) => ({
      contenido: n.contenido,
      usuarioId: n.usuarioId,
      fecha: timestampToString(n.fecha),
    })),
    respuestasVecino: (req.respuestasVecino || []).map((r) => ({
      emailDestino: r.emailDestino,
      asunto: r.asunto,
      mensaje: r.mensaje,
      usuarioId: r.usuarioId,
      fecha: timestampToString(r.fecha),
    })),
    evidenciaResolucion: req.evidenciaResolucion
      ? {
          tipo: req.evidenciaResolucion.tipo,
          nombre: req.evidenciaResolucion.nombre,
          nombreR2: req.evidenciaResolucion.nombreR2,
          url: req.evidenciaResolucion.url,
          tamanio: req.evidenciaResolucion.tamanio,
          fecha: timestampToString(req.evidenciaResolucion.fecha),
          usuarioId: req.evidenciaResolucion.usuarioId,
        }
      : undefined,
    adminAsignadoRespuesta: req.adminAsignadoRespuesta
      ? {
          uid: req.adminAsignadoRespuesta.uid,
          nombre: req.adminAsignadoRespuesta.nombre,
          email: req.adminAsignadoRespuesta.email,
          asignadoEn: timestampToString(req.adminAsignadoRespuesta.asignadoEn),
          asignadoPor: req.adminAsignadoRespuesta.asignadoPor,
        }
      : undefined,
    fechaIngreso: timestampToString(req.fechaIngreso),
    fechaLimite: timestampToString(req.fechaLimite),
    fechaResolucion: req.fechaResolucion ? timestampToString(req.fechaResolucion) : undefined,
    creadoEn: timestampToString(req.creadoEn),
    actualizadoEn: timestampToString(req.actualizadoEn),
    diasHabilesRestantes: getDiasHabilesRestantes(fechaLimite),
    vencido: isVencido(fechaLimite),
  };
}

export const requerimientoService = {
  /**
   * Create a new requerimiento — public endpoint.
   * Only persists the document and returns immediately.
   * Call `afterCreate()` via next/server `after()` for emails, metrics, and cache invalidation.
   */
  async create(input: CreateInput): Promise<{ id: string; numeroSeguimiento: string }> {
    const numeroSeguimiento = await generateNumeroSeguimiento();
    const now = new Date();
    const fechaLimite = calcularFechaLimite(now);
    const direccionMunicipal = input.direccionMunicipal || "";
    const direccionMunicipalLabel = input.direccionMunicipalLabel
      || (direccionMunicipal ? getDireccionLabel(direccionMunicipal) : "");

    const requerimientoData = {
      numeroSeguimiento,
      vecino: input.vecino as unknown as VecinoData,
      tipoRequerimiento: input.tipoRequerimiento as TipoRequerimiento,
      direccionMunicipal,
      direccionMunicipalLabel,
      categoria: input.categoria || "",
      descripcion: input.descripcion,
      documentos: input.documentos || [],
      estado: "pendiente" as const,
      historialEstados: [
        {
          estado: "pendiente" as const,
          fecha: now,
          nota: "Requerimiento ingresado por vecino",
        },
      ],
      notas: [] as Requerimiento["notas"],
      respuestasVecino: [] as Requerimiento["respuestasVecino"],
      fechaIngreso: now,
      fechaLimite,
      creadoEn: now,
      actualizadoEn: now,
    };

    const id = await requerimientoRepository.create(requerimientoData);

    logger.info({ id, numeroSeguimiento }, "Requerimiento created successfully");
    return { id, numeroSeguimiento };
  },

  /**
   * Background work after creating a requerimiento.
   * Should be called inside `after()` from the route handler so it runs
   * after the HTTP response is sent (emails won't block the user).
   */
  async afterCreate(input: CreateInput, numeroSeguimiento: string): Promise<void> {
    const direccionMunicipal = input.direccionMunicipal || "";
    const direccionMunicipalLabel = input.direccionMunicipalLabel
      || (direccionMunicipal ? getDireccionLabel(direccionMunicipal) : "");
    const categoria = input.categoria || "";
    const now = new Date();

    await Promise.allSettled([
      dashboardMetricsService.onCreate({
        tipoRequerimiento: input.tipoRequerimiento as TipoRequerimiento,
        direccionMunicipal,
        direccionMunicipalLabel,
        categoria,
        estado: "pendiente",
      } as Requerimiento),
      notificacionService.enviarConfirmacionVecino({
        numeroSeguimiento,
        vecino: input.vecino as unknown as VecinoData,
        tipoRequerimiento: input.tipoRequerimiento,
        descripcion: input.descripcion,
        fechaIngreso: now.toLocaleDateString("es-CL"),
      }),
      notificacionService.enviarAvisoAdmin({
        numeroSeguimiento,
        vecino: input.vecino as unknown as VecinoData,
        tipoRequerimiento: input.tipoRequerimiento,
        descripcion: input.descripcion,
        fechaIngreso: now.toLocaleDateString("es-CL"),
      }),
    ]);

    invalidateDashboardAndListCaches();
  },

  /**
   * Get requerimiento by ID
   */
  async getById(id: string): Promise<RequerimientoDTO | null> {
    const req = await requerimientoRepository.getById(id);
    if (!req) return null;
    return toRequerimientoDTO(req);
  },

  /**
   * Get requerimiento by tracking number (public)
   */
  async getByNumeroSeguimiento(numero: string, rut: string): Promise<RequerimientoDTO | null> {
    const req = await requerimientoRepository.getByNumeroSeguimiento(numero);
    if (!req) return null;
    // Verify RUT matches
    if (req.vecino.rut.replace(/[.\-]/g, "").toUpperCase() !== rut.replace(/[.\-]/g, "").toUpperCase()) {
      return null;
    }
    return toRequerimientoDTO(req);
  },

  /**
   * List requerimientos with pagination and role-based filtering
   */
  async list(
    filters: RequerimientoFilters,
    direccionRestriccion?: string[]
  ): Promise<{ data: RequerimientoDTO[]; nextCursor?: string; total?: number }> {
    const result = await requerimientoRepository.list(filters, direccionRestriccion);
    return {
      data: result.data.map(toRequerimientoDTO),
      nextCursor: result.nextCursor,
      total: result.total,
    };
  },

  /**
   * Update requerimiento status.
   * Accepts optional `existing` to skip re-reading the doc from Firestore.
   *
   * Si el estado destino es "en_espera_1" o "en_espera_2" la fecha límite
   * vigente se extiende automáticamente en 2 semanas hábiles. Si la transición
   * proviene de uno de esos estados hacia un estado anterior, se devuelve el
   * plazo (compensación). Otras transiciones no afectan el plazo.
   */
  async updateEstado(
    id: string,
    estado: EstadoRequerimiento,
    usuarioId: string,
    nota?: string,
    existing?: RequerimientoDTO
  ): Promise<void> {
    const current = existing ?? await requerimientoRepository.getById(id);
    if (!current) return;
    if (current.estado === estado) return;

    const fechaLimite = computeNuevaFechaLimitePorTransicion(
      toDateFromAny(current.fechaLimite),
      current.estado as EstadoRequerimiento,
      estado
    );

    // Si el estado destino sale de derivado_respuesta_final hacia un estado
    // anterior, limpiamos al admin asignado (la responsabilidad vuelve al director).
    const limpiarAdminAsignado =
      current.estado === "derivado_respuesta_final" &&
      estado !== "derivado_respuesta_final" &&
      estado !== "completado" &&
      estado !== "rechazado";

    await requerimientoRepository.addEstadoToHistorial(id, estado, usuarioId, nota, {
      fechaLimite: fechaLimite ?? undefined,
      adminAsignadoRespuesta: limpiarAdminAsignado ? null : undefined,
    });
    await dashboardMetricsService.onEstadoChange(current as unknown as Requerimiento, estado);
    logger.info({ id, estado, usuarioId }, "Requerimiento status updated");
    invalidateDashboardAndListCaches();
  },

  /**
   * El director deriva el requerimiento a un admin específico para que envíe
   * la respuesta final al vecino. Solo aplica a los tipos:
   * Información / Reclamo / Sugerencia / Felicitación.
   */
  async derivarRespuestaFinal(
    id: string,
    admin: { uid: string; nombre: string; email: string },
    directorUid: string,
    nota?: string,
    existing?: RequerimientoDTO
  ): Promise<void> {
    const current = existing ?? await requerimientoRepository.getById(id);
    if (!current) throw new Error("Requerimiento no encontrado");

    if (
      current.estado !== "en_proceso" &&
      current.estado !== "en_espera_1" &&
      current.estado !== "en_espera_2"
    ) {
      throw new Error("Solo se puede derivar a respuesta final desde en proceso o espera");
    }

    const asignacion: AdminAsignadoRespuesta = {
      uid: admin.uid,
      nombre: admin.nombre,
      email: admin.email,
      asignadoEn: new Date(),
      asignadoPor: directorUid,
    };

    await requerimientoRepository.addEstadoToHistorial(
      id,
      "derivado_respuesta_final",
      directorUid,
      nota || `Derivado a ${admin.nombre} (${admin.email}) para respuesta final`,
      { adminAsignadoRespuesta: asignacion }
    );

    await dashboardMetricsService.onEstadoChange(
      current as unknown as Requerimiento,
      "derivado_respuesta_final"
    );

    try {
      await notificacionService.enviarDerivacionRespuestaFinal(admin.email, {
        adminNombre: admin.nombre,
        numeroSeguimiento: current.numeroSeguimiento,
        vecino: current.vecino,
        tipoRequerimiento: current.tipoRequerimiento,
        descripcion: current.descripcion,
        fechaIngreso: toDateFromAny(current.fechaIngreso),
        fechaLimite: toDateFromAny(current.fechaLimite),
        evidencia: current.evidenciaResolucion
          ? {
              tipo: current.evidenciaResolucion.tipo,
              nombre: current.evidenciaResolucion.nombre,
              url:
                current.evidenciaResolucion.tipo === "link"
                  ? current.evidenciaResolucion.url
                  : undefined,
            }
          : undefined,
      });
    } catch (err) {
      logger.error({ err, id, adminEmail: admin.email }, "Failed to notify admin for final response");
    }

    invalidateDashboardAndListCaches();
  },

  /**
   * Revierte el último cambio de estado del requerimiento, con compensación
   * de plazo y limpieza de adminAsignadoRespuesta cuando corresponde.
   * Política: solo si NO se envió respuesta al vecino.
   */
  async revertirEstado(
    id: string,
    usuarioId: string,
    existing?: RequerimientoDTO
  ): Promise<{ estadoAntes: EstadoRequerimiento; estadoDespues: EstadoRequerimiento }> {
    const current = existing ?? await requerimientoRepository.getById(id);
    if (!current) throw new Error("Requerimiento no encontrado");
    if ((current.respuestasVecino?.length || 0) > 0) {
      throw new Error("No se puede revertir: ya se envió respuesta al vecino");
    }
    const hist = current.historialEstados || [];
    if (hist.length < 2) {
      throw new Error("No hay un estado anterior al cual revertir");
    }
    const estadoAntes = current.estado as EstadoRequerimiento;
    const previo = hist[hist.length - 2].estado as EstadoRequerimiento;

    // Compensación de plazo: si estoy saliendo de en_espera_1/2, devuelvo 2 semanas hábiles.
    const fechaLimiteActual = toDateFromAny(current.fechaLimite);
    let nuevaFechaLimite: Date | undefined;
    if (estadoAntes === "en_espera_2" && previo !== "en_espera_2") {
      nuevaFechaLimite = reducirFechaLimiteSemanas(fechaLimiteActual, 2);
    } else if (estadoAntes === "en_espera_1" && previo !== "en_espera_1") {
      nuevaFechaLimite = reducirFechaLimiteSemanas(fechaLimiteActual, 2);
    } else if (
      (previo === "en_espera_1" || previo === "en_espera_2") &&
      estadoAntes !== "en_espera_1" &&
      estadoAntes !== "en_espera_2"
    ) {
      // Si volvemos hacia en_espera, debemos restaurar las semanas que se habían
      // descontado al avanzar (no es habitual, pero matemáticamente coherente).
      nuevaFechaLimite = extenderFechaLimiteSemanas(fechaLimiteActual, 2);
    }

    const limpiarAdmin = estadoAntes === "derivado_respuesta_final";

    await requerimientoRepository.addEstadoToHistorial(
      id,
      previo,
      usuarioId,
      `[REVERSIÓN] ${estadoAntes} -> ${previo}`,
      {
        fechaLimite: nuevaFechaLimite,
        adminAsignadoRespuesta: limpiarAdmin ? null : undefined,
      }
    );

    await dashboardMetricsService.onEstadoChange(current as unknown as Requerimiento, previo);
    invalidateDashboardAndListCaches();
    logger.info({ id, estadoAntes, previo, usuarioId }, "Estado revertido");
    return { estadoAntes, estadoDespues: previo };
  },

  /**
   * Add a note to a requerimiento
   */
  async addNota(id: string, contenido: string, usuarioId: string): Promise<void> {
    await requerimientoRepository.addNota(id, { contenido, usuarioId });
    logger.info({ id, usuarioId }, "Note added to requerimiento");
    invalidateDashboardAndListCaches();
  },

  async updateDatos(id: string, input: UpdateDataInput, existing?: RequerimientoDTO): Promise<void> {
    const current = existing ?? await requerimientoRepository.getById(id);
    if (!current) {
      throw new Error("Requerimiento no encontrado");
    }

    const direccionMunicipal = input.direccionMunicipal ?? "";
    const categoria = input.categoria ?? "";
    const direccionMunicipalLabel = input.direccionMunicipalLabel || (direccionMunicipal ? getDireccionLabel(direccionMunicipal) : "");

    await requerimientoRepository.update(id, {
      vecino: input.vecino as unknown as VecinoData,
      tipoRequerimiento: input.tipoRequerimiento as TipoRequerimiento,
      direccionMunicipal,
      direccionMunicipalLabel,
      categoria,
      descripcion: input.descripcion,
      documentos: input.documentos || [],
    });

    await dashboardMetricsService.onDataChange(
      current as unknown as Requerimiento,
      { estado: current.estado, direccionMunicipalLabel, categoria } as unknown as Requerimiento,
    );

    logger.info({ id }, "Requerimiento data updated");
    invalidateDashboardAndListCaches();
  },

  async updateDireccionMunicipal(
    id: string,
    direccionMunicipal: string,
    direccionMunicipalLabel: string,
    existing?: RequerimientoDTO
  ): Promise<void> {
    const current = existing ?? await requerimientoRepository.getById(id);
    if (!current) {
      throw new Error("Requerimiento no encontrado");
    }
    if (current.direccionMunicipal === direccionMunicipal) {
      return;
    }

    await requerimientoRepository.update(id, {
      direccionMunicipal,
      direccionMunicipalLabel,
    });

    await dashboardMetricsService.onDataChange(
      current as unknown as Requerimiento,
      { estado: current.estado, direccionMunicipalLabel, categoria: current.categoria } as unknown as Requerimiento,
    );

    invalidateDashboardAndListCaches();
  },

  async enviarRespuestaVecino(
    id: string,
    input: RespuestaVecinoInput & { cierre?: "completado" | "rechazado" },
    usuarioId: string,
    existing?: RequerimientoDTO
  ): Promise<void> {
    const current = existing ?? await requerimientoRepository.getById(id);
    if (!current) {
      throw new Error("Requerimiento no encontrado");
    }

    const estado = current.estado as EstadoRequerimiento;
    const estadoPermiteEnvio: EstadoRequerimiento[] = [
      "en_proceso",
      "en_espera_1",
      "en_espera_2",
      "derivado_respuesta_final",
      "completado",
      "rechazado",
    ];
    if (!estadoPermiteEnvio.includes(estado)) {
      throw new Error("El estado actual del requerimiento no permite enviar la respuesta al vecino");
    }
    if ((current.respuestasVecino?.length || 0) > 0) {
      throw new Error("Ya existe una respuesta enviada al vecino para este requerimiento");
    }

    let evidenciaAdjunta: { filename: string; content: Buffer } | undefined;
    if (current.evidenciaResolucion?.tipo === "documento" && current.evidenciaResolucion.nombreR2) {
      try {
        const buffer = await r2Service.getFileBuffer(current.evidenciaResolucion.nombreR2);
        evidenciaAdjunta = {
          filename: current.evidenciaResolucion.nombre || "evidencia-resolucion.pdf",
          content: buffer,
        };
      } catch (err) {
        logger.warn({ err, id }, "Could not attach evidence PDF to citizen email, sending without it");
      }
    }

    const evidenciaInfo = current.evidenciaResolucion
      ? {
          tipo: current.evidenciaResolucion.tipo,
          nombre: current.evidenciaResolucion.nombre,
          url: current.evidenciaResolucion.tipo === "link" ? current.evidenciaResolucion.url : undefined,
        }
      : undefined;

    await notificacionService.enviarRespuestaVecino(
      input.emailDestino,
      {
        numeroSeguimiento: current.numeroSeguimiento,
        vecino: current.vecino,
        asunto: input.asunto,
        mensaje: input.mensaje,
        evidencia: evidenciaInfo as { tipo: "documento" | "link"; nombre?: string; url?: string } | undefined,
      },
      evidenciaAdjunta
    );

    await requerimientoRepository.addRespuestaVecino(id, {
      emailDestino: input.emailDestino,
      asunto: input.asunto,
      mensaje: input.mensaje,
      usuarioId,
    });

    // Si nos pasaron un estado de cierre, lo registramos como historial.
    if (
      input.cierre &&
      input.cierre !== current.estado &&
      (input.cierre === "completado" || input.cierre === "rechazado")
    ) {
      await requerimientoRepository.addEstadoToHistorial(
        id,
        input.cierre,
        usuarioId,
        `Cierre por envío de respuesta al vecino`,
        { adminAsignadoRespuesta: null }
      );
      await dashboardMetricsService.onEstadoChange(
        current as unknown as Requerimiento,
        input.cierre
      );
    }

    logger.info({ id, usuarioId, emailDestino: input.emailDestino }, "Citizen response registered");
    invalidateDashboardAndListCaches();
  },

  async setEvidenciaResolucion(
    id: string,
    evidencia: { tipo: "documento" | "link"; nombre?: string; nombreR2?: string; url: string; tamanio?: number },
    usuarioId: string,
    existing?: RequerimientoDTO
  ): Promise<void> {
    const current = existing ?? await requerimientoRepository.getById(id);
    if (!current) throw new Error("Requerimiento no encontrado");
    const estadosOk: EstadoRequerimiento[] = ["en_proceso", "en_espera_1", "en_espera_2"];
    if (!estadosOk.includes(current.estado as EstadoRequerimiento)) {
      throw new Error("Solo se puede adjuntar evidencia mientras el requerimiento está en proceso o en espera");
    }

    await requerimientoRepository.update(id, {
      evidenciaResolucion: {
        ...evidencia,
        fecha: new Date(),
        usuarioId,
      },
    } as Partial<Requerimiento>);

    logger.info({ id }, "Evidencia de resolución adjuntada");
    invalidateDashboardAndListCaches();
  },

  async clearEvidenciaResolucion(id: string, existing?: RequerimientoDTO): Promise<void> {
    const current = existing ?? await requerimientoRepository.getById(id);
    if (!current) throw new Error("Requerimiento no encontrado");
    const estadosOk: EstadoRequerimiento[] = ["en_proceso", "en_espera_1", "en_espera_2"];
    if (!estadosOk.includes(current.estado as EstadoRequerimiento)) {
      throw new Error("Solo puede eliminar evidencia mientras el requerimiento está en proceso o en espera");
    }
    if (!current.evidenciaResolucion) {
      return;
    }

    await requerimientoRepository.clearEvidenciaResolucion(id);

    logger.info({ id }, "Evidencia de resolución eliminada");
    invalidateDashboardAndListCaches();
  },

  /**
   * Delete a requerimiento (superadmin only)
   */
  async delete(id: string, existing?: RequerimientoDTO): Promise<void> {
    const current = existing ?? await requerimientoRepository.getById(id);
    if (!current) return;
    await requerimientoRepository.delete(id);
    await dashboardMetricsService.onDelete(current as unknown as Requerimiento);
    logger.info({ id }, "Requerimiento deleted");
    invalidateDashboardAndListCaches();
  },

  /**
   * Dashboard stats — usa métricas pre-agregadas (1 doc) cuando no hay restricción;
   * solo necesita scan completo como fallback o para urgentesActivos (no pre-agregado).
   */
  async getStats(direccionRestriccion?: string[]): Promise<{
    total: number;
    pendiente: number;
    derivado: number;
    en_proceso: number;
    en_espera_1: number;
    en_espera_2: number;
    derivado_respuesta_final: number;
    completado: number;
    rechazado: number;
    urgentesActivos: number;
  }> {
    const cacheKey = `dashboard:stats:${direccionRestriccion?.sort().join(",") ?? "global"}`;
    return cached(cacheKey, 120_000, async () => {
      if (!direccionRestriccion || direccionRestriccion.length === 0) {
        const preAggregated = await dashboardMetricsService.getCoreStats();
        if (preAggregated && preAggregated.total > 0) {
          const urgentesActivos = await this.countUrgentesActivos();
          return { ...preAggregated, urgentesActivos };
        }
      }
      return requerimientoRepository.getStats(direccionRestriccion);
    });
  },

  async countUrgentesActivos(): Promise<number> {
    return cached("dashboard:urgentes:count", 180_000, () =>
      requerimientoRepository.countUrgentesActivos()
    );
  },

  /**
   * Datos agregados para gráficos de torta — cacheados 2 min en servidor.
   */
  async getDashboardCharts(direccionRestriccion?: string[]): Promise<DashboardChartsPayload> {
    const cacheKey = `dashboard:charts:${direccionRestriccion?.sort().join(",") ?? "global"}`;
    return cached(cacheKey, 300_000, async () => {
      const raw = await requerimientoRepository.getDashboardChartRows(direccionRestriccion);
      return buildDashboardChartsPayload(raw);
    });
  },

  /**
   * Dashboard highlights — cacheados 2 min en servidor.
   * Lista de últimos (5), urgentes (5), top direcciones.
   */
  async getDashboardHighlights(direccionRestriccion?: string[]): Promise<{
    ultimos: RequerimientoDTO[];
    urgentes: RequerimientoDTO[];
    direccionesTop: { direccion: string; total: number }[];
    direccionesResueltasTop: { direccion: string; totalResueltos: number }[];
  }> {
    const cacheKey = `dashboard:highlights:${direccionRestriccion?.sort().join(",") ?? "global"}`;
    return cached(cacheKey, 300_000, async () => {
      const ultimosResult = await requerimientoRepository.list({ limit: 5 }, direccionRestriccion);
      const ultimos = ultimosResult.data.map(toRequerimientoDTO);

      if (!direccionRestriccion || direccionRestriccion.length === 0) {
        const [direccionesTop, direccionesResueltasTop, candidatosResult] = await Promise.all([
          dashboardMetricsService.getTopDirections(5),
          dashboardMetricsService.getTopResolvedDirections(5),
          requerimientoRepository.list({ limit: 30 }, direccionRestriccion),
        ]);

        const urgentes = candidatosResult.data.map(toRequerimientoDTO)
          .filter((r) => r.estado !== "completado" && r.estado !== "rechazado")
          .sort((a, b) => getTimeFromDateLike(a.fechaIngreso) - getTimeFromDateLike(b.fechaIngreso))
          .slice(0, 5);

        return { ultimos, urgentes, direccionesTop, direccionesResueltasTop };
      }

      const candidatos = await requerimientoRepository.list({ limit: 30 }, direccionRestriccion);
      const candidatosDto = candidatos.data.map(toRequerimientoDTO);

      const urgentes = candidatosDto
        .filter((r) => r.estado !== "completado" && r.estado !== "rechazado")
        .sort((a, b) => getTimeFromDateLike(a.fechaIngreso) - getTimeFromDateLike(b.fechaIngreso))
        .slice(0, 5);

      const conteoDirecciones = new Map<string, number>();
      candidatosDto.forEach((r) => {
        const key = r.direccionMunicipalLabel || r.direccionMunicipal || "Sin dirección";
        conteoDirecciones.set(key, (conteoDirecciones.get(key) || 0) + 1);
      });
      const direccionesTop = Array.from(conteoDirecciones.entries())
        .map(([direccion, total]) => ({ direccion, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      const conteoResueltos = new Map<string, number>();
      candidatosDto
        .filter((r) => r.estado === "completado")
        .forEach((r) => {
          const key = r.direccionMunicipalLabel || r.direccionMunicipal || "Sin dirección";
          conteoResueltos.set(key, (conteoResueltos.get(key) || 0) + 1);
        });
      const direccionesResueltasTop = Array.from(conteoResueltos.entries())
        .map(([direccion, totalResueltos]) => ({ direccion, totalResueltos }))
        .sort((a, b) => b.totalResueltos - a.totalResueltos)
        .slice(0, 5);

      return { ultimos, urgentes, direccionesTop, direccionesResueltasTop };
    });
  },

  /**
   * Get requerimientos for report generation — cacheado 3 min para evitar
   * scans repetidos cuando varios usuarios exportan seguido.
   */
  async getForReport(filters: RequerimientoFilters, direccionRestriccion?: string[]): Promise<RequerimientoDTO[]> {
    const filterKey = JSON.stringify({ ...filters, direccionRestriccion });
    const cacheKey = `reports:data:${Buffer.from(filterKey).toString("base64url")}`;
    return cached(cacheKey, 180_000, async () => {
      const data = await requerimientoRepository.getForReport(filters, direccionRestriccion);
      return data.map(toRequerimientoDTO);
    });
  },
};
