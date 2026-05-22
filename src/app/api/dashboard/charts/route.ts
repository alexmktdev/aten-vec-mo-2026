import { requerimientoService } from "@/services/requerimiento.service";
import { requireAuth } from "@/lib/auth-guard";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";

const log = createRouteLogger("/api/dashboard/charts");

/**
 * GET /api/dashboard/charts — Agregados para gráficos de torta (alcance global municipal).
 */
export async function GET() {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const charts = await requerimientoService.getDashboardCharts();

    return createSuccessResponse(charts);
  } catch (error) {
    log.error({ error }, "Error getting dashboard charts");
    return createErrorResponse(500, "Error al obtener datos de gráficos");
  }
}
