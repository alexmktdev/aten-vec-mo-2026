import type { RequerimientoDTO } from "@/types/requerimiento.types";
import { ESTADO_LABELS, type EstadoRequerimiento } from "@/types/requerimiento.types";
import { getBusinessDaysBetween } from "@/lib/utils/dias-habiles";
import {
  addAoATable,
  addInstruccionesSheet,
  addJsonTable,
  addMatrixSheet,
  newWorkbook,
  workbookToBuffer,
  type CellVal,
} from "@/lib/reportes/excel-styled-workbook";
import { formatReporteFechaYHora } from "@/lib/reportes/formato-fecha-reporte";

const ESTADOS: EstadoRequerimiento[] = [
  "pendiente",
  "derivado",
  "en_proceso",
  "completado",
  "rechazado",
];

const DAY_MS = 86_400_000;

function dirKey(r: RequerimientoDTO): string {
  return r.direccionMunicipalLabel || r.direccionMunicipal || "Sin dirección";
}

function parseISODate(s: string): Date {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Días calendario entre dos instantes ISO (solo fechas, sin hora). */
function diasCalendarioEntre(inicioISO: string, finISO: string): number {
  const a = startOfDay(parseISODate(inicioISO));
  const b = startOfDay(parseISODate(finISO));
  return Math.floor((b.getTime() - a.getTime()) / DAY_MS);
}

function diasDesdeIngreso(fechaIngreso: string, now: Date): number {
  return diasCalendarioEntre(fechaIngreso, now.toISOString());
}

function esUrgenteActivo(r: RequerimientoDTO, now: Date): boolean {
  if (r.estado === "completado" || r.estado === "rechazado") return false;
  return diasDesdeIngreso(r.fechaIngreso, now) >= 20;
}

function abierto(r: RequerimientoDTO): boolean {
  return r.estado !== "completado" && r.estado !== "rechazado";
}

/** Días hábiles desde el ingreso (solo abiertos); coherente con «Alerta de atención» en la lista de la app. */
function diasHabilesSinRespuestaDesdeIngreso(r: RequerimientoDTO, now: Date): number | "" {
  if (!abierto(r)) return "";
  return getBusinessDaysBetween(parseISODate(r.fechaIngreso), now);
}

function sortedHistorial(r: RequerimientoDTO) {
  return [...(r.historialEstados || [])].sort(
    (a, b) => parseISODate(a.fecha).getTime() - parseISODate(b.fecha).getTime()
  );
}

/** Días en el estado actual (desde último evento de historial o desde ingreso). */
function diasEnEstadoActual(r: RequerimientoDTO, now: Date): number {
  const h = sortedHistorial(r);
  const desde = h.length ? h[h.length - 1]!.fecha : r.fechaIngreso;
  return Math.max(0, diasCalendarioEntre(desde, now.toISOString()));
}

function mesClave(fechaISO: string): string {
  const d = parseISODate(fechaISO);
  if (d.getTime() === 0) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

type ConteoDireccion = {
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
};

function conteoVacio(): ConteoDireccion {
  return {
    total: 0,
    pendiente: 0,
    derivado: 0,
    en_proceso: 0,
    en_espera_1: 0,
    en_espera_2: 0,
    derivado_respuesta_final: 0,
    completado: 0,
    rechazado: 0,
    urgentesActivos: 0,
  };
}

function computeGlobalStats(rows: RequerimientoDTO[], now: Date) {
  const stats = conteoVacio();
  stats.total = rows.length;
  for (const r of rows) {
    stats[r.estado]++;
    if (esUrgenteActivo(r, now)) stats.urgentesActivos++;
  }
  return stats;
}

function computeByDireccion(rows: RequerimientoDTO[], now: Date): Map<string, ConteoDireccion> {
  const map = new Map<string, ConteoDireccion>();
  for (const r of rows) {
    const k = dirKey(r);
    if (!map.has(k)) map.set(k, conteoVacio());
    const c = map.get(k)!;
    c.total++;
    c[r.estado]++;
    if (esUrgenteActivo(r, now)) c.urgentesActivos++;
  }
  return map;
}

function pct(num: number, den: number): number {
  if (!den || den <= 0) return 0;
  return Math.round((num / den) * 10000) / 100;
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}

function maxNum(nums: number[]): number {
  if (!nums.length) return 0;
  return Math.max(...nums);
}

/** Genera buffer .xlsx con todas las pestañas de estadísticas y detalle. */
export async function buildEstadisticasCompletoBuffer(
  rows: RequerimientoDTO[],
  meta: { exportadoEnISO: string; alcance: string }
): Promise<Buffer> {
  const wb = await newWorkbook();
  const now = new Date();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

  const global = computeGlobalStats(rows, now);
  const porDir = computeByDireccion(rows, now);
  const direccionesOrdenadas = Array.from(porDir.keys()).sort((a, b) =>
    a.localeCompare(b, "es", { sensitivity: "base" })
  );

  // --- Instrucciones ---
  const instr: CellVal[][] = [
    ["Exportación completa — Estadísticas y detalle"],
    ["Generado", formatReporteFechaYHora(meta.exportadoEnISO)],
    ["Alcance de datos", meta.alcance],
    [],
    ["Formato fechas y horas en todas las hojas", "DD-MM-AAAA y HH:MM (24 h), zona Chile continental."],
    [],
    [
      "Incluye todos los requerimientos visibles para su usuario (sin filtros de la pantalla de reportes).",
    ],
    [],
    ["Urgentes activos (20+ días calendario)", "Abiertos con 20+ días calendario desde la fecha de ingreso (misma noción que en el panel)."],
    [],
    ["Pestañas", "Descripción"],
    ["Resumen_respuestas_vecino", "Cerrados totales y porcentaje con correo formal al vecino"],
    ["Fiscalizacion_direcciones", "Métricas por dirección: volúmenes, tiempos y respuesta al vecino"],
    ["Antiguedad_abiertos", "Buckets de antigüedad para casos abiertos (todas las direcciones)"],
    ["Ingresos_y_cierres_mes", "Serie mensual de ingresos y cierres"],
    ["Por_tipo_estado", "Conteos largo formato: tipo × estado"],
    ["Tiempos_transicion", "Días entre cambios de estado (trazabilidad)"],
    ["Resumen_global", "Totales globales"],
    ["Por_direccion_conteos", "Cantidades por dirección y estado"],
    ["Por_direccion_pct_total", "% sobre total general"],
    ["Por_direccion_pct_interno", "% dentro de cada dirección"],
    ["Estado_pct_por_direccion", "Distribución de cada estado por dirección"],
    ["Detalle_requerimientos", "Fila por requerimiento (ampliado)"],
    ["Historial_estados", "Historial plano"],
    ["Notas", "Notas internas"],
    ["Respuestas_vecino", "Correos al vecino"],
    ["Documentos", "Adjuntos ingreso"],
    ["Evidencia_resolucion", "Evidencia de cierre"],
  ];
  addInstruccionesSheet(wb, instr);

  // --- Resumen respuestas al vecino (cerrados) ---
  let cerradosConRespuestaVecino = 0;
  for (const r of rows) {
    if (abierto(r)) continue;
    if ((r.respuestasVecino?.length ?? 0) > 0) cerradosConRespuestaVecino++;
  }
  const cerradosTotal = global.completado + global.rechazado;
  const resumenRespVecino = [
    ["Indicador", "Valor", "Notas"],
    ["Cerrados (total)", cerradosTotal, ""],
    [
      "Cerrados con al menos un correo al vecino",
      cerradosConRespuestaVecino,
      "Respuesta formal enviada",
    ],
    [
      "% cerrados con respuesta al vecino",
      pct(cerradosConRespuestaVecino, cerradosTotal),
      "",
    ],
  ];
  addAoATable(wb, "Resumen_respuestas_vecino", resumenRespVecino, {
    numericCols: new Set([2]),
  });

  // --- Fiscalización por dirección ---
  type FiscRow = (string | number)[];
  const fiscHeader: FiscRow = [
    "Dirección municipal",
    "Total casos",
    "Abiertos",
    "Cerrados",
    "% tasa cierre (cerrados/total)",
    "Urgentes activos (20+ días cal.)",
    "Promedio días hasta cierre",
    "Promedio días abierto (solo abiertos)",
    "Máx días abierto (abiertos)",
    "Promedio días en estado actual (abiertos)",
    "% cerrados con respuesta vecino",
  ];
  const fiscRows: FiscRow[] = [fiscHeader];
  for (const d of direccionesOrdenadas) {
    const subset = rows.filter((r) => dirKey(r) === d);
    const abiertos = subset.filter(abierto);
    const cerrados = subset.filter((r) => !abierto(r));
    const diasCierre = cerrados
      .filter((r) => r.fechaResolucion)
      .map((r) => diasCalendarioEntre(r.fechaIngreso, r.fechaResolucion!));
    const diasAbierto = abiertos.map((r) => diasDesdeIngreso(r.fechaIngreso, now));
    const diasEnEstado = abiertos.map((r) => diasEnEstadoActual(r, now));
    const urg = abiertos.filter((r) => esUrgenteActivo(r, now)).length;
    const cerrConResp = cerrados.filter((r) => (r.respuestasVecino?.length ?? 0) > 0).length;
    fiscRows.push([
      d,
      subset.length,
      abiertos.length,
      cerrados.length,
      pct(cerrados.length, subset.length),
      urg,
      avg(diasCierre),
      avg(diasAbierto),
      maxNum(diasAbierto),
      avg(diasEnEstado),
      pct(cerrConResp, cerrados.length || 1),
    ]);
  }
  addAoATable(wb, "Fiscalizacion_direcciones", fiscRows, {
    percentCols: new Set([5, 11]),
    numericCols: new Set([2, 3, 4, 6, 7, 8, 9, 10, 11]),
  });

  // --- Antigüedad casos abiertos (global buckets) ---
  const buckets = [
    { label: "0-9 días", min: 0, max: 9 },
    { label: "10-19 días", min: 10, max: 19 },
    { label: "20-29 días (urgente)", min: 20, max: 29 },
    { label: "30+ días", min: 30, max: 99999 },
  ];
  const antHeader: FiscRow = ["Tramo antigüedad (desde ingreso)", "Cantidad", "% sobre abiertos"];
  const abiertosAll = rows.filter(abierto);
  const antRows: FiscRow[] = [antHeader];
  for (const b of buckets) {
    const n = abiertosAll.filter((r) => {
      const di = diasDesdeIngreso(r.fechaIngreso, now);
      return di >= b.min && di <= b.max;
    }).length;
    antRows.push([b.label, n, pct(n, abiertosAll.length)]);
  }
  antRows.push(["Total abiertos", abiertosAll.length, abiertosAll.length ? 100 : 0]);
  addAoATable(wb, "Antiguedad_abiertos", antRows, {
    percentCols: new Set([3]),
    numericCols: new Set([2, 3]),
  });

  // --- Serie mensual ingresos / cierres ---
  const meses = new Set<string>();
  for (const r of rows) {
    const mi = mesClave(r.fechaIngreso);
    if (mi) meses.add(mi);
    if (r.fechaResolucion) {
      const mc = mesClave(r.fechaResolucion);
      if (mc) meses.add(mc);
    }
  }
  const mesesOrd = Array.from(meses).sort();
  const mesRows: FiscRow[] = [
    ["Año-mes", "Ingresos en el mes", "Cierres en el mes (fecha resolución)"],
  ];
  for (const m of mesesOrd) {
    const ing = rows.filter((r) => mesClave(r.fechaIngreso) === m).length;
    const cie = rows.filter(
      (r) => r.fechaResolucion && mesClave(r.fechaResolucion) === m
    ).length;
    mesRows.push([m, ing, cie]);
  }
  addAoATable(wb, "Ingresos_y_cierres_mes", mesRows, { numericCols: new Set([2, 3]) });

  // --- Largo: tipo × estado ---
  const tipEstMap = new Map<string, number>();
  for (const r of rows) {
    const tipo = r.tipoRequerimiento || "Sin tipo";
    const k = `${tipo}\t${r.estado}`;
    tipEstMap.set(k, (tipEstMap.get(k) || 0) + 1);
  }
  const tipEstRows: Record<string, string | number>[] = [];
  for (const [k, n] of tipEstMap) {
    const [tipoRequerimiento, estado] = k.split("\t");
    tipEstRows.push({
      tipoRequerimiento,
      estadoCodigo: estado,
      estadoEtiqueta: ESTADO_LABELS[estado as EstadoRequerimiento] || estado,
      cantidad: n,
      pct_sobre_total: pct(n, global.total),
    });
  }
  tipEstRows.sort((a, b) =>
    String(a.tipoRequerimiento).localeCompare(String(b.tipoRequerimiento), "es")
  );
  addJsonTable(wb, "Por_tipo_estado", tipEstRows, {
    tipoRequerimiento: "Tipo de requerimiento",
    estadoCodigo: "Estado (código)",
    estadoEtiqueta: "Estado",
    cantidad: "Cantidad",
    pct_sobre_total: "% sobre total",
  }, { numericKeys: ["cantidad"], percentKeys: ["pct_sobre_total"] });

  // --- Tiempos entre transiciones de estado ---
  const transRows: Record<string, string | number>[] = [];
  for (const r of rows) {
    const h = sortedHistorial(r);
    if (h.length === 0) continue;
    const first = h[0]!;
    transRows.push({
      requerimientoId: r.id,
      numeroSeguimiento: r.numeroSeguimiento,
      direccionMunicipalLabel: dirKey(r),
      estadoOrigen: "(ingreso)",
      estadoOrigenEtiqueta: "(ingreso)",
      estadoDestino: first.estado,
      estadoDestinoEtiqueta: (ESTADO_LABELS as Record<string, string>)[first.estado] || first.estado,
      fechaOrigen: formatReporteFechaYHora(r.fechaIngreso),
      fechaDestino: formatReporteFechaYHora(first.fecha),
      diasCalendario: diasCalendarioEntre(r.fechaIngreso, first.fecha),
      usuarioId: first.usuarioId || "",
    });
    for (let i = 0; i < h.length - 1; i++) {
      const a = h[i]!;
      const b = h[i + 1]!;
      transRows.push({
        requerimientoId: r.id,
        numeroSeguimiento: r.numeroSeguimiento,
        direccionMunicipalLabel: dirKey(r),
        estadoOrigen: a.estado,
        estadoDestino: b.estado,
        estadoOrigenEtiqueta: (ESTADO_LABELS as Record<string, string>)[a.estado] || a.estado,
        estadoDestinoEtiqueta: (ESTADO_LABELS as Record<string, string>)[b.estado] || b.estado,
        fechaOrigen: formatReporteFechaYHora(a.fecha),
        fechaDestino: formatReporteFechaYHora(b.fecha),
        diasCalendario: diasCalendarioEntre(a.fecha, b.fecha),
        usuarioId: b.usuarioId || "",
      });
    }
  }
  addJsonTable(wb, "Tiempos_transicion", transRows, {
    requerimientoId: "ID requerimiento",
    numeroSeguimiento: "N° seguimiento",
    direccionMunicipalLabel: "Dirección municipal",
    estadoOrigen: "Estado origen (código)",
    estadoOrigenEtiqueta: "Estado origen",
    estadoDestino: "Estado destino (código)",
    estadoDestinoEtiqueta: "Estado destino",
    fechaOrigen: "Fecha origen",
    fechaDestino: "Fecha destino",
    diasCalendario: "Días calendario",
    usuarioId: "Usuario ID",
  }, { numericKeys: ["diasCalendario"] });

  // --- Resumen global (original) ---
  const resumen = [
    ["Métrica", "Cantidad", "% del total requerimientos"],
    ["Total requerimientos", global.total, global.total ? 100 : 0],
    ["Pendiente", global.pendiente, pct(global.pendiente, global.total)],
    ["Derivado al área correspondiente", global.derivado, pct(global.derivado, global.total)],
    ["En proceso de solución", global.en_proceso, pct(global.en_proceso, global.total)],
    ["Requerimiento completado", global.completado, pct(global.completado, global.total)],
    ["Requerimiento rechazado", global.rechazado, pct(global.rechazado, global.total)],
    ["Urgentes activos", global.urgentesActivos, pct(global.urgentesActivos, global.total)],
  ];
  addAoATable(wb, "Resumen_global", resumen, {
    percentCols: new Set([3]),
    numericCols: new Set([2, 3]),
  });

  // --- Por dirección — conteos ---
  const headerDir = [
    "Dirección municipal",
    "Total",
    "Pendiente",
    "Derivado",
    "En proceso",
    "Completado",
    "Rechazado",
    "Urgentes activos",
  ];
  const rowsDir: (string | number)[][] = [headerDir];
  for (const d of direccionesOrdenadas) {
    const c = porDir.get(d)!;
    rowsDir.push([
      d,
      c.total,
      c.pendiente,
      c.derivado,
      c.en_proceso,
      c.completado,
      c.rechazado,
      c.urgentesActivos,
    ]);
  }
  rowsDir.push([]);
  rowsDir.push([
    "TOTAL general",
    global.total,
    global.pendiente,
    global.derivado,
    global.en_proceso,
    global.completado,
    global.rechazado,
    global.urgentesActivos,
  ]);
  addAoATable(wb, "Por_direccion_conteos", rowsDir, { numericCols: new Set([2, 3, 4, 5, 6, 7, 8]) });

  const headerPct = [
    "Dirección municipal",
    "% requerimientos del total",
    "% pendientes del total",
    "% derivados del total",
    "% en proceso del total",
    "% completados del total",
    "% rechazados del total",
    "% urgentes activos del total",
  ];
  const rowsPctTotal: (string | number)[][] = [headerPct];
  for (const d of direccionesOrdenadas) {
    const c = porDir.get(d)!;
    rowsPctTotal.push([
      d,
      pct(c.total, global.total),
      pct(c.pendiente, global.total),
      pct(c.derivado, global.total),
      pct(c.en_proceso, global.total),
      pct(c.completado, global.total),
      pct(c.rechazado, global.total),
      pct(c.urgentesActivos, global.total),
    ]);
  }
  addAoATable(wb, "Por_direccion_pct_total", rowsPctTotal, {
    percentCols: new Set([2, 3, 4, 5, 6, 7, 8]),
  });

  const headerInt = [
    "Dirección municipal",
    "% pendiente (de la dir.)",
    "% derivado (de la dir.)",
    "% en proceso (de la dir.)",
    "% completado (de la dir.)",
    "% rechazado (de la dir.)",
    "% urgentes activos (de la dir.)",
  ];
  const rowsInt: (string | number)[][] = [headerInt];
  for (const d of direccionesOrdenadas) {
    const c = porDir.get(d)!;
    const t = c.total || 1;
    rowsInt.push([
      d,
      pct(c.pendiente, t),
      pct(c.derivado, t),
      pct(c.en_proceso, t),
      pct(c.completado, t),
      pct(c.rechazado, t),
      pct(c.urgentesActivos, t),
    ]);
  }
  addAoATable(wb, "Por_direccion_pct_interno", rowsInt, {
    percentCols: new Set([2, 3, 4, 5, 6, 7]),
  });

  const headerMat = ["Estado", ...direccionesOrdenadas, "Total fila"];
  const rowsMat: (string | number)[][] = [headerMat];
  for (const est of ESTADOS) {
    const row: (string | number)[] = [ESTADO_LABELS[est]];
    let suma = 0;
    for (const d of direccionesOrdenadas) {
      const c = porDir.get(d)!;
      const n = c[est];
      const g = global[est] || 1;
      row.push(pct(n, g));
      suma += n;
    }
    row.push(suma);
    rowsMat.push(row);
  }
  addMatrixSheet(wb, "Estado_pct_por_direccion", rowsMat, { percentBody: true });

  // --- Detalle requerimientos (ampliado) ---
  const historialResumido = (r: RequerimientoDTO) =>
    sortedHistorial(r)
      .map(
        (h) =>
          `${(ESTADO_LABELS as Record<string, string>)[h.estado] || h.estado}@${formatReporteFechaYHora(h.fecha)}`
      )
      .join(" → ");

  const detalle = rows.map((r) => {
    const h = sortedHistorial(r);
    const ultimo = h.length ? h[h.length - 1]! : null;
    const penultimo = h.length > 1 ? h[h.length - 2]! : null;
    const diasHastaCierre =
      r.fechaResolucion && !abierto(r)
        ? diasCalendarioEntre(r.fechaIngreso, r.fechaResolucion)
        : "";
    return {
      id: r.id,
      numeroSeguimiento: r.numeroSeguimiento,
      estadoCodigo: r.estado,
      estadoEtiqueta: ESTADO_LABELS[r.estado],
      tipoRequerimiento: r.tipoRequerimiento,
      descripcion: r.descripcion,
      direccionMunicipal: r.direccionMunicipal,
      direccionMunicipalLabel: r.direccionMunicipalLabel,
      fechaIngreso: formatReporteFechaYHora(r.fechaIngreso),
      fechaResolucion: r.fechaResolucion ? formatReporteFechaYHora(r.fechaResolucion) : "",
      creadoEn: r.creadoEn ? formatReporteFechaYHora(r.creadoEn) : "",
      actualizadoEn: r.actualizadoEn ? formatReporteFechaYHora(r.actualizadoEn) : "",
      diasHabilesSinRespuesta: diasHabilesSinRespuestaDesdeIngreso(r, now),
      urgenteActivo: esUrgenteActivo(r, now) ? "Sí" : "No",
      diasDesdeIngreso: diasDesdeIngreso(r.fechaIngreso, now),
      diasEnEstadoActual: diasEnEstadoActual(r, now),
      diasCalendarioHastaCierre: diasHastaCierre,
      respuestaVecinoEnviada: (r.respuestasVecino?.length ?? 0) > 0 ? "Sí" : "No",
      cantRespuestasVecino: r.respuestasVecino?.length ?? 0,
      fechaUltimoCambioEstado: ultimo?.fecha ? formatReporteFechaYHora(ultimo.fecha) : "",
      estadoPrevioHistorial: penultimo?.estado || "",
      estadoPrevioEtiqueta: penultimo
        ? (ESTADO_LABELS as Record<string, string>)[penultimo.estado] || penultimo.estado
        : "",
      historialResumido: historialResumido(r),
      urlSeguimientoPublico: appUrl ? `${appUrl}/seguimiento` : "",
      vecinoNombre: `${r.vecino.nombre} ${r.vecino.primerApellido}`.trim(),
      vecinoSegundoApellido: r.vecino.segundoApellido || "",
      vecinoRut: r.vecino.rut,
      vecinoEmail: r.vecino.email,
      vecinoTelefono: r.vecino.telefono,
      vecinoRegion: r.vecino.region,
      vecinoComuna: r.vecino.comuna,
      vecinoDireccion: r.vecino.direccion,
      vecinoTipoInmueble: r.vecino.tipoInmueble,
      cantDocumentos: r.documentos?.length ?? 0,
      cantHistorial: r.historialEstados?.length ?? 0,
      cantNotas: r.notas?.length ?? 0,
      tieneEvidenciaResolucion: r.evidenciaResolucion ? "Sí" : "No",
      evidenciaTipo: r.evidenciaResolucion?.tipo || "",
      evidenciaNombre: r.evidenciaResolucion?.nombre || "",
      evidenciaUrl: r.evidenciaResolucion?.url || "",
      documentosUrls: (r.documentos || []).map((d) => d.url).join(" | "),
    };
  });
  const etiquetasDetalle: Record<string, string> = {
    id: "ID",
    numeroSeguimiento: "N° seguimiento",
    estadoCodigo: "Estado (código)",
    estadoEtiqueta: "Estado",
    tipoRequerimiento: "Tipo",
    descripcion: "Descripción",
    direccionMunicipal: "Dirección municipal (código)",
    direccionMunicipalLabel: "Dirección municipal",
    fechaIngreso: "Fecha ingreso",
    fechaResolucion: "Fecha resolución",
    creadoEn: "Creado en",
    actualizadoEn: "Actualizado en",
    diasHabilesSinRespuesta: "Días hábiles sin respuesta (solo abiertos)",
    urgenteActivo: "¿Urgente activo? (20+ días calendario desde ingreso)",
    diasDesdeIngreso: "Días desde ingreso",
    diasEnEstadoActual: "Días en estado actual",
    diasCalendarioHastaCierre: "Días calendario hasta cierre",
    respuestaVecinoEnviada: "¿Respuesta al vecino enviada?",
    cantRespuestasVecino: "Cant. respuestas vecino",
    fechaUltimoCambioEstado: "Fecha último cambio estado",
    estadoPrevioHistorial: "Estado previo (código)",
    estadoPrevioEtiqueta: "Estado previo",
    historialResumido: "Historial (resumido)",
    urlSeguimientoPublico: "URL seguimiento público",
    vecinoNombre: "Vecino — nombre",
    vecinoSegundoApellido: "Vecino — segundo apellido",
    vecinoRut: "Vecino — RUT",
    vecinoEmail: "Vecino — email",
    vecinoTelefono: "Vecino — teléfono",
    vecinoRegion: "Vecino — región",
    vecinoComuna: "Vecino — comuna",
    vecinoDireccion: "Vecino — dirección",
    vecinoTipoInmueble: "Vecino — tipo inmueble",
    cantDocumentos: "Cant. documentos",
    cantHistorial: "Cant. historial",
    cantNotas: "Cant. notas",
    tieneEvidenciaResolucion: "¿Tiene evidencia resolución?",
    evidenciaTipo: "Evidencia — tipo",
    evidenciaNombre: "Evidencia — nombre",
    evidenciaUrl: "Evidencia — URL",
    documentosUrls: "Documentos — URLs",
  };
  addJsonTable(
    wb,
    "Detalle_requerimientos",
    detalle,
    etiquetasDetalle,
    {
      numericKeys: [
        "diasHabilesSinRespuesta",
        "diasDesdeIngreso",
        "diasEnEstadoActual",
        "diasCalendarioHastaCierre",
        "cantRespuestasVecino",
        "cantDocumentos",
        "cantHistorial",
        "cantNotas",
      ],
    }
  );

  const historialFlat: Record<string, string | number>[] = [];
  for (const r of rows) {
    for (const h of r.historialEstados || []) {
      historialFlat.push({
        requerimientoId: r.id,
        numeroSeguimiento: r.numeroSeguimiento,
        direccionMunicipalLabel: dirKey(r),
        estado: h.estado,
        estadoEtiqueta: (ESTADO_LABELS as Record<string, string>)[h.estado] || h.estado,
        fecha: formatReporteFechaYHora(h.fecha),
        usuarioId: h.usuarioId || "",
        nota: h.nota || "",
      });
    }
  }
  addJsonTable(wb, "Historial_estados", historialFlat, {
    requerimientoId: "ID requerimiento",
    numeroSeguimiento: "N° seguimiento",
    direccionMunicipalLabel: "Dirección municipal",
    estado: "Estado (código)",
    estadoEtiqueta: "Estado",
    fecha: "Fecha",
    usuarioId: "Usuario ID",
    nota: "Nota",
  });

  const notasFlat: Record<string, string>[] = [];
  for (const r of rows) {
    for (const n of r.notas || []) {
      notasFlat.push({
        requerimientoId: r.id,
        numeroSeguimiento: r.numeroSeguimiento,
        direccionMunicipalLabel: dirKey(r),
        fecha: formatReporteFechaYHora(n.fecha),
        usuarioId: n.usuarioId,
        contenido: n.contenido,
      });
    }
  }
  addJsonTable(wb, "Notas", notasFlat, {
    requerimientoId: "ID requerimiento",
    numeroSeguimiento: "N° seguimiento",
    direccionMunicipalLabel: "Dirección municipal",
    fecha: "Fecha",
    usuarioId: "Usuario ID",
    contenido: "Contenido",
  });

  const respFlat: Record<string, string>[] = [];
  for (const r of rows) {
    for (const rv of r.respuestasVecino || []) {
      respFlat.push({
        requerimientoId: r.id,
        numeroSeguimiento: r.numeroSeguimiento,
        direccionMunicipalLabel: dirKey(r),
        fecha: formatReporteFechaYHora(rv.fecha),
        emailDestino: rv.emailDestino,
        asunto: rv.asunto,
        mensaje: rv.mensaje,
        usuarioId: rv.usuarioId,
      });
    }
  }
  addJsonTable(wb, "Respuestas_vecino", respFlat, {
    requerimientoId: "ID requerimiento",
    numeroSeguimiento: "N° seguimiento",
    direccionMunicipalLabel: "Dirección municipal",
    fecha: "Fecha",
    emailDestino: "Email destino",
    asunto: "Asunto",
    mensaje: "Mensaje",
    usuarioId: "Usuario ID",
  });

  const docsFlat: Record<string, string | number>[] = [];
  for (const r of rows) {
    for (const d of r.documentos || []) {
      docsFlat.push({
        requerimientoId: r.id,
        numeroSeguimiento: r.numeroSeguimiento,
        direccionMunicipalLabel: dirKey(r),
        nombre: d.nombre,
        nombreR2: d.nombreR2,
        url: d.url,
        tipo: d.tipo,
        tamanio: d.tamanio,
      });
    }
  }
  addJsonTable(
    wb,
    "Documentos",
    docsFlat,
    {
      requerimientoId: "ID requerimiento",
      numeroSeguimiento: "N° seguimiento",
      direccionMunicipalLabel: "Dirección municipal",
      nombre: "Nombre",
      nombreR2: "Nombre (R2)",
      url: "URL",
      tipo: "Tipo",
      tamanio: "Tamaño (bytes)",
    },
    { numericKeys: ["tamanio"] }
  );

  const evi: Record<string, string | number>[] = [];
  for (const r of rows) {
    if (!r.evidenciaResolucion) continue;
    const e = r.evidenciaResolucion;
    evi.push({
      requerimientoId: r.id,
      numeroSeguimiento: r.numeroSeguimiento,
      direccionMunicipalLabel: dirKey(r),
      tipo: e.tipo,
      nombre: e.nombre || "",
      nombreR2: e.nombreR2 || "",
      url: e.url,
      tamanio: e.tamanio ?? "",
      fecha: formatReporteFechaYHora(e.fecha),
      usuarioId: e.usuarioId,
    });
  }
  addJsonTable(
    wb,
    "Evidencia_resolucion",
    evi,
    {
      requerimientoId: "ID requerimiento",
      numeroSeguimiento: "N° seguimiento",
      direccionMunicipalLabel: "Dirección municipal",
      tipo: "Tipo",
      nombre: "Nombre",
      nombreR2: "Nombre (R2)",
      url: "URL",
      tamanio: "Tamaño",
      fecha: "Fecha",
      usuarioId: "Usuario ID",
    },
    { numericKeys: ["tamanio"] }
  );

  return workbookToBuffer(wb);
}
