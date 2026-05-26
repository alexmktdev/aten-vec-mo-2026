import { NextRequest } from "next/server";
import { requerimientoService } from "@/services/requerimiento.service";
import { canRevertirEstado } from "@/lib/requerimiento-permissions";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";
import {
  RequerimientoRouteParams,
  requireRequerimientoWithAccess,
} from "@/lib/api/requerimiento-route-guards";

const log = createRouteLogger("/api/requerimientos/[id]/revertir");

/**
 * POST /api/requerimientos/:id/revertir
 *
 * Revierte el último cambio de estado del requerimiento, con compensaciones
 * de plazo cuando se sale de en_espera_1 / en_espera_2 y limpieza del admin
 * asignado cuando se sale de derivado_respuesta_final.
 *
 * Solo superadmin y administradora-municipal.
 * No permitido si ya se envió respuesta al vecino.
 */
export async function POST(_request: NextRequest, routeParams: RequerimientoRouteParams) {
  try {
    const access = await requireRequerimientoWithAccess(routeParams, {
      forbidden: "No tiene permisos para revertir este requerimiento",
    });
    if (access.error) return access.error;

    const { id, user, requerimiento: existing } = access;

    if (!canRevertirEstado(user.rol, existing)) {
      return createErrorResponse(
        403,
        "No tiene permisos para revertir el estado o ya se envió correo al vecino"
      );
    }

    const result = await requerimientoService.revertirEstado(id, user.uid, existing);

    return createSuccessResponse(result, "Estado revertido exitosamente");
  } catch (error) {
    log.error({ error }, "Error revirtiendo estado");
    const message = error instanceof Error ? error.message : "Error al revertir el estado";
    return createErrorResponse(400, message);
  }
}
