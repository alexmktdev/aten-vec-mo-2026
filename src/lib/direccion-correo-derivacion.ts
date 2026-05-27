import { getCorreoDireccion } from "@/constants/direcciones-correos";
import { usuarioRepository } from "@/repositories/usuario.repository";
import { normalizeEmail } from "@/lib/utils/sanitize";

/**
 * Correo al derivar un requerimiento a una dirección:
 * 1) email del director activo asignado a esa dirección;
 * 2) fallback al mapa estático en direcciones-correos.ts.
 */
export async function getCorreoDerivacionParaDireccion(direccionMunicipal: string): Promise<string> {
  const director = await usuarioRepository.getDirectorActivoPorDireccion(direccionMunicipal);
  if (director?.email) {
    return normalizeEmail(director.email);
  }
  return getCorreoDireccion(direccionMunicipal);
}
