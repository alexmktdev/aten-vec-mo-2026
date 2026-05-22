"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { ReporteFilters } from "@/components/features/reportes/ReporteFilters";
import { puedeVerReportes } from "@/types/usuario.types";

type ReportFilters = {
  estado?: string;
  tipo?: string;
  direccion?: string;
  categoria?: string;
  fechaDesde?: string;
  fechaHasta?: string;
};

export default function ReportesPage() {
  const { user, loading } = useAuth();
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
      const query =
        format === "excel" ? "" : buildReportParams(filters).toString();
      const response = await fetch(
        `/api/reportes/export/${format}${query ? `?${query}` : ""}`,
        {
          method: "GET",
          credentials: "include",
        }
      );
      if (!response.ok) throw new Error(`No se pudo exportar ${format.toUpperCase()}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        format === "pdf" ? "reporte-requerimientos.pdf" : "estadisticas-requerimientos-completo.xlsx";
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

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
        Cargando permisos…
      </div>
    );
  }

  if (!user || !puedeVerReportes(user.rol)) {
    return (
      <div className="max-w-lg space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-slate-800 shadow-sm">
        <h1 className="admin-title text-amber-950">Reportes no disponibles</h1>
        <p className="text-sm">
          Solo los roles <strong>superadmin</strong> y <strong>administradora municipal</strong> pueden ver y exportar
          reportes. Las <strong>gráficas</strong> del panel están disponibles para todos los roles.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex rounded-xl bg-blue-900 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          Volver al panel de control
        </Link>
        <Link href="/dashboard/graficas" className="ml-3 text-sm font-medium text-blue-900 underline">
          Ir a Gráficas resumen
        </Link>
      </div>
    );
  }

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
