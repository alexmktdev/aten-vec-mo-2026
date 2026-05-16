"use client";

import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { DIRECCIONES_MUNICIPALES } from "@/constants/direcciones";
import { ESTADOS_REQUERIMIENTO, ESTADO_LABELS } from "@/types/requerimiento.types";

interface Props {
  estado: string;
  direccion: string;
  busqueda: string;
  sortMode: "recientes" | "antiguos" | "limite";
  onEstadoChange: (val: string) => void;
  onDireccionChange: (val: string) => void;
  onBusquedaChange: (val: string) => void;
  onSortModeChange: (val: "recientes" | "antiguos" | "limite") => void;
}

export function RequerimientoFilters({
  estado,
  direccion,
  busqueda,
  sortMode,
  onEstadoChange,
  onDireccionChange,
  onBusquedaChange,
  onSortModeChange,
}: Props) {
  const estadoOptions = [
    { value: "", label: "Todos los estados" },
    ...ESTADOS_REQUERIMIENTO.map((e) => ({ value: e, label: ESTADO_LABELS[e] })),
  ];

  const direccionOptions = [
    { value: "", label: "Todas las direcciones" },
    ...Object.entries(DIRECCIONES_MUNICIPALES).map(([key, val]) => ({ value: key, label: val.label })),
  ];

  return (
    <div className="flex flex-wrap gap-4">
      <div className="w-full sm:min-w-[320px] sm:flex-1">
        <Input
          type="text"
          value={busqueda}
          onChange={(e) => onBusquedaChange(e.target.value)}
          placeholder="Buscar por N°, vecino, RUT, dirección o categoría"
        />
      </div>
      <div className="w-full sm:w-auto sm:min-w-[220px]">
        <Select options={estadoOptions} value={estado} onChange={(e) => onEstadoChange(e.target.value)} />
      </div>
      <div className="w-full sm:w-auto sm:min-w-[280px]">
        <Select options={direccionOptions} value={direccion} onChange={(e) => onDireccionChange(e.target.value)} />
      </div>
      <div className="w-full flex flex-wrap gap-2">
        <Button
          type="button"
          variant={sortMode === "recientes" ? "default" : "outline"}
          className={sortMode === "recientes" ? "bg-blue-900 hover:bg-blue-950 text-white" : ""}
          onClick={() => onSortModeChange("recientes")}
        >
          Más recientes
        </Button>
        <Button
          type="button"
          variant={sortMode === "antiguos" ? "default" : "outline"}
          className={sortMode === "antiguos" ? "bg-blue-900 hover:bg-blue-950 text-white" : ""}
          onClick={() => onSortModeChange("antiguos")}
        >
          Más antiguos
        </Button>
        <Button
          type="button"
          variant={sortMode === "limite" ? "default" : "outline"}
          className={sortMode === "limite" ? "bg-blue-900 hover:bg-blue-950 text-white" : ""}
          onClick={() => onSortModeChange("limite")}
        >
          Fecha límite próxima
        </Button>
      </div>
    </div>
  );
}
