import type { SessionUser } from "@/types/auth.types";
import type { EstadoRequerimiento } from "@/types/requerimiento.types";
import type { RolUsuario } from "@/types/usuario.types";

export const ROLES_RESPONSABLE_DIRECCION: readonly RolUsuario[] = [
  "director",
  "administradora-municipal",
];

export const ESTADOS_FLUJO_DIRECTOR: readonly EstadoRequerimiento[] = [
  "derivado",
  "en_proceso",
  "en_espera_1",
  "en_espera_2",
];

type UsuarioConDirecciones = Pick<
  SessionUser,
  "direccionAsignada" | "direccionAsignadas"
>;

export function getDireccionesAsignadasUsuario(user: UsuarioConDirecciones): string[] {
  const fromArray = user.direccionAsignadas?.filter(Boolean) ?? [];
  if (fromArray.length > 0) return Array.from(new Set(fromArray));
  return user.direccionAsignada ? [user.direccionAsignada] : [];
}

export function esResponsableDeDireccion(
  user: Pick<SessionUser, "rol" | "direccionAsignada" | "direccionAsignadas">,
  direccionMunicipal?: string
): boolean {
  if (!direccionMunicipal) return false;
  if (!ROLES_RESPONSABLE_DIRECCION.includes(user.rol)) return false;
  return getDireccionesAsignadasUsuario(user).includes(direccionMunicipal);
}

/** Admin municipal con dirección asignada opera como directora en requerimientos ya derivados a esa dirección. */
export function actuaComoDirectorEnRequerimiento(
  user: Pick<SessionUser, "rol" | "direccionAsignada" | "direccionAsignadas">,
  req: { direccionMunicipal?: string; estado: EstadoRequerimiento }
): boolean {
  if (user.rol !== "administradora-municipal") return false;
  if (!esResponsableDeDireccion(user, req.direccionMunicipal)) return false;
  return ESTADOS_FLUJO_DIRECTOR.includes(req.estado);
}

/** Flujo de directora (nota obligatoria, transiciones restringidas, evidencia). */
export function aplicaFlujoDirectorEnRequerimiento(
  user: Pick<SessionUser, "rol" | "direccionAsignada" | "direccionAsignadas"> | undefined,
  req: { direccionMunicipal?: string; estado: EstadoRequerimiento }
): boolean {
  if (!user) return false;
  if (user.rol === "director") return true;
  return actuaComoDirectorEnRequerimiento(user, req);
}

export function puedeGestionarEvidenciaResolucion(
  user: Pick<SessionUser, "rol" | "direccionAsignada" | "direccionAsignadas">,
  req: { direccionMunicipal?: string; estado: EstadoRequerimiento }
): boolean {
  if (user.rol === "superadmin") return true;
  if (user.rol === "director") return true;
  return actuaComoDirectorEnRequerimiento(user, req);
}
