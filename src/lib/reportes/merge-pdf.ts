import { PDFDocument } from "pdf-lib";

type PdfBytes = Uint8Array | ArrayBuffer;

/**
 * Concatena varios PDF en un solo documento (orden preservado).
 */
export async function mergePdfBuffers(parts: PdfBytes[]): Promise<Buffer> {
  if (parts.length === 0) {
    throw new Error("No hay documentos PDF para fusionar");
  }
  if (parts.length === 1) {
    const only = parts[0];
    return Buffer.from(only instanceof ArrayBuffer ? new Uint8Array(only) : only);
  }

  const merged = await PDFDocument.create();

  for (const part of parts) {
    const bytes = part instanceof ArrayBuffer ? new Uint8Array(part) : part;
    const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const copied = await merged.copyPages(source, source.getPageIndices());
    for (const page of copied) {
      merged.addPage(page);
    }
  }

  return Buffer.from(await merged.save());
}
