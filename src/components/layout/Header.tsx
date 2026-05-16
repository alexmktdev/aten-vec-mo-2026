"use client";

// header de la pagina (todas en general)


import { useUIStore } from "@/stores/ui.store";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title?: string;
}

export function Header({ title }: Props) {
  const { sidebarOpen, toggleSidebar } = useUIStore();

  return (
    <header className={cn(
      "sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 transition-all duration-300",
      sidebarOpen ? "ml-64" : "ml-20"
    )}>
      <div className="flex items-center gap-4 px-6 py-4">
        <button onClick={toggleSidebar} className="lg:hidden p-2 hover:bg-slate-100 rounded-lg">
          <Menu className="h-5 w-5" />
        </button>
        {title && <h1 className="text-xl font-bold text-blue-900">{title}</h1>}
      </div>
    </header>
  );
}
