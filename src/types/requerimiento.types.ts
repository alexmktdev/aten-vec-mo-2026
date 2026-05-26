import { Timestamp } from "firebase-admin/firestore";

export const ESTADOS_REQUERIMIENTO = [
  "pendiente",
  "derivado",
  "en_proceso",
  "en_espera_1",
  "en_espera_2",
  "derivado_respuesta_final",
  "completado",
  "rechazado",
] as const;

export type EstadoRequerimiento = (typeof ESTADOS_REQUERIMIENTO)[number];

export const TIPOS_REQUERIMIENTO = [
  "Información",
  "Reclamo",
  "Sugerencia",
  "Felicitación",
  "Solicitud Vecinal",
  "Solicitud de transparencia",
] as const;

export type TipoRequerimiento = (typeof TIPOS_REQUERIMIENTO)[number];

/** Tipos cuya respuesta final al vecino la envía un admin (no el director). */
export const TIPOS_RESPUESTA_FINAL_ADMIN: readonly TipoRequerimiento[] = [
  "Información",
  "Reclamo",
  "Sugerencia",
  "Felicitación",
];

/** Tipos cuya respuesta final al vecino la envía el propio director. */
export const TIPOS_RESPUESTA_DIRECTA_DIRECTOR: readonly TipoRequerimiento[] = [
  "Solicitud Vecinal",
  "Solicitud de transparencia",
];

export function requiereRespuestaFinalPorAdmin(tipo: string): boolean {
  return TIPOS_RESPUESTA_FINAL_ADMIN.includes(tipo as TipoRequerimiento);
}

export function requiereRespuestaDirectaDirector(tipo: string): boolean {
  return TIPOS_RESPUESTA_DIRECTA_DIRECTOR.includes(tipo as TipoRequerimiento);
}

export const TIPOS_INMUEBLE = ["Casa", "Departamento", "Oficina"] as const;

export type TipoInmueble = (typeof TIPOS_INMUEBLE)[number];

export const REGIONES_CHILE = [
  "Arica y Parinacota",
  "Tarapacá",
  "Antofagasta",
  "Atacama",
  "Coquimbo",
  "Valparaíso",
  "Región Metropolitana",
  "O'Higgins",
  "Maule",
  "Ñuble",
  "Biobío",
  "La Araucanía",
  "Los Ríos",
  "Los Lagos",
  "Aysén",
  "Magallanes",
] as const;

export type RegionChile = (typeof REGIONES_CHILE)[number];

export interface VecinoData {
  nombre: string;
  primerApellido: string;
  segundoApellido?: string;
  rut: string;
  telefono: string;
  email: string;
  region: string;
  comuna: string;
  direccion: string;
  tipoInmueble: TipoInmueble;
}

export interface DocumentoRequerimiento {
  nombre: string;
  nombreR2: string;
  url: string;
  tipo: string;
  tamanio: number;
}

export interface HistorialEstado {
  estado: string;
  fecha: Timestamp | Date | string;
  usuarioId?: string;
  nota?: string;
}

export interface NotaRequerimiento {
  contenido: string;
  usuarioId: string;
  fecha: Timestamp | Date | string;
}

export interface RespuestaVecino {
  emailDestino: string;
  asunto: string;
  mensaje: string;
  usuarioId: string;
  fecha: Timestamp | Date | string;
}

export interface EvidenciaResolucion {
  tipo: "documento" | "link";
  nombre?: string;
  nombreR2?: string;
  url: string;
  tamanio?: number;
  fecha: Timestamp | Date | string;
  usuarioId: string;
}

export interface AdminAsignadoRespuesta {
  uid: string;
  nombre: string;
  email: string;
  asignadoEn: Timestamp | Date | string;
  asignadoPor: string;
}

