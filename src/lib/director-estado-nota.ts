import type { EstadoRequerimiento } from "@/types/requerimiento.types";
import type { SessionUser } from "@/types/auth.types";
import { aplicaFlujoDirectorEnRequerimiento } from "@/lib/director-direccion";

export const MENSAJE_DIRECTOR_NOTA_OBLIGATORIA =
  "Como director, debe escribir una nota antes de cambiar el estado. La nota quedará registrada en el historial (nombre, rol y texto) para que la vean los administradores del sistema.";

export const MENSAJE_DIRECTOR_CAMBIO_ESTADO_OBLIGATORIO =
  "Seleccione el nuevo estado del requerimiento. Al confirmar, se guardará su nota y el cambio de estado en el historial (nombre, rol y texto).";

type RequerimientoFlujoDirector = {
  direccionMunicipal?: string;
  estado: EstadoRequerimiento;
};

/** El director no puede guardar una nota sin cambiar el estado al mismo tiempo. */
export function directorIntentaGuardarSoloNota(
  user: Pick<SessionUser, "rol" | "direccionAsignada" | "direccionAsignadas"> | undefined,
  req: RequerimientoFlujoDirector,
  estadoNuevo: EstadoRequerimiento | undefined,
  nota?: string
): boolean {
  if (!aplicaFlujoDirectorEnRequerimiento(user, req)) return false;
  if (!nota?.trim()) return false;
  return !estadoNuevo || estadoNuevo === req.estado;
}

/** El director debe adjuntar nota en cada transición de estado distinta al actual. */
export function directorDebeAgregarNotaAntesDeCambiarEstado(
  user: Pick<SessionUser, "rol" | "direccionAsignada" | "direccionAsignadas"> | undefined,
  req: RequerimientoFlujoDirector,
  estadoNuevo: EstadoRequerimiento | undefined,
  nota?: string
): boolean {
  if (!aplicaFlujoDirectorEnRequerimiento(user, req)) return false;
  if (!estadoNuevo || estadoNuevo === req.estado) return false;
  return !nota?.trim();
}
