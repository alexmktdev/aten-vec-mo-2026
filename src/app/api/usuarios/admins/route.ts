import { usuarioRepository } from "@/repositories/usuario.repository";
import { requireRole } from "@/lib/auth-guard";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";

const log = createRouteLogger("/api/usuarios/admins");

/**
 * GET /api/usuarios/admins — Lista de administradores activos
 *
 * Usado por el director al derivar para respuesta final: necesita elegir a
 * cuál admin enviarle el caso. Solo expone uid, nombre y email.
 *
 * Roles: superadmin, admin, administradora-municipal, director.
 */
export async function GET() {
  try {
    const authResult = await requireRole(
      "superadmin",
      "admin",
      "administradora-municipal",
      "director"
    );
    if (authResult.error) return authResult.error;

    const admins = await usuarioRepository.getAdmins();
    const data = admins.map((u) => ({
      uid: u.id,
      nombre: u.nombre,
      email: u.email,
    }));

    return createSuccessResponse(data);
  } catch (error) {
    log.error({ error }, "Error listing admins");
    return createErrorResponse(500, "Error al obtener administradores");
  }
}