export interface Requerimiento {
  id: string;
  numeroSeguimiento: string;
  vecino: VecinoData;
  tipoRequerimiento: TipoRequerimiento;
  direccionMunicipal: string;
  direccionMunicipalLabel: string;
  categoria: string;
  descripcion: string;
  documentos: DocumentoRequerimiento[];
  estado: EstadoRequerimiento;
  historialEstados: HistorialEstado[];
  notas: NotaRequerimiento[];
  respuestasVecino?: RespuestaVecino[];
  evidenciaResolucion?: EvidenciaResolucion;
  adminAsignadoRespuesta?: AdminAsignadoRespuesta;
  fechaIngreso: Timestamp | Date | string;
  fechaLimite: Timestamp | Date | string;
  fechaResolucion?: Timestamp | Date | string;
  creadoEn: Timestamp | Date | string;
  actualizadoEn: Timestamp | Date | string;
}

// For API responses — dates serialized as strings
export interface RequerimientoDTO {
  id: string;
  numeroSeguimiento: string;
  vecino: VecinoData;
  tipoRequerimiento: TipoRequerimiento;
  direccionMunicipal: string;
  direccionMunicipalLabel: string;
  categoria: string;
  descripcion: string;
  documentos: DocumentoRequerimiento[];
  estado: EstadoRequerimiento;
  historialEstados: {
    estado: string;
    fecha: string;
    usuarioId?: string;
    nota?: string;
  }[];
  notas: {
    contenido: string;
    usuarioId: string;
    fecha: string;
  }[];
  respuestasVecino: {
    emailDestino: string;
    asunto: string;
    mensaje: string;
    usuarioId: string;
    fecha: string;
  }[];
  evidenciaResolucion?: {
    tipo: "documento" | "link";
    nombre?: string;
    nombreR2?: string;
    url: string;
    tamanio?: number;
    fecha: string;
    usuarioId: string;
  };
  adminAsignadoRespuesta?: {
    uid: string;
    nombre: string;
    email: string;
    asignadoEn: string;
    asignadoPor: string;
  };
  fechaIngreso: string;
  fechaLimite: string;
  fechaResolucion?: string;
  creadoEn: string;
  actualizadoEn: string;
  diasHabilesRestantes?: number;
  vencido?: boolean;
}

export interface RequerimientoCreateInput {
  vecino: VecinoData;
  tipoRequerimiento: TipoRequerimiento;
  direccionMunicipal?: string;
  direccionMunicipalLabel?: string;
  categoria?: string;
  descripcion: string;
  documentos: DocumentoRequerimiento[];
}

export interface RequerimientoUpdateInput {
  estado?: EstadoRequerimiento;
  nota?: string;
}

export interface RespuestaVecinoInput {
  emailDestino: string;
  asunto: string;
  mensaje: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor?: string;
  total?: number;
}

export const ESTADO_LABELS: Record<EstadoRequerimiento, string> = {
  pendiente: "Pendiente",
  derivado: "Derivado al área correspondiente",
  en_proceso: "En proceso de solución",
  en_espera_1: "Requerimiento en espera 1",
  en_espera_2: "Requerimiento en espera 2",
  derivado_respuesta_final: "Derivado para respuesta final",
  completado: "Requerimiento Completado",
  rechazado: "Requerimiento Rechazado",
};

export const ESTADO_COLORS: Record<EstadoRequerimiento, string> = {
  pendiente: "yellow",
  derivado: "blue",
  en_proceso: "orange",
  en_espera_1: "orange",
  en_espera_2: "orange",
  derivado_respuesta_final: "purple",
  completado: "green",
  rechazado: "red",
};

/** Estados en que el director puede subir/reemplazar evidencia. */
export const ESTADOS_PERMITEN_EVIDENCIA: readonly EstadoRequerimiento[] = [
  "en_proceso",
  "en_espera_1",
  "en_espera_2",
];

/** Estados desde los que se puede pasar a un estado de espera o cerrar. */
export const ESTADOS_TRABAJO_DIRECTOR: readonly EstadoRequerimiento[] = [
  "en_proceso",
  "en_espera_1",
  "en_espera_2",
];

/** Estados considerados "en curso" (no cerrados). */
export function isEstadoCerrado(estado: EstadoRequerimiento): boolean {
  return estado === "completado" || estado === "rechazado";
}
