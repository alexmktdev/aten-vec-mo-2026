import { z } from "zod";
import { validateRut } from "@/lib/utils/rut";

export const seguimientoSchema = z.object({
  numero: z
    .string()
    .min(1, "El número de seguimiento es obligatorio")
    .regex(
      /^REQ-\d{4}-\d{6}$/,
      "Formato inválido. Ejemplo: REQ-2024-000123"
    ),
  rut: z
    .string()
    .min(1, "El RUT es obligatorio")
    .refine((val) => validateRut(val), {
      message: "El RUT ingresado no es válido",
    }),
});

export type SeguimientoInput = z.infer<typeof seguimientoSchema>;
