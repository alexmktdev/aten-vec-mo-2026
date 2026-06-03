import { requerimientoService } from "@/services/requerimiento.service";
import { requireAuth } from "@/lib/auth-guard";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";

const log = createRouteLogger("/api/dashboard/stats");
const ROLES_BLOQUEADOS_DASHBOARD = new Set(["director", "admin-municipal", "admin-transparencia"]);

/**
 * GET /api/dashboard/stats — Estadísticas globales del municipio.
 * Mismos totales para cualquier usuario autenticado (la restricción por dirección sólo aplica en listados/reportes).
 */
export async function GET() {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;
    if (ROLES_BLOQUEADOS_DASHBOARD.has(authResult.user.rol)) {
      return createErrorResponse(403, "No tiene permisos para acceder al panel de control");
    }

    const stats = await requerimientoService.getStats();

    return createSuccessResponse(stats);
  } catch (error) {
    log.error({ error }, "Error getting dashboard stats");
    return createErrorResponse(500, "Error al obtener estadísticas");
  }
}
