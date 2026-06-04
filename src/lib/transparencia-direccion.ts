import { getDireccionLabel } from "@/constants/direcciones";

/** Dirección fija para solicitudes de transparencia (derivación y gestión). */
export const TRANSPARENCIA_DIRECCION_KEY = "SECRETARIA";

export function esSolicitudTransparencia(tipoRequerimiento: string): boolean {
  return tipoRequerimiento === "Solicitud de transparencia";
}

export function resolverDireccionMunicipal(
  tipoRequerimiento: string,
  direccionMunicipal?: string,
  direccionMunicipalLabel?: string
): { direccionMunicipal: string; direccionMunicipalLabel: string } {
  if (esSolicitudTransparencia(tipoRequerimiento)) {
    return {
      direccionMunicipal: TRANSPARENCIA_DIRECCION_KEY,
      direccionMunicipalLabel: getDireccionLabel(TRANSPARENCIA_DIRECCION_KEY),
    };
  }
  const dir = direccionMunicipal || "";
  return {
    direccionMunicipal: dir,
    direccionMunicipalLabel: direccionMunicipalLabel || (dir ? getDireccionLabel(dir) : ""),
  };
}

export function necesitaPersistirDireccionTransparencia(
  tipoRequerimiento: string,
  direccionMunicipal?: string
): boolean {
  return (
    esSolicitudTransparencia(tipoRequerimiento) &&
    direccionMunicipal !== TRANSPARENCIA_DIRECCION_KEY
  );
}
