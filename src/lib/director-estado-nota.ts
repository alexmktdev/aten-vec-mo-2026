import type { EstadoRequerimiento } from "@/types/requerimiento.types";
import type { RolUsuario } from "@/types/usuario.types";

export const MENSAJE_DIRECTOR_NOTA_OBLIGATORIA =
  "Como director, debe escribir una nota antes de cambiar el estado. La nota quedará registrada en el historial (nombre, rol y texto) para que la vean los administradores del sistema.";

/** El director debe adjuntar nota en cada transición de estado distinta al actual. */
export function directorDebeAgregarNotaAntesDeCambiarEstado(
  rol: RolUsuario | undefined,
  estadoActual: EstadoRequerimiento,
  estadoNuevo: EstadoRequerimiento | undefined,
  nota?: string
): boolean {
  if (rol !== "director") return false;
  if (!estadoNuevo || estadoNuevo === estadoActual) return false;
  return !nota?.trim();
}
