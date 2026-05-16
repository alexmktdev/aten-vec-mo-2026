import { requerimientoRepository, RequerimientoFilters } from "@/repositories/requerimiento.repository";
import { Requerimiento, RequerimientoDTO, EstadoRequerimiento, VecinoData, TipoRequerimiento, DocumentoRequerimiento, RespuestaVecinoInput } from "@/types/requerimiento.types";

// Input type that accepts Zod-parsed data (Zod v4 infers enums as string)
interface CreateInput {
  vecino: Omit<VecinoData, 'tipoInmueble'> & { tipoInmueble: string };
  tipoRequerimiento: string;
  direccionMunicipal: string;
  direccionMunicipalLabel?: string;
  categoria: string;
  descripcion: string;
  documentos?: DocumentoRequerimiento[];
}
type UpdateDataInput = CreateInput;
import { generateNumeroSeguimiento } from "@/lib/utils/numero-seguimiento";
import { calcularFechaLimite, getDiasHabilesRestantes, isVencido } from "@/lib/utils/dias-habiles";
import { getDireccionLabel } from "@/constants/direcciones";
import { notificacionService } from "@/services/notificacion.service";
import logger from "@/lib/logger";
import { Timestamp } from "firebase-admin/firestore";
import { invalidateCacheByPrefix } from "@/lib/server-cache";
import { dashboardMetricsService } from "@/services/dashboard-metrics.service";

