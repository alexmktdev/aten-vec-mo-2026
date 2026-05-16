"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { UsuarioCreateStyledForm } from "@/components/forms/UsuarioCreateStyledForm";
import { useCreateUsuario } from "@/hooks/useUsuarios";
import { useAuth } from "@/hooks/useAuth";
import { UsuarioCreateInput } from "@/lib/validations/usuario.schema";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, UserPlus } from "lucide-react";

export default function NuevoUsuarioPage() {
  const router = useRouter();
  const { user } = useAuth();
  const createMutation = useCreateUsuario();
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const canCreateUsers = user?.rol === "superadmin";

  const handleCreate = async (data: UsuarioCreateInput) => {
    setErrorMsg("");
    try {
      await createMutation.mutateAsync(data);
      setSuccessMsg("Usuario creado exitosamente");
      setTimeout(() => router.push("/usuarios"), 800);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Error al crear usuario");
    }
  };

  if (!canCreateUsers) {
    return (
      <div className="max-w-3xl mx-auto">
        <Alert variant="error">
          No tiene permisos para crear usuarios.
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/usuarios")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver a usuarios
        </Button>
      </div>
      <div className="mb-6">
        <h1 className="admin-title flex items-center gap-2">
          <UserPlus className="h-7 w-7 text-blue-900" />
          Nuevo Usuario
        </h1>
        <p className="text-slate-600 mt-1">Complete el formulario para crear un nuevo usuario</p>
      </div>

      {successMsg && <Alert variant="success" className="mb-4">{successMsg}</Alert>}
      {errorMsg && <Alert variant="error" className="mb-4">{errorMsg}</Alert>}

      <div className="origin-top scale-[0.85]">
        <UsuarioCreateStyledForm
          onSubmit={handleCreate}
          onCancel={() => router.push("/usuarios")}
          loading={createMutation.isPending}
        />
      </div>
    </div>
  );
}
