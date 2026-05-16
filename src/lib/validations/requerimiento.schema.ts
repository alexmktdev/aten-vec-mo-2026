import { z } from "zod";
import { validateRut } from "@/lib/utils/rut";
import { TIPOS_REQUERIMIENTO, TIPOS_INMUEBLE, REGIONES_CHILE } from "@/types/requerimiento.types";
import { DIRECCIONES_KEYS, isValidCategoria } from "@/constants/direcciones";

// Vecino sub-schema
const vecinoSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(100),
  primerApellido: z.string().min(2, "El primer apellido debe tener al menos 2 caracteres").max(100),
  segundoApellido: z.string().max(100).optional().or(z.literal("")),
  rut: z
    .string()
    .min(1, "El RUT es obligatorio")
    .refine((val) => validateRut(val), {
      message: "El RUT ingresado no es válido. Verifique el formato y dígito verificador.",
    }),
  telefono: z
    .string()
    .min(1, "El teléfono es obligatorio")
    .regex(/^\+?56\d{9}$/, "Formato de teléfono inválido. Ej: +56912345678"),
  email: z.string().email("El correo electrónico no es válido"),
  confirmarEmail: z.string().email("El correo electrónico no es válido"),
  region: z.enum(REGIONES_CHILE as unknown as [string, ...string[]], {
    message: "Debe seleccionar una región",
  }),
  comuna: z.string().min(2, "La comuna debe tener al menos 2 caracteres").max(100),
  direccion: z.string().min(5, "La dirección debe tener al menos 5 caracteres").max(200),
  tipoInmueble: z.enum(TIPOS_INMUEBLE as unknown as [string, ...string[]], {
    message: "Debe seleccionar un tipo de inmueble",
  }),
});

// Schema completo del formulario público
export const requerimientoFormSchema = z
  .object({
    vecino: vecinoSchema,
    tipoRequerimiento: z.enum(TIPOS_REQUERIMIENTO as unknown as [string, ...string[]], {
      message: "Debe seleccionar un tipo de requerimiento",
    }),
    direccionMunicipal: z.string().min(1, "Debe seleccionar una dirección municipal"),
    categoria: z.string().min(1, "Debe seleccionar una categoría"),
    descripcion: z
      .string()
      .min(10, "La descripción debe tener al menos 10 caracteres")
      .max(1500, "La descripción no puede exceder los 1500 caracteres"),
  })
  .refine(
    (data) => data.vecino.email === data.vecino.confirmarEmail,
    {
      message: "Los correos electrónicos no coinciden",
      path: ["vecino", "confirmarEmail"],
    }
  )
  .refine(
    (data) => {
      if (!data.direccionMunicipal || !data.categoria) return true;
      return isValidCategoria(data.direccionMunicipal, data.categoria);
    },
    {
      message: "La categoría seleccionada no corresponde a la dirección municipal elegida",
      path: ["categoria"],
    }
  );

export type RequerimientoFormInput = z.infer<typeof requerimientoFormSchema>;

// Schema para el backend (sin confirmarEmail)
export const requerimientoCreateSchema = z.object({
  vecino: vecinoSchema.omit({ confirmarEmail: true }),
  tipoRequerimiento: z.enum(TIPOS_REQUERIMIENTO as unknown as [string, ...string[]]),
  direccionMunicipal: z.string().refine(
    (val) => DIRECCIONES_KEYS.includes(val as (typeof DIRECCIONES_KEYS)[number]),
    { message: "Dirección municipal inválida" }
  ),
  direccionMunicipalLabel: z.string().optional(),
  categoria: z.string().min(1),
  descripcion: z.string().min(10).max(1500),
  documentos: z
    .array(
      z.object({
        nombre: z.string(),
        nombreR2: z.string(),
        url: z.string(),
        tipo: z.string(),
        tamanio: z.number().max(Math.floor(2.5 * 1024 * 1024), "El archivo no puede superar 2.5MB"),
      })
    )
    .optional()
    .default([]),
});

export type RequerimientoCreateInput = z.infer<typeof requerimientoCreateSchema>;

export const requerimientoAdminEditSchema = requerimientoCreateSchema;

export type RequerimientoAdminEditInput = z.infer<typeof requerimientoAdminEditSchema>;

// Schema para actualización de estado
export const requerimientoUpdateSchema = z.object({
  estado: z
    .enum(["pendiente", "derivado", "en_proceso", "completado", "rechazado"])
    .optional(),
  nota: z.string().max(1000).optional(),
});

export type RequerimientoUpdateInput = z.infer<typeof requerimientoUpdateSchema>;

export const requerimientoRespuestaSchema = z.object({
  emailDestino: z.string().email("El correo electrónico no es válido"),
  asunto: z.string().min(5, "El asunto debe tener al menos 5 caracteres").max(160),
  mensaje: z.string().min(20, "El mensaje debe tener al menos 20 caracteres").max(4000),
});

export type RequerimientoRespuestaInput = z.infer<typeof requerimientoRespuestaSchema>;
