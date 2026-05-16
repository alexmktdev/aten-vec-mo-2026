import { NextRequest } from "next/server";
import { requerimientoService } from "@/services/requerimiento.service";
import { requerimientoUpdateSchema } from "@/lib/validations/requerimiento.schema";
import { requireAuth } from "@/lib/auth-guard";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";
import { sanitizeText } from "@/lib/utils/sanitize";
import { canDeleteRequerimiento, canTransitionEstado } from "@/lib/requerimiento-permissions";
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

    // Validate status transition by role
    if (parsed.data.estado && !canTransitionEstado(user.rol, existing.estado, parsed.data.estado)) {
      return createErrorResponse(403, "No tiene permisos para realizar este cambio de estado");
    }

    // Update status if provided
    if (parsed.data.estado) {
      await requerimientoService.updateEstado(
        id,
        parsed.data.estado,
        user.uid,
        parsed.data.nota
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
export async function DELETE(request: NextRequest, routeParams: RequerimientoRouteParams) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;
    if (!canDeleteRequerimiento(authResult.user.rol)) {
      return createErrorResponse(403, "No tiene permisos para eliminar requerimientos");
    }

    const access = await requireRequerimientoWithAccess(routeParams);
    if (access.error) return access.error;

    await requerimientoService.delete(access.id);

    return createSuccessResponse(null, "Requerimiento eliminado exitosamente");
  } catch (error) {
    log.error({ error }, "Error deleting requerimiento");
    return createErrorResponse(500, "Error al eliminar el requerimiento");
  }
}
