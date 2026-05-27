import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { createErrorResponse, createSuccessResponse } from "@/lib/utils/response";
import { DIRECCIONES_KEYS } from "@/constants/direcciones";
import { getCorreoDerivacionParaDireccion } from "@/lib/direccion-correo-derivacion";

/**
 * GET /api/direcciones/correo-derivacion?direccion=SECRETARIA
 * Correo esperado al derivar (director activo o fallback configurado).
 */
export async function GET(request: NextRequest) {
  const authResult = await requireRole(
    "superadmin",
    "admin",
    "admin-municipal",
    "admin-transparencia",
    "administradora-municipal"
  );
  if (authResult.error) return authResult.error;

  const direccion = request.nextUrl.searchParams.get("direccion") || "";
  if (!DIRECCIONES_KEYS.includes(direccion as (typeof DIRECCIONES_KEYS)[number])) {
    return createErrorResponse(400, "Dirección municipal inválida");
  }

  const correo = await getCorreoDerivacionParaDireccion(direccion);
  if (!correo) {
    return createErrorResponse(404, "No hay correo configurado para esta dirección");
  }

  return createSuccessResponse({ direccion, correo });
}
