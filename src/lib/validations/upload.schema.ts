import { z } from "zod";

const FILE_NAME_REGEX = /^[a-zA-Z0-9._\-\s]+$/;

export const uploadSchema = z.object({
  fileName: z
    .string()
    .min(1, "Nombre de archivo requerido")
    .max(255, "Nombre de archivo demasiado largo")
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
