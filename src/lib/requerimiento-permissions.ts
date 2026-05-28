import {
  EstadoRequerimiento,
  RequerimientoDTO,
  TipoRequerimiento,
  requiereRespuestaFinalPorAdmin,
  rolAdminParaTipo,
} from "@/types/requerimiento.types";
import { RolUsuario, esRolAdminPlataforma } from "@/types/usuario.types";
import { SessionUser } from "@/types/auth.types";

/**
 * Matriz de transiciones por rol.
 *
 * - admin / admin-municipal / admin-transparencia: NO pueden cambiar estado
 *   manualmente. La derivación pendiente → derivado se hace con «Derivar».
 *   El cierre completado/rechazado solo vía modal «Respuesta final al requerimiento».
 *
 * - director: opera entre derivado / en_proceso / esperas; deriva a respuesta
 *   final al admin municipal (o transparencia) desde proceso o esperas.
 *
 * - superadmin y administradora-municipal: todas las transiciones.
 */
const ADMIN_STATUS_TRANSITIONS: Record<EstadoRequerimiento, EstadoRequerimiento[]> = {
  pendiente: [],
  derivado: [],
  en_proceso: [],
  en_espera_1: [],
  en_espera_2: [],
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
 * - admin (legacy) / admin-municipal: tipos municipales incl. Solicitud Vecinal.
 * - admin-transparencia: solo Solicitud de transparencia.
 * - director: no deriva desde pendiente.
 */
export function canDerivarRequerimiento(
  rol: RolUsuario,
  tipo?: TipoRequerimiento | string
): boolean {
  if (rol === "superadmin" || rol === "administradora-municipal") return true;
  if (!esRolAdminPlataforma(rol)) return false;

  if (!tipo) return true;

  const rolEsperado = rolAdminParaTipo(tipo as TipoRequerimiento);
  if (!rolEsperado) return false;

  if (rol === "admin") return rolEsperado === "admin-municipal";
  return rol === rolEsperado;
}

export function canSendCitizenResponse(rol: RolUsuario): boolean {
  return (
    rol === "superadmin" ||
    rol === "administradora-municipal" ||
    esRolAdminPlataforma(rol) ||
    rol === "director"
  );
}

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
  estadoAnteriorReapertura?: EstadoRequerimiento;
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

/** Derivar al admin para respuesta final: desde en_proceso o esperas. */
export function canDerivarRespuestaFinal(
  user: SessionUser,
  req: Pick<RequerimientoDTO, "estado" | "tipoRequerimiento" | "respuestasVecino">
): boolean {
  if ((req.respuestasVecino?.length ?? 0) > 0) return false;
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

/** Admin asignado envía respuesta final al vecino en derivado_respuesta_final. */
export function canEnviarRespuestaFinal(
  user: SessionUser,
  req: Pick<
    RequerimientoDTO,
    "estado" | "tipoRequerimiento" | "adminAsignadoRespuesta" | "respuestasVecino"
  >
): boolean {
  if ((req.respuestasVecino?.length ?? 0) > 0) return false;
  if (!requiereRespuestaFinalPorAdmin(req.tipoRequerimiento)) return false;
  if (req.estado !== "derivado_respuesta_final") return false;
  if (user.rol === "superadmin" || user.rol === "administradora-municipal") return true;
  if (esRolAdminPlataforma(user.rol)) {
    return !!req.adminAsignadoRespuesta && req.adminAsignadoRespuesta.uid === user.uid;
  }
  return false;
}

export function puedeRevertirEstadoPorDatos(
  req: Pick<RequerimientoDTO, "respuestasVecino" | "historialEstados">
): boolean {
  if ((req.respuestasVecino?.length ?? 0) > 0) return false;
  if ((req.historialEstados?.length ?? 0) < 2) return false;
  return true;
}

export function canRevertirEstado(
  rol: RolUsuario,
  req: Pick<RequerimientoDTO, "respuestasVecino" | "historialEstados">
): boolean {
  if (rol !== "superadmin") return false;
  return puedeRevertirEstadoPorDatos(req);
}
