import { requerimientoService } from "@/services/requerimiento.service";
import { requireAuth } from "@/lib/auth-guard";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";

const log = createRouteLogger("/api/dashboard/stats");

/**
 * GET /api/dashboard/stats — Estadísticas globales del municipio.
 * Mismos totales para cualquier usuario autenticado (la restricción por dirección sólo aplica en listados/reportes).
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
