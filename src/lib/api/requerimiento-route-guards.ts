import { NextResponse } from "next/server";
import { hasDireccionAccess, requireAuth } from "@/lib/auth-guard";
import { createErrorResponse } from "@/lib/utils/response";
import { requerimientoService } from "@/services/requerimiento.service";
import { RequerimientoDTO } from "@/types/requerimiento.types";
import { SessionUser } from "@/types/auth.types";

export interface RequerimientoRouteParams {
  params: Promise<{ id: string }>;
}

interface GuardMessages {
  notFound?: string;
  forbidden?: string;
}

async function loadRequerimientoWithAccess(
  id: string,
  user: SessionUser,
  messages: GuardMessages = {}
): Promise<
  | { id: string; user: SessionUser; requerimiento: RequerimientoDTO; error?: never }
  | { error: NextResponse; id?: never; user?: never; requerimiento?: never }
> {
  const requerimiento = await requerimientoService.getById(id);
  if (!requerimiento) {
    return { error: createErrorResponse(404, messages.notFound || "Requerimiento no encontrado") };
  }

  if (!hasDireccionAccess(user, requerimiento.direccionMunicipal)) {
    return {
      error: createErrorResponse(
        403,
        messages.forbidden || "No tiene permisos para acceder a este requerimiento"
      ),
    };
  }

  return { id, user, requerimiento };
}

export async function requireRequerimientoWithAccess(
  routeParams: RequerimientoRouteParams,
  messages: GuardMessages = {}
): Promise<
  | { id: string; user: SessionUser; requerimiento: RequerimientoDTO; error?: never }
  | { error: NextResponse; id?: never; user?: never; requerimiento?: never }
> {
  const authResult = await requireAuth();
  if (authResult.error) return { error: authResult.error };

  const { id } = await routeParams.params;
  return loadRequerimientoWithAccess(id, authResult.user, messages);
}

export async function requireRequerimientoByIdWithAccess(
  id: string,
  messages: GuardMessages = {}
): Promise<
  | { id: string; user: SessionUser; requerimiento: RequerimientoDTO; error?: never }
  | { error: NextResponse; id?: never; user?: never; requerimiento?: never }
> {
  const authResult = await requireAuth();
  if (authResult.error) return { error: authResult.error };
  return loadRequerimientoWithAccess(id, authResult.user, messages);
}
