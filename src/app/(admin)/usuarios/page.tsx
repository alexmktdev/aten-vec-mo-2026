"use client";

import { useMemo, useState } from "react";
import { useUsuarios, useUpdateUsuario, useDeleteUsuario } from "@/hooks/useUsuarios";
import { useAuth } from "@/hooks/useAuth";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Modal, ModalContent, ModalDescription, ModalHeader, ModalTitle } from "@/components/ui/Modal";
import { UsuarioCreateStyledForm } from "@/components/forms/UsuarioCreateStyledForm";
import { UsuarioDTO } from "@/types/usuario.types";
import { UsuarioUpdateInput } from "@/lib/validations/usuario.schema";
import { Pencil, Trash2 } from "lucide-react";
import { PaginationNumeric } from "@/components/ui/PaginationNumeric";
import { Input } from "@/components/ui/Input";

export default function UsuariosPage() {
  const { user } = useAuth();
  const { data: usuarios, isLoading, error } = useUsuarios();
  const updateMutation = useUpdateUsuario();
  const deleteMutation = useDeleteUsuario();
  const [selectedUser, setSelectedUser] = useState<UsuarioDTO | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const canManageUsers = user?.rol === "superadmin" || user?.rol === "administradora-municipal";

  const handleUpdate = async (data: UsuarioUpdateInput) => {
    if (!selectedUser) return;
    setErrorMsg("");
    try {
      await updateMutation.mutateAsync({ id: selectedUser.id, data });
      setShowEdit(false);
      setSelectedUser(null);
      setSuccessMsg("Usuario actualizado exitosamente");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al crear el usuario";
      setErrorMsg(message);
    }
  };

  const handleDelete = async (usuario: UsuarioDTO) => {
    if (!confirm(`¿Está seguro de eliminar definitivamente al usuario ${usuario.nombre}?`)) return;
    setErrorMsg("");
    try {
      await deleteMutation.mutateAsync(usuario.id);
      setSuccessMsg("Usuario eliminado exitosamente");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al eliminar usuario";
      setErrorMsg(message);
    }
  };

  const rolColors: Record<string, "purple" | "blue" | "green" | "default"> = {
    superadmin: "purple",
    admin: "blue",
    "administradora-municipal": "blue",
    director: "green",
  };

  const columns = [
    { key: "nombre", header: "Nombre" },
    { key: "email", header: "Email" },
    {
      key: "rol",
      header: "Rol",
      render: (item: UsuarioDTO) => (
        <Badge variant={rolColors[item.rol] || "default"}>{item.rol}</Badge>
      ),
    },
    {
      key: "direccionAsignadaLabel",
      header: "Dirección",
      render: (item: UsuarioDTO) =>
        item.direccionAsignadasLabel && item.direccionAsignadasLabel.length > 0
          ? item.direccionAsignadasLabel.join(", ")
          : item.direccionAsignadaLabel || "—",
    },
    {
      key: "acciones",
      header: "Acciones",
      render: (item: UsuarioDTO) => (
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            className="bg-blue-900 hover:bg-blue-950 text-white"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedUser(item);
              setShowEdit(true);
            }}
            disabled={!canManageUsers}
          >
            <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              void handleDelete(item);
            }}
            disabled={!canManageUsers || deleteMutation.isPending || item.id === user?.uid}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar
          </Button>
        </div>
      ),
    },
  ];

  const usuariosData = useMemo(() => usuarios || [], [usuarios]);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredUsuarios = useMemo(() => {
    if (!normalizedSearch) return usuariosData;
    return usuariosData.filter((u) => {
      const text = [u.nombre, u.email, u.rol, u.direccionAsignadaLabel || "", ...(u.direccionAsignadasLabel || [])].join(" ").toLowerCase();
      return text.includes(normalizedSearch);
    });
  }, [usuariosData, normalizedSearch]);
  const totalPagesFiltered = Math.max(1, Math.ceil(filteredUsuarios.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPagesFiltered);
  const pagedUsuarios = filteredUsuarios.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="admin-title">Usuarios</h1>
      </div>
      <div className="mb-4 max-w-md">
        <Input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          placeholder="Buscar por nombre, email, rol o dirección"
        />
      </div>

      {successMsg && <Alert variant="success" className="mb-4">{successMsg}</Alert>}
      {errorMsg && !showEdit && <Alert variant="error" className="mb-4">{errorMsg}</Alert>}
      {error && <Alert variant="error" className="mb-4">{error instanceof Error ? error.message : "Error al cargar usuarios"}</Alert>}

      <DataTable
        columns={columns}
        data={pagedUsuarios}
        keyExtractor={(item) => item.id}
        loading={isLoading}
        emptyMessage="No hay usuarios registrados"
      />

      <PaginationNumeric
        currentPage={safeCurrentPage}
        knownPages={totalPagesFiltered}
        hasNext={safeCurrentPage < totalPagesFiltered}
        onPrev={() => setCurrentPage((p) => Math.max(1, Math.min(totalPagesFiltered, p - 1)))}
        onNext={() => setCurrentPage((p) => Math.min(totalPagesFiltered, p + 1))}
        onSelectPage={(page) => setCurrentPage(page)}
      />

      <Modal open={showEdit} onOpenChange={(o) => { if (!o) { setShowEdit(false); setSelectedUser(null); setErrorMsg(""); } }}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Editar usuario</ModalTitle>
            <ModalDescription>
              Actualice los datos del usuario y sus direcciones asignadas.
            </ModalDescription>
          </ModalHeader>
          {errorMsg && <div className="px-6"><Alert variant="error">{errorMsg}</Alert></div>}
          {selectedUser && (
            <UsuarioCreateStyledForm
              mode="edit"
              initialValues={{
                nombre: selectedUser.nombre.split(" ").slice(0, 1).join(" "),
                apellido: selectedUser.nombre.split(" ").slice(1).join(" ") || "",
                email: selectedUser.email,
                rol: selectedUser.rol,
                direccionAsignada: selectedUser.direccionAsignada || "",
                direccionAsignadas: selectedUser.direccionAsignadas || (selectedUser.direccionAsignada ? [selectedUser.direccionAsignada] : []),
              }}
              onSubmit={handleUpdate}
              loading={updateMutation.isPending}
              submitLabel="Guardar cambios"
              onCancel={() => {
                setShowEdit(false);
                setSelectedUser(null);
                setErrorMsg("");
              }}
            />
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
