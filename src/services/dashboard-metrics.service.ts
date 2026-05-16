import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/firestore-collections";
import { Requerimiento, EstadoRequerimiento } from "@/types/requerimiento.types";

const metricsRoot = () => adminDb.collection(COLLECTIONS.DASHBOARD_METRICS).doc("global");
const directionsCol = () => metricsRoot().collection("by_direction");
const categoriesCol = () => metricsRoot().collection("by_category");
const monthsCol = () => metricsRoot().collection("by_month");

function keyFromLabel(label: string): string {
  return Buffer.from(label || "sin_etiqueta").toString("base64url");
}

function getMonthKey(dateLike: string | Date): string {
  const d = new Date(dateLike);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export const dashboardMetricsService = {
  async onCreate(req: Pick<Requerimiento, "estado" | "direccionMunicipalLabel" | "categoria" | "fechaIngreso">) {
    const batch = adminDb.batch();
    const dirLabel = req.direccionMunicipalLabel || "Sin dirección";
    const catLabel = req.categoria || "Sin categoría";
    const month = getMonthKey(req.fechaIngreso as string | Date);

    batch.set(metricsRoot(), {
      total: FieldValue.increment(1),
      [`estado.${req.estado}`]: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    batch.set(directionsCol().doc(keyFromLabel(dirLabel)), {
      label: dirLabel,
      total: FieldValue.increment(1),
      resolved: FieldValue.increment(req.estado === "completado" ? 1 : 0),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    batch.set(categoriesCol().doc(keyFromLabel(catLabel)), {
      label: catLabel,
      total: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    batch.set(monthsCol().doc(month), {
      month,
      total: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    await batch.commit();
  },

  async onEstadoChange(prev: Pick<Requerimiento, "estado" | "direccionMunicipalLabel">, nextEstado: EstadoRequerimiento) {
    if (prev.estado === nextEstado) return;

    const batch = adminDb.batch();
    const dirLabel = prev.direccionMunicipalLabel || "Sin dirección";
    batch.set(metricsRoot(), {
      [`estado.${prev.estado}`]: FieldValue.increment(-1),
      [`estado.${nextEstado}`]: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    if (prev.estado === "completado" && nextEstado !== "completado") {
      batch.set(directionsCol().doc(keyFromLabel(dirLabel)), {
        label: dirLabel,
        resolved: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    if (prev.estado !== "completado" && nextEstado === "completado") {
      batch.set(directionsCol().doc(keyFromLabel(dirLabel)), {
        label: dirLabel,
        resolved: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    await batch.commit();
  },

  async onDelete(req: Pick<Requerimiento, "estado" | "direccionMunicipalLabel" | "categoria" | "fechaIngreso">) {
    const batch = adminDb.batch();
    const dirLabel = req.direccionMunicipalLabel || "Sin dirección";
    const catLabel = req.categoria || "Sin categoría";
    const month = getMonthKey(req.fechaIngreso as string | Date);

    batch.set(metricsRoot(), {
      total: FieldValue.increment(-1),
      [`estado.${req.estado}`]: FieldValue.increment(-1),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    batch.set(directionsCol().doc(keyFromLabel(dirLabel)), {
      label: dirLabel,
      total: FieldValue.increment(-1),
      resolved: FieldValue.increment(req.estado === "completado" ? -1 : 0),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    batch.set(categoriesCol().doc(keyFromLabel(catLabel)), {
      label: catLabel,
      total: FieldValue.increment(-1),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    batch.set(monthsCol().doc(month), {
      month,
      total: FieldValue.increment(-1),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    await batch.commit();
  },

  async onDataChange(
    prev: Pick<Requerimiento, "estado" | "direccionMunicipalLabel" | "categoria">,
    next: Pick<Requerimiento, "estado" | "direccionMunicipalLabel" | "categoria">
  ) {
    const prevDir = prev.direccionMunicipalLabel || "Sin dirección";
    const nextDir = next.direccionMunicipalLabel || "Sin dirección";
    const prevCat = prev.categoria || "Sin categoría";
    const nextCat = next.categoria || "Sin categoría";

    if (prevDir === nextDir && prevCat === nextCat) return;

    const batch = adminDb.batch();

    if (prevDir !== nextDir) {
      batch.set(
        directionsCol().doc(keyFromLabel(prevDir)),
        {
          label: prevDir,
          total: FieldValue.increment(-1),
          resolved: FieldValue.increment(prev.estado === "completado" ? -1 : 0),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      batch.set(
        directionsCol().doc(keyFromLabel(nextDir)),
        {
          label: nextDir,
          total: FieldValue.increment(1),
          resolved: FieldValue.increment(next.estado === "completado" ? 1 : 0),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    if (prevCat !== nextCat) {
      batch.set(
        categoriesCol().doc(keyFromLabel(prevCat)),
        {
          label: prevCat,
          total: FieldValue.increment(-1),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      batch.set(
        categoriesCol().doc(keyFromLabel(nextCat)),
        {
          label: nextCat,
          total: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    await batch.commit();
  },

  async getCoreStats(): Promise<{
    total: number;
    pendiente: number;
    derivado: number;
    en_proceso: number;
    completado: number;
    rechazado: number;
  } | null> {
    const snap = await metricsRoot().get();
    if (!snap.exists) return null;
    const data = snap.data() as {
      total?: number;
      estado?: Partial<Record<EstadoRequerimiento, number>>;
    };
    return {
      total: Number(data.total || 0),
      pendiente: Number(data.estado?.pendiente || 0),
      derivado: Number(data.estado?.derivado || 0),
      en_proceso: Number(data.estado?.en_proceso || 0),
      completado: Number(data.estado?.completado || 0),
      rechazado: Number(data.estado?.rechazado || 0),
    };
  },

  async getTopDirections(limit = 5): Promise<{ direccion: string; total: number }[]> {
    const snap = await directionsCol().orderBy("total", "desc").limit(limit).get();
    return snap.docs
      .map((d) => d.data() as { label?: string; total?: number })
      .filter((d) => Number(d.total || 0) > 0)
      .map((d) => ({ direccion: d.label || "Sin dirección", total: Number(d.total || 0) }));
  },

  async getTopResolvedDirections(limit = 5): Promise<{ direccion: string; totalResueltos: number }[]> {
    const snap = await directionsCol().orderBy("resolved", "desc").limit(limit).get();
    return snap.docs
      .map((d) => d.data() as { label?: string; resolved?: number })
      .filter((d) => Number(d.resolved || 0) > 0)
      .map((d) => ({ direccion: d.label || "Sin dirección", totalResueltos: Number(d.resolved || 0) }));
  },
};
