import { Timestamp } from "firebase-admin/firestore";
import { requerimientoRepository } from "@/repositories/requerimiento.repository";
import { r2Service } from "@/services/r2.service";
import { requerimientoService } from "@/services/requerimiento.service";
import {
  buildFichaPdfFilename,
  buildFichaPdfStorageKey,
  buildRequerimientoFichaPdf,
} from "@/lib/reportes/requerimiento-ficha-pdf";
import type {
  FichaPdfVariant,
  RequerimientoDTO,
  RequerimientoFichaPdf,
} from "@/types/requerimiento.types";
import logger from "@/lib/logger";

function isEstadoCerrado(estado: string): boolean {
  return estado === "completado" || estado === "rechazado";
}

export const requerimientoFichaPdfService = {
  async generateAndStore(
    req: RequerimientoDTO,
    variant: FichaPdfVariant,
    force = false
  ): Promise<RequerimientoFichaPdf | null> {
    const existing =
      variant === "ingreso" ? req.pdfFichaIngreso : req.pdfFichaResuelto;
    if (existing?.nombreR2 && !force) {
      return {
        nombreR2: existing.nombreR2,
        nombre: existing.nombre,
        generadoEn: existing.generadoEn,
      };
    }

    if (variant === "resuelto" && !isEstadoCerrado(req.estado)) {
      return null;
    }

    try {
      const pdfArrayBuffer = await buildRequerimientoFichaPdf(req, variant);
      const buffer = Buffer.from(pdfArrayBuffer);
      const nombreR2 = buildFichaPdfStorageKey(req.id, variant);
      const nombre = buildFichaPdfFilename(req.numeroSeguimiento, variant);
      const generadoEn = new Date();

      await r2Service.putBuffer(nombreR2, buffer, "application/pdf");

      const meta: RequerimientoFichaPdf = {
        nombreR2,
        nombre,
        generadoEn: Timestamp.fromDate(generadoEn),
      };

      await requerimientoRepository.update(req.id, {
        ...(variant === "ingreso" ? { pdfFichaIngreso: meta } : { pdfFichaResuelto: meta }),
      });

      logger.info({ id: req.id, variant, nombreR2 }, "Ficha PDF generada y almacenada");
      return meta;
    } catch (error) {
      logger.error({ error, id: req.id, variant }, "Error generando ficha PDF");
      return null;
    }
  },

  async generateIngresoForId(requerimientoId: string): Promise<void> {
    const req = await requerimientoService.getById(requerimientoId);
    if (!req) return;
    await this.generateAndStore(req, "ingreso");
  },

  async generateResueltoForId(requerimientoId: string): Promise<void> {
    const req = await requerimientoService.getById(requerimientoId);
    if (!req) return;
    if (!isEstadoCerrado(req.estado)) return;
    await this.generateAndStore(req, "resuelto", true);
  },

  async getPdfDownload(
    req: RequerimientoDTO,
    variant: FichaPdfVariant
  ): Promise<{ buffer: Buffer; filename: string }> {
    if (variant === "resuelto" && !isEstadoCerrado(req.estado)) {
      throw new Error("La ficha resuelta solo está disponible para requerimientos cerrados");
    }

    const meta = await this.generateAndStore(req, variant, false);

    const nombreR2 = meta?.nombreR2;
    if (!nombreR2) {
      throw new Error("No fue posible generar la ficha PDF");
    }

    const buffer = await r2Service.getFileBuffer(nombreR2);
    const filename = meta.nombre || buildFichaPdfFilename(req.numeroSeguimiento, variant);
    return { buffer, filename };
  },
};
