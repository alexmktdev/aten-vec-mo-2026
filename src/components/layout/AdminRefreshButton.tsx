"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminRefreshButton() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const handleClick = async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries();
      router.refresh();
    } catch {
      window.location.reload();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={refreshing}
      className="fixed right-4 top-4 z-30 inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-md transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60"
      title="Volver a pedir los datos al servidor (requerimientos, panel, usuarios, etc.)"
      aria-label="Actualizar datos desde el servidor"
      aria-busy={refreshing || undefined}
    >
      <RefreshCw className={cn("h-4 w-4 shrink-0", refreshing && "animate-spin")} aria-hidden />
      <span className="hidden sm:inline">{refreshing ? "Actualizando…" : "Actualizar"}</span>
    </button>
  );
}
