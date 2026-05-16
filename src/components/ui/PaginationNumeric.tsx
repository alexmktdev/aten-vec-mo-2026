"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationNumericProps {
  currentPage: number;
  knownPages: number;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSelectPage: (page: number) => void;
}

export function PaginationNumeric({
  currentPage,
  knownPages,
  hasNext,
  onPrev,
  onNext,
  onSelectPage,
}: PaginationNumericProps) {
  const pages = Array.from({ length: knownPages }, (_, i) => i + 1);

  return (
    <div className="mt-4 flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={onPrev}
        disabled={currentPage <= 1}
        className="h-8 w-8 rounded-md border border-blue-200 bg-white text-blue-900 disabled:opacity-40"
        aria-label="Página anterior"
      >
        <ChevronLeft className="mx-auto h-4 w-4" />
      </button>

      {pages.map((page) => (
        <button
          key={page}
          type="button"
          onClick={() => onSelectPage(page)}
          className={cn(
            "h-8 min-w-8 rounded-md border px-2 text-xs font-semibold",
            currentPage === page
              ? "border-blue-900 bg-blue-900 text-white"
              : "border-blue-200 bg-white text-blue-900 hover:bg-blue-50"
          )}
        >
          {page}
        </button>
      ))}

      {hasNext && <span className="px-1 text-sm font-semibold text-blue-900">...</span>}

      <button
        type="button"
        onClick={onNext}
        disabled={!hasNext}
        className="h-8 w-8 rounded-md border border-blue-200 bg-white text-blue-900 disabled:opacity-40"
        aria-label="Página siguiente"
      >
        <ChevronRight className="mx-auto h-4 w-4" />
      </button>
    </div>
  );
}
