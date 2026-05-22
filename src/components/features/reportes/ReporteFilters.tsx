"use client";

import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { DIRECCIONES_MUNICIPALES } from "@/constants/direcciones";
import { ESTADOS_REQUERIMIENTO, ESTADO_LABELS, TIPOS_REQUERIMIENTO } from "@/types/requerimiento.types";
import { Download } from "lucide-react";

interface Props {
  estado: string;
  tipo: string;
  direccion: string;
  categoria: string;
  fechaDesde: string;
  fechaHasta: string;
  onEstadoChange: (val: string) => void;
  onTipoChange: (val: string) => void;
  onDireccionChange: (val: string) => void;
  onCategoriaChange: (val: string) => void;
  onFechaDesdeChange: (val: string) => void;
  onFechaHastaChange: (val: string) => void;
  onResetFilters: () => void;
  onExportPDF: () => void;
  onExportExcel: () => void;
  loading?: boolean;
}

export function ReporteFilters(props: Props) {
  const estadoOptions = [
    { value: "", label: "Todos los estados" },
    ...ESTADOS_REQUERIMIENTO.map((e) => ({ value: e, label: ESTADO_LABELS[e] })),
  ];
  const direccionOptions = [
    { value: "", label: "Todas las direcciones" },
    ...Object.entries(DIRECCIONES_MUNICIPALES).map(([key, val]) => ({ value: key, label: val.label })),
  ];
  const tipoOptions = [
    { value: "", label: "Todos los tipos" },
    ...TIPOS_REQUERIMIENTO.map((tipo) => ({ value: tipo, label: tipo })),
  ];
  const categorias = props.direccion
    ? DIRECCIONES_MUNICIPALES[props.direccion as keyof typeof DIRECCIONES_MUNICIPALES]?.categorias || []
    : Array.from(
        new Set(Object.values(DIRECCIONES_MUNICIPALES).flatMap((dir) => [...dir.categorias]))
      );
  const categoriaOptions = [
    { value: "", label: "Todas las categorías" },
    ...categorias.map((categoria) => ({ value: categoria, label: categoria })),
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <Select options={estadoOptions} value={props.estado} onChange={(e) => props.onEstadoChange(e.target.value)} label="Estado" />
        <Select options={tipoOptions} value={props.tipo} onChange={(e) => props.onTipoChange(e.target.value)} label="Tipo" />
        <Select options={direccionOptions} value={props.direccion} onChange={(e) => props.onDireccionChange(e.target.value)} label="Dirección" />
        <Select options={categoriaOptions} value={props.categoria} onChange={(e) => props.onCategoriaChange(e.target.value)} label="Categoría" />
        <Input type="date" label="Desde" value={props.fechaDesde} onChange={(e) => props.onFechaDesdeChange(e.target.value)} />
        <Input type="date" label="Hasta" value={props.fechaHasta} onChange={(e) => props.onFechaHastaChange(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-3 items-center">
        <Button variant="outline" onClick={props.onExportPDF} loading={props.loading}><Download className="h-4 w-4 mr-2" />Exportar PDF</Button>
        <Button variant="outline" onClick={props.onExportExcel} loading={props.loading}><Download className="h-4 w-4 mr-2" />Exportar Excel completo</Button>
        <Button variant="ghost" onClick={props.onResetFilters}>Limpiar filtros</Button>
      </div>
      <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
        El PDF respeta los filtros de arriba. El Excel descarga un libro con estadísticas globales, desgloses por
        dirección, porcentajes y todas las hojas de detalle (requerimientos, historial, notas, documentos, etc.)
        según el alcance de su usuario, sin aplicar esos filtros.
      </p>
    </div>
  );
}
