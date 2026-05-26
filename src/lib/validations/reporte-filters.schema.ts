import { z } from "zod";
import { ESTADOS_REQUERIMIENTO, TIPOS_REQUERIMIENTO } from "@/types/requerimiento.types";

export const reporteFiltersSchema = z.object({
  estado: z.enum(ESTADOS_REQUERIMIENTO).optional(),
  tipoRequerimiento: z.enum(TIPOS_REQUERIMIENTO).optional(),
  direccionMunicipal: z.string().min(1).optional(),
  fechaDesde: z.date().optional(),
  fechaHasta: z.date().optional(),
});

export type ReporteFiltersInput = z.infer<typeof reporteFiltersSchema>;
