import { NextRequest } from "next/server";
import { createErrorResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";
import { requerimientoFichaPdfService } from "@/services/requerimiento-ficha-pdf.service";
import type { FichaPdfVariant } from "@/types/requerimiento.types";
import {
  RequerimientoRouteParams,
  requireRequerimientoWithAccess,
} from "@/lib/api/requerimiento-route-guards";

const log = createRouteLogger("/api/requerimientos/[id]/ficha-pdf");

function parseVariant(value: string | null): FichaPdfVariant | null {
  if (value === "ingreso" || value === "resuelto") return value;
  return null;
}

/**
 * GET /api/requerimientos/:id/ficha-pdf?variant=ingreso|resuelto
 */
export async function GET(request: NextRequest, routeParams: RequerimientoRouteParams) {
  try {
    const access = await requireRequerimientoWithAccess(routeParams, {
      forbidden: "No tiene permisos para descargar la ficha de este requerimiento",
    });
    if (access.error) return access.error;

    const variant = parseVariant(request.nextUrl.searchParams.get("variant"));
    if (!variant) {
      return createErrorResponse(400, "Debe indicar variant=ingreso o variant=resuelto");
    }

    const { buffer, filename } = await requerimientoFichaPdfService.getPdfDownload(
      access.requerimiento,
      variant
    );

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    log.error({ error }, "Error descargando ficha PDF");
    const message = error instanceof Error ? error.message : "Error al generar la ficha PDF";
    return createErrorResponse(500, message);
  }
}
