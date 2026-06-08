import { NextRequest } from "next/server";
import { requerimientoService } from "@/services/requerimiento.service";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";
import { z } from "zod";
import { MAX_PDF_UPLOAD_BYTES } from "@/lib/validations/upload.schema";
import {
  RequerimientoRouteParams,
  requireRequerimientoWithAccess,
} from "@/lib/api/requerimiento-route-guards";
import { puedeGestionarEvidenciaResolucion } from "@/lib/director-direccion";

const log = createRouteLogger("/api/requerimientos/[id]/evidencia");

const LINK_PATTERN = /^https:\/\/(.*\.(sharepoint\.com|google\.com|drive\.google\.com|docs\.google\.com|1drv\.ms|onedrive\.live\.com))/i;

const evidenciaDocumentoSchema = z.object({
  tipo: z.literal("documento"),
  nombre: z.string().min(1),
  nombreR2: z.string().min(1),
  url: z.string().min(1),
  tamanio: z.number().max(MAX_PDF_UPLOAD_BYTES, "El archivo no puede superar 1 MB"),
});

const evidenciaLinkSchema = z.object({
  tipo: z.literal("link"),
  url: z
    .string()
    .url("Ingrese una URL válida")
    .refine((val) => LINK_PATTERN.test(val), {
      message: "El enlace debe ser de SharePoint o Google Drive (https://...)",
    }),
});

const evidenciaSchema = z.discriminatedUnion("tipo", [
  evidenciaDocumentoSchema,
  evidenciaLinkSchema,
]);

/**
 * POST /api/requerimientos/:id/evidencia
 * Roles: superadmin, director
 */
export async function POST(request: NextRequest, routeParams: RequerimientoRouteParams) {
  try {
    const access = await requireRequerimientoWithAccess(routeParams, {
      forbidden: "No tiene permisos para acceder a este requerimiento",
    });
    if (access.error) return access.error;

    if (!puedeGestionarEvidenciaResolucion(access.user, access.requerimiento)) {
      return createErrorResponse(403, "Solo el director o superadmin pueden adjuntar evidencia de resolución");
    }

    const estadoActual = access.requerimiento.estado;
    if (
      estadoActual !== "en_proceso" &&
      estadoActual !== "en_espera_1" &&
      estadoActual !== "en_espera_2"
    ) {
      return createErrorResponse(
        400,
        "Solo se puede adjuntar evidencia mientras el requerimiento está en proceso o en espera"
      );
    }

    const body = await request.json();
    const parsed = evidenciaSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(400, "Datos inválidos", parsed.error.issues);
    }

    await requerimientoService.setEvidenciaResolucion(
      access.id,
      parsed.data,
      access.user.uid,
      access.requerimiento
    );

    return createSuccessResponse(null, "Evidencia de resolución adjuntada exitosamente");
  } catch (error) {
    log.error({ error }, "Error adjuntando evidencia de resolución");
    const message = error instanceof Error ? error.message : "Error al adjuntar la evidencia";
    return createErrorResponse(500, message);
  }
}

/**
 * DELETE /api/requerimientos/:id/evidencia
 * Quita la evidencia de resolución (solo en proceso). Roles: director, superadmin.
 */
export async function DELETE(_request: NextRequest, routeParams: RequerimientoRouteParams) {
  try {
    const access = await requireRequerimientoWithAccess(routeParams, {
      forbidden: "No tiene permisos para acceder a este requerimiento",
    });
    if (access.error) return access.error;

    if (!puedeGestionarEvidenciaResolucion(access.user, access.requerimiento)) {
      return createErrorResponse(403, "No tiene permisos para eliminar la evidencia de resolución");
    }

    const estadoActualDelete = access.requerimiento.estado;
    if (
      estadoActualDelete !== "en_proceso" &&
      estadoActualDelete !== "en_espera_1" &&
      estadoActualDelete !== "en_espera_2"
    ) {
      return createErrorResponse(
        400,
        "Solo puede eliminar evidencia mientras el requerimiento está en proceso o en espera"
      );
    }

    await requerimientoService.clearEvidenciaResolucion(access.id, access.requerimiento);

    return createSuccessResponse(null, "Evidencia de resolución eliminada");
  } catch (error) {
    log.error({ error }, "Error eliminando evidencia de resolución");
    const message = error instanceof Error ? error.message : "Error al eliminar la evidencia";
    return createErrorResponse(500, message);
  }
}
