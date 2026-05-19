import { NextRequest } from "next/server";
import { requerimientoService } from "@/services/requerimiento.service";
import { requireAuth } from "@/lib/auth-guard";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";
import { z } from "zod";
import {
  RequerimientoRouteParams,
  requireRequerimientoWithAccess,
} from "@/lib/api/requerimiento-route-guards";

const log = createRouteLogger("/api/requerimientos/[id]/evidencia");

const LINK_PATTERN = /^https:\/\/(.*\.(sharepoint\.com|google\.com|drive\.google\.com|docs\.google\.com|1drv\.ms|onedrive\.live\.com))/i;

const evidenciaDocumentoSchema = z.object({
  tipo: z.literal("documento"),
  nombre: z.string().min(1),
  nombreR2: z.string().min(1),
  url: z.string().min(1),
  tamanio: z.number().max(Math.floor(2.5 * 1024 * 1024), "El archivo no puede superar 2.5 MB"),
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
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    if (authResult.user.rol !== "superadmin" && authResult.user.rol !== "director") {
      return createErrorResponse(403, "Solo el director o superadmin pueden adjuntar evidencia de resolución");
    }

    const access = await requireRequerimientoWithAccess(routeParams, {
      forbidden: "No tiene permisos para acceder a este requerimiento",
    });
    if (access.error) return access.error;

    if (access.requerimiento.estado !== "en_proceso") {
      return createErrorResponse(400, "Solo se puede adjuntar evidencia cuando el requerimiento está en proceso de solución");
    }

    const body = await request.json();
    const parsed = evidenciaSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(400, "Datos inválidos", parsed.error.issues);
    }

    await requerimientoService.setEvidenciaResolucion(
      access.id,
      parsed.data,
      authResult.user.uid
    );

    return createSuccessResponse(null, "Evidencia de resolución adjuntada exitosamente");
  } catch (error) {
    log.error({ error }, "Error adjuntando evidencia de resolución");
    const message = error instanceof Error ? error.message : "Error al adjuntar la evidencia";
    return createErrorResponse(500, message);
  }
}
