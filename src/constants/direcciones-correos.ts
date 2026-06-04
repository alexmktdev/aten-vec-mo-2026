import { DIRECCIONES_KEYS, DIRECCIONES_MUNICIPALES, DireccionMunicipalKey } from "@/constants/direcciones";

/**
 * Correos por defecto al derivar cuando no hay director activo asignado a la dirección.
 * Si existe un director activo con esa dirección, prevalece su email (ver getCorreoDerivacionParaDireccion).
 */
export const CORREOS_DIRECCION: Record<DireccionMunicipalKey, string> = {
  ADMINISTRACION: "amachuca@molina.cl",
  INSPECCION: "amachuca@molina.cl",
  INNOVACION: "jtartari@molina.cl",
  SECRETARIA: "faviles@molina.cl",
  JPL: "saguilera@molina.cl",
  CONTROL: "faviles@molina.cl",
  FINANZAS: "alejandro.rojas@molina.cl",
  SECPLAN: "scelis@molina.cl",
  DIDECO: "lalbornoz@molina.cl",
  JURIDICA: "fgandarillas@molina.cl",
  TRANSITO: "jtartari@molina.cl",
  OBRAS: "lvidal@molina.cl",
  PERSONAS: "amachuca@molina.cl",
  SEGURIDAD: "fcastro@molina.cl",
  MEDIOAMBIENTE: "cescandor@molina.cl",
  SALUD: "nvillalobos@apsmolina.cl",
  EDUCACION: "juribe@daemmolina.cl",
  OPERACIONES: "jpereira@molina.cl",
};

export function getCorreoDireccion(direccionMunicipal: string): string {
  return CORREOS_DIRECCION[direccionMunicipal as DireccionMunicipalKey] || "";
}

export const DIRECCIONES_DERIVACION_OPTIONS = DIRECCIONES_KEYS.map((key) => ({
  value: key,
  label: DIRECCIONES_MUNICIPALES[key].label,
}));
