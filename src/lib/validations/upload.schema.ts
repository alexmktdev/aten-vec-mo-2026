import { z } from "zod";

/** Límite único para PDF: formulario público, evidencia de director y respuesta inmediata admin. */
export const MAX_PDF_UPLOAD_BYTES = 1024 * 1024; // 1 MB

export const PDF_COMPRESS_HINT =
  "Si su archivo supera el límite de tamaño, puede reducirlo en ilovepdf.com.";

const FILE_NAME_REGEX = /^[a-zA-Z0-9._\-\s]+$/;

export const uploadSchema = z.object({
  fileName: z
    .string()
    .min(1, "Nombre de archivo requerido")
    .max(255, "Nombre de archivo demasiado largo")
    .refine((name) => !name.includes("..") && !name.includes("/") && !name.includes("\\"), {
      message: "El nombre del archivo contiene segmentos no permitidos",
    })
    .refine((name) => !name.startsWith("."), {
      message: "El nombre del archivo no puede comenzar con punto",
    })
    .refine((name) => FILE_NAME_REGEX.test(name), {
      message: "El nombre del archivo contiene caracteres no permitidos",
    }),
  contentType: z.string().min(1, "Tipo de archivo requerido"),
  size: z.number().positive("Tamaño inválido"),
  isPublic: z.boolean().optional().default(true),
});

export function getFileExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}
