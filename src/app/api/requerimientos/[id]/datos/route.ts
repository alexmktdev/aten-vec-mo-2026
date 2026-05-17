import { NextRequest } from "next/server";
import { requerimientoService } from "@/services/requerimiento.service";
import { requerimientoAdminEditSchema } from "@/lib/validations/requerimiento.schema";
import { requireAuth } from "@/lib/auth-guard";
import { createErrorResponse, createSuccessResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";
import { normalizeEmail, sanitizeMultilineText, sanitizeOptionalText, sanitizeText } from "@/lib/utils/sanitize";
import { normalizeRut } from "@/lib/utils/rut";
import { canEditRequerimientoData } from "@/lib/requerimiento-permissions";
import {
  RequerimientoRouteParams,
  requireRequerimientoWithAccess,
} from "@/lib/api/requerimiento-route-guards";

const log = createRouteLogger("/api/requerimientos/[id]/datos");

export async function PATCH(request: NextRequest, routeParams: RequerimientoRouteParams) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;
    if (!canEditRequerimientoData(authResult.user.rol)) {
      return createErrorResponse(403, "No tiene permisos para editar datos del requerimiento");
    }

    const access = await requireRequerimientoWithAccess(routeParams, {
      forbidden: "No tiene permisos para editar este requerimiento",
    });
    if (access.error) return access.error;
    const { id } = access;
    const body = await request.json();

    if (body.vecino) {
      body.vecino.nombre = sanitizeText(body.vecino.nombre || "");
      body.vecino.primerApellido = sanitizeText(body.vecino.primerApellido || "");
      body.vecino.segundoApellido = sanitizeOptionalText(body.vecino.segundoApellido);
      body.vecino.rut = normalizeRut(body.vecino.rut || "");
      body.vecino.telefono = sanitizeText(body.vecino.telefono || "");
      body.vecino.email = normalizeEmail(body.vecino.email || "");
      body.vecino.region = sanitizeText(body.vecino.region || "");
      body.vecino.comuna = sanitizeText(body.vecino.comuna || "");
      body.vecino.direccion = sanitizeText(body.vecino.direccion || "");
      body.vecino.tipoInmueble = sanitizeText(body.vecino.tipoInmueble || "");
    }

    if (typeof body.descripcion === "string") {
      body.descripcion = sanitizeMultilineText(body.descripcion);
    }

    const parsed = requerimientoAdminEditSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(400, "Datos inválidos", parsed.error.issues);
    }

    await requerimientoService.updateDatos(id, parsed.data);

    return createSuccessResponse(null, "Datos del requerimiento actualizados exitosamente");
  } catch (error) {
    log.error({ error }, "Error updating requerimiento data");
    return createErrorResponse(500, "Error al actualizar los datos del requerimiento");
  }
}
