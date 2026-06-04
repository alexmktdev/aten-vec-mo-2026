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
  usaRespuestaAutomaticaAdminCompletado,
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
import { buildRespuestaAutomaticaCompletado } from "@/lib/respuesta-automatica-completado";
import { validateRespuestaVecinoMensaje } from "@/lib/validations/requerimiento.schema";
import { generateNumeroSeguimiento } from "@/lib/utils/numero-seguimiento";
import {
  calcularFechaLimite,
  extenderFechaLimiteSemanas,
  reducirFechaLimiteSemanas,
  getDiasHabilesRestantes,
  isVencido,
} from "@/lib/utils/dias-habiles";
import { getDireccionLabel } from "@/constants/direcciones";
import {
  necesitaPersistirDireccionTransparencia,
  resolverDireccionMunicipal,
} from "@/lib/transparencia-direccion";
import { buildDashboardChartsPayload } from "@/lib/dashboard/chart-analytics";
import type { DashboardChartsPayload } from "@/types/dashboard-charts.types";
import type { SessionUser } from "@/types/auth.types";
import { notificacionService } from "@/services/notificacion.service";
import logger from "@/lib/logger";
import { Timestamp } from "firebase-admin/firestore";
import { cached, invalidateCacheByPrefix } from "@/lib/server-cache";
import { dashboardMetricsService } from "@/services/dashboard-metrics.service";

type UsuarioRegistro = Pick<SessionUser, "uid" | "nombre" | "rol">;

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

function buildUsuarioRegistro(usuario: UsuarioRegistro) {
  return {
    usuarioId: usuario.uid,
    usuarioNombre: usuario.nombre,
    usuarioRol: usuario.rol,
  };
}

/**
 * Calcula la nueva fecha límite cuando un cambio de estado debe afectar el plazo.
 * - Al pasar a derivado: reinicia plazo base (10 días hábiles) desde ahora.
 * - Al entrar a en_espera_1 o en_espera_2: suma 10 días hábiles al plazo vigente.
 * - Al salir de en_espera_1 o en_espera_2 hacia estado anterior: descuenta 10 días hábiles.
 * - Cualquier otro cambio: sin efecto en el plazo.
 *
 * Retorna null cuando no hay que modificar la fecha.
 */
function computeNuevaFechaLimitePorTransicion(
  fechaLimiteActual: Date,
  estadoActual: EstadoRequerimiento,
  estadoDestino: EstadoRequerimiento
): Date | null {
  // El plazo base de 10 días hábiles comienza (o se reinicia) al derivar al área.
  // Esto cubre tanto la primera derivación como las re-derivaciones luego de volver a pendiente.
  if (estadoDestino === "derivado") {
    return calcularFechaLimite(new Date());
  }

  if (estadoDestino === "en_espera_1" && estadoActual !== "en_espera_1" && estadoActual !== "en_espera_2") {
    return extenderFechaLimiteSemanas(fechaLimiteActual, 2);
  }
  if (estadoDestino === "en_espera_2" && estadoActual !== "en_espera_2") {
    return extenderFechaLimiteSemanas(fechaLimiteActual, 2);
  }

  if (estadoActual === "en_espera_2" && estadoDestino !== "en_espera_2") {
    return reducirFechaLimiteSemanas(fechaLimiteActual, 2);
  }
  if (
    estadoActual === "en_espera_1" &&
    estadoDestino !== "en_espera_1" &&
    estadoDestino !== "en_espera_2"
  ) {
    return reducirFechaLimiteSemanas(fechaLimiteActual, 2);
  }
  return null;
}

function getTimeFromDateLike(value: string | Date | undefined): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

function isReversionNota(nota?: string): boolean {
  return typeof nota === "string" && nota.startsWith("[REVERSIÓN]");
}

/**
 * Calcula el estado previo "real" para revertir en cadena.
 * Interpreta las entradas de reversión como UNDO (pop de la pila),
 * evitando rebotes tipo A->B y luego B->A al repetir el botón.
 */
function getEstadoPrevioParaReversion(
  historial: Array<{ estado: string; nota?: string }>,
  estadoActual: EstadoRequerimiento
): EstadoRequerimiento | null {
  const stack: EstadoRequerimiento[] = [];

  for (const h of historial) {
    const estado = h.estado as EstadoRequerimiento;
    if (isReversionNota(h.nota)) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    if (stack.length === 0 || stack[stack.length - 1] !== estado) {
      stack.push(estado);
    }
  }

  if (stack.length < 2) return null;
  const top = stack[stack.length - 1];
  if (top !== estadoActual) {
    // Fallback defensivo: si por alguna anomalía no coincide, usamos
    // igualmente el penúltimo de la secuencia efectiva.
    return stack[stack.length - 2] ?? null;
  }
  return stack[stack.length - 2] ?? null;
}

