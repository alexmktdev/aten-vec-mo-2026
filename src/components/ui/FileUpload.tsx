"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Upload, X, FileText } from "lucide-react";
import { PDF_COMPRESS_URL } from "@/lib/validations/upload.schema";

interface FileUploadProps {
  label?: string;
  error?: string;
  accept?: string;
  maxSize?: number;
  /** Muestra el aviso de compresión con enlace a iLovePDF (PDF ≤ 1 MB). */
  showCompressHint?: boolean;
  onChange: (file: File | null) => void;
  value?: File | null;
}

export function FileUpload({
  label,
  error,
  accept = ".pdf",
  maxSize = 5 * 1024 * 1024,
  showCompressHint = false,
  onChange,
  value,
}: FileUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = React.useState(false);

  const handleFile = (file: File | null) => {
    if (!file) { onChange(null); return; }
    if (accept === ".pdf" && file.type !== "application/pdf") {
      return;
    }
    if (file.size > maxSize) { return; }
    onChange(file);
  };

  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-semibold text-slate-700">{label}</label>}
      {!value ? (
        <div
          className={cn(
            "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors",
            dragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-blue-400 hover:bg-slate-50",
            error && "border-red-500"
          )}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFile(e.dataTransfer.files[0] || null); }}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="mx-auto h-8 w-8 text-slate-400 mb-2" />
          <p className="text-sm text-slate-600">Haga clic o arrastre un archivo</p>
          <p className="text-xs text-slate-400 mt-1">
            Solo PDF, máximo {maxSize / (1024 * 1024)} MB
          </p>
          {showCompressHint && (
            <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto">
              Si su archivo supera el límite de tamaño, puede reducirlo en{" "}
              <a
                href={PDF_COMPRESS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 underline underline-offset-2 hover:text-blue-900"
                onClick={(e) => e.stopPropagation()}
              >
                iLovePDF (comprimir PDF)
              </a>
              .
            </p>
          )}
          <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => handleFile(e.target.files?.[0] || null)} />
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
          <FileText className="h-8 w-8 text-blue-600" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-700 truncate">{value.name}</p>
            <p className="text-xs text-slate-500">{(value.size / 1024).toFixed(1)} KB</p>
          </div>
          <button type="button" onClick={() => onChange(null)} className="p-1 hover:bg-blue-100 rounded-md transition-colors">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
