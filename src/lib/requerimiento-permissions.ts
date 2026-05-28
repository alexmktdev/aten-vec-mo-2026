import {
  EstadoRequerimiento,
  RequerimientoDTO,
  TipoRequerimiento,
  esSolicitudVecinal,
  requiereRespuestaFinalPorAdmin,
  rolAdminParaTipo,
} from "@/types/requerimiento.types";
import { RolUsuario, esRolAdminPlataforma } from "@/types/usuario.types";
import { SessionUser } from "@/types/auth.types";

/**
 * Matriz de transiciones por rol.
 *
 * - admin / admin-municipal / admin-transparencia: NO pueden cambiar estado
 *   manualmente excepto enviar la respuesta final cuando un director les derivó
 *   un requerimiento de su tipo. La derivación pendiente → derivado se hace
 *   con el botón "Derivar".
 *
 * - director: opera entre derivado / en_proceso / esperas; puede marcar completado o
 *   rechazado en Solicitud Vecinal y luego enviar respuesta automática (completado) o
 *   derivar al admin municipal (rechazado). En los demás tipos con respuesta final por
 *   admin, el director solo deriva a respuesta final desde proceso o esperas.
 *
 * - superadmin y administradora-municipal: todas las transiciones.
 */
const ADMIN_STATUS_TRANSITIONS: Record<EstadoRequerimiento, EstadoRequerimiento[]> = {
  pendiente: [],
  derivado: [],
  en_proceso: [],
  en_espera_1: [],
  en_espera_2: [],
  // Cierre completado/rechazado solo vía modal «Respuesta final al requerimiento».
  derivado_respuesta_final: [],
  completado: [],
  rechazado: [],
};

const DIRECTOR_STATUS_TRANSITIONS: Record<EstadoRequerimiento, EstadoRequerimiento[]> = {
  pendiente: [],
  derivado: ["pendiente", "en_proceso"],
  en_proceso: ["en_espera_1", "completado", "rechazado"],
  en_espera_1: ["en_espera_2", "completado", "rechazado"],
  en_espera_2: ["completado", "rechazado"],
  derivado_respuesta_final: [],
  completado: [],
  rechazado: [],
};

const FULL_STATUS_TRANSITIONS: Record<EstadoRequerimiento, EstadoRequerimiento[]> = {
  pendiente: ["derivado"],
  derivado: ["pendiente", "en_proceso"],
  en_proceso: ["en_espera_1", "completado", "rechazado", "derivado_respuesta_final"],
  en_espera_1: ["en_espera_2", "completado", "rechazado", "derivado_respuesta_final"],
  en_espera_2: ["completado", "rechazado", "derivado_respuesta_final"],
  // Cierre completado/rechazado solo vía modal «Respuesta final al requerimiento».
  derivado_respuesta_final: [],
  completado: [],
  rechazado: [],
};

export function canDeleteRequerimiento(rol: RolUsuario): boolean {
  return rol === "superadmin";
}

/**
 * ¿Puede el rol derivar (pendiente → derivado) este tipo de requerimiento?
 *
 * - superadmin / administradora-municipal: pueden derivar cualquier tipo.
 * - admin (legacy) / admin-municipal: pueden derivar tipos de su área
 *   (Información, Reclamo, Sugerencia, Felicitación) y Solicitud Vecinal.
 * - admin-transparencia: puede derivar Solicitud de transparencia y Solicitud
 *   Vecinal.
 * - director: no deriva desde pendiente (no opera ese estado).
 *
 * Si no se especifica el tipo, devuelve true cuando el rol puede derivar AL
 * MENOS un tipo (útil para mostrar/ocultar el botón a alto nivel).
 */
export function canDerivarRequerimiento(
  rol: RolUsuario,
  tipo?: TipoRequerimiento | string
): boolean {
  if (rol === "superadmin" || rol === "administradora-municipal") return true;
  if (!esRolAdminPlataforma(rol)) return false;

  if (!tipo) return true;

  const tipoStr = tipo as TipoRequerimiento;
  if (tipoStr === "Solicitud Vecinal") return true;

  const rolEsperado = rolAdminParaTipo(tipoStr);
  if (!rolEsperado) return false;

  if (rol === "admin") return rolEsperado === "admin-municipal";
  return rol === rolEsperado;
}

/**
 * Indica si el rol puede ENVIAR el correo final al vecino a nivel general.
 * Para los tipos derivados a admin, además se requiere ser exactamente el admin
 * asignado (ver `canEnviarRespuestaFinal`).
 */
export function canSendCitizenResponse(rol: RolUsuario): boolean {
  return (
    rol === "superadmin" ||
    rol === "administradora-municipal" ||
    esRolAdminPlataforma(rol) ||
    rol === "director"
  );
}

/**
 * Edición completa del requerimiento (modal «Editar datos completos»):
 * - En completado / rechazado: nadie
 * - superadmin: en el resto de estados, siempre puede editar
 * - administradora-municipal: solo con estado pendiente
 * - admin / admin-municipal / admin-transparencia: solo con estado pendiente
 *   y siempre que el tipo del requerimiento le corresponda (o sea Solicitud
 *   Vecinal, que pueden tratar los dos admins).
 * - director: nunca
 */
export function canEditRequerimientoData(
  rol: RolUsuario,
  estado: EstadoRequerimiento,
  tipo?: TipoRequerimiento | string
): boolean {
  if (estado === "completado" || estado === "rechazado") return false;
  if (rol === "superadmin") return true;
  if (rol === "director") return false;
  if (rol === "administradora-municipal") return estado === "pendiente";
  if (esRolAdminPlataforma(rol)) {
    if (estado !== "pendiente") return false;
    return canDerivarRequerimiento(rol, tipo);
  }
  return false;
}

