"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UsuarioDTO } from "@/types/usuario.types";
import { fetchJson } from "@/lib/api/fetch-json";
import { UsuarioCreateInput, UsuarioUpdateInput } from "@/lib/validations/usuario.schema";

export function useUsuarios() {
  return useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => fetchJson<UsuarioDTO[]>("/api/usuarios"),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UsuarioCreateInput) => {
      return fetchJson<UsuarioDTO>("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    },
  });
}

export function useUpdateUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UsuarioUpdateInput }) =>
      fetchJson<UsuarioDTO>(`/api/usuarios/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    },
  });
}

export function useDeleteUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      fetchJson<{ id: string }>(`/api/usuarios/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    },
  });
}
