"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  loading?: boolean;
  fetching?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  loading,
  fetching,
  emptyMessage = "No hay datos disponibles",
  onRowClick,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="animate-pulse">
          <div className="h-10 bg-slate-50 border-b" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-11 border-b border-slate-50 flex items-center px-4 gap-3">
              {columns.map((_, j) => (
                <div key={j} className="h-4 bg-slate-100 rounded flex-1" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-[0_4px_15px_rgba(0,0,0,0.05)] transition-opacity duration-150",
      fetching && "opacity-60 pointer-events-none"
    )}>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {columns.map((col) => (
                <th key={col.key} className={cn("text-left px-4 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider", col.className)}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400 text-sm">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr
                  key={keyExtractor(item)}
                  className={cn("border-b border-slate-50 transition-colors hover:bg-slate-50/50", onRowClick && "cursor-pointer")}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn("px-4 py-2.5 text-slate-700", col.className)}>
                      {col.render ? col.render(item) : (item as Record<string, unknown>)[col.key] as React.ReactNode}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
