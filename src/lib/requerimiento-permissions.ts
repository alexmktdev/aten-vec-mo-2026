import {
  EstadoRequerimiento,
  RequerimientoDTO,
  TipoRequerimiento,
  requiereRespuestaDirectaDirector,
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
 * - director: opera entre derivado / en_proceso / esperas; el cierre manual a
 *   completado/rechazado desde proceso o esperas solo aplica a tipos donde el
 *   director envía la respuesta al vecino (p. ej. Solicitud Vecinal). Si el tipo
 *   requiere respuesta final por admin, el director solo puede derivar a
 *   respuesta final; el admin cerrará al enviar el correo.
 *
 * - superadmin y administradora-municipal: todas las transiciones.
 */
const ADMIN_STATUS_TRANSITIONS: Record<EstadoRequerimiento, EstadoRequerimiento[]> = {
  pendiente: [],
  derivado: [],
  en_proceso: [],
  en_espera_1: [],
  en_espera_2: [],
  // El estado se actualiza cuando el admin envía la respuesta final.
  derivado_respuesta_final: ["completado", "rechazado"],
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
  derivado_respuesta_final: ["completado", "rechazado"],
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
    if (
      sinRespuestaVecino &&
      (currentEstado === "completado" || currentEstado === "rechazado") &&
      context?.estadoAnteriorReapertura
    ) {
      next.push(context.estadoAnteriorReapertura);
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
 * Solo el director (o superadmin) puede derivar el requerimiento al admin
 * para la respuesta final, y solo para los tipos que la requieren
 * (Información / Reclamo / Sugerencia / Felicitación / Solicitud de
 * transparencia).
 */
export function canDerivarRespuestaFinal(
  user: SessionUser,
  req: Pick<RequerimientoDTO, "estado" | "tipoRequerimiento">
): boolean {
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
 * Quien envía la respuesta final al vecino:
 *  - Si el tipo es Solicitud Vecinal, lo hace el director responsable (o
 *    superadmin / administradora-municipal).
 *  - Si el tipo es Información / Reclamo / Sugerencia / Felicitación, solo el
 *    admin-municipal que el director eligió (adminAsignadoRespuesta.uid ===
 *    user.uid). El superadmin y la administradora-municipal pueden hacerlo
 *    también.
 *  - Si el tipo es Solicitud de transparencia, solo el admin-transparencia
 *    asignado por el director de Secretaría Municipal (o superadmin /
 *    administradora-municipal).
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

  if (requiereRespuestaDirectaDirector(tipo)) {
    if (
      req.estado !== "en_proceso" &&
      req.estado !== "en_espera_1" &&
      req.estado !== "en_espera_2"
    ) {
      return false;
    }
    return (
      user.rol === "director" ||
      user.rol === "superadmin" ||
      user.rol === "administradora-municipal"
    );
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
 * Revertir un paso en el historial de estados. Permitido mientras no se haya
 * enviado correo al vecino, para corregir errores (p. ej. cerrar sin responder).
 * Incluye admin (legacy/municipal/transparencia) y director además de
 * superadmin y administradora-municipal.
 */
export function canRevertirEstado(
  rol: RolUsuario,
  req: Pick<RequerimientoDTO, "respuestasVecino" | "historialEstados">
): boolean {
  if ((req.respuestasVecino?.length ?? 0) > 0) return false;
  if ((req.historialEstados?.length ?? 0) < 2) return false;
  return (
    rol === "superadmin" ||
    rol === "administradora-municipal" ||
    rol === "director" ||
    esRolAdminPlataforma(rol)
  );
}
