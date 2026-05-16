"use client";

import { useState } from "react";
import { ReporteFilters } from "@/components/features/reportes/ReporteFilters";

type ReportFilters = {
  estado?: string;
  tipo?: string;
  direccion?: string;
  categoria?: string;
  fechaDesde?: string;
  fechaHasta?: string;
};

export default function ReportesPage() {
  const [estado, setEstado] = useState("");
  const [tipo, setTipo] = useState("");
  const [direccion, setDireccion] = useState("");
  const [categoria, setCategoria] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [exporting, setExporting] = useState(false);

  const buildReportParams = (filters?: ReportFilters) => {
    const active = {
      estado,
      tipo,
      direccion,
      categoria,
      fechaDesde,
      fechaHasta,
      ...filters,
    };
    const params = new URLSearchParams();
    if (active.estado) params.set("estado", active.estado);
    if (active.tipo) params.set("tipo", active.tipo);
    if (active.direccion) params.set("direccion", active.direccion);
    if (active.categoria) params.set("categoria", active.categoria);
    if (active.fechaDesde) params.set("fechaDesde", active.fechaDesde);
    if (active.fechaHasta) params.set("fechaHasta", active.fechaHasta);
    return params;
  };

  const downloadReport = async (format: "pdf" | "excel", filters?: ReportFilters) => {
    setExporting(true);
    try {
      const query = buildReportParams(filters).toString();
      const response = await fetch(`/api/reportes/export/${format}?${query}`, {
        method: "GET",
        credentials: "include",
      });
      if (!response.ok) throw new Error(`No se pudo exportar ${format.toUpperCase()}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = format === "pdf" ? "reporte-requerimientos.pdf" : "reporte-requerimientos.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const handleResetFilters = () => {
    setEstado("");
    setTipo("");
    setDireccion("");
    setCategoria("");
    setFechaDesde("");
    setFechaHasta("");
  };

  return (
    <div>
      <h1 className="admin-title mb-6">Reportes</h1>
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <ReporteFilters
          estado={estado}
          tipo={tipo}
          direccion={direccion}
          categoria={categoria}
          fechaDesde={fechaDesde}
          fechaHasta={fechaHasta}
          onEstadoChange={setEstado}
          onTipoChange={setTipo}
          onDireccionChange={(value) => {
            setDireccion(value);
            setCategoria("");
          }}
          onCategoriaChange={setCategoria}
          onFechaDesdeChange={setFechaDesde}
          onFechaHastaChange={setFechaHasta}
          onResetFilters={handleResetFilters}
          onExportPDF={() => void downloadReport("pdf")}
          onExportExcel={() => void downloadReport("excel")}
          loading={exporting}
        />
      </div>
    </div>
  );
}
