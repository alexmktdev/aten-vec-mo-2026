import { NextRequest } from "next/server";
import { z } from "zod";
import { requerimientoService } from "@/services/requerimiento.service";
import { usuarioRepository } from "@/repositories/usuario.repository";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";
import { sanitizeText, normalizeEmail } from "@/lib/utils/sanitize";
import { canDerivarRespuestaFinal } from "@/lib/requerimiento-permissions";
import { esRolAdminPlataforma } from "@/types/usuario.types";
import { rolAdminParaTipo } from "@/types/requerimiento.types";
import {
  RequerimientoRouteParams,
  requireRequerimientoWithAccess,
} from "@/lib/api/requerimiento-route-guards";
import { MENSAJE_DIRECTOR_NOTA_OBLIGATORIA } from "@/lib/director-estado-nota";

const log = createRouteLogger("/api/requerimientos/[id]/derivar-respuesta-final");

const schema = z.object({
  adminUid: z.string().min(1, "Debe seleccionar el admin destinatario"),
  nota: z.string().max(1000).optional(),
});

/**
 * POST /api/requerimientos/:id/derivar-respuesta-final
 *
 * Tipos con respuesta final por admin: Información, Reclamo, Sugerencia,
 * Felicitación, Solicitud Vecinal, Solicitud de transparencia.
 */
export async function POST(request: NextRequest, routeParams: RequerimientoRouteParams) {
  try {
    const access = await requireRequerimientoWithAccess(routeParams, {
      forbidden: "No tiene permisos para derivar este requerimiento",
    });
    if (access.error) return access.error;

    const { id, user, requerimiento: existing } = access;

    if (!canDerivarRespuestaFinal(user, existing)) {
      return createErrorResponse(
        403,
        "El requerimiento no permite derivar para respuesta final desde el rol o tipo actual"
      );
    }
    if (!existing.evidenciaResolucion) {
      return createErrorResponse(
        400,
        "Debe adjuntar evidencia antes de derivar para respuesta final"
      );
    }

    const body = await request.json();
    if (typeof body?.nota === "string") body.nota = sanitizeText(body.nota);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(400, "Datos inválidos", parsed.error.issues);
    }

    if (user.rol === "director" && !parsed.data.nota?.trim()) {
      return createErrorResponse(400, MENSAJE_DIRECTOR_NOTA_OBLIGATORIA);
    }

    const admin = await usuarioRepository.getById(parsed.data.adminUid);
    if (!admin || admin.activo === false || !esRolAdminPlataforma(admin.rol)) {
      return createErrorResponse(404, "El admin seleccionado no es válido o no está activo");
    }

    const rolEsperado = rolAdminParaTipo(existing.tipoRequerimiento);
    if (rolEsperado) {
      const aceptaLegacy = rolEsperado === "admin-municipal";
      const rolesValidos: string[] = aceptaLegacy
        ? ["admin-municipal", "admin"]
        : [rolEsperado];
      if (!rolesValidos.includes(admin.rol)) {
        return createErrorResponse(
          400,
          rolEsperado === "admin-transparencia"
            ? "Los requerimientos de transparencia se derivan solo a admin-transparencia"
            : "Este tipo se deriva a admin-municipal"
        );
      }
    }

    await requerimientoService.derivarRespuestaFinal(
      id,
      {
        uid: admin.id,
        nombre: admin.nombre,
        email: normalizeEmail(admin.email),
      },
      user,
      parsed.data.nota,
      existing
    );

    return createSuccessResponse(null, "Requerimiento derivado al admin para respuesta final");
  } catch (error) {
    log.error({ error }, "Error derivando a respuesta final");
    const message = error instanceof Error ? error.message : "Error al derivar a respuesta final";
    return createErrorResponse(500, message);
  }
}
