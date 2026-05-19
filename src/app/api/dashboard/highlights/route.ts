import { requerimientoService } from "@/services/requerimiento.service";
import { requireAuth } from "@/lib/auth-guard";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";

const log = createRouteLogger("/api/dashboard/highlights");

/**
 * GET /api/dashboard/highlights — Latest and urgent requerimientos for dashboard
 * No server cache: ensures fresh data after estado/note changes.
 */
export async function GET() {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const highlights = await requerimientoService.getDashboardHighlights();

    return createSuccessResponse(highlights);
  } catch (error) {
    log.error({ error }, "Error getting dashboard highlights");
    return createErrorResponse(500, "Error al obtener destacados del dashboard");
  }
}