function toRequerimientoDTO(req: Requerimiento): RequerimientoDTO {
  const fechaLimite = req.fechaLimite
    ? typeof req.fechaLimite === "string"
      ? new Date(req.fechaLimite)
      : req.fechaLimite instanceof Date
        ? req.fechaLimite
        : (req.fechaLimite as Timestamp).toDate()
    : new Date();

  const estadosConPlazoActivo: EstadoRequerimiento[] = [
    "derivado",
    "en_proceso",
    "en_espera_1",
    "en_espera_2",
    "derivado_respuesta_final",
  ];
  const plazoActivo = estadosConPlazoActivo.includes(req.estado as EstadoRequerimiento);
  const { direccionMunicipal, direccionMunicipalLabel } = resolverDireccionMunicipal(
    req.tipoRequerimiento,
    req.direccionMunicipal,
    req.direccionMunicipalLabel
  );

  return {
    id: req.id,
    numeroSeguimiento: req.numeroSeguimiento,
    vecino: req.vecino,
    tipoRequerimiento: req.tipoRequerimiento,
    direccionMunicipal,
    direccionMunicipalLabel,
    categoria: req.categoria,
    descripcion: req.descripcion,
    documentos: req.documentos || [],
    estado: req.estado,
    historialEstados: (req.historialEstados || []).map((h) => ({
      estado: h.estado,
      fecha: timestampToString(h.fecha),
      usuarioId: h.usuarioId,
      usuarioNombre: h.usuarioNombre,
      usuarioRol: h.usuarioRol,
      nota: h.nota,
    })),
    notas: (req.notas || []).map((n) => ({
      contenido: n.contenido,
      usuarioId: n.usuarioId,
      usuarioNombre: n.usuarioNombre,
      usuarioRol: n.usuarioRol,
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
    pdfFichaIngreso: req.pdfFichaIngreso
      ? {
          nombreR2: req.pdfFichaIngreso.nombreR2,
          nombre: req.pdfFichaIngreso.nombre,
          generadoEn: timestampToString(req.pdfFichaIngreso.generadoEn),
        }
      : undefined,
    pdfFichaResuelto: req.pdfFichaResuelto
      ? {
          nombreR2: req.pdfFichaResuelto.nombreR2,
          nombre: req.pdfFichaResuelto.nombre,
          generadoEn: timestampToString(req.pdfFichaResuelto.generadoEn),
        }
      : undefined,
    creadoEn: timestampToString(req.creadoEn),
    actualizadoEn: timestampToString(req.actualizadoEn),
    diasHabilesRestantes: plazoActivo ? getDiasHabilesRestantes(fechaLimite) : undefined,
    vencido: plazoActivo ? isVencido(fechaLimite) : false,
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
    const { direccionMunicipal, direccionMunicipalLabel } = resolverDireccionMunicipal(
      input.tipoRequerimiento,
      input.direccionMunicipal,
      input.direccionMunicipalLabel
    );

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
  async afterCreate(input: CreateInput, numeroSeguimiento: string, requerimientoId: string): Promise<void> {
    const { direccionMunicipal, direccionMunicipalLabel } = resolverDireccionMunicipal(
      input.tipoRequerimiento,
      input.direccionMunicipal,
      input.direccionMunicipalLabel
    );
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

    void import("@/services/requerimiento-ficha-pdf.service").then(({ requerimientoFichaPdfService }) =>
      requerimientoFichaPdfService.generateIngresoForId(requerimientoId)
    );
  },

  /**
   * Get requerimiento by ID
   */
  async getById(id: string): Promise<RequerimientoDTO | null> {
    const req = await requerimientoRepository.getById(id);
    if (!req) return null;
    if (necesitaPersistirDireccionTransparencia(req.tipoRequerimiento, req.direccionMunicipal)) {
      const { direccionMunicipal, direccionMunicipalLabel } = resolverDireccionMunicipal(
        req.tipoRequerimiento,
        req.direccionMunicipal,
        req.direccionMunicipalLabel
      );
      await requerimientoRepository.update(id, { direccionMunicipal, direccionMunicipalLabel });
      return toRequerimientoDTO({ ...req, direccionMunicipal, direccionMunicipalLabel });
    }
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
    await Promise.all(
      result.data
        .filter((r) => necesitaPersistirDireccionTransparencia(r.tipoRequerimiento, r.direccionMunicipal))
        .map(async (r) => {
          const { direccionMunicipal, direccionMunicipalLabel } = resolverDireccionMunicipal(
            r.tipoRequerimiento,
            r.direccionMunicipal,
            r.direccionMunicipalLabel
          );
          await requerimientoRepository.update(r.id, { direccionMunicipal, direccionMunicipalLabel });
          r.direccionMunicipal = direccionMunicipal;
          r.direccionMunicipalLabel = direccionMunicipalLabel;
        })
    );
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
   * Reglas de plazo:
   * - "derivado": reinicia plazo base (10 hábiles).
   * - "en_espera_1" / "en_espera_2": suma 10 hábiles al entrar.
   * - salida desde "en_espera_1" / "en_espera_2": descuenta 10 hábiles.
   */
  async updateEstado(
    id: string,
    estado: EstadoRequerimiento,
    usuario: UsuarioRegistro,
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

    await requerimientoRepository.addEstadoToHistorial(
      id,
      estado,
      buildUsuarioRegistro(usuario),
      nota,
      {
      fechaLimite: fechaLimite ?? undefined,
      adminAsignadoRespuesta: limpiarAdminAsignado ? null : undefined,
      }
    );
    await dashboardMetricsService.onEstadoChange(current as unknown as Requerimiento, estado);
    logger.info({ id, estado, usuarioId: usuario.uid }, "Requerimiento status updated");
    invalidateDashboardAndListCaches();

    if (estado === "completado" || estado === "rechazado") {
      void import("@/services/requerimiento-ficha-pdf.service").then(({ requerimientoFichaPdfService }) =>
        requerimientoFichaPdfService.generateResueltoForId(id)
      );
    }
  },

  /**
   * El director deriva el requerimiento a un admin específico para que envíe
   * la respuesta final al vecino (Información, Vecinal, Transparencia, etc.).
   */
  async derivarRespuestaFinal(
    id: string,
    admin: { uid: string; nombre: string; email: string },
    director: UsuarioRegistro,
    nota?: string,
    existing?: RequerimientoDTO
  ): Promise<void> {
    const current = existing ?? await requerimientoRepository.getById(id);
    if (!current) throw new Error("Requerimiento no encontrado");

    const desdeProcesoOEspera =
      current.estado === "en_proceso" ||
      current.estado === "en_espera_1" ||
      current.estado === "en_espera_2";

    if (!desdeProcesoOEspera) {
      throw new Error("Solo se puede derivar a respuesta final desde en proceso o espera");
    }
    if (!current.evidenciaResolucion) {
      throw new Error("Debe adjuntar evidencia antes de derivar para respuesta final");
    }

    const asignacion: AdminAsignadoRespuesta = {
      uid: admin.uid,
      nombre: admin.nombre,
      email: admin.email,
      asignadoEn: new Date(),
      asignadoPor: director.uid,
    };

    await requerimientoRepository.addEstadoToHistorial(
      id,
      "derivado_respuesta_final",
      buildUsuarioRegistro(director),
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
    usuario: UsuarioRegistro,
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
    const previo = getEstadoPrevioParaReversion(hist, estadoAntes);
    if (!previo) {
      throw new Error("No hay un estado anterior al cual revertir");
    }

    // Aplicamos la misma regla de transición de plazos que en updateEstado.
    const fechaLimiteActual = toDateFromAny(current.fechaLimite);
    const nuevaFechaLimite =
      computeNuevaFechaLimitePorTransicion(fechaLimiteActual, estadoAntes, previo) ?? undefined;

    const limpiarAdmin = estadoAntes === "derivado_respuesta_final";

    await requerimientoRepository.addEstadoToHistorial(
      id,
      previo,
      buildUsuarioRegistro(usuario),
      `[REVERSIÓN] ${estadoAntes} -> ${previo}`,
      {
        fechaLimite: nuevaFechaLimite,
        adminAsignadoRespuesta: limpiarAdmin ? null : undefined,
      }
    );

    await dashboardMetricsService.onEstadoChange(current as unknown as Requerimiento, previo);
    invalidateDashboardAndListCaches();
    logger.info({ id, estadoAntes, previo, usuarioId: usuario.uid }, "Estado revertido");
    return { estadoAntes, estadoDespues: previo };
  },

  /**
   * Add a note to a requerimiento
   */
  async addNota(id: string, contenido: string, usuario: UsuarioRegistro): Promise<void> {
    await requerimientoRepository.addNota(id, {
      contenido,
      usuarioId: usuario.uid,
      usuarioNombre: usuario.nombre,
      usuarioRol: usuario.rol,
    });
    logger.info({ id, usuarioId: usuario.uid }, "Note added to requerimiento");
    invalidateDashboardAndListCaches();
  },

  async updateDatos(id: string, input: UpdateDataInput, existing?: RequerimientoDTO): Promise<void> {
    const current = existing ?? await requerimientoRepository.getById(id);
    if (!current) {
      throw new Error("Requerimiento no encontrado");
    }

    const categoria = input.categoria ?? "";
    const { direccionMunicipal, direccionMunicipalLabel } = resolverDireccionMunicipal(
      input.tipoRequerimiento,
      input.direccionMunicipal,
      input.direccionMunicipalLabel
    );

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
    usuario: UsuarioRegistro,
    existing?: RequerimientoDTO
  ): Promise<void> {
    const raw = existing ?? (await requerimientoRepository.getById(id));
    if (!raw) {
      throw new Error("Requerimiento no encontrado");
    }
    const current: RequerimientoDTO = existing ?? toRequerimientoDTO(raw as Requerimiento);

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

    const respuestaAutomaticaCompletado =
      input.cierre === "completado" &&
      usaRespuestaAutomaticaAdminCompletado(current.tipoRequerimiento);

    const mensajeError = validateRespuestaVecinoMensaje({
      mensaje: input.mensaje,
      cierre: input.cierre,
      respuestaAutomaticaCompletado,
    });
    if (mensajeError) {
      throw new Error(mensajeError);
    }

    let asunto = input.asunto;
    let mensaje = input.mensaje.trim();
    if (respuestaAutomaticaCompletado) {
      const auto = buildRespuestaAutomaticaCompletado(current);
      asunto = auto.asunto;
      mensaje = auto.mensaje;
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
        asunto,
        mensaje,
        evidencia: evidenciaInfo as { tipo: "documento" | "link"; nombre?: string; url?: string } | undefined,
      },
      evidenciaAdjunta
    );

    await requerimientoRepository.addRespuestaVecino(id, {
      emailDestino: input.emailDestino,
      asunto,
      mensaje,
      usuarioId: usuario.uid,
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
        buildUsuarioRegistro(usuario),
        `Cierre por envío de respuesta al vecino`,
        { adminAsignadoRespuesta: null }
      );
      await dashboardMetricsService.onEstadoChange(
        raw as unknown as Requerimiento,
        input.cierre
      );
    }

    logger.info({ id, usuarioId: usuario.uid, emailDestino: input.emailDestino }, "Citizen response registered");
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
   * Dashboard stats — siempre se cuentan desde la colección real para que las
   * tarjetas del panel siempre coincidan con el listado. El caché de 2 min
   * evita scans repetidos en ventanas muy cortas.
   *
   * Antes preferíamos un doc agregado (`dashboard_metrics/global`) mantenido
   * por contadores incrementales, pero quedaba desfasado cuando el backfill
   * inicial se hizo con un conjunto de estados distinto al actual, o cuando
   * alguna mutación no pasaba por `onEstadoChange`. La fuente de verdad debe
   * ser la colección.
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
    // Para el dashboard global usamos métricas agregadas (1 lectura) y
    // calculamos urgentes activos aparte. Si el agregado aún no existe,
    // hacemos fallback al conteo en vivo.
    if (!direccionRestriccion || direccionRestriccion.length === 0) {
      const [core, urgentesActivos] = await Promise.all([
        dashboardMetricsService.getCoreStats(),
        requerimientoRepository.countUrgentesActivos(),
      ]);
      if (core) {
        return { ...core, urgentesActivos };
      }
    }

    return requerimientoRepository.getStats(direccionRestriccion);
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
   * Lista de últimos (5), urgentes (5), top direcciones (totales y resueltas)
   * calculadas en caliente sobre todos los requerimientos. Antes se leía un
   * agregado pre-computado que podía desfasarse del estado real; ahora la
   * lista y el dashboard usan exactamente los mismos datos.
   */
  async getDashboardHighlights(direccionRestriccion?: string[]): Promise<{
    ultimos: RequerimientoDTO[];
    urgentes: RequerimientoDTO[];
    direccionesTop: { direccion: string; total: number }[];
    direccionesResueltasTop: { direccion: string; totalResueltos: number }[];
  }> {
    const cacheKey = `dashboard:highlights:${direccionRestriccion?.sort().join(",") ?? "global"}`;
    return cached(cacheKey, 120_000, async () => {
      const [ultimosResult, direccionesTop, direccionesResueltasTop] = await Promise.all([
        requerimientoRepository.list({ limit: 5 }, direccionRestriccion),
        dashboardMetricsService.getTopDirections(5),
        dashboardMetricsService.getTopResolvedDirections(5),
      ]);

      const ultimos = ultimosResult.data.map(toRequerimientoDTO);

      const candidatos = await requerimientoRepository.list({ limit: 30 }, direccionRestriccion);
      const urgentes = candidatos.data.map(toRequerimientoDTO)
        .filter((r) => r.estado !== "completado" && r.estado !== "rechazado")
        .sort((a, b) => getTimeFromDateLike(a.fechaIngreso) - getTimeFromDateLike(b.fechaIngreso))
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
