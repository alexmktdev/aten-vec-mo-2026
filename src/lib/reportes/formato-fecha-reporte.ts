/**
 * Formato fijo para exportaciones PDF/Excel: DD-MM-AAAA y HH:MM (24 h).
 * Zona horaria consistente para reportes municipales.
 */
export const REPORTE_TIMEZONE = "America/Santiago";

function parseInput(d: Date | string): Date {
  return typeof d === "string" ? new Date(d) : d;
}

/** DD-MM-AAAA */
export function formatReporteFecha(d: Date | string): string {
  const date = parseInput(d);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: REPORTE_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  if (!day || !month || !year) return "";
  return `${day}-${month}-${year}`;
}

/** HH:MM (24 h) */
export function formatReporteHora(d: Date | string): string {
  const date = parseInput(d);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: REPORTE_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

/** DD-MM-AAAA HH:MM */
export function formatReporteFechaYHora(d: Date | string): string {
  const f = formatReporteFecha(d);
  if (!f) return "";
  return `${f} ${formatReporteHora(d)}`;
}
