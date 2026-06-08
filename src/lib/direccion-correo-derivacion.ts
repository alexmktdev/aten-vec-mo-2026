import { getCorreoDireccion } from "@/constants/direcciones-correos";
import { usuarioRepository } from "@/repositories/usuario.repository";
import { normalizeEmail } from "@/lib/utils/sanitize";

/**
 * Correo al derivar un requerimiento a una dirección:
 * 1) email del responsable activo (director o administradora-municipal) asignado a esa dirección;
 * 2) fallback al mapa estático en direcciones-correos.ts.
 */
export async function getCorreoDerivacionParaDireccion(direccionMunicipal: string): Promise<string> {
  const responsable = await usuarioRepository.getResponsableActivoPorDireccion(direccionMunicipal);
  if (responsable?.email) {
    return normalizeEmail(responsable.email);
  }
  return getCorreoDireccion(direccionMunicipal);
}
