import { NextRequest } from "next/server";
import { reporteService } from "@/services/reporte.service";
import { requireReportesAccess, getDireccionRestriccion } from "@/lib/auth-guard";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";
import { requerimientoFiltersSchema } from "@/lib/validations/requerimiento-filters.schema";
import { getRequerimientoListFiltersFromRequest } from "@/lib/api/requerimiento-filters-from-request";

const log = createRouteLogger("/api/reportes");

/**
 * GET /api/reportes — Generate report data
 * Solo superadmin y administradora municipal. Filtrado por dirección para roles restringidos.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireReportesAccess();
    if (authResult.error) return authResult.error;

    const requestFilters = getRequerimientoListFiltersFromRequest(request);
    const rawFilters = { ...requestFilters, limit: requestFilters.limit || 200 };
    const parsedFilters = requerimientoFiltersSchema.safeParse(rawFilters);
    if (!parsedFilters.success) {
      return createErrorResponse(400, "Filtros inválidos", parsedFilters.error.issues);
    }

    const direccionRestriccion = getDireccionRestriccion(authResult.user);
    const data = await reporteService.generateReportData(parsedFilters.data, direccionRestriccion);

    return createSuccessResponse(data);
  } catch (error) {
    log.error({ error }, "Error generating report");
    return createErrorResponse(500, "Error al generar el reporte");
  }
}
