import { NextRequest } from "next/server";
import { usuarioRepository } from "@/repositories/usuario.repository";
import { requireRole } from "@/lib/auth-guard";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";
import { RolUsuario } from "@/types/usuario.types";
import { rolAdminParaTipo } from "@/types/requerimiento.types";

const log = createRouteLogger("/api/usuarios/admins");

/**
 * GET /api/usuarios/admins?tipo=...
 *
 * Lista de administradores activos para «Derivar para respuesta final».
 * Si se envía ?tipo=, devuelve solo el rol que corresponde a ese tipo de
 * requerimiento:
 *   - Información/Reclamo/Sugerencia/Felicitación → admin-municipal (+ admin legacy)
 *   - Solicitud de transparencia → admin-transparencia
 * Sin ?tipo= devuelve todos los admins activos (compatibilidad y fallback).
 *
 * Roles consumidores: superadmin, admin*, administradora-municipal, director.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(
      "superadmin",
      "admin",
      "admin-municipal",
      "admin-transparencia",
      "administradora-municipal",
      "director"
    );
    if (authResult.error) return authResult.error;

    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get("tipo") || undefined;

    let admins;
    if (tipo) {
      const rolEsperado = rolAdminParaTipo(tipo);
      if (!rolEsperado) {
        return createSuccessResponse([]);
      }
      const roles: RolUsuario[] =
        rolEsperado === "admin-municipal"
          ? ["admin-municipal", "admin"]
          : ["admin-transparencia"];
      admins = await usuarioRepository.getAdminsByRoles(roles);
    } else {
      admins = await usuarioRepository.getAdmins();
    }

    const data = admins.map((u) => ({
      uid: u.id,
      nombre: u.nombre,
      email: u.email,
      rol: u.rol,
    }));

    return createSuccessResponse(data);
  } catch (error) {
    log.error({ error }, "Error listing admins");
    return createErrorResponse(500, "Error al obtener administradores");
  }
}
