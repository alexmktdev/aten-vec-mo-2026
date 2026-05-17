"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { PaginatedUsuariosResponse, RolUsuario, UsuarioDTO } from "@/types/usuario.types";
import { fetchJson } from "@/lib/api/fetch-json";
import { UsuarioCreateInput, UsuarioUpdateInput } from "@/lib/validations/usuario.schema";

interface UseUsuariosParams {
  page?: number;
  limit?: number;
  search?: string;
}

export function getUsuariosQueryOptions(params: UseUsuariosParams = {}) {
  return {
    queryKey: ["usuarios", params] as const,
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set("page", String(params.page));
      if (params.limit) searchParams.set("limit", String(params.limit));
      if (params.search) searchParams.set("search", params.search);
      return fetchJson<PaginatedUsuariosResponse>(`/api/usuarios?${searchParams}`);
    },
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  };
}

export function useUsuarios(params: UseUsuariosParams = {}) {
  return useQuery(getUsuariosQueryOptions(params));
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
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["usuarios"] });
      const snapshots = queryClient.getQueriesData<PaginatedUsuariosResponse>({ queryKey: ["usuarios"] });
      queryClient.setQueriesData<PaginatedUsuariosResponse>(
        { queryKey: ["usuarios"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((u) =>
              u.id === id ? { ...u, nombre: data.nombre ?? u.nombre, email: data.email ?? u.email, rol: (data.rol as RolUsuario) ?? u.rol } : u
            ),
          };
        }
      );
      return { snapshots };
    },
    onError: (_err, _vars, context) => {
      context?.snapshots?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    },
  });
}

export function useDeleteUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      fetchJson<{ id: string }>(`/api/usuarios/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["usuarios"] });
      const snapshots = queryClient.getQueriesData<PaginatedUsuariosResponse>({ queryKey: ["usuarios"] });
      queryClient.setQueriesData<PaginatedUsuariosResponse>(
        { queryKey: ["usuarios"] },
        (old) => {
          if (!old) return old;
          return { ...old, data: old.data.filter((u) => u.id !== id), total: old.total - 1 };
        }
      );
      return { snapshots };
    },
    onError: (_err, _id, context) => {
      context?.snapshots?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    },
  });
}
