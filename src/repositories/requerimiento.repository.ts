import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/firestore-collections";
import type { ChartSourceRow } from "@/lib/dashboard/chart-analytics";
import { Requerimiento, EstadoRequerimiento } from "@/types/requerimiento.types";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import logger from "@/lib/logger";
import { incrementMetric } from "@/lib/metrics";

const collection = () => adminDb.collection(COLLECTIONS.REQUERIMIENTOS);

export interface RequerimientoFilters {
  estado?: EstadoRequerimiento;
  tipoRequerimiento?: string;
  direccionMunicipal?: string;
  categoria?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
  limit?: number;
  page?: number;
  includeTotal?: boolean;
  cursor?: string;
  sortBy?: "creadoEn" | "fechaIngreso" | "fechaLimite" | "numeroSeguimiento";
  sortDir?: "asc" | "desc";
}

function hasFechaFilters(filters: RequerimientoFilters): boolean {
  return Boolean(filters.fechaDesde || filters.fechaHasta);
}

function buildFilteredQuery(
  filters: RequerimientoFilters,
  direccionRestriccion?: string[]
) {
  // Default ordering keeps current UX, but allows explicit sorting from UI.
  const sortField = filters.sortBy || (hasFechaFilters(filters) ? "fechaIngreso" : "creadoEn");
  const sortDir = filters.sortDir || "desc";
  let query = collection().orderBy(sortField, sortDir);

  if (direccionRestriccion && direccionRestriccion.length > 0) {
    if (direccionRestriccion.length === 1) {
      query = query.where("direccionMunicipal", "==", direccionRestriccion[0]);
    } else {
      query = query.where("direccionMunicipal", "in", direccionRestriccion.slice(0, 10));
    }
  }

  if (filters.estado) {
    query = query.where("estado", "==", filters.estado);
  }

  if (filters.tipoRequerimiento) {
    query = query.where("tipoRequerimiento", "==", filters.tipoRequerimiento);
  }

  if (filters.direccionMunicipal && (!direccionRestriccion || direccionRestriccion.length === 0)) {
    query = query.where("direccionMunicipal", "==", filters.direccionMunicipal);
  }

  if (filters.categoria) {
    query = query.where("categoria", "==", filters.categoria);
  }

  if (filters.fechaDesde) {
    query = query.where("fechaIngreso", ">=", Timestamp.fromDate(filters.fechaDesde));
  }

  if (filters.fechaHasta) {
    query = query.where("fechaIngreso", "<=", Timestamp.fromDate(filters.fechaHasta));
  }

  return query;
}

async function executePageQuery(
  query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData>,
  page: number,
  limit: number
): Promise<FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>> {
  const skip = (page - 1) * limit;
  return query.offset(skip).limit(limit).get();
}

