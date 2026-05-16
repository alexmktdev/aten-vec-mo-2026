import { NextRequest, NextResponse } from "next/server";
import { r2Service } from "@/services/r2.service";
import { requireAuth } from "@/lib/auth-guard";
import { createRouteLogger } from "@/lib/logger";
import { createErrorResponse } from "@/lib/utils/response";

const log = createRouteLogger("/api/documentos");

export async function GET(request: NextRequest) {
  try {
    // 1. Verify authentication (only admins can access)
    const authResult = await requireAuth();
    if (authResult.error) {
      return createErrorResponse(401, "No autorizado");
    }

    // 2. Get file key from query
    const { searchParams } = new URL(request.url);
    const fileKey = searchParams.get("key");

    if (!fileKey) {
      return createErrorResponse(400, "Falta el key del documento");
    }

    // 3. Generate presigned GET URL (10 min expiry)
    const url = await r2Service.generatePresignedGetUrl(fileKey);

    // 4. Redirect user to the secure temporal URL
    return NextResponse.redirect(url);
  } catch (error) {
    log.error({ error }, "Error generating secure document URL");
    return createErrorResponse(500, "Error al generar URL segura");
  }
}
