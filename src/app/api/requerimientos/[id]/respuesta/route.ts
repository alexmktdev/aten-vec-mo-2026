import { NextRequest } from "next/server";
import { z } from "zod";
import { requerimientoService } from "@/services/requerimiento.service";
import { requerimientoRespuestaSchema } from "@/lib/validations/requerimiento.schema";
import { createErrorResponse, createSuccessResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";
import { normalizeEmail, sanitizeMultilineText, sanitizeText } from "@/lib/utils/sanitize";
import { canEnviarRespuestaFinal } from "@/lib/requerimiento-permissions";
import {
  RequerimientoRouteParams,
  requireRequerimientoWithAccess,
} from "@/lib/api/requerimiento-route-guards";

const log = createRouteLogger("/api/requerimientos/[id]/respuesta");

const respuestaConCierreSchema = requerimientoRespuestaSchema.extend({
  cierre: z.enum(["completado", "rechazado"]).optional(),
});

export async function POST(request: NextRequest, routeParams: RequerimientoRouteParams) {
  try {
    const access = await requireRequerimientoWithAccess(routeParams, {
      forbidden: "No tiene permisos para responder este requerimiento",
    });
    if (access.error) return access.error;
    const { id, user, requerimiento: existing } = access;

    if (!canEnviarRespuestaFinal(user, existing)) {
      return createErrorResponse(
        403,
        "No tiene permisos para enviar la respuesta final al vecino para este requerimiento"
      );
    }

    const body = await request.json();

    if (typeof body.emailDestino === "string") {
      body.emailDestino = normalizeEmail(body.emailDestino);
    }
    if (typeof body.asunto === "string") {
      body.asunto = sanitizeText(body.asunto);
    }
    if (typeof body.mensaje === "string") {
      body.mensaje = sanitizeMultilineText(body.mensaje);
    }

    const parsed = respuestaConCierreSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(400, "Datos inválidos", parsed.error.issues);
    }

    await requerimientoService.enviarRespuestaVecino(id, parsed.data, user.uid, existing);

    return createSuccessResponse(null, "Correo de respuesta enviado al vecino exitosamente");
  } catch (error) {
    log.error({ error }, "Error sending citizen response email");
    const message = error instanceof Error ? error.message : "Error al enviar la respuesta al vecino";
    if (message === "Ya existe una respuesta enviada al vecino para este requerimiento") {
      return createErrorResponse(409, message);
    }
    if (message === "El estado actual del requerimiento no permite enviar la respuesta al vecino") {
      return createErrorResponse(400, message);
    }
    return createErrorResponse(500, "No fue posible enviar la respuesta al vecino");
  }
}
