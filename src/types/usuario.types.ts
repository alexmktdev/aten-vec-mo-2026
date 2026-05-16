export const ROLES_USUARIO = [
  "superadmin",
  "admin",
  "administradora-municipal",
  "director",
] as const;

export type RolUsuario = (typeof ROLES_USUARIO)[number];

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
