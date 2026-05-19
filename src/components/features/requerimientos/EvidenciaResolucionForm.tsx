"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FileUpload } from "@/components/ui/FileUpload";
import { Alert } from "@/components/ui/Alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { useSetEvidenciaResolucion, useDeleteEvidenciaResolucion } from "@/hooks/useRequerimientos";
import { ExternalLink, FileCheck, Trash2, Upload } from "lucide-react";

const MAX_PDF_SIZE = Math.floor(2.5 * 1024 * 1024);

interface Props {
  requerimientoId: string;
  /** Solo en «en proceso»: director/superadmin pueden eliminar o reemplazar */
  canManage?: boolean;
  evidenciaExistente?: {
    tipo: "documento" | "link";
    nombre?: string;
    nombreR2?: string;
    url: string;
    tamanio?: number;
    fecha: string;
  };
}

export function EvidenciaResolucionForm({ requerimientoId, canManage = false, evidenciaExistente }: Props) {
  const [modo, setModo] = useState<"documento" | "link">("documento");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showConfirmEliminar, setShowConfirmEliminar] = useState(false);
  const mutation = useSetEvidenciaResolucion();
  const deleteMutation = useDeleteEvidenciaResolucion();

  const handlePdfChange = (file: File | null) => {
    setPdfError("");
    if (file) {
      if (file.type !== "application/pdf") {
        setPdfError("Solo se permiten archivos PDF");
        return;
      }
      if (file.size > MAX_PDF_SIZE) {
        setPdfError("El archivo no puede superar 2.5 MB");
        return;
      }
    }
    setPdfFile(file);
  };

  const handleSubmitDocumento = async () => {
    if (!pdfFile) return;
    setError("");
    setSuccess("");

    try {
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: pdfFile.name,
          contentType: pdfFile.type,
          size: pdfFile.size,
          isPublic: false,
        }),
      });
      const uploadData = await uploadRes.json();
      if (!uploadData.success) {
        throw new Error(uploadData.error || "No fue posible preparar la carga del archivo");
      }

      await fetch(uploadData.data.uploadUrl, {
        method: "PUT",
        body: pdfFile,
        headers: { "Content-Type": pdfFile.type },
      });

      await mutation.mutateAsync({
        id: requerimientoId,
        tipo: "documento",
        nombre: pdfFile.name,
        nombreR2: uploadData.data.fileKey,
        url: uploadData.data.publicUrl,
        tamanio: pdfFile.size,
      });

      setSuccess(evidenciaExistente ? "Evidencia reemplazada correctamente" : "Evidencia de resolución adjuntada exitosamente");
      setPdfFile(null);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir la evidencia");
    }
  };

  const handleSubmitLink = async () => {
    if (!linkUrl.trim()) return;
    setError("");
    setSuccess("");

    try {
      await mutation.mutateAsync({
        id: requerimientoId,
        tipo: "link",
        url: linkUrl.trim(),
      });

      setSuccess(evidenciaExistente ? "Enlace de evidencia actualizado correctamente" : "Enlace de evidencia guardado exitosamente");
      setLinkUrl("");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el enlace");
    }
  };

  const handleConfirmEliminarEvidencia = async () => {
    setError("");
    try {
      await deleteMutation.mutateAsync(requerimientoId);
      setShowConfirmEliminar(false);
      setSuccess("Evidencia eliminada");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar la evidencia");
      setShowConfirmEliminar(false);
    }
  };

  const uploadSection = (
    <>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={modo === "documento" ? "default" : "outline"}
          onClick={() => setModo("documento")}
          className={modo === "documento" ? "bg-blue-900 hover:bg-blue-950 text-white" : ""}
        >
          <Upload className="h-3.5 w-3.5 mr-1.5" /> Subir PDF
        </Button>
        <Button
          type="button"
          size="sm"
          variant={modo === "link" ? "default" : "outline"}
          onClick={() => setModo("link")}
          className={modo === "link" ? "bg-blue-900 hover:bg-blue-950 text-white" : ""}
        >
          <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Enlace externo
        </Button>
      </div>

      {modo === "documento" ? (
        <div className="space-y-3">
          <FileUpload
            label="Documento PDF (máx. 2.5 MB)"
            accept=".pdf"
            maxSize={MAX_PDF_SIZE}
            value={pdfFile}
            onChange={handlePdfChange}
            error={pdfError}
          />
          <Button
            onClick={handleSubmitDocumento}
            loading={mutation.isPending}
            disabled={!pdfFile || mutation.isPending}
            className="bg-blue-900 hover:bg-blue-950 text-white"
          >
            {evidenciaExistente ? "Reemplazar por este PDF" : "Adjuntar evidencia"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Input
            label="Enlace a SharePoint o Google Drive"
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://docs.google.com/... o https://...sharepoint.com/..."
          />
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            El enlace debe ser <strong>público</strong> para que el vecino y todos los que revisen el
            requerimiento puedan acceder a la documentación.
          </p>
          <Button
            onClick={handleSubmitLink}
            loading={mutation.isPending}
            disabled={!linkUrl.trim() || mutation.isPending}
            className="bg-blue-900 hover:bg-blue-950 text-white"
          >
            {evidenciaExistente ? "Reemplazar por este enlace" : "Guardar enlace"}
          </Button>
        </div>
      )}
    </>
  );

  if (evidenciaExistente && !canManage) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardHeader>
          <CardTitle className="text-sm text-emerald-900 flex items-center gap-2">
            <FileCheck className="h-4 w-4" /> Evidencia de resolución adjuntada
          </CardTitle>
        </CardHeader>
        <CardContent>
          {evidenciaExistente.tipo === "documento" ? (
            <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-white px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-700">{evidenciaExistente.nombre}</p>
                {evidenciaExistente.tamanio !== undefined && evidenciaExistente.tamanio > 0 && (
                  <p className="text-xs text-slate-500">{(evidenciaExistente.tamanio / 1024 / 1024).toFixed(2)} MB</p>
                )}
              </div>
              <a
                href={`/api/documentos?key=${encodeURIComponent(evidenciaExistente.nombreR2 || "")}&requerimientoId=${encodeURIComponent(requerimientoId)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-emerald-700 font-medium hover:text-emerald-900 px-3 py-1 bg-emerald-100 hover:bg-emerald-200 rounded-md transition-colors"
              >
                Ver / Descargar
              </a>
            </div>
          ) : (
            <a
              href={evidenciaExistente.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-emerald-700 font-medium hover:text-emerald-900 underline underline-offset-2"
            >
              <ExternalLink className="h-4 w-4" /> Ver documentación externa
            </a>
          )}
          <p className="text-xs text-slate-500 mt-2">
            Adjuntado el {new Date(evidenciaExistente.fecha).toLocaleString("es-CL")}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (evidenciaExistente && canManage) {
    return (
      <div className="space-y-4">
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <CardTitle className="text-sm text-emerald-900 flex items-center gap-2">
              <FileCheck className="h-4 w-4" /> Evidencia de resolución adjuntada
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 border-red-200 text-red-700 hover:bg-red-50"
              onClick={() => setShowConfirmEliminar(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Eliminar
            </Button>
          </CardHeader>
          <CardContent>
            {evidenciaExistente.tipo === "documento" ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700">{evidenciaExistente.nombre}</p>
                  {evidenciaExistente.tamanio !== undefined && evidenciaExistente.tamanio > 0 && (
                    <p className="text-xs text-slate-500">{(evidenciaExistente.tamanio / 1024 / 1024).toFixed(2)} MB</p>
                  )}
                </div>
                <a
                  href={`/api/documentos?key=${encodeURIComponent(evidenciaExistente.nombreR2 || "")}&requerimientoId=${encodeURIComponent(requerimientoId)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-emerald-700 font-medium hover:text-emerald-900 px-3 py-1 bg-emerald-100 hover:bg-emerald-200 rounded-md transition-colors"
                >
                  Ver / Descargar
                </a>
              </div>
            ) : (
              <a
                href={evidenciaExistente.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-emerald-700 font-medium hover:text-emerald-900 underline underline-offset-2"
              >
                <ExternalLink className="h-4 w-4" /> Ver documentación externa
              </a>
            )}
            <p className="text-xs text-slate-500 mt-2">
              Adjuntado el {new Date(evidenciaExistente.fecha).toLocaleString("es-CL")}
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="text-sm text-blue-900">Reemplazar evidencia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">{uploadSection}</CardContent>
        </Card>

        {error && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        <ConfirmDeleteModal
          open={showConfirmEliminar}
          onOpenChange={setShowConfirmEliminar}
          title="Eliminar evidencia"
          confirmLabel="Sí, eliminar evidencia"
          description={
            <p className="text-sm text-slate-600">
              ¿Eliminar la evidencia adjunta? Podrá subir otra mientras el requerimiento siga en proceso de solución.
            </p>
          }
          onConfirm={handleConfirmEliminarEvidencia}
          loading={deleteMutation.isPending}
        />
      </div>
    );
  }

  return (
    <Card className="border-blue-200">
      <CardHeader>
        <CardTitle className="text-sm text-blue-900">
          Adjuntar documentación y/o evidencia de la resolución del requerimiento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {uploadSection}
        {error && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}
      </CardContent>
    </Card>
  );
}
