import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { createErrorResponse, createSuccessResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";
import { usuarioService, UsuarioConflictError } from "@/services/usuario.service";
import { usuarioUpdateSchema } from "@/lib/validations/usuario.schema";
import { sanitizeText, normalizeEmail } from "@/lib/utils/sanitize";

const log = createRouteLogger("/api/usuarios/[id]");

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireRole("superadmin", "administradora-municipal");
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const body = await request.json();
    body.nombre = sanitizeText(body.nombre || "");
    body.email = normalizeEmail(body.email || "");
    if (Array.isArray(body.direccionAsignadas)) {
      body.direccionAsignadas = body.direccionAsignadas.map((value: unknown) => sanitizeText(String(value || "")));
    }
    const parsed = usuarioUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(400, "Datos inválidos", parsed.error.issues);
    }

    const updated = await usuarioService.update(id, parsed.data);
    if (!updated) return createErrorResponse(404, "Usuario no encontrado");
    return createSuccessResponse(updated, "Usuario actualizado exitosamente");
  } catch (error: unknown) {
    if (error instanceof UsuarioConflictError) {
      return createErrorResponse(409, error.message);
    }
    const firebaseError = error as { code?: string; message?: string; errorInfo?: { code?: string; message?: string } };
    const errorCode = firebaseError?.errorInfo?.code || firebaseError?.code || "";
    const errorMessage = firebaseError?.errorInfo?.message || firebaseError?.message || "Error al actualizar usuario";

    log.error({ errorCode, errorMessage }, "Error updating user");

    if (errorCode.includes("email-already-exists")) {
      return createErrorResponse(400, "El correo electrónico ya está registrado");
    }
    return createErrorResponse(500, errorMessage);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireRole("superadmin", "administradora-municipal");
    if (authResult.error) return authResult.error;

    const { id } = await params;
    if (id === authResult.user.uid) {
      return createErrorResponse(400, "No puede eliminar su propio usuario en sesión");
    }

    await usuarioService.delete(id);
    return createSuccessResponse({ id }, "Usuario eliminado exitosamente");
  } catch (error) {
    log.error({ error }, "Error deleting user");
    return createErrorResponse(500, "Error al eliminar usuario");
  }
}
