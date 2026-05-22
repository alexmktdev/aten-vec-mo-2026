import { requireReportesAccess, getDireccionRestriccion } from "@/lib/auth-guard";
import { createErrorResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";
import { requerimientoService } from "@/services/requerimiento.service";
import { buildEstadisticasCompletoBuffer } from "@/lib/reportes/excel-completo";

const log = createRouteLogger("/api/reportes/export/excel");

/**
 * GET /api/reportes/export/excel
 * Solo superadmin y administradora municipal.
 * Libro Excel multipestaña: estadísticas globales, por dirección, porcentajes,
 * detalle de todos los requerimientos, historial, notas, respuestas al vecino,
 * documentos y evidencia.
 *
 * Alcance: todos los requerimientos visibles según el rol (sin filtros de la UI).
 */
export async function GET() {
  try {
    const authResult = await requireReportesAccess();
    if (authResult.error) return authResult.error;

    const direccionRestricion = getDireccionRestriccion(authResult.user);
    const rows = await requerimientoService.getForReport({}, direccionRestricion);

    const alcance =
      !direccionRestricion || direccionRestricion.length === 0
        ? "Todos los requerimientos del sistema (según permisos del usuario autenticado)."
        : `Filtrado por dirección(es) municipal(es) asignadas al rol: ${direccionRestricion.join(", ")}.`;

    const buffer = await buildEstadisticasCompletoBuffer(rows, {
      exportadoEnISO: new Date().toISOString(),
      alcance,
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="estadisticas-requerimientos-completo.xlsx"`,
      },
    });
  } catch (error) {
    log.error({ error }, "Error exporting excel report");
    return createErrorResponse(500, "Error al exportar reporte Excel");
  }
}
