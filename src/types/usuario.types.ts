export const ROLES_USUARIO = [
  "superadmin",
  "admin",
  "admin-municipal",
  "admin-transparencia",
  "administradora-municipal",
  "director",
] as const;

export type RolUsuario = (typeof ROLES_USUARIO)[number];

/** Roles administrativos que reciben y operan sobre los requerimientos (cualquier tipo). */
export const ROLES_ADMINS_PLATAFORMA: readonly RolUsuario[] = [
  "admin",
  "admin-municipal",
  "admin-transparencia",
];

export function esRolAdminPlataforma(rol: RolUsuario): boolean {
  return ROLES_ADMINS_PLATAFORMA.includes(rol);
}

/** Roles con acceso a la pestaña Reportes y a las exportaciones PDF/Excel asociadas. */
export const ROLES_ACCESO_REPORTES: readonly RolUsuario[] = [
  "superadmin",
  "administradora-municipal",
  "admin",
  "admin-municipal",
  "admin-transparencia",
];

export function puedeVerReportes(rol: RolUsuario): boolean {
  return ROLES_ACCESO_REPORTES.includes(rol);
}

/**
 * Roles que se pueden seleccionar al crear o editar un usuario desde el panel.
 * Se excluye el rol legacy "admin": las nuevas altas deben usar
 * admin-municipal o admin-transparencia.
 */
export const ROLES_SELECCIONABLES: readonly RolUsuario[] = [
  "superadmin",
  "administradora-municipal",
  "admin-municipal",
  "admin-transparencia",
  "director",
];

export const ROL_LABELS: Record<RolUsuario, string> = {
  superadmin: "Superadmin",
  admin: "Admin (legacy)",
  "admin-municipal": "Admin municipal",
  "admin-transparencia": "Admin transparencia",
  "administradora-municipal": "Administradora municipal",
  director: "Director",
};

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
