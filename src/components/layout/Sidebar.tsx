"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useUIStore } from "@/stores/ui.store";
import { getRequerimientosQueryOptions } from "@/hooks/useRequerimientos";
import { getUsuariosQueryOptions } from "@/hooks/useUsuarios";
import { fetchJson } from "@/lib/api/fetch-json";
import {
  LayoutDashboard,
  FileText,
  Users,
  UserPlus,
  BarChart3,
  ChartPie,
  LogOut,
  ChevronLeft,
} from "lucide-react";
import { ROLES_USUARIO, ROLES_ACCESO_REPORTES } from "@/types/usuario.types";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Panel de Control", icon: LayoutDashboard, section: "General", roles: [...ROLES_USUARIO] },
  { href: "/dashboard/graficas", label: "Gráficas resumen", icon: ChartPie, section: "General", roles: [...ROLES_USUARIO] },
  { href: "/requerimientos", label: "Requerimientos", icon: FileText, section: "Administración", roles: [...ROLES_USUARIO] },
  { href: "/reportes", label: "Reportes", icon: BarChart3, section: "Administración", roles: [...ROLES_ACCESO_REPORTES] },
  { href: "/usuarios", label: "Usuarios", icon: Users, section: "Usuarios", roles: ["superadmin", "admin", "administradora-municipal"] },
  { href: "/usuarios/nuevo", label: "Crear usuario", icon: UserPlus, section: "Usuarios", roles: ["superadmin"] },
];

const SECTIONS = ["General", "Administración", "Usuarios"] as const;

function getPrefetchQueries(): { queryKey: readonly unknown[]; queryFn: () => Promise<unknown> }[] {
  return [
    getRequerimientosQueryOptions({ page: 1, includeTotal: true, limit: 8, sortBy: "fechaIngreso", sortDir: "desc" }),
    { queryKey: ["dashboard-stats"] as const, queryFn: () => fetchJson("/api/dashboard/stats") },
    { queryKey: ["dashboard-highlights"] as const, queryFn: () => fetchJson("/api/dashboard/highlights") },
  ];
}

const PREFETCH_MAP: Record<string, () => { queryKey: readonly unknown[]; queryFn: () => Promise<unknown> }[]> = {
  "/requerimientos": () => [getRequerimientosQueryOptions({ page: 1, includeTotal: true, limit: 8, sortBy: "fechaIngreso", sortDir: "desc" })],
  "/usuarios": () => [getUsuariosQueryOptions({ page: 1, limit: 10 })],
  "/dashboard": () => [
    { queryKey: ["dashboard-stats"] as const, queryFn: () => fetchJson("/api/dashboard/stats") },
    { queryKey: ["dashboard-highlights"] as const, queryFn: () => fetchJson("/api/dashboard/highlights") },
    { queryKey: ["dashboard-charts"] as const, queryFn: () => fetchJson("/api/dashboard/charts") },
  ],
  "/dashboard/graficas": () => [
    { queryKey: ["dashboard-charts"] as const, queryFn: () => fetchJson("/api/dashboard/charts") },
    { queryKey: ["dashboard-stats"] as const, queryFn: () => fetchJson("/api/dashboard/stats") },
  ],
};

export function Sidebar() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();
  const { sidebarOpen, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } = useUIStore();
  const didPrefetch = useRef(false);

  const userRol = user?.rol;
  const filteredNav = useMemo(
    () => NAV_ITEMS.filter((item) => userRol && item.roles.includes(userRol)),
    [userRol]
  );
  const fullName = user?.nombre?.trim() || "Usuario";
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const avatarInitials =
    nameParts.length >= 2
      ? `${nameParts[0][0] || ""}${nameParts[1][0] || ""}`.toUpperCase()
      : (nameParts[0]?.slice(0, 2) || "US").toUpperCase();
  const navBySection = useMemo(
    () => SECTIONS.map((section) => ({
      section,
      items: filteredNav.filter((item) => item.section === section),
    })).filter((group) => group.items.length > 0),
    [filteredNav]
  );

  useEffect(() => {
    if (!user || didPrefetch.current) return;
    didPrefetch.current = true;
    const queries = getPrefetchQueries();
    queries.forEach((q) => void queryClient.prefetchQuery(q));
  }, [user, queryClient]);

  const handlePrefetchData = useCallback((href: string) => {
    const factory = PREFETCH_MAP[href];
    if (factory) {
      factory().forEach((q) => void queryClient.prefetchQuery(q));
    }
  }, [queryClient]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-30 bg-slate-900/40 transition-opacity lg:hidden",
          mobileSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setMobileSidebarOpen(false)}
      />
      <aside className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-white text-slate-900 transition-all duration-300 flex flex-col border-r border-slate-200",
        "w-72 lg:w-auto",
        mobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        sidebarOpen ? "lg:w-64" : "lg:w-20"
      )}>
      {/* Logo */}
      <div className="relative flex items-center justify-center px-5 py-6 border-b border-slate-200">
        <div className={cn(
          "bg-slate-100 rounded-xl flex items-center justify-center shrink-0 overflow-hidden",
          sidebarOpen ? "w-44 h-[72px]" : "w-16 h-16"
        )}>
          <Image
            src="/logo-molina.png"
            alt="Logo Municipalidad de Molina"
            width={sidebarOpen ? 176 : 64}
            height={sidebarOpen ? 72 : 64}
            className="object-contain"
          />
        </div>
        <button
          onClick={() => {
            if (window.innerWidth < 1024) {
              setMobileSidebarOpen(false);
              return;
            }
            toggleSidebar();
          }}
          className="absolute right-4 p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", !sidebarOpen && "rotate-180")} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-6 overflow-y-auto">
        {navBySection.map(({ section, items }) => (
          <div key={section} className="space-y-2">
            {sidebarOpen && (
              <p className="sidebar-section-title">
                {section}
              </p>
            )}
            <div className="space-y-1.5">
              {items.map((item) => {
                const isActive =
                  item.href === "/usuarios"
                    ? pathname === "/usuarios"
                    : item.href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onMouseEnter={() => handlePrefetchData(item.href)}
                    onClick={() => {
                      setMobileSidebarOpen(false);
                    }}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-2xl px-2.5 py-2 text-xs font-medium transition-all duration-200",
                      isActive
                        ? "bg-blue-900 text-white shadow-[0_8px_16px_rgba(30,58,138,0.35)]"
                        : "text-slate-900 hover:bg-slate-100"
                    )}
                  >
                    <span className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                      isActive ? "bg-white/14 text-white" : "bg-slate-100 text-slate-700 group-hover:bg-slate-200"
                    )}>
                      <item.icon className="h-4 w-4 shrink-0" />
                    </span>
                    {sidebarOpen && <span className={cn("text-sm leading-5", isActive ? "font-medium" : "font-normal")}>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User & Logout */}
      <div className="px-3 py-4 border-t border-slate-200">
        {sidebarOpen && user && (
          <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_4px_12px_rgba(15,23,42,0.08)]">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-900 text-white flex items-center justify-center font-semibold">
                {avatarInitials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate text-slate-900">{user.nombre?.trim() || "Usuario"}</p>
                <p className="text-xs text-slate-600 capitalize">{user.rol}</p>
              </div>
            </div>
          </div>
        )}
        <button
          onClick={() => {
            logout();
            setMobileSidebarOpen(false);
          }}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-all"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <LogOut className="h-5 w-5 shrink-0" />
          </span>
          {sidebarOpen && <span className="text-base">Cerrar sesión</span>}
        </button>
      </div>
      </aside>
    </>
  );
}
