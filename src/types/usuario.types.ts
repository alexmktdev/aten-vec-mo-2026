export const ROLES_USUARIO = [
  "superadmin",
  "admin",
  "administradora-municipal",
  "director",
] as const;

export type RolUsuario = (typeof ROLES_USUARIO)[number];

/** Roles con acceso a la pestaña Reportes y a las exportaciones PDF/Excel asociadas. */
export const ROLES_ACCESO_REPORTES: readonly RolUsuario[] = ["superadmin", "administradora-municipal"];

export function puedeVerReportes(rol: RolUsuario): boolean {
  return ROLES_ACCESO_REPORTES.includes(rol);
}

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  direccionAsignada?: string;
  direccionAsignadas?: string[];
  activo: boolean;
  creadoEn: string | Date;
  actualizadoEn: string | Date;
}

export interface UsuarioCreateInput {
  nombre: string;
  email: string;
  password: string;
  rol: RolUsuario;
  direccionAsignada?: string;
  direccionAsignadas?: string[];
}

export interface UsuarioDTO {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  direccionAsignada?: string;
  direccionAsignadaLabel?: string;
  direccionAsignadas?: string[];
  direccionAsignadasLabel?: string[];
  activo: boolean;
  creadoEn: string;
  actualizadoEn: string;
}

export interface PaginatedUsuariosResponse {
  data: UsuarioDTO[];
  total: number;
}
