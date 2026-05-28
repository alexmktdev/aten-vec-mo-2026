import { requerimientoService } from "@/services/requerimiento.service";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";
import { canEnviarRespuestaAutomaticaVecinal } from "@/lib/requerimiento-permissions";
import {
  RequerimientoRouteParams,
  requireRequerimientoWithAccess,
} from "@/lib/api/requerimiento-route-guards";

const log = createRouteLogger("/api/requerimientos/[id]/respuesta-automatica");

/**
 * POST /api/requerimientos/:id/respuesta-automatica
 * Solicitud Vecinal en estado completado: envía correo genérico al vecino.
 */
export async function POST(_request: Request, routeParams: RequerimientoRouteParams) {
  try {
    const access = await requireRequerimientoWithAccess(routeParams, {
      forbidden: "No tiene permisos para enviar la respuesta automática de este requerimiento",
    });
    if (access.error) return access.error;

    const { id, user, requerimiento: existing } = access;

    if (!canEnviarRespuestaAutomaticaVecinal(user, existing)) {
      return createErrorResponse(
        403,
        "Debe marcar el requerimiento como completado y aún no haber enviado correo al vecino"
      );
    }

    await requerimientoService.enviarRespuestaAutomaticaVecinal(id, user.uid, existing);

    return createSuccessResponse(null, "Respuesta automática enviada al vecino exitosamente");
  } catch (error) {
    log.error({ error }, "Error sending automatic vecinal response");
    const message = error instanceof Error ? error.message : "Error al enviar la respuesta automática";
    if (message.includes("Ya existe una respuesta")) {
      return createErrorResponse(409, message);
    }
    if (
      message.includes("completado") ||
      message.includes("Solicitud Vecinal")
    ) {
      return createErrorResponse(400, message);
    }
    return createErrorResponse(500, "No fue posible enviar la respuesta automática");
  }
}
