"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData, queryOptions } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { RequerimientoDTO, EstadoRequerimiento, RespuestaVecinoInput } from "@/types/requerimiento.types";
import { fetchJson } from "@/lib/api/fetch-json";
import { RequerimientoCreateInput } from "@/lib/validations/requerimiento.schema";
import { getDireccionLabel } from "@/constants/direcciones";
import type { DashboardChartsPayload } from "@/types/dashboard-charts.types";

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
  en_espera_1: number;
  en_espera_2: number;
  derivado_respuesta_final: number;
  completado: number;
  rechazado: number;
  urgentesActivos: number;
}

interface DashboardHighlights {
  ultimos: RequerimientoDTO[];
  urgentes: RequerimientoDTO[];
  direccionesTop: { direccion: string; total: number }[];
  direccionesResueltasTop: { direccion: string; totalResueltos: number }[];
}

type RequerimientosListCache = { data: RequerimientoDTO[]; nextCursor?: string; total?: number };

/**
 * Invalida las 3 queries de dashboard (stats, highlights y charts) para que
 * se refresquen al instante después de cualquier mutación sobre
 * requerimientos. Las queries activas refetchean inmediatamente; las
 * inactivas quedan marcadas como stale y se actualizan al volver a
 * montarse.
 */
function invalidateDashboardQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["dashboard-stats"], refetchType: "all" });
  queryClient.invalidateQueries({ queryKey: ["dashboard-highlights"], refetchType: "all" });
  queryClient.invalidateQueries({ queryKey: ["dashboard-charts"], refetchType: "all" });
}

function patchRowInAllRequerimientosQueries(
  queryClient: QueryClient,
  id: string,
  patchRow: (row: RequerimientoDTO) => RequerimientoDTO
) {
  queryClient.setQueriesData<RequerimientosListCache>(
    { predicate: (q) => q.queryKey[0] === "requerimientos" },
    (old) => {
      if (!old?.data) return old;
      const idx = old.data.findIndex((r) => r.id === id);
      if (idx === -1) return old;
      return {
        ...old,
        data: old.data.map((r, i) => (i === idx ? patchRow(r) : r)),
      };
    }
  );
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
    onMutate: async ({ id, estado, nota }) => {
      if (!estado) return {};
      await queryClient.cancelQueries({ queryKey: ["requerimiento", id] });
      await queryClient.cancelQueries({ queryKey: ["requerimientos"] });

      const listSnapshots = queryClient.getQueriesData<RequerimientosListCache>({ queryKey: ["requerimientos"] });
      const prevDetail = queryClient.getQueryData<RequerimientoDTO>(["requerimiento", id]);
      const notaTrim = nota?.trim();

      if (prevDetail) {
        queryClient.setQueryData<RequerimientoDTO>(["requerimiento", id], {
          ...prevDetail,
          estado,
          historialEstados: [
            ...prevDetail.historialEstados,
            {
              estado,
              fecha: new Date().toISOString(),
              ...(notaTrim ? { nota: notaTrim } : {}),
            },
          ],
        });
      }

      patchRowInAllRequerimientosQueries(queryClient, id, (r) => ({
        ...r,
        estado,
        historialEstados: [
          ...r.historialEstados,
          {
            estado,
            fecha: new Date().toISOString(),
            ...(notaTrim ? { nota: notaTrim } : {}),
          },
        ],
      }));

      return { prevDetail, listSnapshots };
    },
    onSuccess: (_data, variables) => {
      if (!variables.estado) return;
      patchRowInAllRequerimientosQueries(queryClient, variables.id, (r) => ({
        ...r,
        estado: variables.estado!,
      }));
    },
    onError: (_err, { id }, context) => {
      if (context?.prevDetail) {
        queryClient.setQueryData(["requerimiento", id], context.prevDetail);
      }
      context?.listSnapshots?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: (_data, _err, variables) => {
      invalidateDashboardQueries(queryClient);
      if (variables?.id) {
        queryClient.invalidateQueries({ queryKey: ["requerimiento", variables.id] });
      }
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
      const { id, payload } = variables;
      const direccion = payload.direccionMunicipal || "";
      const label = payload.direccionMunicipalLabel
        ?? (direccion ? getDireccionLabel(direccion) : "");

      patchRowInAllRequerimientosQueries(queryClient, id, (r) => ({
        ...r,
        vecino: payload.vecino as RequerimientoDTO["vecino"],
        tipoRequerimiento: payload.tipoRequerimiento as RequerimientoDTO["tipoRequerimiento"],
        direccionMunicipal: direccion,
        direccionMunicipalLabel: label,
        categoria: payload.categoria || "",
        descripcion: payload.descripcion,
        documentos: payload.documentos ?? r.documentos,
      }));

      queryClient.setQueryData<RequerimientoDTO>(["requerimiento", id], (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          vecino: payload.vecino as RequerimientoDTO["vecino"],
          tipoRequerimiento: payload.tipoRequerimiento as RequerimientoDTO["tipoRequerimiento"],
          direccionMunicipal: direccion,
          direccionMunicipalLabel: label,
          categoria: payload.categoria || "",
          descripcion: payload.descripcion,
          documentos: payload.documentos ?? prev.documentos,
        };
      });

      queryClient.invalidateQueries({ queryKey: ["requerimientos"] });
      queryClient.invalidateQueries({ queryKey: ["requerimiento", id] });
      invalidateDashboardQueries(queryClient);
    },
  });
}

