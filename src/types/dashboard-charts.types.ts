/** Segmento para gráficos de torta (dashboard / fiscalización). */
export type DashboardPieSlice = {
  name: string;
  value: number;
  /** Porcentaje sobre el total del conjunto filtrado (0–100). */
  pct: number;
};

/** IDs alineados con las tarjetas del panel de control. */
export type DashboardChartCardId =
  | "total"
  | "pendiente"
  | "derivado"
  | "en_proceso"
  | "completado"
  | "rechazado"
  | "urgentesActivos";

export type DashboardChartsPayload = {
  generatedAt: string;
  /** Reparto por dirección municipal según cada tarjeta. */
  cards: Record<DashboardChartCardId, DashboardPieSlice[]>;
  /** Mix global de estados (todos los requerimientos del alcance). */
  estadosDistribucion: DashboardPieSlice[];
  /** Ingresos por mes (últimos 12 meses con actividad). */
  ingresosPorMes: DashboardPieSlice[];
  /** Casos abiertos por categoría. */
  categoriasAbiertos: DashboardPieSlice[];
  /** Casos cerrados por categoría. */
  categoriasCerrados: DashboardPieSlice[];
};
