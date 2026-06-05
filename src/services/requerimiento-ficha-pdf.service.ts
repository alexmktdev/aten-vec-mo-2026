import { requerimientoService } from "@/services/requerimiento.service";
import { r2Service } from "@/services/r2.service";
import {
  buildFichaPdfFilename,
  buildRequerimientoFichaPdf,
} from "@/lib/reportes/requerimiento-ficha-pdf";
import { mergePdfBuffers } from "@/lib/reportes/merge-pdf";
import logger from "@/lib/logger";
import type { FichaPdfVariant, RequerimientoDTO } from "@/types/requerimiento.types";

function isEstadoCerrado(estado: string): boolean {
  return estado === "completado" || estado === "rechazado";
}

export const requerimientoFichaPdfService = {
  async getPdfDownload(
    req: RequerimientoDTO,
    variant: FichaPdfVariant
  ): Promise<{ buffer: Buffer; filename: string }> {
    if (variant === "resuelto" && !isEstadoCerrado(req.estado)) {
      throw new Error("La ficha resuelta solo está disponible para requerimientos cerrados");
    }

    const pdfArrayBuffer = await buildRequerimientoFichaPdf(req, variant);
    let buffer = Buffer.from(pdfArrayBuffer);

    if (
      variant === "resuelto" &&
      req.evidenciaResolucion?.tipo === "documento" &&
      req.evidenciaResolucion.nombreR2
    ) {
      try {
        const evidenciaBuffer = await r2Service.getFileBuffer(req.evidenciaResolucion.nombreR2);
        const merged = await mergePdfBuffers([
          new Uint8Array(buffer),
          new Uint8Array(evidenciaBuffer),
        ]);
        buffer = Buffer.from(merged);
      } catch (error) {
        logger.warn(
          { error, requerimientoId: req.id, nombreR2: req.evidenciaResolucion.nombreR2 },
          "No se pudo anexar la evidencia PDF al ficha resuelto; se entrega solo la ficha"
        );
      }
    }

    const filename = buildFichaPdfFilename(req.numeroSeguimiento, variant);
    return { buffer, filename };
  },

  /** Recarga el requerimiento por id (datos actualizados) y genera el PDF. */
  async getPdfDownloadById(
    requerimientoId: string,
    variant: FichaPdfVariant
  ): Promise<{ buffer: Buffer; filename: string }> {
    const req = await requerimientoService.getById(requerimientoId);
    if (!req) {
      throw new Error("Requerimiento no encontrado");
    }
    return this.getPdfDownload(req, variant);
  },
};
