"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FileDown, Loader2 } from "lucide-react";
import type { EstadoRequerimiento, FichaPdfVariant } from "@/types/requerimiento.types";

interface Props {
  requerimientoId: string;
  numeroSeguimiento: string;
  estado: EstadoRequerimiento;
  compact?: boolean;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function RequerimientoFichaPdfDownload({
  requerimientoId,
  numeroSeguimiento,
  estado,
  compact = false,
}: Props) {
  const [loadingVariant, setLoadingVariant] = useState<FichaPdfVariant | null>(null);

  const cerrado = estado === "completado" || estado === "rechazado";

  const handleDownload = async (variant: FichaPdfVariant) => {
    setLoadingVariant(variant);
    try {
      const res = await fetch(
        `/api/requerimientos/${requerimientoId}/ficha-pdf?variant=${variant}`,
        { credentials: "include" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          typeof data?.error === "string" ? data.error : "No se pudo descargar la ficha PDF"
        );
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="([^"]+)"/);
      const filename =
        match?.[1] ||
        (variant === "ingreso"
          ? `ficha-ingreso-${numeroSeguimiento}.pdf`
          : `ficha-resuelto-${numeroSeguimiento}.pdf`);
      downloadBlob(blob, filename);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Error al descargar la ficha PDF");
    } finally {
      setLoadingVariant(null);
    }
  };

  return (
    <div className={compact ? "flex flex-col gap-1" : "flex flex-wrap gap-2"}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-xs"
        disabled={!!loadingVariant}
        onClick={(e) => {
          e.stopPropagation();
          void handleDownload("ingreso");
        }}
        title="Descargar ficha formal de ingreso"
      >
        {loadingVariant === "ingreso" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileDown className="h-3.5 w-3.5" />
        )}
        <span className={compact ? "ml-1" : "ml-1.5"}>Ingreso</span>
      </Button>
      {cerrado && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs border-emerald-200 text-emerald-800 hover:bg-emerald-50"
          disabled={!!loadingVariant}
          onClick={(e) => {
            e.stopPropagation();
            void handleDownload("resuelto");
          }}
          title="Descargar ficha formal del requerimiento resuelto"
        >
          {loadingVariant === "resuelto" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileDown className="h-3.5 w-3.5" />
          )}
          <span className={compact ? "ml-1" : "ml-1.5"}>Resuelto</span>
        </Button>
      )}
    </div>
  );
}
