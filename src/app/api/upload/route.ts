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
const ADMIN_EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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

    let isAdmin = false;
    if (!parsed.data.isPublic) {
      const authResult = await requireAuth();
      if (authResult.error) return authResult.error;
      isAdmin = true;
    }

    const ext = getFileExtension(parsed.data.fileName);
    const allowedMap = isAdmin ? ADMIN_EXT_TO_MIME : PUBLIC_EXT_TO_MIME;
    const expectedMime = allowedMap[ext];
    if (!ext || !expectedMime) {
      return createErrorResponse(400, "Extensión de archivo no permitida");
    }
    if (parsed.data.contentType !== expectedMime) {
      return createErrorResponse(400, "Tipo MIME inválido para la extensión del archivo");
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
    if (error instanceof Error) {
      const allowedMessages = new Set([
        "Tipo de archivo no permitido",
        "Tipo MIME inválido para la extensión del archivo",
      ]);
      if (allowedMessages.has(error.message) || error.message.includes("tamaño máximo")) {
        return createErrorResponse(400, error.message);
      }
    }
    return createErrorResponse(500, "No fue posible preparar la carga del archivo");
  }
}
