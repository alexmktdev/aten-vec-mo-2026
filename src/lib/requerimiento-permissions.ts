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
 * - completado / rechazado → en_proceso solo si aún NO se envió correo al vecino (hasRespuestaVecino)
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

/**
 * Edición completa del requerimiento (modal «Editar datos completos»):
 * - En completado / rechazado: nadie (ni siquiera superadmin); solo puede corregirse volviendo antes a «en proceso» si aún no hay correo al vecino
 * - superadmin: en el resto de estados, siempre puede editar
 * - admin / administradora-municipal: solo con estado pendiente
 * - director: nunca
 */
export function canEditRequerimientoData(rol: RolUsuario, estado: EstadoRequerimiento): boolean {
  if (estado === "completado" || estado === "rechazado") {
    return false;
  }
  if (rol === "superadmin") return true;
  if (rol === "director") return false;
  if (rol === "admin" || rol === "administradora-municipal") {
    return estado === "pendiente";
  }
  return false;
}

/** Contexto opcional para transiciones que dependen del historial (ej. correo al vecino ya enviado). */
export interface EstadoTransitionContext {
  hasRespuestaVecino?: boolean;
}

export function getAllowedNextStates(
  rol: RolUsuario,
  currentEstado: EstadoRequerimiento,
  context?: EstadoTransitionContext
): EstadoRequerimiento[] {
  const sinRespuestaVecino = !context?.hasRespuestaVecino;

  if (rol === "superadmin" || rol === "administradora-municipal") {
    if (currentEstado === "completado" || currentEstado === "rechazado") {
      // Solo puede deshacer el cierre volviendo a «en proceso», y solo antes del correo al vecino
      if (sinRespuestaVecino) return ["en_proceso"];
      return [];
    }
    return ALL_STATUS_TRANSITIONS[currentEstado];
  }

  if (rol === "admin") {
    return ADMIN_STATUS_TRANSITIONS[currentEstado];
  }

  if (rol === "director") {
    const base = [...DIRECTOR_STATUS_TRANSITIONS[currentEstado]];
    if (
      sinRespuestaVecino &&
      (currentEstado === "completado" || currentEstado === "rechazado")
    ) {
      base.push("en_proceso");
    }
    return base;
  }

  return [];
}

export function canTransitionEstado(
  rol: RolUsuario,
  from: EstadoRequerimiento,
  to: EstadoRequerimiento,
  context?: EstadoTransitionContext
): boolean {
  if (from === to) return true;
  return getAllowedNextStates(rol, from, context).includes(to);
}
