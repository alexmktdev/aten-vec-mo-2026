"use client";

import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod"; // para validacion 
import { usuarioCreateSchema, usuarioUpdateSchema, UsuarioCreateInput, UsuarioUpdateInput } from "@/lib/validations/usuario.schema";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { ROL_LABELS, ROLES_SELECCIONABLES, ROLES_USUARIO } from "@/types/usuario.types";
import { DIRECCIONES_MUNICIPALES } from "@/constants/direcciones";
import { User, Mail, Shield, UserPlus, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

const direccionKeys = Object.keys(DIRECCIONES_MUNICIPALES); // traemos toda la data de direcciones de municipales

const direccionItemSchema = z.object({
  direccion: z
    .string()
    .min(1, "Debe seleccionar una dirección asignada")
    .refine((val) => direccionKeys.includes(val), {
      message: "Dirección asignada inválida",
    }),
});

// creamos el esquema de validación con zod 
const createStyledSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(100),
  apellido: z.string().min(2, "El apellido debe tener al menos 2 caracteres").max(100),
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
  direccionAsignadas: z
    .array(direccionItemSchema)
    .min(1, "Debe seleccionar al menos una dirección")
    .refine((arr) => new Set(arr.map((item) => item.direccion)).size === arr.length, {
      message: "No repita direcciones",
    }),
  confirmPassword: z.string().min(1, "Debe confirmar la contraseña"),
})
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

type CreateStyledInput = z.infer<typeof createStyledSchema>;

interface Props {
  mode?: "create" | "edit";
  initialValues?: Partial<{
    nombre: string;
    apellido: string;
    email: string;
    rol: UsuarioCreateInput["rol"];
    direccionAsignada: string;
    direccionAsignadas: string[];
  }>;
  onSubmit: (data: UsuarioCreateInput | UsuarioUpdateInput) => Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
  submitLabel?: string;
}

