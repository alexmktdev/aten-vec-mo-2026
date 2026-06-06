import { NextRequest, after } from "next/server";
import { requerimientoService } from "@/services/requerimiento.service";
import { requerimientoCreateSchema } from "@/lib/validations/requerimiento.schema";
import { requerimientoFiltersSchema } from "@/lib/validations/requerimiento-filters.schema";
import { requireAuth, getDireccionRestriccion } from "@/lib/auth-guard";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";
import { enforceRateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { sanitizeText, sanitizeOptionalText, normalizeEmail, sanitizeMultilineText } from "@/lib/utils/sanitize";
import { normalizeRut } from "@/lib/utils/rut";
import { getRequerimientoListFiltersFromRequest } from "@/lib/api/requerimiento-filters-from-request";
import { verifyRecaptchaToken } from "@/lib/security/recaptcha";

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
    if (
      parsedFilters.data.direccionMunicipal &&
      direccionRestriccion?.length &&
      !direccionRestriccion.includes(parsedFilters.data.direccionMunicipal)
    ) {
      return createErrorResponse(403, "No tiene permisos para filtrar por esa dirección");
    }
    // Lista sin unstable_cache: dirección/categoría deben reflejarse al instante tras editar un requerimiento.
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
    const rateLimited = await enforceRateLimit(
      request,
      "requerimientos-create",
      RATE_LIMIT_PRESETS.requerimientosCreate.maxRequests,
      RATE_LIMIT_PRESETS.requerimientosCreate.windowMs,
      "Demasiados intentos de crear requerimiento."
    );
    if (rateLimited) return rateLimited;

    const body = await request.json();
    const recaptchaToken = typeof body?.recaptchaToken === "string" ? body.recaptchaToken : "";
    if (!recaptchaToken) {
      return createErrorResponse(400, "Debe completar la verificación reCAPTCHA");
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    const clientIp = forwardedFor ? forwardedFor.split(",")[0]?.trim() : undefined;
    const recaptcha = await verifyRecaptchaToken(recaptchaToken, clientIp);
    if (!recaptcha.success) {
      return createErrorResponse(400, "No se pudo validar reCAPTCHA");
    }

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
      body.descripcion = sanitizeMultilineText(body.descripcion);
    }

    delete body.recaptchaToken;

    // Validate with Zod
    const parsed = requerimientoCreateSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(400, "Datos inválidos", parsed.error.issues);
    }

    const result = await requerimientoService.create(parsed.data);

    after(async () => {
      await requerimientoService.afterCreate(parsed.data, result.numeroSeguimiento);
    });

    return createSuccessResponse(result, "Requerimiento ingresado exitosamente", 201);
  } catch (error) {
    log.error({ error }, "Error creating requerimiento");
    return createErrorResponse(500, "Error al crear el requerimiento");
  }
}
