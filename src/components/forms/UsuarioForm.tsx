"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { usuarioCreateSchema, usuarioUpdateSchema, type UsuarioCreateInput, type UsuarioUpdateInput } from "@/lib/validations/usuario.schema";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { ROL_LABELS, ROLES_SELECCIONABLES } from "@/types/usuario.types";
import { DIRECCIONES_MUNICIPALES } from "@/constants/direcciones";

interface Props {
  mode?: "create" | "edit";
  initialValues?: Partial<UsuarioUpdateInput & Pick<UsuarioCreateInput, "email">>;
  onSubmit: (data: UsuarioCreateInput | UsuarioUpdateInput) => Promise<void>;
  loading?: boolean;
  submitLabel?: string;
}
// formulario para crear y editar usuarios, en la pestaña de Ver usuarios 

export function UsuarioForm({ mode = "create", initialValues, onSubmit, loading, submitLabel }: Props) {
  const isCreate = mode === "create";
  const { register, handleSubmit, control, formState: { errors } } = useForm<UsuarioCreateInput | UsuarioUpdateInput>({
    resolver: zodResolver(isCreate ? usuarioCreateSchema : usuarioUpdateSchema) as never,
    defaultValues: {
      nombre: initialValues?.nombre || "",
      email: initialValues?.email || "",
      rol: initialValues?.rol,
      direccionAsignada: initialValues?.direccionAsignada || "",
      password: "",
    },
  });

  const selectedRol = useWatch({ control, name: "rol" });
  const needsDireccion = selectedRol === "director";

  const rolOptions = ROLES_SELECCIONABLES.map((r) => ({ value: r, label: ROL_LABELS[r] || r }));
  const direccionOptions = Object.entries(DIRECCIONES_MUNICIPALES).map(([key, val]) => ({ value: key, label: val.label }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input label="Nombre completo" required {...register("nombre")} error={errors.nombre?.message} />
      <Input label="Correo electrónico" type="email" required {...register("email")} error={errors.email?.message} />
      <Input
        label={isCreate ? "Contraseña" : "Nueva contraseña (opcional)"}
        type="password"
        required={isCreate}
        {...register("password")}
        error={errors.password?.message}
      />
      <Select label="Rol" required options={rolOptions} placeholder="Seleccione un rol" {...register("rol")} error={errors.rol?.message} />
      {needsDireccion && (
        <Select label="Dirección asignada" required options={direccionOptions} placeholder="Seleccione dirección" {...register("direccionAsignada")} error={errors.direccionAsignada?.message} />
      )}
      <Button type="submit" loading={loading} className="w-full">{submitLabel || (isCreate ? "Crear usuario" : "Guardar cambios")}</Button>
    </form>
  );
}
