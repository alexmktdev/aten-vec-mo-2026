import { requerimientoService } from "@/services/requerimiento.service";
import { requireAuth } from "@/lib/auth-guard";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";

const log = createRouteLogger("/api/dashboard/stats");

/**
 * GET /api/dashboard/stats — Dashboard statistics
 * All authenticated roles. Always global dashboard data.
 * No server cache: live counts ensure accuracy after estado changes.
 */
export async function GET() {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const stats = await requerimientoService.getStats();

    return createSuccessResponse(stats);
  } catch (error) {
    log.error({ error }, "Error getting dashboard stats");
    return createErrorResponse(500, "Error al obtener estadísticas");
  }
}
