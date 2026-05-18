import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";
import { SessionUser } from "@/types/auth.types";
import { RolUsuario } from "@/types/usuario.types";
import { createErrorResponse } from "@/lib/utils/response";
import { NextResponse } from "next/server";

function normalizeDireccionesFromClaims(claims: Record<string, unknown>): string[] {
  const fromArray = Array.isArray(claims.direccionAsignadas)
    ? claims.direccionAsignadas.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  const fromSingle = typeof claims.direccionAsignada === "string" && claims.direccionAsignada.trim().length > 0
    ? [claims.direccionAsignada]
    : [];

  return Array.from(new Set([...fromArray, ...fromSingle]));
}

/**
 * Verify session cookie and extract user info.
 * Returns null if not authenticated.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) return null;

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const userRecord = await adminAuth.getUser(decoded.uid);
    const claims = userRecord.customClaims || {};
    const direcciones = normalizeDireccionesFromClaims(claims);

    return {
      uid: decoded.uid,
      email: decoded.email || "",
      nombre: userRecord.displayName || "",
      rol: (claims.rol as RolUsuario) || "director",
      direccionAsignada: direcciones[0],
      direccionAsignadas: direcciones,
    };
  } catch {
    return null;
  }
}

/**
 * Require authentication — returns error response if not authenticated
 */
export async function requireAuth(): Promise<
  { user: SessionUser; error?: never } | { user?: never; error: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) {
    return { error: createErrorResponse(401, "No autenticado") };
  }
  return { user };
}

/**
 * Require specific roles — returns error if user doesn't have the required role
 */
export async function requireRole(
  ...allowedRoles: RolUsuario[]
): Promise<
  { user: SessionUser; error?: never } | { user?: never; error: NextResponse }
> {
  const result = await requireAuth();
  if (result.error) return result;

  if (!allowedRoles.includes(result.user.rol)) {
    return {
      error: createErrorResponse(403, "No tiene permisos para realizar esta acción"),
    };
  }

  return { user: result.user };
}

/**
 * Get direction restriction for filtered queries (directors)
 */
export function getDireccionRestriccion(user: SessionUser): string[] | undefined {
  if (user.rol === "director") {
    const direcciones = user.direccionAsignadas || (user.direccionAsignada ? [user.direccionAsignada] : []);
    return direcciones.length > 0 ? direcciones : undefined;
  }
  return undefined;
}

export function hasDireccionAccess(user: SessionUser, direccionMunicipal: string): boolean {
  const restriccion = getDireccionRestriccion(user);
  if (!restriccion || restriccion.length === 0) return true;
  return restriccion.includes(direccionMunicipal);
}