function applyInMemoryFilters(
  data: Requerimiento[],
  filters: RequerimientoFilters,
  direccionRestriccion?: string[]
): Requerimiento[] {
  return data
    .filter((req) => {
      if (direccionRestriccion && direccionRestriccion.length > 0 && !direccionRestriccion.includes(req.direccionMunicipal)) return false;
      if (filters.estado && req.estado !== filters.estado) return false;
      if (filters.tipoRequerimiento && req.tipoRequerimiento !== filters.tipoRequerimiento) return false;
      if (filters.direccionMunicipal && (!direccionRestriccion || direccionRestriccion.length === 0) && req.direccionMunicipal !== filters.direccionMunicipal) return false;
      if (filters.categoria && req.categoria !== filters.categoria) return false;

      const fechaIngreso = new Date(req.fechaIngreso as string | Date);
      if (filters.fechaDesde && fechaIngreso < filters.fechaDesde) return false;
      if (filters.fechaHasta && fechaIngreso > filters.fechaHasta) return false;

      return true;
    })
    .sort((a, b) => {
      const field = filters.sortBy || (hasFechaFilters(filters) ? "fechaIngreso" : "creadoEn");
      const dir = filters.sortDir || "desc";
      if (field === "numeroSeguimiento") {
        const av = String(a.numeroSeguimiento || "");
        const bv = String(b.numeroSeguimiento || "");
        return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const aDate = new Date(a[field] as string | Date).getTime();
      const bDate = new Date(b[field] as string | Date).getTime();
      return dir === "asc" ? aDate - bDate : bDate - aDate;
    });
}

function isMissingIndexError(error: unknown): boolean {
  const code = (error as { code?: number | string })?.code;
  const message = (error as { message?: string })?.message || "";
  return code === 9 || code === "9" || message.includes("requires an index");
}

function allowInMemoryFallback(): boolean {
  const explicit = process.env.ALLOW_FIRESTORE_IN_MEMORY_FALLBACK;
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  return process.env.NODE_ENV !== "production";
}

export const requerimientoRepository = {
  /**
   * Create a new requerimiento
   */
  async create(data: Omit<Requerimiento, "id">): Promise<string> {
    const docRef = collection().doc();
    await docRef.set({
      ...data,
      creadoEn: FieldValue.serverTimestamp(),
      actualizadoEn: FieldValue.serverTimestamp(),
    });
    return docRef.id;
  },

  /**
   * Get a requerimiento by ID
   */
  async getById(id: string): Promise<Requerimiento | null> {
    const doc = await collection().doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Requerimiento;
  },

  /**
   * Get a requerimiento by tracking number
   */
  async getByNumeroSeguimiento(numero: string): Promise<Requerimiento | null> {
    const snapshot = await collection()
      .where("numeroSeguimiento", "==", numero)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Requerimiento;
  },

  /**
   * List requerimientos with filters and cursor-based pagination
   */
  async list(
    filters: RequerimientoFilters,
    direccionRestriccion?: string[]
  ): Promise<{ data: Requerimiento[]; nextCursor?: string; total?: number }> {
    const limit = filters.limit || 20;
    const page = filters.page || 1;
    const includeTotal = Boolean(filters.includeTotal);
    const maxPage = 200;

    try {
      const baseQuery = buildFilteredQuery(filters, direccionRestriccion);
      let total: number | undefined;
      if (includeTotal) {
        const countSnapshot = await baseQuery.count().get();
        total = Number(countSnapshot.data().count || 0);
      }

      let query = baseQuery;
      if (filters.page) {
        if (page > maxPage) {
          throw new Error(`Pagination page exceeds supported maximum (${maxPage})`);
        }
      } else {
        query = query.limit(limit + 1);
        if (filters.cursor) {
          const cursorDoc = await collection().doc(filters.cursor).get();
          if (cursorDoc.exists) {
            query = query.startAfter(cursorDoc);
          }
        }
      }

      // Limit selected fields on listing endpoints to reduce read payload.
      if (filters.page || filters.cursor || filters.limit) {
        query = query.select(
          "numeroSeguimiento",
          "vecino",
          "tipoRequerimiento",
          "direccionMunicipal",
          "direccionMunicipalLabel",
          "categoria",
          "estado",
          "respuestasVecino",
          "fechaIngreso",
          "creadoEn",
          "actualizadoEn"
        );
      }

      const snapshot = filters.page
        ? await executePageQuery(query, page, limit)
        : await query.get();
      const docs = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Requerimiento
      );

      let nextCursor: string | undefined;
      if (docs.length > limit) {
        docs.pop();
        nextCursor = docs[docs.length - 1]?.id;
      }

      if (filters.page) {
        return { data: docs, total };
      }
      return { data: docs, nextCursor, total };
    } catch (error) {
      if (!isMissingIndexError(error)) throw error;
      if (!allowInMemoryFallback()) {
        throw new Error("Missing Firestore index for requested filters");
      }
      incrementMetric("firestore.requerimientos.list.fallback");
      logger.warn({ filters, direccionRestriccion }, "Using in-memory fallback for requerimientos list");

      // Fallback: avoid hard failure when required composite indexes are missing.
      const snapshot = await collection().get();
      const allDocs = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Requerimiento
      );
      const filtered = applyInMemoryFilters(allDocs, filters, direccionRestriccion);

      let startIndex = 0;
      if (filters.cursor) {
        const cursorIndex = filtered.findIndex((req) => req.id === filters.cursor);
        startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
      }

      const pageData = filtered.slice(startIndex, startIndex + limit + 1);
      let nextCursor: string | undefined;
      if (pageData.length > limit) {
        pageData.pop();
        nextCursor = pageData[pageData.length - 1]?.id;
      }

      if (filters.page) {
        const offset = (page - 1) * limit;
        const data = filtered.slice(offset, offset + limit);
        return { data, total: includeTotal ? filtered.length : undefined };
      }

      return { data: pageData, nextCursor, total: includeTotal ? filtered.length : undefined };
    }
  },

  /**
   * Update a requerimiento
   */
  async update(id: string, data: Partial<Requerimiento>): Promise<void> {
    await collection().doc(id).update({
      ...data,
      actualizadoEn: FieldValue.serverTimestamp(),
    });
  },

  /** Quita el campo evidenciaResolucion del documento */
  async clearEvidenciaResolucion(id: string): Promise<void> {
    await collection().doc(id).update({
      evidenciaResolucion: FieldValue.delete(),
      actualizadoEn: FieldValue.serverTimestamp(),
    });
  },

  /**
   * Add a note to a requerimiento
   */
  async addNota(
    id: string,
    nota: { contenido: string; usuarioId: string }
  ): Promise<void> {
    await collection()
      .doc(id)
      .update({
        notas: FieldValue.arrayUnion({
          ...nota,
          fecha: Timestamp.now(),
        }),
        actualizadoEn: FieldValue.serverTimestamp(),
      });
  },

  async addRespuestaVecino(
    id: string,
    respuesta: { emailDestino: string; asunto: string; mensaje: string; usuarioId: string }
  ): Promise<void> {
    await collection()
      .doc(id)
      .update({
        respuestasVecino: FieldValue.arrayUnion({
          ...respuesta,
          fecha: Timestamp.now(),
        }),
        actualizadoEn: FieldValue.serverTimestamp(),
      });
  },

  /**
   * Add a status change to the history
   */
  async addEstadoToHistorial(
    id: string,
    estado: EstadoRequerimiento,
    usuarioId?: string,
    nota?: string
  ): Promise<void> {
    await collection()
      .doc(id)
      .update({
        estado,
        historialEstados: FieldValue.arrayUnion({
          estado,
          fecha: Timestamp.now(),
          ...(usuarioId && { usuarioId }),
          ...(nota && { nota }),
        }),
        actualizadoEn: FieldValue.serverTimestamp(),
        ...(estado === "completado" && { fechaResolucion: FieldValue.serverTimestamp() }),
      });
  },

  /**
   * Delete a requerimiento
   */
  async delete(id: string): Promise<void> {
    await collection().doc(id).delete();
  },

  /**
   * Get statistics for dashboard
   */
  async getStats(direccionRestriccion?: string[]): Promise<{
    total: number;
    pendiente: number;
    derivado: number;
    en_proceso: number;
    completado: number;
    rechazado: number;
    urgentesActivos: number;
  }> {
    let query = collection().select("estado", "fechaIngreso");

    if (direccionRestriccion && direccionRestriccion.length > 0) {
      if (direccionRestriccion.length === 1) {
        query = query.where("direccionMunicipal", "==", direccionRestriccion[0]);
      } else {
        query = query.where("direccionMunicipal", "in", direccionRestriccion.slice(0, 10));
      }
    }

    const snapshot = await query.get();
    const stats = {
      total: 0,
      pendiente: 0,
      derivado: 0,
      en_proceso: 0,
      completado: 0,
      rechazado: 0,
      urgentesActivos: 0,
    };

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const estadoKeys = new Set<string>(["pendiente", "derivado", "en_proceso", "completado", "rechazado"]);
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      stats.total++;
      const estado = data.estado as string;
      if (estadoKeys.has(estado)) {
        (stats as Record<string, number>)[estado]++;
      }

      if (estado !== "completado" && estado !== "rechazado" && data.fechaIngreso) {
        const fechaIngreso = (data.fechaIngreso as Timestamp).toDate();
        const diffMs = now.getTime() - fechaIngreso.getTime();
        const diasCalendario = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diasCalendario >= 20) {
          stats.urgentesActivos++;
        }
      }
    });

    return stats;
  },

  /**
   * Cuenta solo requerimientos activos con 20+ días desde ingreso (select mínimo + filtro servidor).
   */
  async countUrgentesActivos(): Promise<number> {
    const snap = await collection()
      .select("fechaIngreso")
      .where("estado", "not-in", ["completado", "rechazado"])
      .get();
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    let count = 0;
    for (const doc of snap.docs) {
      const fi = (doc.data().fechaIngreso as Timestamp)?.toDate?.();
      if (fi && Math.floor((now.getTime() - fi.getTime()) / 86_400_000) >= 20) count++;
    }
    return count;
  },

  /**
   * Filas mínimas para gráficos del dashboard (opcionalmente filtradas; el API del panel no aplica filtro por rol).
   */
  async getDashboardChartRows(direccionRestriccion?: string[]): Promise<ChartSourceRow[]> {
    let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = collection().select(
      "estado",
      "direccionMunicipal",
      "direccionMunicipalLabel",
      "categoria",
      "fechaIngreso"
    );

    if (direccionRestriccion && direccionRestriccion.length > 0) {
      if (direccionRestriccion.length === 1) {
        query = query.where("direccionMunicipal", "==", direccionRestriccion[0]);
      } else {
        query = query.where("direccionMunicipal", "in", direccionRestriccion.slice(0, 10));
      }
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => doc.data() as ChartSourceRow);
  },

  /**
   * Get all requerimientos for reports (no pagination)
   */
  async getForReport(
    filters: RequerimientoFilters,
    direccionRestriccion?: string[]
  ): Promise<Requerimiento[]> {
    try {
      const snapshot = await buildFilteredQuery(filters, direccionRestriccion).get();
      return snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Requerimiento
      );
    } catch (error) {
      if (!isMissingIndexError(error)) throw error;
      incrementMetric("firestore.requerimientos.report.fallback");
      logger.warn({ filters, direccionRestriccion }, "Using in-memory fallback for requerimientos report");

      const snapshot = await collection().get();
      const allDocs = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Requerimiento
      );
      return applyInMemoryFilters(allDocs, filters, direccionRestriccion);
    }
  },
};
