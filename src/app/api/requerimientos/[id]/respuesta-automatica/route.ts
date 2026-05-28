import { createErrorResponse } from "@/lib/utils/response";
import { RequerimientoRouteParams, requireRequerimientoWithAccess } from "@/lib/api/requerimiento-route-guards";

/**
 * POST /api/requerimientos/:id/respuesta-automatica
 * @deprecated Use «Respuesta final al requerimiento» desde derivado_respuesta_final.
 */
export async function POST(_request: Request, routeParams: RequerimientoRouteParams) {
  const access = await requireRequerimientoWithAccess(routeParams, {
    forbidden: "No tiene permisos para responder este requerimiento",
  });
  if (access.error) return access.error;

  return createErrorResponse(
    410,
    "Este endpoint ya no se utiliza. Derive al admin municipal y envíe la respuesta final desde el modal correspondiente."
  );
}
