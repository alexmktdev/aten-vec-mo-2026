import {
  EstadoRequerimiento,
  RequerimientoDTO,
  TipoRequerimiento,
  requiereRespuestaDirectaDirector,
  requiereRespuestaFinalPorAdmin,
} from "@/types/requerimiento.types";
import { RolUsuario } from "@/types/usuario.types";
import { SessionUser } from "@/types/auth.types";

/**
 * Matriz de transiciones por rol.
 *
 * - admin: NO puede cambiar estado manualmente excepto enviar la respuesta final
 *   cuando un director le derivó un requerimiento de los 4 tipos correspondientes.
 *   La derivación pendiente → derivado se hace con el botón "Derivar".
 *
 * - director: opera entre derivado / en_proceso / esperas / cierre.
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

export function canDerivarRequerimiento(rol: RolUsuario): boolean {
  return rol === "superadmin" || rol === "admin" || rol === "administradora-municipal";
}

/**
 * Indica si el rol puede ENVIAR el correo final al vecino. Para los tipos
 * derivados a admin, además se requiere ser exactamente el admin asignado
 * (ver `canEnviarRespuestaFinal`).
 */
export function canSendCitizenResponse(rol: RolUsuario): boolean {
  return (
    rol === "superadmin" ||
    rol === "administradora-municipal" ||
    rol === "admin" ||
    rol === "director"
  );
}

/**
 * Edición completa del requerimiento (modal «Editar datos completos»):
 * - En completado / rechazado: nadie
 * - superadmin: en el resto de estados, siempre puede editar
 * - admin / administradora-municipal: solo con estado pendiente
 * - director: nunca
 */
export function canEditRequerimientoData(rol: RolUsuario, estado: EstadoRequerimiento): boolean {
  if (estado === "completado" || estado === "rechazado") return false;
  if (rol === "superadmin") return true;
  if (rol === "director") return false;
  if (rol === "admin" || rol === "administradora-municipal") return estado === "pendiente";
  return false;
}

export interface EstadoTransitionContext {
  hasRespuestaVecino?: boolean;
  /**
   * Si el caso está en completado/rechazado y aún no hay correo al vecino,
   * es el estado previo en historial (sirve para reabrir con el mismo flujo).
   */
  estadoAnteriorReapertura?: EstadoRequerimiento;
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

  if (rol === "admin") {
    return ADMIN_STATUS_TRANSITIONS[currentEstado];
  }

  if (rol === "director") {
    const base = [...DIRECTOR_STATUS_TRANSITIONS[currentEstado]];
    if (
      sinRespuestaVecino &&
      (currentEstado === "completado" || currentEstado === "rechazado") &&
      context?.estadoAnteriorReapertura
    ) {
      base.push(context.estadoAnteriorReapertura);
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

/**
 * Solo el director (o superadmin) puede derivar el requerimiento al admin
 * para la respuesta final, y solo para los 4 tipos que la requieren.
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
 *  - Si el tipo es Solicitud Vecinal o Solicitud de transparencia, lo hace el
 *    director responsable (o superadmin / administradora-municipal).
 *  - Si el tipo es Información / Reclamo / Sugerencia / Felicitación, solo el
 *    admin que el director eligió (adminAsignadoRespuesta.uid === user.uid).
 *    El superadmin y la administradora-municipal pueden hacerlo también.
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
    if (user.rol === "admin") {
      return !!req.adminAsignadoRespuesta && req.adminAsignadoRespuesta.uid === user.uid;
    }
    return false;
  }

  return false;
}

/**
 * Revertir un paso en el historial de estados. Permitido mientras no se haya
 * enviado correo al vecino, para corregir errores (p. ej. cerrar sin responder).
 * Incluye admin y director además de superadmin y administradora-municipal.
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
    rol === "admin"
  );
}
