"use client";

import { useEffect } from "react";
import { ChartPie, Loader2 } from "lucide-react";
import { useDashboardCharts } from "@/hooks/useRequerimientos";
import { FiscalPieChart } from "@/components/features/dashboard/FiscalPieChart";
import type { DashboardChartCardId, DashboardChartsPayload } from "@/types/dashboard-charts.types";

function ChartSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-blue-900">{title}</h2>
      <p className="mb-4 text-xs text-slate-500">{description}</p>
      {children}
    </section>
  );
}

const CARD_SECTIONS: {
  id: DashboardChartCardId;
  title: string;
  description: string;
}[] = [
  {
    id: "total",
    title: "Total de requerimientos por dirección",
    description: "Volumen acumulado según dirección municipal. Sirve para comparar carga entre equipos.",
  },
  {
    id: "pendiente",
    title: "Pendientes por dirección",
    description: "Casos aún sin derivar o sin primera acción: dónde se concentra la cola inicial.",
  },
  {
    id: "derivado",
    title: "Derivados por dirección",
    description: "Requerimientos en manos del área técnica correspondiente.",
  },
  {
    id: "en_proceso",
    title: "En proceso por dirección",
    description: "Trabajo activo de resolución por dirección.",
  },
  {
    id: "en_espera_1",
    title: "En espera 1 por dirección",
    description: "Casos en el primer estado de espera (con plazo extendido en 2 semanas hábiles).",
  },
  {
    id: "en_espera_2",
    title: "En espera 2 por dirección",
    description: "Casos en el segundo estado de espera (con plazo extendido en 2 semanas hábiles adicionales).",
  },
  {
    id: "derivado_respuesta_final",
    title: "Derivados para respuesta final",
    description: "Casos que el director ya derivó a un admin para que envíe el correo final al vecino.",
  },
  {
    id: "completado",
    title: "Completados por dirección",
    description: "Cierres positivos: qué dirección resuelve más casos en términos absolutos (en su universo).",
  },
  {
    id: "rechazado",
    title: "Rechazados por dirección",
    description: "Casos cerrados sin solución favorable; útil para revisar criterios o calidad de ingreso.",
  },
  {
    id: "urgentesActivos",
    title: "Urgentes activos por dirección",
    description: "Abiertos con 20+ días calendario desde el ingreso. Prioridad operativa.",
  },
];

function scrollToHash() {
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return;
  requestAnimationFrame(() => {
    document.getElementById(raw)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

export default function GraficasPage() {
  const { data, isLoading, isError, error } = useDashboardCharts();

  useEffect(() => {
    scrollToHash();
  }, [data]);

  useEffect(() => {
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-2 xl:px-4 pb-10">
      <header className="space-y-2">
        <h1 className="admin-title flex items-center gap-3">
          <ChartPie className="h-7 w-7 text-blue-900" />
          Gráficas resumen de requerimientos
        </h1>
        {typeof data?.generatedAt === "string" ? (
          <p className="text-xs text-slate-500">
            Actualizado: {new Date(data.generatedAt).toLocaleString("es-CL")}
          </p>
        ) : null}
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-8 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando agregados…
        </div>
      ) : null}

      {isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error instanceof Error ? error.message : "No se pudieron cargar los gráficos."}
        </div>
      ) : null}

      {data ? <GraficasGrid payload={data} /> : null}
    </div>
  );
}

function GraficasGrid({ payload }: { payload: DashboardChartsPayload }) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      {CARD_SECTIONS.map((s) => (
        <ChartSection key={s.id} id={s.id} title={s.title} description={s.description}>
          <FiscalPieChart data={payload.cards[s.id]} height={300} />
        </ChartSection>
      ))}

      <ChartSection
        id="estados"
        title="Distribución global por estado"
        description="Mix de todos los requerimientos del alcance visible (panel resumido)."
      >
        <FiscalPieChart data={payload.estadosDistribucion} height={300} />
      </ChartSection>

      <ChartSection
        id="ingresos-mes"
        title="Ingresos por mes (últimos 12 meses)"
        description="Serie mensual de nuevos requerimientos: estacionalidad y carga reciente."
      >
        <FiscalPieChart data={payload.ingresosPorMes} height={300} />
      </ChartSection>

      <ChartSection
        id="cat-abiertos"
        title="Categorías — casos abiertos"
        description="Dónde está el trabajo pendiente según tipo de trámite / categoría."
      >
        <FiscalPieChart data={payload.categoriasAbiertos} height={300} />
      </ChartSection>

      <ChartSection
        id="cat-cerrados"
        title="Categorías — casos cerrados"
        description="Qué tipos de problemas ya se cerraron (mix histórico reciente en el universo visible)."
      >
        <FiscalPieChart data={payload.categoriasCerrados} height={300} />
      </ChartSection>
    </div>
  );
}
