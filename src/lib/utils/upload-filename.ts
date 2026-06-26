/** Nombre seguro para la API de upload (R2 usa UUID; esto evita rechazos por caracteres especiales). */
export function sanitizeUploadFileName(fileName: string): string {
  const normalized = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._\-\s]/g, "_");
  return normalized || "documento.pdf";
}

export function isPdfFile(file: File): boolean {
  if (file.type === "application/pdf") return true;
  return file.name.toLowerCase().endsWith(".pdf");
}

export function resolvePdfContentType(file: File): string {
  if (file.type === "application/pdf" || file.type === "application/octet-stream") {
    return "application/pdf";
  }
  if (file.name.toLowerCase().endsWith(".pdf")) {
    return "application/pdf";
  }
  return file.type || "application/pdf";
}

export function firstValidationError(
  payload: { error?: string; details?: Array<{ message?: string }> }
): string {
  const detail = payload.details?.find((issue) => typeof issue.message === "string")?.message;
  return detail || payload.error || "No fue posible completar la operación";
}
