"use client";

import { useState } from "react";
import { useDashboardHighlights, useDashboardStats, useDashboardCharts } from "@/hooks/useRequerimientos";
import { StatsCard } from "@/components/features/dashboard/StatsCard";
import { DashboardChartModal } from "@/components/features/dashboard/DashboardChartModal";
import type { DashboardChartCardId } from "@/types/dashboard-charts.types";
import {
  FileText,
  CheckCircle,
  Clock,
  Send,
  XCircle,
  AlertTriangle,
  LayoutDashboard,
  ListChecks,
  Flame,
  Building2,
  BadgeCheck,
  PauseCircle,
  Users,
} from "lucide-react";

type RankTheme = "blue" | "orange" | "slate" | "green";

function getDaysInPlatform(fechaIngreso: string): number {
  const ingreso = new Date(fechaIngreso).getTime();
  if (Number.isNaN(ingreso)) return 0;
  const diffMs = Date.now() - ingreso;
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function rankClass(index: number, theme: RankTheme) {
  const palette = {
    blue: ["bg-blue-700 text-white", "bg-blue-600 text-white", "bg-blue-500 text-white", "bg-blue-100 text-blue-700"],
    orange: ["bg-orange-700 text-white", "bg-orange-600 text-white", "bg-orange-500 text-white", "bg-orange-100 text-orange-700"],
    slate: ["bg-slate-700 text-white", "bg-slate-600 text-white", "bg-slate-500 text-white", "bg-slate-200 text-slate-700"],
    green: ["bg-emerald-700 text-white", "bg-emerald-600 text-white", "bg-emerald-500 text-white", "bg-emerald-100 text-emerald-700"],
  } as const;

  if (index <= 2) return palette[theme][index];
  return palette[theme][3];
}

export default function DashboardPage() {
  const [chartOpen, setChartOpen] = useState(false);
  const [activeCard, setActiveCard] = useState<DashboardChartCardId | null>(null);
  const { data: stats, isLoading } = useDashboardStats();
  const { data: highlights, isLoading: loadingHighlights } = useDashboardHighlights();
  const { data: charts } = useDashboardCharts();

  const openCardChart = (id: DashboardChartCardId) => {
    setActiveCard(id);
    setChartOpen(true);
  };

  const statsReady = !isLoading && stats;

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-6 px-2 xl:px-4">
      <h1 className="admin-title mb-2 flex items-center gap-3">
        <LayoutDashboard className="h-7 w-7 text-blue-900" />
        Panel de control de Requerimientos para el sistema de atención al vecino
      </h1>

      <p className="text-sm text-slate-600">
        Pulse una tarjeta para ver la torta por <strong>dirección municipal</strong> (misma base que el Excel de
        fiscalización). También puede abrir la sección <strong>Gráficas resumen</strong> en el menú lateral.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {!statsReady && [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
          <div key={i} className="rounded-2xl bg-white p-4 shadow-sm animate-pulse">
            <div className="mb-3 h-4 w-24 rounded bg-slate-100" />
            <div className="h-8 w-16 rounded bg-slate-100" />
          </div>
        ))}
        {statsReady && (
          <>
            <StatsCard
              title="Total Requerimientos"
              value={stats?.total || 0}
              icon={FileText}
              color="blue"
              trend="Total acumulado del sistema"
              onClick={() => openCardChart("total")}
            />
            <StatsCard
              title="Pendientes"
              value={stats?.pendiente || 0}
              icon={Clock}
              color="yellow"
              trend="Estado: Pendiente"
              onClick={() => openCardChart("pendiente")}
            />
            <StatsCard
              title="Derivados"
              value={stats?.derivado || 0}
              icon={Send}
              color="blue"
              trend="Estado: Derivar al área correspondiente"
              onClick={() => openCardChart("derivado")}
            />
            <StatsCard
              title="En Proceso"
              value={stats?.en_proceso || 0}
              icon={Clock}
              color="orange"
              trend="Estado: En proceso de solución"
              onClick={() => openCardChart("en_proceso")}
            />
            <StatsCard
              title="En Espera 1"
              value={stats?.en_espera_1 || 0}
              icon={PauseCircle}
              color="orange"
              trend="Estado: Requerimiento en espera 1"
              onClick={() => openCardChart("en_espera_1")}
            />
            <StatsCard
              title="En Espera 2"
              value={stats?.en_espera_2 || 0}
              icon={PauseCircle}
              color="orange"
              trend="Estado: Requerimiento en espera 2"
              onClick={() => openCardChart("en_espera_2")}
            />
            <StatsCard
              title="Derivados Respuesta Final"
              value={stats?.derivado_respuesta_final || 0}
              icon={Users}
              color="blue"
              trend="Estado: Derivado para respuesta final"
              onClick={() => openCardChart("derivado_respuesta_final")}
            />
            <StatsCard
              title="Completados"
              value={stats?.completado || 0}
              icon={CheckCircle}
              color="green"
              trend="Estado: Requerimiento Completado"
              onClick={() => openCardChart("completado")}
            />
            <StatsCard
              title="Rechazados"
              value={stats?.rechazado || 0}
              icon={XCircle}
              color="red"
              trend="Estado: Requerimiento Rechazado"
              onClick={() => openCardChart("rechazado")}
            />
            <StatsCard
              title="Urgentes Activos"
              value={stats?.urgentesActivos || 0}
              icon={AlertTriangle}
              color="red"
              trend="Más de 20 días sin responder"
              onClick={() => openCardChart("urgentesActivos")}
            />
          </>
        )}
      </div>

      <DashboardChartModal
        open={chartOpen}
        onOpenChange={setChartOpen}
        cardId={activeCard}
        slices={activeCard && charts?.cards ? charts.cards[activeCard] : []}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-blue-900">
            <ListChecks className="h-4 w-4" />
            Últimos 5 requerimientos
          </h2>
          <p className="mb-3 text-xs text-slate-500">Ingresos más recientes del sistema.</p>
          <div className="space-y-2">
            {(highlights?.ultimos || []).map((item, index) => (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-bold ${rankClass(index, "blue")}`}>
                    {index + 1}#
                  </span>
                  <span className="text-xs font-semibold text-blue-700">{item.numeroSeguimiento}</span>
                </div>
                <p className="text-sm font-medium text-slate-800">
                  {item.vecino.nombre} {item.vecino.primerApellido}
                </p>
                <p className="text-xs text-slate-500">{item.direccionMunicipalLabel}</p>
              </div>
            ))}
            {!loadingHighlights && (!highlights?.ultimos || highlights.ultimos.length === 0) ? (
              <p className="text-sm text-slate-500">Sin datos.</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-blue-900">
            <Flame className="h-4 w-4" />
            Top 5 requerimientos más urgentes
          </h2>
          <p className="mb-3 text-xs text-slate-500">Mayor antigüedad en plataforma primero.</p>
          <div className="space-y-2">
            {(highlights?.urgentes || []).map((item, index) => (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-bold ${rankClass(index, "orange")}`}>
                    {index + 1}#
                  </span>
                  <span className="text-xs font-semibold text-red-600">
                    {getDaysInPlatform(item.fechaIngreso)} días en plataforma
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-800">{item.numeroSeguimiento}</p>
                <p className="text-xs text-slate-500">{item.direccionMunicipalLabel}</p>
              </div>
            ))}
            {!loadingHighlights && (!highlights?.urgentes || highlights.urgentes.length === 0) ? (
              <p className="text-sm text-slate-500">Sin datos.</p>
            ) : null}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-blue-900">
            <Building2 className="h-4 w-4" />
            Top 5 direcciones con más requerimientos
          </h2>
          <p className="mb-3 text-xs text-slate-500">Direcciones con mayor volumen ingresado.</p>
          <div className="space-y-2">
            {(highlights?.direccionesTop || []).map((item, index) => (
              <div key={item.direccion} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-bold ${rankClass(index, "slate")}`}>
                    {index + 1}#
                  </span>
                  <span className="text-sm text-slate-800">{item.direccion}</span>
                </div>
                <span className="text-sm font-semibold text-slate-900">{item.total}</span>
              </div>
            ))}
            {!loadingHighlights && (!highlights?.direccionesTop || highlights.direccionesTop.length === 0) ? (
              <p className="text-sm text-slate-500">Sin datos.</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-blue-900">
            <BadgeCheck className="h-4 w-4" />
            Top 5 direcciones con más requerimientos resueltos
          </h2>
          <p className="mb-3 text-xs text-slate-500">Direcciones con más cierres efectivos.</p>
          <div className="space-y-2">
            {(highlights?.direccionesResueltasTop || []).map((item, index) => (
              <div key={item.direccion} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-bold ${rankClass(index, "green")}`}>
                    {index + 1}#
                  </span>
                  <span className="text-sm text-slate-800">{item.direccion}</span>
                </div>
                <span className="text-sm font-semibold text-emerald-700">{item.totalResueltos}</span>
              </div>
            ))}
            {!loadingHighlights && (!highlights?.direccionesResueltasTop || highlights.direccionesResueltasTop.length === 0) ? (
              <p className="text-sm text-slate-500">Sin datos.</p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
