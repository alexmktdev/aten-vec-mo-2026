import { EstadoRequerimiento } from "@/types/requerimiento.types";
import { RolUsuario } from "@/types/usuario.types";

/**
 * Admin: NO puede cambiar estado manualmente.
 * La única forma de pasar de pendiente → derivado es con el botón Derivar (acción + correo).
 */
const ADMIN_STATUS_TRANSITIONS: Record<EstadoRequerimiento, EstadoRequerimiento[]> = {
  pendiente: [],
  derivado: [],
  en_proceso: [],
  completado: [],
  rechazado: [],
};

/**
 * Director:
 * - derivado → pendiente (admin derivó mal) o en_proceso
 * - en_proceso → pendiente (categoría/dirección equivocada), completado o rechazado
 * - completado / rechazado: sin transiciones (se bloquea tras responder al vecino desde la UI y backend)
 */
const DIRECTOR_STATUS_TRANSITIONS: Record<EstadoRequerimiento, EstadoRequerimiento[]> = {
  pendiente: [],
  derivado: ["pendiente", "en_proceso"],
  en_proceso: ["pendiente", "completado", "rechazado"],
  completado: [],
  rechazado: [],
};

const ALL_STATUS_TRANSITIONS: Record<EstadoRequerimiento, EstadoRequerimiento[]> = {
  pendiente: ["derivado", "en_proceso", "completado", "rechazado"],
  derivado: ["pendiente", "en_proceso", "completado", "rechazado"],
  en_proceso: ["pendiente", "derivado", "completado", "rechazado"],
  completado: ["pendiente", "derivado", "en_proceso", "rechazado"],
  rechazado: ["pendiente", "derivado", "en_proceso", "completado"],
};

export function canDeleteRequerimiento(rol: RolUsuario): boolean {
  return rol === "superadmin";
}

export function canDerivarRequerimiento(rol: RolUsuario): boolean {
  return rol === "superadmin" || rol === "admin";
}

export function canSendCitizenResponse(rol: RolUsuario): boolean {
  return rol === "superadmin" || rol === "director" || rol === "administradora-municipal";
}

export function canEditRequerimientoData(rol: RolUsuario): boolean {
  return rol === "superadmin" || rol === "admin" || rol === "director" || rol === "administradora-municipal";
}

export function getAllowedNextStates(
  rol: RolUsuario,
  currentEstado: EstadoRequerimiento
): EstadoRequerimiento[] {
  if (rol === "superadmin" || rol === "administradora-municipal") {
    return ALL_STATUS_TRANSITIONS[currentEstado];
  }

  if (rol === "admin") {
    return ADMIN_STATUS_TRANSITIONS[currentEstado];
  }

  if (rol === "director") {
    return DIRECTOR_STATUS_TRANSITIONS[currentEstado];
  }

  return [];
}

export function canTransitionEstado(
  rol: RolUsuario,
  from: EstadoRequerimiento,
  to: EstadoRequerimiento
): boolean {
  if (from === to) return true;
  return getAllowedNextStates(rol, from).includes(to);
}
