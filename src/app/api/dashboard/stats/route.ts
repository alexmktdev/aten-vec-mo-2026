import { requerimientoService } from "@/services/requerimiento.service";
import { requireAuth } from "@/lib/auth-guard";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";
import { cached } from "@/lib/server-cache";

const log = createRouteLogger("/api/dashboard/stats");

/**
 * GET /api/dashboard/stats — Dashboard statistics
 * All authenticated roles. Always global dashboard data.
 */
export async function GET() {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const stats = await cached("dashboard:stats:all", 180_000, () =>
      requerimientoService.getStats()
    );

    return createSuccessResponse(stats);
  } catch (error) {
    log.error({ error }, "Error getting dashboard stats");
    return createErrorResponse(500, "Error al obtener estadísticas");
  }
}
