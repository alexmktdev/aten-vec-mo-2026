import type { EstadoRequerimiento } from "@/types/requerimiento.types";
import type {
  DashboardChartCardId,
  DashboardChartsPayload,
  DashboardPieSlice,
} from "@/types/dashboard-charts.types";

const DAY_MS = 86_400_000;

const ESTADO_KEYS = new Set<string>(["pendiente", "derivado", "en_proceso", "completado", "rechazado"]);

/** Fila mínima leída de Firestore para armar gráficos (sin DTO completo). */
export type ChartSourceRow = Record<string, unknown>;

function coalesceDate(v: unknown): Date | null {
  if (v == null) return null;
  if (typeof (v as { toDate?: () => Date }).toDate === "function") {
    try {
      const d = (v as { toDate: () => Date }).toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function diasCalendarioEntre(inicio: Date | null, fin: Date | null): number {
  if (!inicio || !fin) return 0;
  const a = startOfDay(inicio);
  const b = startOfDay(fin);
  return Math.floor((b.getTime() - a.getTime()) / DAY_MS);
}

type Norm = {
  estado: string;
  dirLabel: string;
  categoria: string;
  fechaIngreso: Date | null;
};

function normalizeRow(raw: ChartSourceRow): Norm {
  const estadoRaw = raw.estado;
  const estado = typeof estadoRaw === "string" ? estadoRaw : "pendiente";
  const dm = typeof raw.direccionMunicipal === "string" ? raw.direccionMunicipal : "";
  const label = typeof raw.direccionMunicipalLabel === "string" ? raw.direccionMunicipalLabel.trim() : "";
  const dirLabel = label || dm || "Sin dirección";
  const catRaw = raw.categoria;
  const categoria = typeof catRaw === "string" && catRaw.trim() ? catRaw.trim() : "Sin categoría";

  return {
    estado,
    dirLabel,
    categoria,
    fechaIngreso: coalesceDate(raw.fechaIngreso),
  };
}

function abierto(r: Norm): boolean {
  return r.estado !== "completado" && r.estado !== "rechazado";
}

function esUrgenteActivo(r: Norm, now: Date): boolean {
  if (!abierto(r) || !r.fechaIngreso) return false;
  return diasCalendarioEntre(r.fechaIngreso, now) >= 20;
}

function mapToSlices(map: Map<string, number>, maxSlices = 12): DashboardPieSlice[] {
  const entries = [...map.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (entries.length <= maxSlices) {
    const total = entries.reduce((s, [, v]) => s + v, 0);
    return entries.map(([name, value]) => ({
      name,
      value,
      pct: total > 0 ? Math.round((value / total) * 10000) / 100 : 0,
    }));
  }
  const head = entries.slice(0, maxSlices - 1);
  const tail = entries.slice(maxSlices - 1);
  const otrosVal = tail.reduce((s, [, v]) => s + v, 0);
  const merged = [...head, [`Otros (${tail.length} direcciones)`, otrosVal] as [string, number]];
  const total = merged.reduce((s, [, v]) => s + v, 0);
  return merged.map(([name, value]) => ({
    name,
    value,
    pct: total > 0 ? Math.round((value / total) * 10000) / 100 : 0,
  }));
}

function countByDir(rows: Norm[]): DashboardPieSlice[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    m.set(r.dirLabel, (m.get(r.dirLabel) || 0) + 1);
  }
  return mapToSlices(m);
}

function countByName(rows: Norm[], key: (r: Norm) => string, maxSlices = 10): DashboardPieSlice[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return mapToSlices(m, maxSlices);
}

function estadosPie(rows: Norm[]): DashboardPieSlice[] {
  const labels: Record<string, string> = {
    pendiente: "Pendiente",
    derivado: "Derivado",
    en_proceso: "En proceso",
    completado: "Completado",
    rechazado: "Rechazado",
  };
  const m = new Map<string, number>();
  for (const r of rows) {
    const bucket = ESTADO_KEYS.has(r.estado) ? r.estado : "otro";
    const label = bucket === "otro" ? "Otro estado" : labels[bucket] || bucket;
    m.set(label, (m.get(label) || 0) + 1);
  }
  const total = [...m.values()].reduce((a, b) => a + b, 0);
  return [...m.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({
      name,
      value,
      pct: total > 0 ? Math.round((value / total) * 10000) / 100 : 0,
    }));
}

function ingresosPorMesPie(rows: Norm[], now: Date): DashboardPieSlice[] {
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const m = new Map<string, number>();
  for (const r of rows) {
    if (!r.fechaIngreso || r.fechaIngreso < cutoff) continue;
    const y = r.fechaIngreso.getFullYear();
    const mo = String(r.fechaIngreso.getMonth() + 1).padStart(2, "0");
    const key = `${y}-${mo}`;
    m.set(key, (m.get(key) || 0) + 1);
  }
  const sorted = [...m.entries()].filter(([, v]) => v > 0).sort((a, b) => a[0].localeCompare(b[0]));
  const total = sorted.reduce((s, [, v]) => s + v, 0);
  return sorted.map(([name, value]) => ({
    name,
    value,
    pct: total > 0 ? Math.round((value / total) * 10000) / 100 : 0,
  }));
}

export function buildDashboardChartsPayload(raw: ChartSourceRow[]): DashboardChartsPayload {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const rows = raw.map(normalizeRow);

  const byEstado = (e: EstadoRequerimiento) => countByDir(rows.filter((r) => r.estado === e));

  const urgentes = rows.filter((r) => esUrgenteActivo(r, now));

  const cards: Record<DashboardChartCardId, DashboardPieSlice[]> = {
    total: countByDir(rows),
    pendiente: byEstado("pendiente"),
    derivado: byEstado("derivado"),
    en_proceso: byEstado("en_proceso"),
    completado: byEstado("completado"),
    rechazado: byEstado("rechazado"),
    urgentesActivos: countByDir(urgentes),
  };

  return {
    generatedAt: new Date().toISOString(),
    cards,
    estadosDistribucion: estadosPie(rows),
    ingresosPorMes: ingresosPorMesPie(rows, now),
    categoriasAbiertos: countByName(
      rows.filter(abierto),
      (r) => r.categoria,
      10
    ),
    categoriasCerrados: countByName(
      rows.filter((r) => !abierto(r)),
      (r) => r.categoria,
      10
    ),
  };
}