export function useDerivarRespuestaFinal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, adminUid, nota }: { id: string; adminUid: string; nota?: string }) => {
      return fetchJson(`/api/requerimientos/${id}/derivar-respuesta-final`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminUid, nota }),
      });
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ["requerimiento", variables?.id] });
      queryClient.invalidateQueries({ queryKey: ["requerimientos"] });
      invalidateDashboardQueries(queryClient);
    },
  });
}

export function useRevertirEstado() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return fetchJson<{ estadoAntes: EstadoRequerimiento; estadoDespues: EstadoRequerimiento }>(
        `/api/requerimientos/${id}/revertir`,
        { method: "POST" }
      );
    },
    onSettled: (_data, _err, id) => {
      queryClient.invalidateQueries({ queryKey: ["requerimiento", id] });
      queryClient.invalidateQueries({ queryKey: ["requerimientos"] });
      invalidateDashboardQueries(queryClient);
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
    onMutate: async ({ id, direccionMunicipal, emailDestinatario }) => {
      await queryClient.cancelQueries({ queryKey: ["requerimiento", id] });
      await queryClient.cancelQueries({ queryKey: ["requerimientos"] });

      const listSnapshots = queryClient.getQueriesData<RequerimientosListCache>({ queryKey: ["requerimientos"] });
      const prevDetail = queryClient.getQueryData<RequerimientoDTO>(["requerimiento", id]);
      const label = getDireccionLabel(direccionMunicipal);

      const patchRow = (r: RequerimientoDTO): RequerimientoDTO => ({
        ...r,
        estado: "derivado",
        direccionMunicipal,
        direccionMunicipalLabel: label,
        historialEstados: [
          ...r.historialEstados,
          {
            estado: "derivado",
            fecha: new Date().toISOString(),
            nota: `Derivado a ${label} (${emailDestinatario})`,
          },
        ],
      });

      if (prevDetail) {
        queryClient.setQueryData<RequerimientoDTO>(["requerimiento", id], patchRow(prevDetail));
      }

      patchRowInAllRequerimientosQueries(queryClient, id, patchRow);

      return { prevDetail, listSnapshots };
    },
    onSuccess: (_data, variables) => {
      const label = getDireccionLabel(variables.direccionMunicipal);
      patchRowInAllRequerimientosQueries(queryClient, variables.id, (r) => ({
        ...r,
        estado: "derivado",
        direccionMunicipal: variables.direccionMunicipal,
        direccionMunicipalLabel: label,
      }));
    },
    onError: (_err, { id }, context) => {
      if (context?.prevDetail) {
        queryClient.setQueryData(["requerimiento", id], context.prevDetail);
      }
      context?.listSnapshots?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: (_data, _err, variables) => {
      invalidateDashboardQueries(queryClient);
      if (variables?.id) {
        queryClient.invalidateQueries({ queryKey: ["requerimiento", variables.id] });
      }
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
      const snapshots = queryClient.getQueriesData<RequerimientosListCache>({ queryKey: ["requerimientos"] });
      queryClient.setQueriesData<RequerimientosListCache>(
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
      invalidateDashboardQueries(queryClient);
    },
  });
}

export function useEnviarRespuestaVecino() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: RespuestaVecinoInput & { cierre?: "completado" | "rechazado" };
    }) => {
      return fetchJson(`/api/requerimientos/${id}/respuesta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["requerimiento", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["requerimientos"] });
      invalidateDashboardQueries(queryClient);
    },
  });
}

export function useEnviarRespuestaInmediata() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: RespuestaVecinoInput & {
        cierre: "completado" | "rechazado";
        evidencia?: {
          tipo: "documento";
          nombre: string;
          nombreR2: string;
          url: string;
          tamanio: number;
        };
      };
    }) => {
      return fetchJson(`/api/requerimientos/${id}/respuesta-inmediata`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["requerimiento", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["requerimientos"] });
      invalidateDashboardQueries(queryClient);
    },
  });
}

export function useSetEvidenciaResolucion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; tipo: "documento" | "link"; nombre?: string; nombreR2?: string; url: string; tamanio?: number }) => {
      return fetchJson(`/api/requerimientos/${id}/evidencia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["requerimiento", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["requerimientos"] });
      invalidateDashboardQueries(queryClient);
    },
  });
}

export function useDeleteEvidenciaResolucion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return fetchJson(`/api/requerimientos/${id}/evidencia`, { method: "DELETE" });
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["requerimiento", id] });
      queryClient.invalidateQueries({ queryKey: ["requerimientos"] });
      invalidateDashboardQueries(queryClient);
    },
  });
}

export function useDashboardStats() {
  return useQuery(getDashboardStatsQueryOptions());
}

export function useDashboardHighlights() {
  return useQuery(getDashboardHighlightsQueryOptions());
}

export function useDashboardCharts() {
  return useQuery(getDashboardChartsQueryOptions());
}

export function getDashboardStatsQueryOptions() {
  return queryOptions({
    queryKey: ["dashboard-stats"] as const,
    queryFn: async () => {
      return fetchJson<DashboardStats>("/api/dashboard/stats");
    },
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });
}

export function getDashboardHighlightsQueryOptions() {
  return queryOptions({
    queryKey: ["dashboard-highlights"] as const,
    queryFn: async () => {
      return fetchJson<DashboardHighlights>("/api/dashboard/highlights");
    },
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });
}

export function getDashboardChartsQueryOptions() {
  return queryOptions({
    queryKey: ["dashboard-charts"],
    queryFn: async () => fetchJson<DashboardChartsPayload>("/api/dashboard/charts"),
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });
}
