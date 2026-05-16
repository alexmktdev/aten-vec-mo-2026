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
import { getCorreoDireccion } from "@/constants/direcciones-correos";

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
    const authResult = await requireRole("superadmin", "admin", "administradora-municipal");
    if (authResult.error) return authResult.error;
    if (!canDerivarRequerimiento(authResult.user.rol)) {
      return createErrorResponse(403, "No tiene permisos para derivar requerimientos");
    }

    const { id } = await params;
    const body = await request.json();
    body.direccionMunicipal = body.direccionMunicipal || "";
    body.emailDestinatario = normalizeEmail(body.emailDestinatario || "");

    const parsed = derivarSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(400, "Datos inválidos", parsed.error.issues);
    }

    // Get requerimiento
    const req = await requerimientoService.getById(id);
    if (!req) {
      return createErrorResponse(404, "Requerimiento no encontrado");
    }
    if (req.estado !== "pendiente") {
      return createErrorResponse(400, "Solo se puede derivar un requerimiento en estado pendiente");
    }

    const correoSugerido = getCorreoDireccion(parsed.data.direccionMunicipal);
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
        direccionMunicipalLabel
      );
    }

    // Send derivation email
    await notificacionService.enviarDerivacion(parsed.data.emailDestinatario, {
      numeroSeguimiento: req.numeroSeguimiento,
      vecino: req.vecino,
      tipoRequerimiento: req.tipoRequerimiento,
      direccionMunicipalLabel,
      categoria: req.categoria,
      descripcion: req.descripcion,
      fechaIngreso: req.fechaIngreso,
      fechaLimite: req.fechaLimite,
    });

    // Update status to "derivado"
    await requerimientoService.updateEstado(
      id,
      "derivado",
      authResult.user.uid,
      `Derivado a ${direccionMunicipalLabel} (${parsed.data.emailDestinatario})`
    );

    log.info(
      { id, emailDestinatario: parsed.data.emailDestinatario },
      "Requerimiento derivado"
    );

    return createSuccessResponse(null, "Requerimiento derivado exitosamente");
  } catch (error) {
    log.error({ error }, "Error derivando requerimiento");
    return createErrorResponse(500, "Error al derivar el requerimiento");
  }
}
