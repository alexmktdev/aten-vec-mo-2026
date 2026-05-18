"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { AdminRefreshButton } from "@/components/layout/AdminRefreshButton";
import { useUIStore } from "@/stores/ui.store";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, setMobileSidebarOpen } = useUIStore();

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <button
        type="button"
        onClick={() => setMobileSidebarOpen(true)}
        className="fixed left-4 top-4 z-30 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-900 text-white shadow-lg lg:hidden"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>
      <AdminRefreshButton />
      <main className={cn("transition-all duration-300 pb-4 px-4 sm:pb-6 sm:px-6 pt-16 sm:pt-20", sidebarOpen ? "lg:ml-64 lg:pt-6" : "lg:ml-20 lg:pt-6")}>
        {children}
      </main>
    </div>
  );
}
