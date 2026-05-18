import { EstadoRequerimiento } from "@/types/requerimiento.types";
import { RolUsuario } from "@/types/usuario.types";

const ADMIN_STATUS_TRANSITIONS: Record<EstadoRequerimiento, EstadoRequerimiento[]> = {
  // Admin puede corregir derivaciones: pendiente ↔ derivado en cualquier momento (también vía acción Derivar con correo).
  pendiente: ["derivado"],
  derivado: ["pendiente"],
  en_proceso: [],
  completado: [],
  rechazado: [],
};

const DIRECTOR_STATUS_TRANSITIONS: Record<EstadoRequerimiento, EstadoRequerimiento[]> = {
  pendiente: [],
  // Pendiente: el admin pudo derivar con dirección equivocada; el director puede devolverlo al estado inicial.
  derivado: ["pendiente", "en_proceso"],
  en_proceso: ["derivado", "completado", "rechazado"],
  completado: ["en_proceso", "rechazado"],
  rechazado: ["en_proceso", "completado"],
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
