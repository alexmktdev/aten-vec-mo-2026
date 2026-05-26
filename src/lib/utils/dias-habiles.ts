/**
 * Cálculo de días hábiles (lunes a viernes, excluyendo feriados).
 *
 * Plazos del workflow actual:
 *  - Base al ingresar: 2 semanas hábiles (10 días hábiles)
 *  - +Espera 1: agrega 2 semanas hábiles más al plazo vigente
 *  - +Espera 2: agrega otras 2 semanas hábiles más
 */

export const DIAS_HABILES_BASE = 10;
export const DIAS_HABILES_POR_SEMANA = 5;

// Feriados fijos de Chile (mes-día)
const FERIADOS_FIJOS: string[] = [
  "01-01", // Año Nuevo
  "05-01", // Día del Trabajo
  "05-21", // Día de las Glorias Navales
  "06-20", // Día Nacional de los Pueblos Indígenas (aprox.)
  "06-29", // San Pedro y San Pablo
  "07-16", // Virgen del Carmen
  "08-15", // Asunción de la Virgen
  "09-18", // Fiestas Patrias
  "09-19", // Día de las Glorias del Ejército
  "10-12", // Encuentro de Dos Mundos
  "10-31", // Día de las Iglesias Evangélicas
  "11-01", // Día de Todos los Santos
  "12-08", // Inmaculada Concepción
  "12-25", // Navidad
];

function isFeriado(date: Date): boolean {
  const monthDay = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return FERIADOS_FIJOS.includes(monthDay);
}

function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  // 0 = domingo, 6 = sábado
  if (day === 0 || day === 6) return false;
  if (isFeriado(date)) return false;
  return true;
}

/**
 * Suma N días hábiles a una fecha
 */
export function addBusinessDays(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  let added = 0;

  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (isBusinessDay(result)) {
      added++;
    }
  }

  return result;
}

/**
 * Calcula los días hábiles entre dos fechas
 */
export function getBusinessDaysBetween(startDate: Date, endDate: Date): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (start >= end) return 0;

  let count = 0;
  const current = new Date(start);

  while (current < end) {
    current.setDate(current.getDate() + 1);
    if (current <= end && isBusinessDay(current)) {
      count++;
    }
  }

  return count;
}

/**
 * Calcula los días hábiles restantes de un requerimiento.
 * Retorna negativo si venció.
 */
export function getDiasHabilesRestantes(fechaLimite: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const limite = new Date(fechaLimite);
  limite.setHours(0, 0, 0, 0);

  if (now > limite) {
    // Ya venció — retornar días negativos
    return -getBusinessDaysBetween(limite, now);
  }

  return getBusinessDaysBetween(now, limite);
}

/**
 * Calcula la fecha límite base del requerimiento al momento del ingreso.
 * Plazo: 2 semanas hábiles (10 días hábiles).
 */
export function calcularFechaLimite(fechaIngreso: Date): Date {
  return addBusinessDays(fechaIngreso, DIAS_HABILES_BASE);
}

/**
 * Extiende una fecha límite existente sumando N semanas hábiles.
 */
export function extenderFechaLimiteSemanas(
  fechaLimiteActual: Date,
  semanas: number
): Date {
  const dias = Math.max(0, Math.round(semanas)) * DIAS_HABILES_POR_SEMANA;
  return addBusinessDays(fechaLimiteActual, dias);
}

/**
 * Retrocede una fecha límite restando N semanas hábiles. Útil al revertir
 * una transición que había extendido el plazo (espera 1 / espera 2).
 */
export function reducirFechaLimiteSemanas(
  fechaLimiteActual: Date,
  semanas: number
): Date {
  const dias = Math.max(0, Math.round(semanas)) * DIAS_HABILES_POR_SEMANA;
  return subtractBusinessDays(fechaLimiteActual, dias);
}

function subtractBusinessDays(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  let removed = 0;
  while (removed < days) {
    result.setDate(result.getDate() - 1);
    if (isBusinessDay(result)) removed++;
  }
  return result;
}

/**
 * Verifica si un requerimiento está próximo a vencer (≤ 3 días hábiles)
 */
export function isProximoAVencer(fechaLimite: Date): boolean {
  const restantes = getDiasHabilesRestantes(fechaLimite);
  return restantes >= 0 && restantes <= 3;
}

/**
 * Verifica si un requerimiento ya venció
 */
export function isVencido(fechaLimite: Date): boolean {
  return getDiasHabilesRestantes(fechaLimite) < 0;
}
