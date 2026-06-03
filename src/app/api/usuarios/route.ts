import { NextRequest } from "next/server";
import { usuarioService, UsuarioConflictError } from "@/services/usuario.service";
import { usuarioCreateSchema } from "@/lib/validations/usuario.schema";
import { requireRole } from "@/lib/auth-guard";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";
import { sanitizeText, normalizeEmail } from "@/lib/utils/sanitize";

const log = createRouteLogger("/api/usuarios");

/**
 * GET /api/usuarios — List all users
 * Roles: superadmin, admin, administradora-municipal, director
 * Sin caché de servidor: la lista debe reflejar altas/bajas al instante.
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
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || "10")));
    const search = sanitizeText(searchParams.get("search") || "");

    const users = await usuarioService.listPaginated({ page, limit, search });
    return createSuccessResponse(users);
  } catch (error) {
    log.error({ error }, "Error listing users");
    return createErrorResponse(500, "Error al obtener usuarios");
  }
}

/**
 * POST /api/usuarios — Create user
 * Roles: superadmin only
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireRole("superadmin");
    if (authResult.error) return authResult.error;

    const body = await request.json();
    body.nombre = sanitizeText(body.nombre || "");
    body.email = normalizeEmail(body.email || "");
    if (Array.isArray(body.direccionAsignadas)) {
      body.direccionAsignadas = body.direccionAsignadas.map((value: unknown) => sanitizeText(String(value || "")));
    }

    const parsed = usuarioCreateSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(400, "Datos inválidos", parsed.error.issues);
    }

    const user = await usuarioService.create(parsed.data as Parameters<typeof usuarioService.create>[0]);
    return createSuccessResponse(user, "Usuario creado exitosamente", 201);
  } catch (error: unknown) {
    if (error instanceof UsuarioConflictError) {
      return createErrorResponse(409, error.message);
    }
    const firebaseError = error as { code?: string; message?: string; errorInfo?: { code?: string; message?: string } };
    const errorCode = firebaseError?.errorInfo?.code || firebaseError?.code || "";
    const errorMessage = firebaseError?.errorInfo?.message || firebaseError?.message || "Error al crear usuario";

    log.error({ errorCode, errorMessage }, "Error creating user");

    if (errorCode.includes("email-already-exists")) {
      return createErrorResponse(400, "El correo electrónico ya está registrado");
    }
    return createErrorResponse(500, errorMessage);
  }
}
