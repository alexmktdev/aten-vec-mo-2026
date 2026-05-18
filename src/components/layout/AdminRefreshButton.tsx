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
    <div
      className="fixed right-4 top-4 z-30 w-[calc(100vw-2rem)] max-w-md rounded-xl border border-slate-200 bg-white p-3 shadow-md sm:flex sm:max-w-lg sm:items-center sm:gap-3 sm:p-3.5"
      role="region"
      aria-label="Actualización de datos del panel"
    >
      <p className="mb-2 text-xs leading-snug text-slate-600 sm:mb-0 sm:min-w-0 sm:flex-1 sm:text-sm sm:leading-relaxed">
        <span className="font-semibold text-slate-800">Actualizar:</span> vuelve a cargar desde el servidor lo que ves en esta
        pantalla (por ejemplo requerimientos, cifras del panel o usuarios). Si vas a otra sección del menú, ahí también se
        pedirán datos al día.
      </p>
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={refreshing}
        className="flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-900 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 sm:w-auto"
        title="Volver a pedir los datos al servidor ahora"
        aria-label="Actualizar datos desde el servidor"
        aria-busy={refreshing || undefined}
      >
        <RefreshCw className={cn("h-4 w-4 shrink-0", refreshing && "animate-spin")} aria-hidden />
        <span>{refreshing ? "Actualizando…" : "Actualizar"}</span>
      </button>
    </div>
  );
}
