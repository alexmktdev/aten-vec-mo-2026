import { NextRequest } from "next/server";
import { EstadoRequerimiento, TipoRequerimiento } from "@/types/requerimiento.types";

function toOptionalDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function toPositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed < 1 ? fallback : parsed;
}

export function getBaseRequerimientoFiltersFromRequest(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  return {
    estado: (searchParams.get("estado") as EstadoRequerimiento) || undefined,
    tipoRequerimiento: (searchParams.get("tipo") as TipoRequerimiento) || undefined,
    direccionMunicipal: searchParams.get("direccion") || undefined,
    fechaDesde: toOptionalDate(searchParams.get("fechaDesde")),
    fechaHasta: toOptionalDate(searchParams.get("fechaHasta")),
  };
}

export function getRequerimientoListFiltersFromRequest(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  return {
    ...getBaseRequerimientoFiltersFromRequest(request),
    limit: toPositiveInt(searchParams.get("limit"), 20),
    page: toPositiveInt(searchParams.get("page"), 1),
    includeTotal: searchParams.get("includeTotal") === "1",
    cursor: searchParams.get("cursor") || undefined,
    sortBy:
      (searchParams.get("sortBy") as
        | "creadoEn"
        | "fechaIngreso"
        | "fechaLimite"
        | "numeroSeguimiento") || undefined,
    sortDir: (searchParams.get("sortDir") as "asc" | "desc") || undefined,
  };
}
