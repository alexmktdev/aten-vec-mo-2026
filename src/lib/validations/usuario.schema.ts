import { z } from "zod";
import { ROLES_USUARIO } from "@/types/usuario.types";
import { DIRECCIONES_KEYS } from "@/constants/direcciones";

const direccionesAsignadasSchema = z
  .array(
    z
      .string()
      .min(1)
      .refine(
        (val) => DIRECCIONES_KEYS.includes(val as (typeof DIRECCIONES_KEYS)[number]),
        { message: "Dirección asignada inválida" }
      )
  )
  .min(1, "Debe seleccionar al menos una dirección")
  .max(10, "Máximo 10 direcciones")
  .refine((arr) => new Set(arr).size === arr.length, {
    message: "No repita direcciones",
  });

export const usuarioCreateSchema = z
  .object({
    nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(100),
    email: z.string().email("El correo electrónico no es válido"),
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "La contraseña debe contener al menos una mayúscula, una minúscula y un número"
      ),
    rol: z.enum(ROLES_USUARIO as unknown as [string, ...string[]], {
      message: "Debe seleccionar un rol válido",
    }),
    direccionAsignada: z
      .string()
      .min(1, "Debe seleccionar una dirección asignada")
      .refine(
        (val) => DIRECCIONES_KEYS.includes(val as (typeof DIRECCIONES_KEYS)[number]),
        { message: "Dirección asignada inválida" }
      ),
    direccionAsignadas: direccionesAsignadasSchema.optional(),
  })
  .transform((data) => {
    const direcciones = data.direccionAsignadas && data.direccionAsignadas.length > 0
      ? data.direccionAsignadas
      : [data.direccionAsignada];
    return {
      ...data,
      direccionAsignadas: direcciones,
      direccionAsignada: direcciones[0],
    };
  });

export type UsuarioCreateInput = z.infer<typeof usuarioCreateSchema>;

export const usuarioUpdateSchema = z
  .object({
    nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(100),
    email: z.string().email("El correo electrónico no es válido"),
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "La contraseña debe contener al menos una mayúscula, una minúscula y un número"
      ),
    rol: z.enum(ROLES_USUARIO as unknown as [string, ...string[]], {
      message: "Debe seleccionar un rol válido",
    }),
    direccionAsignada: z
      .string()
      .min(1, "Debe seleccionar una dirección asignada")
      .refine(
        (val) => DIRECCIONES_KEYS.includes(val as (typeof DIRECCIONES_KEYS)[number]),
        { message: "Dirección asignada inválida" }
      ),
    direccionAsignadas: direccionesAsignadasSchema.optional(),
  })
  .transform((data) => {
    const direcciones = data.direccionAsignadas && data.direccionAsignadas.length > 0
      ? data.direccionAsignadas
      : [data.direccionAsignada];
    return {
      ...data,
      direccionAsignadas: direcciones,
      direccionAsignada: direcciones[0],
    };
  });

export type UsuarioUpdateInput = z.infer<typeof usuarioUpdateSchema>;

export const loginSchema = z.object({
  email: z.string().email("El correo electrónico no es válido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

export type LoginInput = z.infer<typeof loginSchema>;
