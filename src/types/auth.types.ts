import { RolUsuario } from "./usuario.types";

export interface SessionUser {
  uid: string;
  email: string;
  nombre: string;
  rol: RolUsuario;
  direccionAsignada?: string;
  direccionAsignadas?: string[];
}

export interface FirebaseCustomClaims {
  rol: RolUsuario;
  direccionAsignada?: string;
  direccionAsignadas?: string[];
}

export interface DecodedSessionToken {
  uid: string;
  email: string;
  rol: RolUsuario;
  direccionAsignada?: string;
  direccionAsignadas?: string[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  error: string | null;
}