export interface EstadoTransitionContext {
  hasRespuestaVecino?: boolean;
  /**
   * Si el caso está en completado/rechazado y aún no hay correo al vecino,
   * es el estado previo en historial (sirve para reabrir con el mismo flujo).
   */
  estadoAnteriorReapertura?: EstadoRequerimiento;
  /** Necesario para acotar transiciones del director según el tipo de caso. */
  tipoRequerimiento?: string;
}

export function getAllowedNextStates(
  rol: RolUsuario,
  currentEstado: EstadoRequerimiento,
  context?: EstadoTransitionContext
): EstadoRequerimiento[] {
  const sinRespuestaVecino = !context?.hasRespuestaVecino;

  if (rol === "superadmin" || rol === "administradora-municipal") {
    if (currentEstado === "completado" || currentEstado === "rechazado") {
      if (sinRespuestaVecino && context?.estadoAnteriorReapertura) {
        return [context.estadoAnteriorReapertura];
      }
      return [];
    }
    return FULL_STATUS_TRANSITIONS[currentEstado];
  }

  if (esRolAdminPlataforma(rol)) {
    return ADMIN_STATUS_TRANSITIONS[currentEstado];
  }

  if (rol === "director") {
    let next = [...DIRECTOR_STATUS_TRANSITIONS[currentEstado]];
    const directorNoCierraManualPorAdmin =
      !!context?.tipoRequerimiento &&
      requiereRespuestaFinalPorAdmin(context.tipoRequerimiento) &&
      (currentEstado === "en_proceso" ||
        currentEstado === "en_espera_1" ||
        currentEstado === "en_espera_2");
    if (directorNoCierraManualPorAdmin) {
      next = next.filter((s) => s !== "completado" && s !== "rechazado");
    }
    return next;
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

/**
 * Derivar al admin para respuesta final:
 * - Tipos Información / Reclamo / … / Transparencia: desde en_proceso o esperas.
 * - Solicitud Vecinal rechazada: desde estado rechazado (sin correo al vecino aún).
 */
export function canDerivarRespuestaFinal(
  user: SessionUser,
  req: Pick<RequerimientoDTO, "estado" | "tipoRequerimiento" | "respuestasVecino">
): boolean {
  if ((req.respuestasVecino?.length ?? 0) > 0) return false;

  if (esSolicitudVecinal(req.tipoRequerimiento)) {
    if (req.estado !== "rechazado") return false;
    return (
      user.rol === "superadmin" ||
      user.rol === "director" ||
      user.rol === "administradora-municipal"
    );
  }

  if (!requiereRespuestaFinalPorAdmin(req.tipoRequerimiento)) return false;
  if (
    req.estado !== "en_proceso" &&
    req.estado !== "en_espera_1" &&
    req.estado !== "en_espera_2"
  ) {
    return false;
  }
  return user.rol === "superadmin" || user.rol === "director";
}

/**
 * Enviar respuesta automática (Solicitud Vecinal completada).
 */
export function canEnviarRespuestaAutomaticaVecinal(
  user: SessionUser,
  req: Pick<RequerimientoDTO, "estado" | "tipoRequerimiento" | "respuestasVecino">
): boolean {
  if (!esSolicitudVecinal(req.tipoRequerimiento)) return false;
  if (req.estado !== "completado") return false;
  if ((req.respuestasVecino?.length ?? 0) > 0) return false;
  return (
    user.rol === "superadmin" ||
    user.rol === "director" ||
    user.rol === "administradora-municipal"
  );
}

/**
 * Quien envía la respuesta final al vecino (manual, admin asignado o superadmin):
 * - Solicitud Vecinal rechazada y derivada: admin municipal asignado (igual que Información).
 * - Información / Reclamo / … / Transparencia: admin asignado en derivado_respuesta_final.
 */
export function canEnviarRespuestaFinal(
  user: SessionUser,
  req: Pick<
    RequerimientoDTO,
    "estado" | "tipoRequerimiento" | "adminAsignadoRespuesta" | "respuestasVecino"
  >
): boolean {
  if ((req.respuestasVecino?.length ?? 0) > 0) return false;

  const tipo = req.tipoRequerimiento as TipoRequerimiento;

  if (esSolicitudVecinal(tipo)) {
    if (req.estado !== "derivado_respuesta_final") return false;
    if (user.rol === "superadmin" || user.rol === "administradora-municipal") return true;
    if (esRolAdminPlataforma(user.rol)) {
      return !!req.adminAsignadoRespuesta && req.adminAsignadoRespuesta.uid === user.uid;
    }
    return false;
  }

  if (requiereRespuestaFinalPorAdmin(tipo)) {
    if (req.estado !== "derivado_respuesta_final") return false;
    if (user.rol === "superadmin" || user.rol === "administradora-municipal") return true;
    if (esRolAdminPlataforma(user.rol)) {
      return !!req.adminAsignadoRespuesta && req.adminAsignadoRespuesta.uid === user.uid;
    }
    return false;
  }

  return false;
}

/**
 * Condiciones de datos para poder revertir (sin correo al vecino y con historial).
 */
export function puedeRevertirEstadoPorDatos(
  req: Pick<RequerimientoDTO, "respuestasVecino" | "historialEstados">
): boolean {
  if ((req.respuestasVecino?.length ?? 0) > 0) return false;
  if ((req.historialEstados?.length ?? 0) < 2) return false;
  return true;
}

/**
 * Revertir un paso en el historial de estados. Solo superadmin.
 */
export function canRevertirEstado(
  rol: RolUsuario,
  req: Pick<RequerimientoDTO, "respuestasVecino" | "historialEstados">
): boolean {
  if (rol !== "superadmin") return false;
  return puedeRevertirEstadoPorDatos(req);
}
