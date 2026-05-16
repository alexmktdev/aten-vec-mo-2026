import { NextRequest } from "next/server";
import { requerimientoService } from "@/services/requerimiento.service";
import { seguimientoSchema } from "@/lib/validations/seguimiento.schema";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizeRut } from "@/lib/utils/rut";

const log = createRouteLogger("/api/seguimiento");

/**
 * GET /api/seguimiento?numero=REQ-2024-000123&rut=12.345.678-9
 * Public endpoint — no authentication required
 */
export async function GET(request: NextRequest) {
  try {
    const rate = await checkRateLimit(request, "seguimiento", 30, 60_000);
    if (!rate.allowed) {
      return createErrorResponse(429, `Demasiadas consultas. Reintente en ${rate.retryAfterSeconds}s`);
    }

    const { searchParams } = new URL(request.url);
    const numero = searchParams.get("numero") || "";
    const rut = normalizeRut(searchParams.get("rut") || "");

    // Validate input
    const parsed = seguimientoSchema.safeParse({ numero, rut });
    if (!parsed.success) {
      return createErrorResponse(400, "Datos inválidos", parsed.error.issues);
    }

    const req = await requerimientoService.getByNumeroSeguimiento(
      parsed.data.numero,
      parsed.data.rut
    );

    if (!req) {
      return createErrorResponse(
        404,
        "No se encontró un requerimiento con los datos proporcionados"
      );
    }

    // Return limited data for public view
    return createSuccessResponse({
      numeroSeguimiento: req.numeroSeguimiento,
      estado: req.estado,
      tipoRequerimiento: req.tipoRequerimiento,
      direccionMunicipalLabel: req.direccionMunicipalLabel,
      categoria: req.categoria,
      descripcion: req.descripcion,
      fechaIngreso: req.fechaIngreso,
      fechaLimite: req.fechaLimite,
      diasHabilesRestantes: req.diasHabilesRestantes,
      vencido: req.vencido,
    });
  } catch (error) {
    log.error({ error }, "Error in seguimiento query");
    return createErrorResponse(500, "Error al consultar el estado del requerimiento");
  }
}
