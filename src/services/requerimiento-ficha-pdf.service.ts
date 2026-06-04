import { requerimientoService } from "@/services/requerimiento.service";
import {
  buildFichaPdfFilename,
  buildRequerimientoFichaPdf,
} from "@/lib/reportes/requerimiento-ficha-pdf";
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
    const buffer = Buffer.from(pdfArrayBuffer);
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
