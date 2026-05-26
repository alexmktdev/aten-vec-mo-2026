"use client";

import { useCallback, useDeferredValue, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getUsuariosQueryOptions, useUsuarios, useUpdateUsuario, useDeleteUsuario } from "@/hooks/useUsuarios";
import { useAuth } from "@/hooks/useAuth";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Modal, ModalContent, ModalDescription, ModalHeader, ModalTitle } from "@/components/ui/Modal";
import { UsuarioDTO } from "@/types/usuario.types";
import { UsuarioUpdateInput } from "@/lib/validations/usuario.schema";
import { Pencil, Trash2 } from "lucide-react";
import { PaginationNumeric } from "@/components/ui/PaginationNumeric";
import { Input } from "@/components/ui/Input";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { UsuarioCreateStyledForm } from "@/components/forms/UsuarioCreateStyledForm";

export default function UsuariosPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const updateMutation = useUpdateUsuario();
  const deleteMutation = useDeleteUsuario();
  const [selectedUser, setSelectedUser] = useState<UsuarioDTO | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [userToDelete, setUserToDelete] = useState<UsuarioDTO | null>(null);
  const pageSize = 10;
  const deferredSearch = useDeferredValue(searchTerm.trim());
  const cachedTotal = useRef<number | undefined>(undefined);
  const { data: usuariosResponse, isLoading, isFetching, error } = useUsuarios({
    page: currentPage,
    limit: pageSize,
    search: deferredSearch || undefined,
  });

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
    setErrorMsg("");
    try {
      await deleteMutation.mutateAsync(usuario.id);
      setSuccessMsg("Usuario eliminado exitosamente");
      setTimeout(() => setSuccessMsg(""), 3000);
      setUserToDelete(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al eliminar usuario";
      setErrorMsg(message);
    }
  };

  const handleOpenEdit = (usuario: UsuarioDTO) => {
    setSelectedUser(usuario);
    setShowEdit(true);
  };

  const rolColors: Record<string, "purple" | "blue" | "green" | "yellow" | "default"> = {
    superadmin: "purple",
    admin: "blue",
    "admin-municipal": "blue",
    "admin-transparencia": "yellow",
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
              handleOpenEdit(item);
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
              setUserToDelete(item);
            }}
            disabled={!canManageUsers || deleteMutation.isPending || item.id === user?.uid}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar
          </Button>
        </div>
      ),
    },
  ];

  const usuariosData = usuariosResponse?.data || [];
  if (usuariosResponse?.total !== undefined && usuariosResponse.total !== cachedTotal.current) {
    cachedTotal.current = usuariosResponse.total;
  }
  const total = cachedTotal.current ?? usuariosResponse?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const buildUserParams = useCallback((page: number) => ({
    page,
    limit: pageSize,
    search: deferredSearch || undefined,
  }), [deferredSearch]);

  useEffect(() => {
    if (total === 0) return;
    const pages: number[] = [];
    if (safeCurrentPage > 1) pages.push(safeCurrentPage - 1);
    if (safeCurrentPage < totalPages) pages.push(safeCurrentPage + 1);
    if (safeCurrentPage + 2 <= totalPages) pages.push(safeCurrentPage + 2);
    pages.forEach((p) => {
      void queryClient.prefetchQuery(getUsuariosQueryOptions(buildUserParams(p)));
    });
  }, [total, safeCurrentPage, totalPages, queryClient, buildUserParams]);

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
            cachedTotal.current = undefined;
          }}
          placeholder="Buscar por nombre, email, rol o dirección"
        />
      </div>

      {successMsg && <Alert variant="success" className="mb-4">{successMsg}</Alert>}
      {errorMsg && !showEdit && <Alert variant="error" className="mb-4">{errorMsg}</Alert>}
      {error && <Alert variant="error" className="mb-4">{error instanceof Error ? error.message : "Error al cargar usuarios"}</Alert>}

      <DataTable
        columns={columns}
        data={usuariosData}
        keyExtractor={(item) => item.id}
        loading={isLoading}
        fetching={isFetching && !isLoading}
        emptyMessage="No hay usuarios registrados"
      />

      <PaginationNumeric
        currentPage={safeCurrentPage}
        knownPages={totalPages}
        hasNext={safeCurrentPage < totalPages}
        onPrev={() => setCurrentPage((p) => Math.max(1, Math.min(totalPages, p - 1)))}
        onNext={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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

      <ConfirmDeleteModal
        open={Boolean(userToDelete)}
        onOpenChange={(open) => {
          if (!open) setUserToDelete(null);
        }}
        title="Eliminar usuario"
        description={
          <>
            ¿Está seguro de eliminar definitivamente al usuario{" "}
            <span className="font-semibold text-slate-700">{userToDelete?.nombre}</span>?
          </>
        }
        onConfirm={() => userToDelete ? handleDelete(userToDelete) : undefined}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
