import { NextRequest } from "next/server";
import { requerimientoService } from "@/services/requerimiento.service";
import { requerimientoUpdateSchema } from "@/lib/validations/requerimiento.schema";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";
import { sanitizeText } from "@/lib/utils/sanitize";
import { canDeleteRequerimiento, canTransitionEstado } from "@/lib/requerimiento-permissions";
import type { EstadoRequerimiento } from "@/types/requerimiento.types";
import {
  RequerimientoRouteParams,
  requireRequerimientoWithAccess,
} from "@/lib/api/requerimiento-route-guards";

const log = createRouteLogger("/api/requerimientos/[id]");

/**
 * GET /api/requerimientos/:id — Get requerimiento detail
 */
export async function GET(request: NextRequest, routeParams: RequerimientoRouteParams) {
  try {
    const access = await requireRequerimientoWithAccess(routeParams, {
      forbidden: "No tiene permisos para ver este requerimiento",
    });
    if (access.error) return access.error;

    return createSuccessResponse(access.requerimiento);
  } catch (error) {
    log.error({ error }, "Error getting requerimiento");
    return createErrorResponse(500, "Error al obtener el requerimiento");
  }
}

/**
 * PATCH /api/requerimientos/:id — Update status/notes
 */
export async function PATCH(request: NextRequest, routeParams: RequerimientoRouteParams) {
  try {
    const access = await requireRequerimientoWithAccess(routeParams, {
      forbidden: "No tiene permisos para editar este requerimiento",
    });
    if (access.error) return access.error;

    const { id, user, requerimiento: existing } = access;
    const body = await request.json();
    if (typeof body.nota === "string") {
      body.nota = sanitizeText(body.nota);
    }

    const parsed = requerimientoUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(400, "Datos inválidos", parsed.error.issues);
    }

    const hist = existing.historialEstados || [];
    const estadoAnteriorReapertura =
      (existing.estado === "completado" || existing.estado === "rechazado") &&
      (existing.respuestasVecino?.length ?? 0) === 0 &&
      hist.length >= 2
        ? (hist[hist.length - 2]!.estado as EstadoRequerimiento)
        : undefined;

    // Validate status transition by role
    const transitionContext = {
      hasRespuestaVecino: (existing.respuestasVecino?.length ?? 0) > 0,
      estadoAnteriorReapertura,
      tipoRequerimiento: existing.tipoRequerimiento,
    };
    const nextEstado = parsed.data.estado as EstadoRequerimiento | undefined;
    if (
      nextEstado &&
      !canTransitionEstado(user.rol, existing.estado, nextEstado, transitionContext)
    ) {
      return createErrorResponse(403, "No tiene permisos para realizar este cambio de estado");
    }

    // No pasar a pendiente desde en proceso si sigue habiendo evidencia (debe eliminarse antes)
    if (
      parsed.data.estado === "pendiente" &&
      existing.estado === "en_proceso" &&
      existing.evidenciaResolucion
    ) {
      return createErrorResponse(
        403,
        "Debe eliminar la evidencia de resolución antes de volver el requerimiento a pendiente"
      );
    }

    // Block state changes when citizen response was already sent
    if (
      parsed.data.estado &&
      parsed.data.estado !== existing.estado &&
      (existing.estado === "completado" || existing.estado === "rechazado") &&
      existing.respuestasVecino &&
      existing.respuestasVecino.length > 0
    ) {
      return createErrorResponse(
        403,
        "No se puede cambiar el estado porque ya se envió una respuesta al vecino"
      );
    }

    // Update status if provided
    if (nextEstado) {
      await requerimientoService.updateEstado(
        id,
        nextEstado,
        user.uid,
        parsed.data.nota,
        existing
      );
    }

    // Add note if provided without status change
    if (parsed.data.nota && !parsed.data.estado) {
      await requerimientoService.addNota(id, parsed.data.nota, user.uid);
    }

    return createSuccessResponse(null, "Requerimiento actualizado exitosamente");
  } catch (error) {
    log.error({ error }, "Error updating requerimiento");
    return createErrorResponse(500, "Error al actualizar el requerimiento");
  }
}

/**
 * DELETE /api/requerimientos/:id — Delete (superadmin only)
 */
export async function DELETE(_request: NextRequest, routeParams: RequerimientoRouteParams) {
  try {
    const access = await requireRequerimientoWithAccess(routeParams);
    if (access.error) return access.error;
    if (!canDeleteRequerimiento(access.user.rol)) {
      return createErrorResponse(403, "No tiene permisos para eliminar requerimientos");
    }

    await requerimientoService.delete(access.id, access.requerimiento);

    return createSuccessResponse(null, "Requerimiento eliminado exitosamente");
  } catch (error) {
    log.error({ error }, "Error deleting requerimiento");
    return createErrorResponse(500, "Error al eliminar el requerimiento");
  }
}
