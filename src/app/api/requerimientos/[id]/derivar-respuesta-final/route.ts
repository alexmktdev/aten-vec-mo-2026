import { NextRequest } from "next/server";
import { z } from "zod";
import { requerimientoService } from "@/services/requerimiento.service";
import { usuarioRepository } from "@/repositories/usuario.repository";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";
import { sanitizeText, normalizeEmail } from "@/lib/utils/sanitize";
import { canDerivarRespuestaFinal } from "@/lib/requerimiento-permissions";
import {
  RequerimientoRouteParams,
  requireRequerimientoWithAccess,
} from "@/lib/api/requerimiento-route-guards";

const log = createRouteLogger("/api/requerimientos/[id]/derivar-respuesta-final");

const schema = z.object({
  adminUid: z.string().min(1, "Debe seleccionar el admin destinatario"),
  nota: z.string().max(1000).optional(),
});

/**
 * POST /api/requerimientos/:id/derivar-respuesta-final
 *
 * Solo aplica a tipos: Información / Reclamo / Sugerencia / Felicitación.
 * El director (o superadmin) asigna el requerimiento a un admin específico
 * para que envíe el correo de respuesta final al vecino.
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

    const body = await request.json();
    if (typeof body?.nota === "string") body.nota = sanitizeText(body.nota);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(400, "Datos inválidos", parsed.error.issues);
    }

    const admin = await usuarioRepository.getById(parsed.data.adminUid);
    if (!admin || admin.rol !== "admin" || admin.activo === false) {
      return createErrorResponse(404, "El admin seleccionado no es válido o no está activo");
    }

    await requerimientoService.derivarRespuestaFinal(
      id,
      {
        uid: admin.id,
        nombre: admin.nombre,
        email: normalizeEmail(admin.email),
      },
      user.uid,
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
