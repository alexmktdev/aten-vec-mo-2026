import { NextRequest } from "next/server";
import { requerimientoService } from "@/services/requerimiento.service";
import { requerimientoCreateSchema } from "@/lib/validations/requerimiento.schema";
import { requerimientoFiltersSchema } from "@/lib/validations/requerimiento-filters.schema";
import { requireAuth, getDireccionRestriccion } from "@/lib/auth-guard";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeText, sanitizeOptionalText, normalizeEmail } from "@/lib/utils/sanitize";
import { normalizeRut } from "@/lib/utils/rut";
import { getRequerimientoListFiltersFromRequest } from "@/lib/api/requerimiento-filters-from-request";

const log = createRouteLogger("/api/requerimientos");

/**
 * GET /api/requerimientos — List requerimientos (authenticated)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const rawFilters = getRequerimientoListFiltersFromRequest(request);
    const parsedFilters = requerimientoFiltersSchema.safeParse(rawFilters);
    if (!parsedFilters.success) {
      return createErrorResponse(400, "Filtros inválidos", parsedFilters.error.issues);
    }

    const direccionRestriccion = getDireccionRestriccion(authResult.user);
    const result = await requerimientoService.list(parsedFilters.data, direccionRestriccion);

    return createSuccessResponse(result);
  } catch (error) {
    log.error({ error }, "Error listing requerimientos");
    return createErrorResponse(500, "Error al obtener requerimientos");
  }
}

/**
 * POST /api/requerimientos — Create new requerimiento (public)
 */
export async function POST(request: NextRequest) {
  try {
    const rate = await checkRateLimit(request, "requerimientos-create", 15, 60_000);
    if (!rate.allowed) {
      return createErrorResponse(429, `Demasiadas solicitudes. Reintente en ${rate.retryAfterSeconds}s`);
    }

    const body = await request.json();

    if (body.vecino) {
      body.vecino.nombre = sanitizeText(body.vecino.nombre || "");
      body.vecino.primerApellido = sanitizeText(body.vecino.primerApellido || "");
      body.vecino.segundoApellido = sanitizeOptionalText(body.vecino.segundoApellido);
      body.vecino.rut = normalizeRut(body.vecino.rut || "");
      body.vecino.direccion = sanitizeText(body.vecino.direccion || "");
      body.vecino.comuna = sanitizeText(body.vecino.comuna || "");
      body.vecino.email = normalizeEmail(body.vecino.email || "");
    }
    if (body.descripcion) {
      body.descripcion = sanitizeText(body.descripcion);
    }

    // Validate with Zod
    const parsed = requerimientoCreateSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(400, "Datos inválidos", parsed.error.issues);
    }

    const result = await requerimientoService.create(parsed.data);

    return createSuccessResponse(result, "Requerimiento ingresado exitosamente", 201);
  } catch (error) {
    log.error({ error }, "Error creating requerimiento");
    return createErrorResponse(500, "Error al crear el requerimiento");
  }
}
