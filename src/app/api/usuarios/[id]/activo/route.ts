import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { createErrorResponse, createSuccessResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";
import { usuarioService, UsuarioConflictError } from "@/services/usuario.service";
import { usuarioSetActivoSchema } from "@/lib/validations/usuario.schema";

const log = createRouteLogger("/api/usuarios/[id]/activo");

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireRole("superadmin", "administradora-municipal");
    if (authResult.error) return authResult.error;

    const { id } = await params;
    if (id === authResult.user.uid) {
      return createErrorResponse(400, "No puede cambiar el estado de su propio usuario en sesión");
    }

    const body = await request.json();
    const parsed = usuarioSetActivoSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(400, "Datos inválidos", parsed.error.issues);
    }

    const updated = await usuarioService.setActivo(id, parsed.data);
    if (!updated) return createErrorResponse(404, "Usuario no encontrado");

    const message = parsed.data.activo
      ? "Usuario activado exitosamente"
      : "Usuario desactivado exitosamente";
    return createSuccessResponse(updated, message);
  } catch (error: unknown) {
    if (error instanceof UsuarioConflictError) {
      return createErrorResponse(409, error.message);
    }
    log.error({ error }, "Error updating user active state");
    return createErrorResponse(500, "Error al actualizar el estado del usuario");
  }
}
