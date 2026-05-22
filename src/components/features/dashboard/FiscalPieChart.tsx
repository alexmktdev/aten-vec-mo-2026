"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { DashboardPieSlice } from "@/types/dashboard-charts.types";

const DEFAULT_COLORS = [
  "#1e3a8a",
  "#2563eb",
  "#0d9488",
  "#ca8a04",
  "#ea580c",
  "#dc2626",
  "#7c3aed",
  "#db2777",
  "#4f46e5",
  "#059669",
  "#b45309",
  "#64748b",
];

type NameVal = { name: string; value: number; pct: number };

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: NameVal }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-md">
      <p className="font-semibold text-slate-900">{p.name}</p>
      <p className="text-slate-600">
        {p.value} caso{p.value === 1 ? "" : "s"} · {p.pct}%
      </p>
    </div>
  );
}

type Props = {
  data: DashboardPieSlice[];
  /** altura mínima del contenedor del gráfico */
  height?: number;
  className?: string;
};

export function FiscalPieChart({ data, height = 280, className }: Props) {
  if (!data.length) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500 ${className ?? ""}`}
        style={{ minHeight: height }}
      >
        Sin datos para mostrar
      </div>
    );
  }

  const showLabels = data.length <= 8;

  return (
    <div className={className} style={{ width: "100%", minHeight: height }}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data as NameVal[]}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={height > 260 ? 96 : 78}
            paddingAngle={1}
            label={showLabels ? ({ pct }) => `${pct}%` : false}
          >
            {data.map((_, i) => (
              <Cell key={`cell-${i}`} fill={DEFAULT_COLORS[i % DEFAULT_COLORS.length]} stroke="#fff" strokeWidth={1} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
          <Legend
            layout="horizontal"
            align="center"
            verticalAlign="bottom"
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(value) => <span className="text-slate-700">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
