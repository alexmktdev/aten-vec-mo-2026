"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";

interface TabAccessDeniedProps {
  tabLabel: string;
}

export function TabAccessDenied({ tabLabel }: TabAccessDeniedProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl items-center justify-center px-2 xl:px-4">
      <section className="w-full rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-8 shadow-[0_16px_40px_rgba(120,53,15,0.10)]">
        <div className="mx-auto flex max-w-xl flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
            Acceso restringido
          </p>
          <h1 className="text-2xl font-bold text-slate-900">
            {tabLabel}
          </h1>
          <p className="mt-4 text-base text-slate-700">
            Su perfil no tiene acceso a esta pestaña.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Si necesita revisarla, solicite apoyo a un perfil con permisos administrativos.
          </p>
          <Link
            href="/requerimientos"
            className="mt-6 inline-flex rounded-2xl bg-blue-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-800"
          >
            Ir a Requerimientos
          </Link>
        </div>
      </section>
    </div>
  );
}
