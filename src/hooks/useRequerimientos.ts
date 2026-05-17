"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { RequerimientoDTO, EstadoRequerimiento, RespuestaVecinoInput } from "@/types/requerimiento.types";
import { fetchJson } from "@/lib/api/fetch-json";
import { RequerimientoCreateInput } from "@/lib/validations/requerimiento.schema";

interface ListParams {
  estado?: string;
  direccion?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  page?: number;
  includeTotal?: boolean;
  cursor?: string;
  limit?: number;
  sortBy?: "creadoEn" | "fechaIngreso" | "fechaLimite" | "numeroSeguimiento";
  sortDir?: "asc" | "desc";
}

interface DashboardStats {
  total: number;
  pendiente: number;
  derivado: number;
  en_proceso: number;
  completado: number;
  rechazado: number;
  vencidos: number;
}

interface DashboardHighlights {
  ultimos: RequerimientoDTO[];
  urgentes: RequerimientoDTO[];
  direccionesTop: { direccion: string; total: number }[];
  direccionesResueltasTop: { direccion: string; totalResueltos: number }[];
  porcentajeUrgentesActivos: number;
}

async function fetchRequerimientos(params: ListParams) {
  const searchParams = new URLSearchParams();
  if (params.estado) searchParams.set("estado", params.estado);
  if (params.direccion) searchParams.set("direccion", params.direccion);
  if (params.fechaDesde) searchParams.set("fechaDesde", params.fechaDesde);
  if (params.fechaHasta) searchParams.set("fechaHasta", params.fechaHasta);
  if (params.page) searchParams.set("page", String(params.page));
  if (params.includeTotal) searchParams.set("includeTotal", "1");
  if (params.cursor) searchParams.set("cursor", params.cursor);
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params.sortDir) searchParams.set("sortDir", params.sortDir);

  return fetchJson<{ data: RequerimientoDTO[]; nextCursor?: string; total?: number }>(`/api/requerimientos?${searchParams}`);
}

export function getRequerimientosQueryOptions(params: ListParams = {}) {
  return {
    queryKey: ["requerimientos", params] as const,
    queryFn: () => fetchRequerimientos(params),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  };
}

async function fetchRequerimiento(id: string) {
  return fetchJson<RequerimientoDTO>(`/api/requerimientos/${id}`);
}

export function useRequerimientos(params: ListParams = {}) {
  return useQuery(getRequerimientosQueryOptions(params));
}

export function useRequerimiento(id: string) {
  return useQuery({
    queryKey: ["requerimiento", id],
    queryFn: () => fetchRequerimiento(id),
    enabled: !!id,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
}

export function useUpdateRequerimiento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, estado, nota }: { id: string; estado?: EstadoRequerimiento; nota?: string }) => {
      return fetchJson(`/api/requerimientos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado, nota }),
      });
    },
    onMutate: async ({ id, estado }) => {
      if (!estado) return;
      await queryClient.cancelQueries({ queryKey: ["requerimiento", id] });
      const prevDetail = queryClient.getQueryData<RequerimientoDTO>(["requerimiento", id]);
      if (prevDetail) {
        queryClient.setQueryData<RequerimientoDTO>(["requerimiento", id], { ...prevDetail, estado });
      }
      return { prevDetail };
    },
    onError: (_err, { id }, context) => {
      if (context?.prevDetail) {
        queryClient.setQueryData(["requerimiento", id], context.prevDetail);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["requerimientos"] });
      queryClient.invalidateQueries({ queryKey: ["requerimiento"] });
    },
  });
}

export function useUpdateRequerimientoDatos() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: RequerimientoCreateInput }) => {
      return fetchJson(`/api/requerimientos/${id}/datos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["requerimientos"] });
      queryClient.invalidateQueries({ queryKey: ["requerimiento", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-highlights"] });
    },
  });
}

export function useDerivarRequerimiento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      direccionMunicipal,
      emailDestinatario,
    }: {
      id: string;
      direccionMunicipal: string;
      emailDestinatario: string;
    }) => {
      return fetchJson(`/api/requerimientos/${id}/derivar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direccionMunicipal, emailDestinatario }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requerimientos"] });
      queryClient.invalidateQueries({ queryKey: ["requerimiento"] });
    },
  });
}

export function useDeleteRequerimiento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return fetchJson(`/api/requerimientos/${id}`, { method: "DELETE" });
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["requerimientos"] });
      type ListResult = { data: RequerimientoDTO[]; nextCursor?: string; total?: number };
      const snapshots = queryClient.getQueriesData<ListResult>({ queryKey: ["requerimientos"] });
      queryClient.setQueriesData<ListResult>(
        { queryKey: ["requerimientos"] },
        (old) => {
          if (!old) return old;
          return { ...old, data: old.data.filter((r) => r.id !== id), total: old.total ? old.total - 1 : undefined };
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
      queryClient.invalidateQueries({ queryKey: ["requerimientos"] });
    },
  });
}

export function useEnviarRespuestaVecino() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: RespuestaVecinoInput }) => {
      return fetchJson(`/api/requerimientos/${id}/respuesta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["requerimiento", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["requerimientos"] });
    },
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      return fetchJson<DashboardStats>("/api/dashboard/stats");
    },
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useDashboardHighlights() {
  return useQuery({
    queryKey: ["dashboard-highlights"],
    queryFn: async () => {
      return fetchJson<DashboardHighlights>("/api/dashboard/highlights");
    },
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
}
