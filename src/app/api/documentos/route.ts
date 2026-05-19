import { NextRequest, NextResponse } from "next/server";
import { r2Service } from "@/services/r2.service";
import { createRouteLogger } from "@/lib/logger";
import { createErrorResponse } from "@/lib/utils/response";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireRequerimientoByIdWithAccess } from "@/lib/api/requerimiento-route-guards";

const log = createRouteLogger("/api/documentos");

export async function GET(request: NextRequest) {
  try {
    const rate = await checkRateLimit(request, "documentos", 30, 60_000);
    if (!rate.allowed) {
      return createErrorResponse(429, `Demasiadas solicitudes. Reintente en ${rate.retryAfterSeconds}s`);
    }

    const { searchParams } = new URL(request.url);
    const fileKey = searchParams.get("key");
    const requerimientoId = searchParams.get("requerimientoId");

    if (!fileKey || !requerimientoId) {
      return createErrorResponse(400, "Faltan parámetros requeridos para acceder al documento");
    }

    const access = await requireRequerimientoByIdWithAccess(requerimientoId, {
      forbidden: "No tiene permisos para acceder a este documento",
    });
    if (access.error) return access.error;

    const documento = access.requerimiento.documentos.find((item) => item.nombreR2 === fileKey);
    const isEvidencia = access.requerimiento.evidenciaResolucion?.nombreR2 === fileKey;
    if (!documento && !isEvidencia) {
      return createErrorResponse(404, "Documento no encontrado para este requerimiento");
    }

    const url = await r2Service.generatePresignedGetUrl(fileKey);

    return NextResponse.redirect(url);
  } catch (error) {
    log.error({ error }, "Error generating secure document URL");
    return createErrorResponse(500, "No fue posible generar el acceso seguro al documento");
  }
}
