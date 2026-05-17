import { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/response";
import { cookies } from "next/headers";
import logger from "@/lib/logger";
import { sanitizeText } from "@/lib/utils/sanitize";
import { requireAuth } from "@/lib/auth-guard";

/**
 * POST /api/auth/session — Create session cookie from Firebase ID Token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const idToken = sanitizeText(body?.idToken || "");

    if (!idToken) {
      return createErrorResponse(400, "ID Token es requerido");
    }

    // Verify the ID token
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    // Create session cookie — 1 hour expiry
    const expiresIn = 60 * 60 * 1000; // 1 hour in milliseconds
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    // Set the cookie
    const cookieStore = await cookies();
    cookieStore.set("session", sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: expiresIn / 1000,
      path: "/",
    });

    // Get user custom claims for the response
    const userRecord = await adminAuth.getUser(decodedToken.uid);
    const claims = userRecord.customClaims || {};
    const direccionAsignadas = Array.isArray(claims.direccionAsignadas)
      ? (claims.direccionAsignadas as string[])
      : claims.direccionAsignada
        ? [claims.direccionAsignada as string]
        : [];

    logger.info({ uid: decodedToken.uid }, "Session created");

    return createSuccessResponse({
      uid: decodedToken.uid,
      email: decodedToken.email,
      nombre: userRecord.displayName || "",
      rol: claims.rol || "director",
      direccionAsignada: direccionAsignadas[0],
      direccionAsignadas,
    });
  } catch (error) {
    logger.error({ error }, "Failed to create session");
    return createErrorResponse(401, "Token inválido o expirado");
  }
}

export async function GET() {
  const authResult = await requireAuth();
  if (authResult.error) {
    return createErrorResponse(401, "Sesión inválida");
  }

  return createSuccessResponse(authResult.user);
}

/**
 * DELETE /api/auth/session — Logout (delete session cookie)
 */
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("session");
    return createSuccessResponse(null, "Sesión cerrada exitosamente");
  } catch (error) {
    logger.error({ error }, "Failed to delete session");
    return createErrorResponse(500, "Error al cerrar sesión");
  }
}
