import { NextRequest } from "next/server";
import { requerimientoService } from "@/services/requerimiento.service";
import {
  requerimientoRespuestaInmediataSchema,
  validateRespuestaVecinoMensaje,
} from "@/lib/validations/requerimiento.schema";
import { usaRespuestaAutomaticaAdminCompletado } from "@/types/requerimiento.types";
import { createErrorResponse, createSuccessResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";
import { normalizeEmail, sanitizeMultilineText, sanitizeText } from "@/lib/utils/sanitize";
import { canEnviarRespuestaInmediata } from "@/lib/requerimiento-permissions";
import {
  RequerimientoRouteParams,
  requireRequerimientoWithAccess,
} from "@/lib/api/requerimiento-route-guards";

const log = createRouteLogger("/api/requerimientos/[id]/respuesta-inmediata");

export async function POST(request: NextRequest, routeParams: RequerimientoRouteParams) {
  try {
    const access = await requireRequerimientoWithAccess(routeParams, {
      forbidden: "No tiene permisos para responder este requerimiento",
    });
    if (access.error) return access.error;
    const { id, user, requerimiento: existing } = access;

    if (!canEnviarRespuestaInmediata(user, existing)) {
      return createErrorResponse(
        403,
        "No tiene permisos para enviar una respuesta inmediata en este requerimiento"
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

    const parsed = requerimientoRespuestaInmediataSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(400, "Datos inválidos", parsed.error.issues);
    }

    const respuestaAutomaticaCompletado =
      parsed.data.cierre === "completado" &&
      usaRespuestaAutomaticaAdminCompletado(existing.tipoRequerimiento);
    const mensajeError = validateRespuestaVecinoMensaje({
      mensaje: parsed.data.mensaje,
      cierre: parsed.data.cierre,
      respuestaAutomaticaCompletado,
    });
    if (mensajeError) {
      return createErrorResponse(400, mensajeError);
    }

    await requerimientoService.enviarRespuestaInmediata(id, parsed.data, user, existing);

    return createSuccessResponse(
      null,
      "Respuesta inmediata enviada al vecino y requerimiento cerrado exitosamente"
    );
  } catch (error) {
    log.error({ error }, "Error sending immediate citizen response");
    const message =
      error instanceof Error ? error.message : "Error al enviar la respuesta inmediata al vecino";
    if (message === "Ya existe una respuesta enviada al vecino para este requerimiento") {
      return createErrorResponse(409, message);
    }
    if (
      message ===
      "Solo se puede responder de forma inmediata con el requerimiento en pendiente por derivación"
    ) {
      return createErrorResponse(400, message);
    }
    return createErrorResponse(500, "No fue posible enviar la respuesta inmediata al vecino");
  }
}
