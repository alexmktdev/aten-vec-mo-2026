import { DIRECCIONES_KEYS, DIRECCIONES_MUNICIPALES, DireccionMunicipalKey } from "@/constants/direcciones";

export const CORREOS_DIRECCION: Record<DireccionMunicipalKey, string> = {
  ADMINISTRACION: "amachuca@molina.cl",
  INSPECCION: "amachuca@molina.cl",
  INNOVACION: "jtartari@molina.cl",
  SECRETARIA: "cuentadesarrollo2013@gmail.com",
  JPL: "cuentadesarrollo2013@gmail.com",
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
  OPERACIONES: "jpereira@molina.cl",
};

export function getCorreoDireccion(direccionMunicipal: string): string {
  return CORREOS_DIRECCION[direccionMunicipal as DireccionMunicipalKey] || "";
}

export const DIRECCIONES_DERIVACION_OPTIONS = DIRECCIONES_KEYS.map((key) => ({
  value: key,
  label: DIRECCIONES_MUNICIPALES[key].label,
}));