export function UsuarioCreateStyledForm({
  mode = "create",
  initialValues,
  onSubmit,
  onCancel,
  loading,
  submitLabel,
}: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isEdit = mode === "edit";
  const { register, handleSubmit, control, formState: { errors } } = useForm<CreateStyledInput>({
    resolver: zodResolver(createStyledSchema),
    defaultValues: {
      nombre: initialValues?.nombre || "",
      apellido: initialValues?.apellido || "",
      email: initialValues?.email || "",
      rol: initialValues?.rol,
      direccionAsignadas:
        initialValues?.direccionAsignadas && initialValues.direccionAsignadas.length > 0
          ? initialValues.direccionAsignadas.map((direccion) => ({ direccion }))
          : initialValues?.direccionAsignada
            ? [{ direccion: initialValues.direccionAsignada }]
            : [{ direccion: "" }],
    },
  });

  useWatch({ control, name: "rol" });
  const direccionPrincipal = useWatch({ control, name: "direccionAsignadas.0.direccion" }) || "";
  const { fields, append, remove } = useFieldArray({ control, name: "direccionAsignadas" });

  const currentRol = initialValues?.rol as (typeof ROLES_USUARIO)[number] | undefined;
  const baseRoles = [...ROLES_SELECCIONABLES] as Array<(typeof ROLES_USUARIO)[number]>;
  if (currentRol && !baseRoles.includes(currentRol)) {
    baseRoles.unshift(currentRol);
  }
  const rolOptions = baseRoles.map((r) => ({
    value: r,
    label: ROL_LABELS[r] || r,
  }));

  const direccionOptions = [
    ...Object.entries(DIRECCIONES_MUNICIPALES).map(([key, val]) => ({
      value: key,
      label: val.label,
    })),
  ];

  return (
    <form
      onSubmit={handleSubmit(async (data) => {
        const payload = {
          nombre: `${data.nombre} ${data.apellido}`.trim(),
          email: data.email,
          password: data.password,
          rol: data.rol,
          direccionAsignadas: data.direccionAsignadas.map((item) => item.direccion).filter(Boolean),
          direccionAsignada: data.direccionAsignadas.map((item) => item.direccion).find(Boolean),
        } as UsuarioCreateInput | UsuarioUpdateInput;

        if (isEdit) {
          usuarioUpdateSchema.parse(payload);
        } else {
          usuarioCreateSchema.parse(payload);
        }
        await onSubmit(payload);
      })}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.06)]"
    >
      <h2 className="text-lg font-semibold text-slate-800 mb-6">Información del Usuario</h2>

      <div className="space-y-6">
        <section>
          <h3 className="flex items-center gap-2 text-2xl font-semibold text-slate-800 mb-4">
            <User className="h-5 w-5 text-blue-800" />
            Información Personal
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nombre *"
              placeholder="Ej: Juan"
              {...register("nombre")}
              error={errors.nombre?.message}
            />
            <Input
              label="Apellido *"
              placeholder="Ej: Pérez"
              {...register("apellido")}
              error={errors.apellido?.message}
            />
          </div>
        </section>

        <section>
          <h3 className="flex items-center gap-2 text-2xl font-semibold text-slate-800 mb-4">
            <Mail className="h-5 w-5 text-blue-800" />
            Información de Cuenta
          </h3>
          <div className="space-y-4">
            <Input
              label="Email *"
              type="email"
              placeholder="usuario@example.com"
              {...register("email")}
              error={errors.email?.message}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Input
                  label="Contraseña *"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 8 caracteres"
                  className="pr-11"
                  {...register("password")}
                  error={errors.password?.message}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-[35px] text-slate-500 hover:text-slate-700 transition-colors"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="relative">
                <Input
                  label="Confirmar Contraseña *"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Repetir contraseña"
                  className="pr-11"
                  {...register("confirmPassword")}
                  error={errors.confirmPassword?.message}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-[35px] text-slate-500 hover:text-slate-700 transition-colors"
                  aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Requisito del sistema: mínimo 8 caracteres, al menos una mayúscula, una minúscula y un número.
            </p>
          </div>
        </section>

        <section>
          <h3 className="flex items-center gap-2 text-2xl font-semibold text-slate-800 mb-4">
            <Shield className="h-5 w-5 text-blue-800" />
            Rol y Permisos
          </h3>
          <div className="space-y-4">
            <Select
              label="Rol del Usuario *"
              options={rolOptions}
              placeholder="Seleccionar rol"
              {...register("rol")}
              error={errors.rol?.message}
            />
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                  <Controller
                    control={control}
                    name={`direccionAsignadas.${index}.direccion`}
                    render={({ field: direccionField }) => (
                      <Select
                        label={index === 0 ? "Dirección principal *" : `Dirección adicional ${index} *`}
                        options={direccionOptions}
                        placeholder={index === 0 ? "Seleccione dirección principal" : "Seleccione dirección adicional"}
                        value={direccionField.value || ""}
                        onChange={(e) => direccionField.onChange(e.target.value)}
                        onBlur={direccionField.onBlur}
                        error={errors.direccionAsignadas?.[index]?.direccion?.message}
                      />
                    )}
                  />
                  {index > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      className="md:self-end"
                      onClick={() => remove(index)}
                    >
                      Quitar
                    </Button>
                  )}
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!direccionPrincipal.trim()}
                  onClick={() => append({ direccion: "" })}
                >
                  Tiene otra dirección
                </Button>
                {!direccionPrincipal.trim() && (
                  <p className="text-xs text-slate-500">Primero seleccione la dirección principal.</p>
                )}
                {errors.direccionAsignadas?.message && (
                  <p className="text-xs font-semibold text-red-600">{errors.direccionAsignadas.message}</p>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-500">Define los permisos y accesos del usuario en el sistema.</p>
          </div>
        </section>
      </div>

      <div className="mt-8 pt-5 border-t border-slate-200 flex items-center justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={loading} className="bg-blue-900 hover:bg-blue-950 shadow-[0_8px_16px_rgba(30,58,138,0.35)]">
          <UserPlus className="h-4 w-4 mr-2" /> {submitLabel || (isEdit ? "Guardar cambios" : "Crear Usuario")}
        </Button>
      </div>
    </form>
  );
}
