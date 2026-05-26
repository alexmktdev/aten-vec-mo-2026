"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { seguimientoSchema, type SeguimientoInput } from "@/lib/validations/seguimiento.schema";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ESTADO_LABELS, ESTADO_COLORS, EstadoRequerimiento } from "@/types/requerimiento.types";
import { cn } from "@/lib/utils";
import { formatRut } from "@/lib/utils/rut";
import { Search, Calendar, FileText } from "lucide-react";

interface SeguimientoResult {
  numeroSeguimiento: string;
  estado: EstadoRequerimiento;
  tipoRequerimiento: string;
  direccionMunicipalLabel?: string;
  categoria?: string;
  descripcion: string;
  fechaIngreso: string;
}

/** Avance visual del trámite: porcentaje de relleno y color de la barra (alineado con cada estado). */
const BARRA_ESTADO: Record<EstadoRequerimiento, { porcentaje: number; fill: string }> = {
  pendiente: { porcentaje: 15, fill: "bg-amber-400" },
  derivado: { porcentaje: 35, fill: "bg-blue-600" },
  en_proceso: { porcentaje: 55, fill: "bg-orange-500" },
  en_espera_1: { porcentaje: 65, fill: "bg-orange-500" },
  en_espera_2: { porcentaje: 75, fill: "bg-orange-500" },
  derivado_respuesta_final: { porcentaje: 90, fill: "bg-purple-600" },
  completado: { porcentaje: 100, fill: "bg-emerald-500" },
  rechazado: { porcentaje: 100, fill: "bg-red-500" },
};

export function SeguimientoForm() {
  const [result, setResult] = useState<SeguimientoResult | null>(null);
  const [searchError, setSearchError] = useState("");

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SeguimientoInput>({
    resolver: zodResolver(seguimientoSchema),
  });

  const onSubmit = async (data: SeguimientoInput) => {
    setSearchError("");
    setResult(null);
    try {
      const params = new URLSearchParams({ numero: data.numero, rut: data.rut });
      const res = await fetch(`/api/seguimiento?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setResult(json.data);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Error al consultar");
    }
  };

  const estadoColor = result
    ? (ESTADO_COLORS[result.estado] as "yellow" | "blue" | "orange" | "green" | "red" | "purple")
    : "default";

  return (
    <div className="space-y-8">
      <Card className="border-blue-100 shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-800">Consultar estado de requerimiento</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Número de Seguimiento" placeholder="REQ-2024-000123" required {...register("numero")} error={errors.numero?.message} />
              <Input
                label="RUT"
                placeholder="12.345.678-9"
                required
                {...register("rut", {
                  onChange: (event) => {
                    event.target.value = formatRut(event.target.value);
                  },
                })}
                error={errors.rut?.message}
              />
            </div>
            <Button type="submit" loading={isSubmitting} className="bg-[#1e3a8a] hover:bg-[#1e40af]">
              <Search className="h-4 w-4 mr-2" />Consultar
            </Button>
          </form>
        </CardContent>
      </Card>

      {searchError && <Alert variant="error">{searchError}</Alert>}

      {result && (
        <Card className="border-blue-100 shadow-sm">
          <CardHeader>
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <p className="text-sm text-slate-500">Requerimiento</p>
                <CardTitle className="text-blue-600">{result.numeroSeguimiento}</CardTitle>
              </div>
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <Badge variant={estadoColor} className="text-sm px-4 py-1.5">
                  {ESTADO_LABELS[result.estado]}
                </Badge>
                <div
                  className="w-[min(100%,11rem)] sm:w-44 rounded-full bg-slate-200/90 h-2.5 overflow-hidden border border-slate-200"
                  role="progressbar"
                  aria-valuenow={BARRA_ESTADO[result.estado].porcentaje}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Avance del trámite: ${BARRA_ESTADO[result.estado].porcentaje}%`}
                >
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-500 ease-out",
                      BARRA_ESTADO[result.estado].fill
                    )}
                    style={{ width: `${BARRA_ESTADO[result.estado].porcentaje}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-600">
                  {BARRA_ESTADO[result.estado].porcentaje}%
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span className="font-medium">Fecha ingreso:</span>
                <span>{new Date(result.fechaIngreso).toLocaleDateString("es-CL")}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <FileText className="h-4 w-4 text-slate-400" />
                <span className="font-medium">Tipo:</span>
                <span>{result.tipoRequerimiento}</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-sm font-medium text-slate-700 mb-1">Descripción:</p>
              <p className="text-sm text-slate-600">{result.descripcion}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
