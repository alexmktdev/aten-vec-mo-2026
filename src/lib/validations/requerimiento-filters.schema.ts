import { z } from "zod";
import { ESTADOS_REQUERIMIENTO, TIPOS_REQUERIMIENTO } from "@/types/requerimiento.types";

export const requerimientoFiltersSchema = z.object({
  estado: z.enum(ESTADOS_REQUERIMIENTO).optional(),
  tipoRequerimiento: z.enum(TIPOS_REQUERIMIENTO).optional(),
  direccionMunicipal: z.string().min(1).optional(),
  fechaDesde: z.date().optional(),
  fechaHasta: z.date().optional(),
  limit: z.number().int().min(1).max(200).optional(),
  page: z.number().int().min(1).optional(),
  includeTotal: z.boolean().optional(),
  cursor: z.string().min(1).optional(),
  sortBy: z.enum(["creadoEn", "fechaIngreso", "fechaLimite", "numeroSeguimiento"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

export type RequerimientoFiltersInput = z.infer<typeof requerimientoFiltersSchema>;
