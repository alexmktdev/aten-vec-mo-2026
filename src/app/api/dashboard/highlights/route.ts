import { requerimientoService } from "@/services/requerimiento.service";
import { requireAuth } from "@/lib/auth-guard";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";

const log = createRouteLogger("/api/dashboard/highlights");
const ROLES_BLOQUEADOS_DASHBOARD = new Set(["director", "admin-municipal", "admin-transparencia"]);

/**
 * GET /api/dashboard/highlights — Destacados recientes y urgentes del panel.
 * Alcance global para todos los usuarios autenticados (sin filtrar por dirección asignada).
 */
export async function GET() {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;
    if (ROLES_BLOQUEADOS_DASHBOARD.has(authResult.user.rol)) {
      return createErrorResponse(403, "No tiene permisos para acceder al panel de control");
    }

    const highlights = await requerimientoService.getDashboardHighlights();

    return createSuccessResponse(highlights);
  } catch (error) {
    log.error({ error }, "Error getting dashboard highlights");
    return createErrorResponse(500, "Error al obtener destacados del dashboard");
  }
}
