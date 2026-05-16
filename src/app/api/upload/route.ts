import { NextRequest } from "next/server";
import { r2Service } from "@/services/r2.service";
import { requireAuth } from "@/lib/auth-guard";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";
import { uploadSchema, getFileExtension } from "@/lib/validations/upload.schema";
import { checkRateLimit } from "@/lib/rate-limit";

const log = createRouteLogger("/api/upload");
const PUBLIC_EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
};

/**
 * POST /api/upload — Generate presigned URL for file upload to R2
 */
export async function POST(request: NextRequest) {
  try {
    const rate = await checkRateLimit(request, "upload", 20, 60_000);
    if (!rate.allowed) {
      return createErrorResponse(429, `Demasiadas solicitudes. Reintente en ${rate.retryAfterSeconds}s`);
    }

    const body = await request.json();

    const parsed = uploadSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(400, "Datos inválidos", parsed.error.issues);
    }

    const ext = getFileExtension(parsed.data.fileName);
    if (!ext || !(ext in PUBLIC_EXT_TO_MIME)) {
      return createErrorResponse(400, "Extensión de archivo no permitida");
    }

    if (parsed.data.isPublic) {
      const expectedMime = PUBLIC_EXT_TO_MIME[ext];
      if (parsed.data.contentType !== expectedMime) {
        return createErrorResponse(400, "Tipo MIME inválido para la extensión del archivo");
      }
    }

    // If not public (admin upload), require authentication
    let isAdmin = false;
    if (!parsed.data.isPublic) {
      const authResult = await requireAuth();
      if (authResult.error) return authResult.error;
      isAdmin = true;
    }

    const result = await r2Service.generatePresignedUrl(
      parsed.data.fileName,
      parsed.data.contentType,
      parsed.data.size,
      isAdmin
    );

    return createSuccessResponse(result);
  } catch (error) {
    log.error({ error }, "Error generating upload URL");
    const message = error instanceof Error ? error.message : "Error al generar URL de subida";
    return createErrorResponse(400, message);
  }
}
