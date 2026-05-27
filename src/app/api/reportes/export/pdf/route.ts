import { NextRequest } from "next/server";
import { requireReportesAccess, getDireccionRestriccion } from "@/lib/auth-guard";
import { createErrorResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";
import { reporteFiltersSchema } from "@/lib/validations/reporte-filters.schema";
import { requerimientoService } from "@/services/requerimiento.service";
import { ESTADO_LABELS } from "@/types/requerimiento.types";
import { getBaseRequerimientoFiltersFromRequest } from "@/lib/api/requerimiento-filters-from-request";
import { formatReporteFecha, formatReporteFechaYHora } from "@/lib/reportes/formato-fecha-reporte";

const log = createRouteLogger("/api/reportes/export/pdf");

const DAY_MS = 86_400_000;

function startOfDayPdf(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function diasCalendarioDesdeIngreso(fechaIngreso: string | Date): number {
  const a = startOfDayPdf(new Date(fechaIngreso));
  const b = startOfDayPdf(new Date());
  return Math.floor((b.getTime() - a.getTime()) / DAY_MS);
}

function esActivoUrgente20d(r: { estado: string; fechaIngreso: string | Date }): boolean {
  if (r.estado === "completado" || r.estado === "rechazado") return false;
  return diasCalendarioDesdeIngreso(r.fechaIngreso) >= 20;
}

function getNextAutoTableY(doc: unknown, fallback: number): number {
  const maybe = doc as { lastAutoTable?: { finalY?: number } };
  const finalY = maybe.lastAutoTable?.finalY;
  return typeof finalY === "number" ? finalY + 4 : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireReportesAccess();
    if (authResult.error) return authResult.error;

    const parsed = reporteFiltersSchema.safeParse(getBaseRequerimientoFiltersFromRequest(request));
    if (!parsed.success) return createErrorResponse(400, "Filtros inválidos", parsed.error.issues);

    const direccionRestriccion = getDireccionRestriccion(authResult.user);
    const rows = await requerimientoService.getForReport(parsed.data, direccionRestriccion);

    const { jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF();
    const now = new Date();
    const sortedRows = [...rows].sort(
      (a, b) => new Date(b.fechaIngreso).getTime() - new Date(a.fechaIngreso).getTime()
    );
    const porEstado = rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.estado] = (acc[row.estado] || 0) + 1;
      return acc;
    }, {});
    const porDireccion = rows.reduce<Record<string, number>>((acc, row) => {
      const key = row.direccionMunicipalLabel || "Sin dirección";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const porDireccionResuelta = rows.reduce<Record<string, number>>((acc, row) => {
      if (row.estado !== "completado") return acc;
      const key = row.direccionMunicipalLabel || "Sin dirección";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const topDirecciones = Object.entries(porDireccion).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topDireccionesResueltas = Object.entries(porDireccionResuelta).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const urgentes = sortedRows
      .filter((r) => r.estado !== "completado" && r.estado !== "rechazado")
      .sort((a, b) => diasCalendarioDesdeIngreso(b.fechaIngreso) - diasCalendarioDesdeIngreso(a.fechaIngreso))
      .slice(0, 5);
    const activos = rows.filter((r) => r.estado === "pendiente" || r.estado === "derivado" || r.estado === "en_proceso");
    const urgentesActivos = activos.filter((r) => esActivoUrgente20d(r));
    const porcentajeUrgentesActivos = activos.length > 0 ? Math.round((urgentesActivos.length / activos.length) * 100) : 0;

    doc.setFontSize(16);
    doc.setTextColor(30, 58, 138);
    doc.text("Reporte Ejecutivo de Requerimientos", 14, 16);
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(9);
    doc.text(`Generado: ${now.toLocaleDateString("es-CL")} ${now.toLocaleTimeString("es-CL")}`, 14, 22);
    doc.text(`Total de registros analizados: ${rows.length}`, 14, 27);
    doc.text(
      `Filtros: Estado=${parsed.data.estado || "Todos"} | Tipo=${parsed.data.tipoRequerimiento || "Todos"} | Dirección=${parsed.data.direccionMunicipal || "Todas"} | Desde=${parsed.data.fechaDesde ? formatReporteFecha(parsed.data.fechaDesde) : "-"} | Hasta=${parsed.data.fechaHasta ? formatReporteFecha(parsed.data.fechaHasta) : "-"}`,
      14,
      32
    );

    autoTable(doc, {
      startY: 36,
      theme: "grid",
      headStyles: { fillColor: [30, 58, 138] },
      head: [["Indicador Panel", "Valor"]],
      styles: { fontSize: 8, cellPadding: 1.8 },
      body: [
        ["Total requerimientos", rows.length],
        ["Pendientes", porEstado.pendiente || 0],
        ["Derivados", porEstado.derivado || 0],
        ["En proceso", porEstado.en_proceso || 0],
        ["Completados", porEstado.completado || 0],
        ["Rechazados", porEstado.rechazado || 0],
        [
          "% activos con 20+ días calendario desde ingreso",
          `${porcentajeUrgentesActivos}%`,
        ],
      ],
    });

    autoTable(doc, {
      startY: getNextAutoTableY(doc, 90),
      theme: "grid",
      headStyles: { fillColor: [30, 58, 138] },
      styles: { fontSize: 8, cellPadding: 1.8 },
      head: [["Estado", "Cantidad"]],
      body: Object.entries(porEstado).map(([key, value]) => [
        ESTADO_LABELS[key as keyof typeof ESTADO_LABELS] || key,
        value,
      ]),
    });

    doc.addPage();
    doc.setTextColor(30, 58, 138);
    doc.setFontSize(13);
    doc.text("Top del Panel de Control", 14, 14);
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text("Incluye los mismos indicadores estratégicos del dashboard, filtrados.", 14, 19);

    autoTable(doc, {
      startY: 23,
      theme: "striped",
      headStyles: { fillColor: [15, 74, 127] },
      styles: { fontSize: 8, cellPadding: 1.8 },
      head: [["Top 5 direcciones con más requerimientos", "Total"]],
      body: topDirecciones.length ? topDirecciones.map(([label, total]) => [label, total]) : [["Sin datos", 0]],
    });

    autoTable(doc, {
      startY: getNextAutoTableY(doc, 80),
      theme: "striped",
      headStyles: { fillColor: [16, 185, 129] },
      styles: { fontSize: 8, cellPadding: 1.8 },
      head: [["Top 5 direcciones con más requerimientos resueltos", "Total"]],
      body: topDireccionesResueltas.length
        ? topDireccionesResueltas.map(([label, total]) => [label, total])
        : [["Sin datos", 0]],
    });

    autoTable(doc, {
      startY: getNextAutoTableY(doc, 120),
      theme: "striped",
      headStyles: { fillColor: [194, 65, 12] },
      styles: { fontSize: 7.5, cellPadding: 1.6 },
      head: [["Mayor antigüedad abierta (top 5)", "Vecino", "Dirección", "Días calendario desde ingreso"]],
      body: urgentes.length
        ? urgentes.map((r) => [
            r.numeroSeguimiento,
            `${r.vecino.nombre} ${r.vecino.primerApellido}`,
            r.direccionMunicipalLabel,
            diasCalendarioDesdeIngreso(r.fechaIngreso),
          ])
        : [["Sin datos", "", "", ""]],
    });

    doc.addPage();
    doc.setTextColor(30, 58, 138);
    doc.setFontSize(13);
    doc.text("Detalle completo de requerimientos", 14, 14);

    autoTable(doc, {
      startY: 18,
      theme: "grid",
      styles: { fontSize: 7.2, cellPadding: 1.5 },
      headStyles: { fillColor: [30, 58, 138] },
      head: [["N°", "Vecino", "RUT", "Dirección", "Tipo", "Estado", "Fecha ingreso"]],
      body: sortedRows.map((r) => [
        r.numeroSeguimiento,
        `${r.vecino.nombre} ${r.vecino.primerApellido}`,
        r.vecino.rut,
        r.direccionMunicipalLabel,
        r.tipoRequerimiento,
        ESTADO_LABELS[r.estado] || r.estado,
        formatReporteFechaYHora(r.fechaIngreso),
      ]),
    });

    const arrayBuffer = doc.output("arraybuffer");
    return new Response(arrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="reporte-requerimientos.pdf"`,
      },
    });
  } catch (error) {
    log.error({ error }, "Error exporting pdf report");
    return createErrorResponse(500, "Error al exportar reporte PDF");
  }
}
