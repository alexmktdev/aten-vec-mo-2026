"use client";

import Link from "next/link";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/Modal";
import { FiscalPieChart } from "@/components/features/dashboard/FiscalPieChart";
import type { DashboardChartCardId, DashboardPieSlice } from "@/types/dashboard-charts.types";

const CARD_COPY: Record<
  DashboardChartCardId,
  { title: string; subtitle: string; hash: string }
> = {
  total: {
    title: "Total por dirección",
    subtitle: "Distribución del volumen total según dirección municipal (100% del universo visible).",
    hash: "total",
  },
  pendiente: {
    title: "Pendientes por dirección",
    subtitle: "Solo casos en estado pendiente: qué dirección concentra la carga.",
    hash: "pendiente",
  },
  derivado: {
    title: "Derivados por dirección",
    subtitle: "Casos derivados al área correspondiente, repartidos por dirección.",
    hash: "derivado",
  },
  en_proceso: {
    title: "En proceso por dirección",
    subtitle: "Casos en solución activa, por dirección municipal.",
    hash: "en_proceso",
  },
  en_espera_1: {
    title: "En espera 1 por dirección",
    subtitle: "Casos en el primer estado de espera (plazo extendido +2 semanas hábiles).",
    hash: "en_espera_1",
  },
  en_espera_2: {
    title: "En espera 2 por dirección",
    subtitle: "Casos en el segundo estado de espera (plazo extendido +2 semanas hábiles adicionales).",
    hash: "en_espera_2",
  },
  derivado_respuesta_final: {
    title: "Derivados a respuesta final",
    subtitle: "Casos que el director derivó a un admin para que envíe la respuesta final al vecino.",
    hash: "derivado_respuesta_final",
  },
  completado: {
    title: "Completados por dirección",
    subtitle: "Cierres efectivos según dirección que tenía el caso.",
    hash: "completado",
  },
  rechazado: {
    title: "Rechazados por dirección",
    subtitle: "Casos rechazados, repartidos por dirección.",
    hash: "rechazado",
  },
  urgentesActivos: {
    title: "Urgentes activos por dirección",
    subtitle: "Abiertos con 20+ días calendario desde el ingreso (alerta operativa).",
    hash: "urgentesActivos",
  },
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId: DashboardChartCardId | null;
  slices: DashboardPieSlice[];
};

export function DashboardChartModal({ open, onOpenChange, cardId, slices }: Props) {
  const meta = cardId ? CARD_COPY[cardId] : null;

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <ModalHeader>
          <ModalTitle>{meta?.title ?? "Gráfico"}</ModalTitle>
          <ModalDescription>{meta?.subtitle ?? ""}</ModalDescription>
        </ModalHeader>
        <FiscalPieChart data={slices} height={320} />
        <ModalFooter className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500 text-left w-full sm:w-auto sm:max-w-[55%]">
            Misma lógica que la exportación Excel (agregación en servidor sobre datos en vivo).
          </p>
          <div className="flex flex-wrap gap-3 justify-end w-full sm:w-auto">
            <Link
              href="/dashboard/graficas"
              className="text-sm font-medium text-slate-600 hover:text-blue-900 hover:underline"
              onClick={() => onOpenChange(false)}
            >
              Gráficas resumen
            </Link>
            {meta ? (
              <Link
                href={`/dashboard/graficas#${meta.hash}`}
                className="text-sm font-medium text-blue-900 hover:underline"
                onClick={() => onOpenChange(false)}
              >
                Ir a esta sección →
              </Link>
            ) : null}
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
