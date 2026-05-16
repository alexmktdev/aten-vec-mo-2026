import { NextRequest } from "next/server";
import { requireAuth, getDireccionRestriccion } from "@/lib/auth-guard";
import { createErrorResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";
import { reporteFiltersSchema } from "@/lib/validations/reporte-filters.schema";
import { requerimientoService } from "@/services/requerimiento.service";
import { ESTADO_LABELS } from "@/types/requerimiento.types";
import { getBaseRequerimientoFiltersFromRequest } from "@/lib/api/requerimiento-filters-from-request";

const log = createRouteLogger("/api/reportes/export/excel");

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const parsed = reporteFiltersSchema.safeParse(getBaseRequerimientoFiltersFromRequest(request));
    if (!parsed.success) return createErrorResponse(400, "Filtros inválidos", parsed.error.issues);

    const direccionRestriccion = getDireccionRestriccion(authResult.user);
    const rows = await requerimientoService.getForReport(parsed.data, direccionRestriccion);

    const XLSX = await import("xlsx");
    const wsData = rows.map((r) => ({
      "N° Seguimiento": r.numeroSeguimiento,
      Nombre: `${r.vecino.nombre} ${r.vecino.primerApellido}`,
      "Segundo Apellido": r.vecino.segundoApellido || "",
      RUT: r.vecino.rut,
      Teléfono: r.vecino.telefono,
      Email: r.vecino.email,
      Región: r.vecino.region,
      Comuna: r.vecino.comuna,
      "Dirección Vecino": r.vecino.direccion,
      "Dirección Municipal": r.direccionMunicipalLabel,
      Categoría: r.categoria,
      Tipo: r.tipoRequerimiento,
      Estado: ESTADO_LABELS[r.estado] || r.estado,
      "Fecha Ingreso": new Date(r.fechaIngreso).toLocaleDateString("es-CL"),
      "Fecha Límite": new Date(r.fechaLimite).toLocaleDateString("es-CL"),
      "Fecha Resolución": r.fechaResolucion ? new Date(r.fechaResolucion).toLocaleDateString("es-CL") : "",
      "Días Hábiles Restantes": r.diasHabilesRestantes ?? "",
      Vencido: r.vencido ? "Sí" : "No",
      "Notas Registradas": (r.notas || []).length,
      "Eventos Historial": (r.historialEstados || []).length,
      Descripción: r.descripcion,
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Requerimientos");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="reporte-requerimientos.xlsx"`,
      },
    });
  } catch (error) {
    log.error({ error }, "Error exporting excel report");
    return createErrorResponse(500, "Error al exportar reporte Excel");
  }
}