function timestampToString(ts: Timestamp | Date | string | undefined): string {
  if (!ts) return "";
  if (typeof ts === "string") return ts;
  if (ts instanceof Date) return ts.toISOString();
  if ("toDate" in ts) return ts.toDate().toISOString();
  return "";
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
   * Create a new requerimiento — public endpoint
   */
  async create(input: CreateInput): Promise<{ id: string; numeroSeguimiento: string }> {
    const numeroSeguimiento = await generateNumeroSeguimiento();
    const now = new Date();
    const fechaLimite = calcularFechaLimite(now);
    const direccionMunicipalLabel = input.direccionMunicipalLabel || getDireccionLabel(input.direccionMunicipal);

    const requerimientoData = {
      numeroSeguimiento,
      vecino: input.vecino as unknown as VecinoData,
      tipoRequerimiento: input.tipoRequerimiento as TipoRequerimiento,
      direccionMunicipal: input.direccionMunicipal,
      direccionMunicipalLabel,
      categoria: input.categoria,
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
    await dashboardMetricsService.onCreate(requerimientoData);

    // Send notification emails (non-blocking)
    try {
      await notificacionService.enviarConfirmacionVecino({
        numeroSeguimiento,
        vecino: input.vecino as unknown as VecinoData,
        tipoRequerimiento: input.tipoRequerimiento,
        direccionMunicipalLabel,
        categoria: input.categoria,
        descripcion: input.descripcion,
        fechaIngreso: now.toLocaleDateString("es-CL"),
      });

      await notificacionService.enviarAvisoAdmin({
        numeroSeguimiento,
        vecino: input.vecino as unknown as VecinoData,
        tipoRequerimiento: input.tipoRequerimiento,
        direccionMunicipalLabel,
        categoria: input.categoria,
        descripcion: input.descripcion,
        fechaIngreso: now.toLocaleDateString("es-CL"),
      });
    } catch (error) {
      logger.error({ error }, "Error sending notification emails");
    }

    logger.info({ id, numeroSeguimiento }, "Requerimiento created successfully");
    invalidateCacheByPrefix("dashboard:stats:");
    invalidateCacheByPrefix("dashboard:highlights:");
    return { id, numeroSeguimiento };
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
   * Update requerimiento status
   */
  async updateEstado(
    id: string,
    estado: EstadoRequerimiento,
    usuarioId: string,
    nota?: string
  ): Promise<void> {
    const current = await requerimientoRepository.getById(id);
    if (!current) return;
    await requerimientoRepository.addEstadoToHistorial(id, estado, usuarioId, nota);
    await dashboardMetricsService.onEstadoChange(current, estado);
    logger.info({ id, estado, usuarioId }, "Requerimiento status updated");
    invalidateCacheByPrefix("dashboard:stats:");
    invalidateCacheByPrefix("dashboard:highlights:");
  },

  /**
   * Add a note to a requerimiento
   */
  async addNota(id: string, contenido: string, usuarioId: string): Promise<void> {
    await requerimientoRepository.addNota(id, { contenido, usuarioId });
    logger.info({ id, usuarioId }, "Note added to requerimiento");
    invalidateCacheByPrefix("dashboard:highlights:");
  },

  async updateDatos(id: string, input: UpdateDataInput): Promise<void> {
    const current = await requerimientoRepository.getById(id);
    if (!current) {
      throw new Error("Requerimiento no encontrado");
    }

    const direccionMunicipalLabel = input.direccionMunicipalLabel || getDireccionLabel(input.direccionMunicipal);

    await requerimientoRepository.update(id, {
      vecino: input.vecino as unknown as VecinoData,
      tipoRequerimiento: input.tipoRequerimiento as TipoRequerimiento,
      direccionMunicipal: input.direccionMunicipal,
      direccionMunicipalLabel,
      categoria: input.categoria,
      descripcion: input.descripcion,
      documentos: input.documentos || [],
    });

    await dashboardMetricsService.onDataChange(
      {
        estado: current.estado,
        direccionMunicipalLabel: current.direccionMunicipalLabel,
        categoria: current.categoria,
      },
      {
        estado: current.estado,
        direccionMunicipalLabel,
        categoria: input.categoria,
      }
    );

    logger.info({ id }, "Requerimiento data updated");
    invalidateCacheByPrefix("dashboard:stats:");
    invalidateCacheByPrefix("dashboard:highlights:");
  },

  async updateDireccionMunicipal(
    id: string,
    direccionMunicipal: string,
    direccionMunicipalLabel: string
  ): Promise<void> {
    const current = await requerimientoRepository.getById(id);
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
      {
        estado: current.estado,
        direccionMunicipalLabel: current.direccionMunicipalLabel,
        categoria: current.categoria,
      },
      {
        estado: current.estado,
        direccionMunicipalLabel,
        categoria: current.categoria,
      }
    );

    invalidateCacheByPrefix("dashboard:stats:");
    invalidateCacheByPrefix("dashboard:highlights:");
  },

  async enviarRespuestaVecino(
    id: string,
    input: RespuestaVecinoInput,
    usuarioId: string
  ): Promise<void> {
    const current = await requerimientoRepository.getById(id);
    if (!current) {
      throw new Error("Requerimiento no encontrado");
    }
    if (current.estado !== "completado" && current.estado !== "rechazado") {
      throw new Error("Solo se puede enviar respuesta al vecino cuando el requerimiento está completado o rechazado");
    }

    await notificacionService.enviarRespuestaVecino(input.emailDestino, {
      numeroSeguimiento: current.numeroSeguimiento,
      vecino: current.vecino,
      asunto: input.asunto,
      mensaje: input.mensaje,
      direccionMunicipalLabel: current.direccionMunicipalLabel,
      categoria: current.categoria,
    });

    await requerimientoRepository.addRespuestaVecino(id, {
      emailDestino: input.emailDestino,
      asunto: input.asunto,
      mensaje: input.mensaje,
      usuarioId,
    });

    logger.info({ id, usuarioId, emailDestino: input.emailDestino }, "Citizen response registered");
  },

  /**
   * Delete a requerimiento (superadmin only)
   */
  async delete(id: string): Promise<void> {
    const current = await requerimientoRepository.getById(id);
    if (!current) return;
    await requerimientoRepository.delete(id);
    await dashboardMetricsService.onDelete(current);
    logger.info({ id }, "Requerimiento deleted");
    invalidateCacheByPrefix("dashboard:stats:");
    invalidateCacheByPrefix("dashboard:highlights:");
  },

  /**
   * Get dashboard stats
   */
  async getStats(direccionRestriccion?: string[]) {
    if (!direccionRestriccion || direccionRestriccion.length === 0) {
      const core = await dashboardMetricsService.getCoreStats();
      if (core) {
        // "vencidos" still computed live because it is time-dependent.
        const live = await requerimientoRepository.getStats(direccionRestriccion);
        return { ...core, vencidos: live.vencidos };
      }
    }
    return requerimientoRepository.getStats(direccionRestriccion);
  },

  /**
   * Get dashboard highlights: latest and most urgent requerimientos
   */
  async getDashboardHighlights(direccionRestriccion?: string[]): Promise<{
    ultimos: RequerimientoDTO[];
    urgentes: RequerimientoDTO[];
    direccionesTop: { direccion: string; total: number }[];
    direccionesResueltasTop: { direccion: string; totalResueltos: number }[];
    porcentajeUrgentesActivos: number;
  }> {
    const ultimosResult = await requerimientoRepository.list({ limit: 5 }, direccionRestriccion);
    const ultimos = ultimosResult.data.map(toRequerimientoDTO);

    if (!direccionRestriccion || direccionRestriccion.length === 0) {
      let [direccionesTop, direccionesResueltasTop] = await Promise.all([
        dashboardMetricsService.getTopDirections(5),
        dashboardMetricsService.getTopResolvedDirections(5),
      ]);

      const candidatosResult = await requerimientoRepository.list({ limit: 150 }, direccionRestriccion);
      const candidatosDto = candidatosResult.data.map(toRequerimientoDTO);
      const urgentes = candidatosDto
        .filter((r) => r.estado !== "completado" && r.estado !== "rechazado")
        .sort((a, b) => getTimeFromDateLike(a.fechaIngreso) - getTimeFromDateLike(b.fechaIngreso))
        .slice(0, 5);
      const activos = candidatosDto.filter(
        (r) => r.estado === "pendiente" || r.estado === "derivado" || r.estado === "en_proceso"
      );
      const urgentesActivos = activos.filter(
        (r) => !r.vencido && (r.diasHabilesRestantes ?? Number.POSITIVE_INFINITY) <= 7
      );
      const porcentajeUrgentesActivos =
        activos.length > 0 ? Math.round((urgentesActivos.length / activos.length) * 100) : 0;

      // Fallback when aggregated metrics are still empty (e.g., before historical backfill).
      if (direccionesTop.length === 0 || direccionesResueltasTop.length === 0) {
        const universo = await requerimientoRepository.getForReport({}, direccionRestriccion);
        const universoDto = universo.map(toRequerimientoDTO);

        if (direccionesTop.length === 0) {
          const conteoDirecciones = new Map<string, number>();
          universoDto.forEach((r) => {
            const key = r.direccionMunicipalLabel || r.direccionMunicipal || "Sin dirección";
            conteoDirecciones.set(key, (conteoDirecciones.get(key) || 0) + 1);
          });
          direccionesTop = Array.from(conteoDirecciones.entries())
            .map(([direccion, total]) => ({ direccion, total }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);
        }

        if (direccionesResueltasTop.length === 0) {
          const conteoResueltos = new Map<string, number>();
          universoDto
            .filter((r) => r.estado === "completado")
            .forEach((r) => {
              const key = r.direccionMunicipalLabel || r.direccionMunicipal || "Sin dirección";
              conteoResueltos.set(key, (conteoResueltos.get(key) || 0) + 1);
            });
          direccionesResueltasTop = Array.from(conteoResueltos.entries())
            .map(([direccion, totalResueltos]) => ({ direccion, totalResueltos }))
            .sort((a, b) => b.totalResueltos - a.totalResueltos)
            .slice(0, 5);
        }
      }

      return { ultimos, urgentes, direccionesTop, direccionesResueltasTop, porcentajeUrgentesActivos };
    }

    // Use full filtered universe to avoid missing records in tops/percentages.
    const candidatos = await requerimientoRepository.getForReport({}, direccionRestriccion);
    const candidatosDto = candidatos.map(toRequerimientoDTO);

    const urgentes = candidatosDto
      .filter((r) => r.estado !== "completado" && r.estado !== "rechazado")
      .sort((a, b) => getTimeFromDateLike(a.fechaIngreso) - getTimeFromDateLike(b.fechaIngreso))
      .slice(0, 5);

    const activos = candidatosDto.filter(
      (r) => r.estado === "pendiente" || r.estado === "derivado" || r.estado === "en_proceso"
    );
    const urgentesActivos = activos.filter(
      (r) => !r.vencido && (r.diasHabilesRestantes ?? Number.POSITIVE_INFINITY) <= 7
    );
    const porcentajeUrgentesActivos =
      activos.length > 0 ? Math.round((urgentesActivos.length / activos.length) * 100) : 0;

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

    return { ultimos, urgentes, direccionesTop, direccionesResueltasTop, porcentajeUrgentesActivos };
  },

  /**
   * Get requerimientos for report generation
   */
  async getForReport(filters: RequerimientoFilters, direccionRestriccion?: string[]): Promise<RequerimientoDTO[]> {
    const data = await requerimientoRepository.getForReport(filters, direccionRestriccion);
    return data.map(toRequerimientoDTO);
  },
};
