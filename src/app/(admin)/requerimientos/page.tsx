"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useRequerimientos, useDeleteRequerimiento, getRequerimientosQueryOptions } from "@/hooks/useRequerimientos";
import { useAuth } from "@/hooks/useAuth";
import { DataTable } from "@/components/ui/DataTable";
import { RequerimientoFilters } from "@/components/features/requerimientos/RequerimientoFilters";
import { RequerimientoStatusBadge } from "@/components/features/requerimientos/RequerimientoStatusBadge";
import { RequerimientoDTO } from "@/types/requerimiento.types";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { AlertTriangle, History, Pencil, Trash2 } from "lucide-react";
import { PaginationNumeric } from "@/components/ui/PaginationNumeric";
import { getBusinessDaysBetween } from "@/lib/utils/dias-habiles";
import { canDeleteRequerimiento } from "@/lib/requerimiento-permissions";
import { esRolAdminPlataforma } from "@/types/usuario.types";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";

const PAGE_SIZE = 8;

export default function RequerimientosPage() {
  const [estado, setEstado] = useState("");
  const [direccion, setDireccion] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [sortMode, setSortMode] = useState<"recientes" | "antiguos" | "limite">("recientes");
  const [currentPage, setCurrentPage] = useState(1);
  const [errorMsg, setErrorMsg] = useState("");
  const [requerimientoToDelete, setRequerimientoToDelete] = useState<RequerimientoDTO | null>(null);
  const cachedTotal = useRef<number | undefined>(undefined);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const deleteMutation = useDeleteRequerimiento();
  const effectivePage = currentPage;
  const canFilterByDireccion =
    user?.rol === "superadmin" ||
    (!!user && esRolAdminPlataforma(user.rol)) ||
    user?.rol === "administradora-municipal";

  const sortBy = sortMode === "limite" ? "fechaLimite" as const : "fechaIngreso" as const;
  const sortDir = sortMode === "antiguos" ? "asc" as const : "desc" as const;
  const needsTotal = cachedTotal.current === undefined;

  const { data, isLoading, isFetching } = useRequerimientos({
    estado: estado || undefined,
    direccion: direccion || undefined,
    page: effectivePage,
    includeTotal: needsTotal,
    limit: PAGE_SIZE,
    sortBy,
    sortDir,
  });

  if (data?.total !== undefined && data.total !== cachedTotal.current) {
    cachedTotal.current = data.total;
  }
  const total = cachedTotal.current ?? data?.total ?? 0;
  const knownPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const search = busqueda.trim().toLowerCase();
  const visiblePage = Math.min(currentPage, knownPages);

  const buildParams = useCallback((page: number) => ({
    estado: estado || undefined,
    direccion: direccion || undefined,
    page,
    includeTotal: false as const,
    limit: PAGE_SIZE,
    sortBy,
    sortDir,
  }), [estado, direccion, sortBy, sortDir]);

  useEffect(() => {
    if (total === 0) return;
    const pages: number[] = [];
    if (effectivePage > 1) pages.push(effectivePage - 1);
    if (effectivePage < knownPages) pages.push(effectivePage + 1);
    if (effectivePage + 2 <= knownPages) pages.push(effectivePage + 2);
    pages.forEach((p) => {
      void queryClient.prefetchQuery(getRequerimientosQueryOptions(buildParams(p)));
    });
  }, [total, knownPages, effectivePage, queryClient, buildParams]);

  const filteredRows = useMemo(() => {
    const rows = data?.data || [];
    if (!search) return rows;
    return rows.filter((item) => {
      const text = [
        item.numeroSeguimiento,
        `${item.vecino.nombre} ${item.vecino.primerApellido}`,
        item.vecino.rut,
        item.direccionMunicipalLabel,
      ]
        .join(" ")
        .toLowerCase();
      return text.includes(search);
    });
  }, [data?.data, search]);

  const goToRequerimiento = (id: string, hash?: string) => {
    const target = hash ? `/requerimientos/${id}${hash}` : `/requerimientos/${id}`;
    router.push(target);
  };

  const columns = [
    {
      key: "numeroSeguimiento",
      header: "N° Seguimiento",
      className: "whitespace-nowrap min-w-[170px] w-[170px]",
      render: (item: RequerimientoDTO) => (
        <span className="font-semibold text-blue-600 whitespace-nowrap">{item.numeroSeguimiento}</span>
      ),
    },
    {
      key: "vecino",
      header: "Vecino",
      className: "min-w-[180px]",
      render: (item: RequerimientoDTO) => (
        <div>
          <p className="font-medium">{item.vecino.nombre} {item.vecino.primerApellido}</p>
          <p className="text-xs text-slate-400">{item.vecino.rut}</p>
        </div>
      ),
    },
    {
      key: "direccionMunicipalLabel",
      header: "Dirección",
      className: "min-w-[200px]",
      render: (item: RequerimientoDTO) => (
        <span className="text-sm">{item.direccionMunicipalLabel}</span>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      render: (item: RequerimientoDTO) => (
        <RequerimientoStatusBadge estado={item.estado} />
      ),
    },
    {
      key: "respuestaVecino",
      header: "Respuesta enviada al vecino",
      className: "min-w-[200px] text-center",
      render: (item: RequerimientoDTO) => {
        const cerrado = item.estado === "completado" || item.estado === "rechazado";
        const enviada = (item.respuestasVecino?.length ?? 0) > 0;
        if (!cerrado) {
          return <span className="text-xs text-slate-400">—</span>;
        }
        if (enviada) {
          return (
            <span className="inline-flex min-w-[3rem] items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
              Sí
            </span>
          );
        }
        return (
          <span className="inline-flex min-w-[3rem] items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800">
            No
          </span>
        );
      },
    },
    {
      key: "fechaIngreso",
      header: "Fecha",
      className: "whitespace-nowrap min-w-[130px]",
      render: (item: RequerimientoDTO) => (
        <span className="text-sm whitespace-nowrap">{new Date(item.fechaIngreso).toLocaleDateString("es-CL")}</span>
      ),
    },
    {
      key: "alertaAtencion",
      header: "Alerta de atención",
      className: "min-w-[180px]",
      render: (item: RequerimientoDTO) => {
        if (item.estado === "completado" || item.estado === "rechazado") {
          return (
            <span className="inline-flex w-fit whitespace-nowrap items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
              Cerrado
            </span>
          );
        }

        const diasSinResponder = getBusinessDaysBetween(new Date(item.fechaIngreso), new Date());
        // Rojo ≥10 hábiles (2 semanas, plazo base), ámbar 5–9, azul <5.
        const isCritico = diasSinResponder >= 10;
        const isAlerta = !isCritico && diasSinResponder >= 5;

        return (
          <span
            className={
              isCritico
                ? "inline-flex w-fit whitespace-nowrap items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700"
                : isAlerta
                  ? "inline-flex w-fit whitespace-nowrap items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700"
                  : "inline-flex w-fit whitespace-nowrap items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700"
            }
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {diasSinResponder} día{diasSinResponder !== 1 ? "s" : ""} hábil{diasSinResponder !== 1 ? "es" : ""} sin respuesta
          </span>
        );
      },
    },
    {
      key: "acciones",
      header: "Acciones",
      className: "min-w-[260px]",
      render: (item: RequerimientoDTO) => (
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            className="bg-blue-900 hover:bg-blue-950 text-white"
            onClick={(e) => {
              e.stopPropagation();
              goToRequerimiento(item.id);
            }}
          >
            <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              goToRequerimiento(item.id, "#historial-estados");
            }}
          >
            <History className="h-3.5 w-3.5 mr-1" /> Historial
          </Button>
          {user && canDeleteRequerimiento(user.rol) && (
            <Button
              variant="destructive"
              size="sm"
              loading={deleteMutation.isPending}
              onClick={async (e) => {
                e.stopPropagation();
                setErrorMsg("");
                setRequerimientoToDelete(item);
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="admin-title">Requerimientos</h1>
      </div>

      <div className="mb-6">
        <RequerimientoFilters
          estado={estado}
          direccion={direccion}
          busqueda={busqueda}
          sortMode={sortMode}
          showDireccionFilter={canFilterByDireccion}
          onEstadoChange={(v) => {
            setEstado(v);
            setCurrentPage(1);
            cachedTotal.current = undefined;
          }}
          onDireccionChange={(v) => {
            setDireccion(v);
            setCurrentPage(1);
            cachedTotal.current = undefined;
          }}
          onBusquedaChange={(v) => {
            setBusqueda(v);
            setCurrentPage(1);
          }}
          onSortModeChange={(mode) => {
            setSortMode(mode);
            setCurrentPage(1);
            cachedTotal.current = undefined;
          }}
        />
      </div>

      {errorMsg && <Alert variant="error" className="mb-4">{errorMsg}</Alert>}

      <DataTable
        columns={columns}
        data={filteredRows}
        keyExtractor={(item) => item.id}
        loading={isLoading}
        fetching={isFetching && !isLoading}
        emptyMessage="No se encontraron requerimientos"
        onRowClick={(item) => goToRequerimiento(item.id)}
      />

      <PaginationNumeric
        currentPage={visiblePage}
        knownPages={knownPages}
        hasNext={visiblePage < knownPages}
        onPrev={() => setCurrentPage((p) => Math.max(1, Math.min(knownPages, p) - 1))}
        onNext={() => setCurrentPage((p) => Math.min(knownPages, p + 1))}
        onSelectPage={(page) => {
          if (page >= 1 && page <= knownPages) setCurrentPage(page);
        }}
      />

      <ConfirmDeleteModal
        open={Boolean(requerimientoToDelete)}
        onOpenChange={(open) => {
          if (!open) setRequerimientoToDelete(null);
        }}
        title="Eliminar requerimiento"
        description={
          <>
            ¿Está seguro de eliminar el requerimiento{" "}
            <span className="font-semibold text-slate-700">{requerimientoToDelete?.numeroSeguimiento}</span>?
          </>
        }
        onConfirm={async () => {
          if (!requerimientoToDelete) return;
          setErrorMsg("");
          try {
            await deleteMutation.mutateAsync(requerimientoToDelete.id);
            setRequerimientoToDelete(null);
          } catch (error) {
            const message = error instanceof Error ? error.message : "Error al eliminar requerimiento";
            setErrorMsg(message);
          }
        }}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
