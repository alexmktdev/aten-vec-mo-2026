import { NextRequest } from "next/server";
import { requerimientoService } from "@/services/requerimiento.service";
import { notificacionService } from "@/services/notificacion.service";
import { requireRole } from "@/lib/auth-guard";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";
import { z } from "zod";
import { normalizeEmail } from "@/lib/utils/sanitize";
import { canDerivarRequerimiento } from "@/lib/requerimiento-permissions";
import { DIRECCIONES_KEYS, getDireccionLabel } from "@/constants/direcciones";
import { getCorreoDerivacionParaDireccion } from "@/lib/direccion-correo-derivacion";

const log = createRouteLogger("/api/requerimientos/[id]/derivar");

const derivarSchema = z.object({
  direccionMunicipal: z
    .string()
    .refine((value) => DIRECCIONES_KEYS.includes(value as (typeof DIRECCIONES_KEYS)[number]), {
      message: "Dirección municipal inválida",
    }),
  emailDestinatario: z.string().email("Email del destinatario inválido"),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/requerimientos/:id/derivar — Derive requerimiento + send email
 * Roles: superadmin, admin
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireRole(
      "superadmin",
      "admin",
      "admin-municipal",
      "admin-transparencia",
      "administradora-municipal"
    );
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const body = await request.json();
    body.direccionMunicipal = body.direccionMunicipal || "";
    body.emailDestinatario = normalizeEmail(body.emailDestinatario || "");

    const parsed = derivarSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(400, "Datos inválidos", parsed.error.issues);
    }

    const req = await requerimientoService.getById(id);
    if (!req) {
      return createErrorResponse(404, "Requerimiento no encontrado");
    }
    if (req.estado !== "pendiente") {
      return createErrorResponse(400, "Solo se puede derivar un requerimiento en estado pendiente");
    }

    if (!canDerivarRequerimiento(authResult.user.rol, req.tipoRequerimiento)) {
      return createErrorResponse(
        403,
        "No tiene permisos para derivar este tipo de requerimiento"
      );
    }

    // Solicitud de transparencia siempre se deriva a Secretaría Municipal.
    if (
      req.tipoRequerimiento === "Solicitud de transparencia" &&
      parsed.data.direccionMunicipal !== "SECRETARIA"
    ) {
      return createErrorResponse(
        400,
        "Los requerimientos de Solicitud de transparencia se derivan a Secretaría Municipal"
      );
    }

    const correoSugerido = await getCorreoDerivacionParaDireccion(parsed.data.direccionMunicipal);
    if (!correoSugerido) {
      return createErrorResponse(400, "No existe correo configurado para la dirección seleccionada");
    }
    if (parsed.data.emailDestinatario !== correoSugerido) {
      return createErrorResponse(
        400,
        `El correo debe coincidir con la dirección seleccionada (${correoSugerido})`
      );
    }

    const direccionMunicipalLabel = getDireccionLabel(parsed.data.direccionMunicipal);
    if (req.direccionMunicipal !== parsed.data.direccionMunicipal) {
      await requerimientoService.updateDireccionMunicipal(
        id,
        parsed.data.direccionMunicipal,
        direccionMunicipalLabel,
        req
      );
    }

    await requerimientoService.updateEstado(
      id,
      "derivado",
      authResult.user,
      `Derivado a ${direccionMunicipalLabel} (${parsed.data.emailDestinatario})`,
      req
    );

    const reqActualizado = await requerimientoService.getById(id);

    let envioCorreoOk = true;
    try {
      await notificacionService.enviarDerivacion(parsed.data.emailDestinatario, {
        numeroSeguimiento: req.numeroSeguimiento,
        vecino: req.vecino,
        tipoRequerimiento: req.tipoRequerimiento,
        direccionMunicipalLabel,
        descripcion: req.descripcion,
        fechaIngreso: req.fechaIngreso,
        fechaLimite: reqActualizado?.fechaLimite || req.fechaLimite,
      });
    } catch (emailError) {
      envioCorreoOk = false;
      log.error(
        { id, emailDestinatario: parsed.data.emailDestinatario, error: emailError },
        "No se pudo enviar el correo de derivación"
      );
    }

    log.info(
      { id, emailDestinatario: parsed.data.emailDestinatario },
      "Requerimiento derivado"
    );

    const message = envioCorreoOk
      ? "Requerimiento derivado exitosamente"
      : "Requerimiento derivado, pero no se pudo enviar el correo de derivación";
    return createSuccessResponse(null, message);
  } catch (error) {
    log.error({ error }, "Error derivando requerimiento");
    return createErrorResponse(500, "Error al derivar el requerimiento");
  }
}
