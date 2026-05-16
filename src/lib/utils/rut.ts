/**
 * Validador de RUT chileno con algoritmo módulo 11.
 * Formatos aceptados: 12.345.678-9, 12345678-9, 12345678-K
 */

/**
 * Limpia un RUT de puntos y guión, dejando solo números y dígito verificador
 */
export function cleanRut(rut: string): string {
  return rut.replace(/[^0-9kK]/g, "").toUpperCase().slice(0, 9);
}

/**
 * Formatea un RUT limpio al formato XX.XXX.XXX-X
 */
export function formatRut(rut: string): string {
  const cleaned = cleanRut(rut);
  if (cleaned.length === 0) return "";
  if (cleaned.length === 1) return cleaned;

  const dv = cleaned.slice(-1);
  const body = cleaned.slice(0, -1);

  // Agregar puntos separadores
  let formatted = "";
  let count = 0;
  for (let i = body.length - 1; i >= 0; i--) {
    formatted = body[i] + formatted;
    count++;
    if (count === 3 && i > 0) {
      formatted = "." + formatted;
      count = 0;
    }
  }

  return `${formatted}-${dv}`;
}

export function normalizeRut(rut: string): string {
  return formatRut(rut);
}

function hasSameDigitBody(body: string): boolean {
  return /^(\d)\1+$/.test(body);
}

/**
 * Calcula el dígito verificador de un RUT usando el algoritmo módulo 11
 */
export function calculateDV(rutBody: number): string {
  let sum = 0;
  let multiplier = 2;

  let current = rutBody;
  while (current > 0) {
    sum += (current % 10) * multiplier;
    current = Math.floor(current / 10);
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);

  if (remainder === 11) return "0";
  if (remainder === 10) return "K";
  return remainder.toString();
}

/**
 * Valida un RUT chileno completo (número + dígito verificador)
 * @param rut - RUT en cualquier formato (con o sin puntos/guión)
 * @returns true si el RUT es válido
 */
export function validateRut(rut: string): boolean {
  if (!rut || rut.length < 3) return false;

  const cleaned = cleanRut(rut);

  // Verificar formato: solo dígitos + un dígito verificador (0-9 o K)
  if (!/^\d{7,8}[0-9K]$/.test(cleaned)) return false;

  const dv = cleaned.slice(-1);
  const body = cleaned.slice(0, -1);
  const rutBody = parseInt(body, 10);

  if (isNaN(rutBody) || rutBody === 0) return false;
  if (hasSameDigitBody(body)) return false;

  const expectedDV = calculateDV(rutBody);

  return dv === expectedDV;
}

/**
 * Valida el formato del RUT (XX.XXX.XXX-X)
 */
export function isValidRutFormat(rut: string): boolean {
  return /^\d{1,2}\.\d{3}\.\d{3}-[\dkK]$/.test(rut);
}
