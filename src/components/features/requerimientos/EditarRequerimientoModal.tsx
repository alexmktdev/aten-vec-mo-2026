"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { FileUpload } from "@/components/ui/FileUpload";
import { Alert } from "@/components/ui/Alert";
import { DIRECCIONES_MUNICIPALES, getCategorias, getDireccionLabel } from "@/constants/direcciones";
import { REGIONES_CHILE, RequerimientoDTO, TIPOS_INMUEBLE, TIPOS_REQUERIMIENTO } from "@/types/requerimiento.types";
import { formatRut } from "@/lib/utils/rut";
import { requerimientoFormSchema, RequerimientoCreateInput, RequerimientoFormInput } from "@/lib/validations/requerimiento.schema";

const MAX_PDF_SIZE = Math.floor(2.5 * 1024 * 1024);

interface Props {
  open: boolean;
  requerimiento: RequerimientoDTO;
  onClose: () => void;
  onSubmit: (payload: RequerimientoCreateInput) => Promise<void>;
}

export function EditarRequerimientoModal({ open, requerimiento, onClose, onSubmit }: Props) {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [removedDocumentKeys, setRemovedDocumentKeys] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RequerimientoFormInput>({
    resolver: zodResolver(requerimientoFormSchema),
    defaultValues: {
      vecino: {
        nombre: requerimiento.vecino.nombre,
        primerApellido: requerimiento.vecino.primerApellido,
        segundoApellido: requerimiento.vecino.segundoApellido || "",
        rut: requerimiento.vecino.rut,
        telefono: requerimiento.vecino.telefono,
        email: requerimiento.vecino.email,
        confirmarEmail: requerimiento.vecino.email,
        region: requerimiento.vecino.region as typeof REGIONES_CHILE[number],
        comuna: requerimiento.vecino.comuna,
        direccion: requerimiento.vecino.direccion,
        tipoInmueble: requerimiento.vecino.tipoInmueble as typeof TIPOS_INMUEBLE[number],
      },
      tipoRequerimiento: requerimiento.tipoRequerimiento as typeof TIPOS_REQUERIMIENTO[number],
      direccionMunicipal: requerimiento.direccionMunicipal,
      categoria: requerimiento.categoria,
      descripcion: requerimiento.descripcion,
    },
  });

  const selectedDireccion = useWatch({ control, name: "direccionMunicipal" });
  const categorias = selectedDireccion ? getCategorias(selectedDireccion) : [];

  const regionOptions = REGIONES_CHILE.map((r) => ({ value: r, label: r }));
  const inmuebleOptions = TIPOS_INMUEBLE.map((t) => ({ value: t, label: t }));
  const tipoReqOptions = TIPOS_REQUERIMIENTO.map((t) => ({ value: t, label: t }));
  const direccionOptions = Object.entries(DIRECCIONES_MUNICIPALES).map(([key, val]) => ({ value: key, label: val.label }));
  const categoriaOptions = categorias.map((c) => ({ value: c, label: c }));

  const handleDireccionChange = (value: string) => {
    setValue("direccionMunicipal", value);
    setValue("categoria", "");
  };

  const handlePdfChange = (file: File | null) => {
    setPdfError("");
    if (file) {
      if (file.type !== "application/pdf") {
        setPdfError("Solo se permiten archivos PDF");
        return;
      }
      if (file.size > MAX_PDF_SIZE) {
        setPdfError("El archivo no puede superar 2.5MB");
        return;
      }
    }
    setPdfFile(file);
  };

  const submitForm = async (data: RequerimientoFormInput) => {
    setSubmitError("");

    try {
      let documentos = (requerimiento.documentos || []).filter(
        (doc) => !removedDocumentKeys.includes(doc.nombreR2)
      );

      if (pdfFile) {
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: pdfFile.name,
            contentType: pdfFile.type,
            size: pdfFile.size,
            isPublic: true,
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

        documentos = [
          ...documentos,
          {
            nombre: pdfFile.name,
            nombreR2: uploadData.data.fileKey,
            url: uploadData.data.publicUrl,
            tipo: pdfFile.type,
            tamanio: pdfFile.size,
          },
        ];
      }

      await onSubmit({
        vecino: {
          nombre: data.vecino.nombre,
          primerApellido: data.vecino.primerApellido,
          segundoApellido: data.vecino.segundoApellido || undefined,
          rut: data.vecino.rut,
          telefono: data.vecino.telefono,
          email: data.vecino.email,
          region: data.vecino.region,
          comuna: data.vecino.comuna,
          direccion: data.vecino.direccion,
          tipoInmueble: data.vecino.tipoInmueble,
        },
        tipoRequerimiento: data.tipoRequerimiento,
        direccionMunicipal: data.direccionMunicipal,
        direccionMunicipalLabel: getDireccionLabel(data.direccionMunicipal),
        categoria: data.categoria,
        descripcion: data.descripcion,
        documentos,
      });

      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "No fue posible actualizar el requerimiento");
    }
  };

  return (
    <Modal open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <ModalContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <ModalHeader>
          <ModalTitle>Editar requerimiento</ModalTitle>
          <ModalDescription>
            Modifique todos los datos del requerimiento. La validación se mantiene igual que en el ingreso público.
          </ModalDescription>
        </ModalHeader>

        <form onSubmit={handleSubmit(submitForm)} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-blue-900">Datos del Vecino</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Nombre" required {...register("vecino.nombre")} error={errors.vecino?.nombre?.message} />
                <Input label="Primer Apellido" required {...register("vecino.primerApellido")} error={errors.vecino?.primerApellido?.message} />
                <Input label="Segundo Apellido" {...register("vecino.segundoApellido")} error={errors.vecino?.segundoApellido?.message} />
                <Input
                  label="RUT"
                  required
                  placeholder="12.345.678-9"
                  {...register("vecino.rut", {
                    onChange: (event) => {
                      event.target.value = formatRut(event.target.value);
                    },
                  })}
                  error={errors.vecino?.rut?.message}
                />
                <Input label="Teléfono" type="tel" required placeholder="+56912345678" {...register("vecino.telefono")} error={errors.vecino?.telefono?.message} />
                <Input label="Correo" type="email" required {...register("vecino.email")} error={errors.vecino?.email?.message} />
                <Input label="Confirmar correo" type="email" required {...register("vecino.confirmarEmail")} error={errors.vecino?.confirmarEmail?.message} />
                <Select label="Región" required options={regionOptions} placeholder="Seleccione una región" {...register("vecino.region")} error={errors.vecino?.region?.message} />
                <Input label="Comuna" required {...register("vecino.comuna")} error={errors.vecino?.comuna?.message} />
                <Input label="Dirección" required {...register("vecino.direccion")} error={errors.vecino?.direccion?.message} />
                <Select label="Tipo de inmueble" required options={inmuebleOptions} placeholder="Seleccione tipo" {...register("vecino.tipoInmueble")} error={errors.vecino?.tipoInmueble?.message} />
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-blue-900">Datos del Requerimiento</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select label="Tipo de Requerimiento" required options={tipoReqOptions} placeholder="Seleccione tipo" {...register("tipoRequerimiento")} error={errors.tipoRequerimiento?.message} />
                <Select
                  label="Dirección Municipal"
                  required
                  options={direccionOptions}
                  placeholder="Seleccione dirección"
                  value={selectedDireccion}
                  onChange={(e) => handleDireccionChange(e.target.value)}
                  error={errors.direccionMunicipal?.message}
                />
                <Select
                  label="Categoría"
                  required
                  options={categoriaOptions}
                  placeholder={selectedDireccion ? "Seleccione categoría" : "Primero seleccione dirección"}
                  disabled={!selectedDireccion}
                  {...register("categoria")}
                  error={errors.categoria?.message}
                />
                <div className="md:col-span-2">
                  <Textarea
                    label="Descripción"
                    required
                    rows={8}
                    maxLength={1500}
                    {...register("descripcion")}
                    error={errors.descripcion?.message}
                  />
                </div>
                <div className="md:col-span-2 space-y-3">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-700">Documentos actuales</p>
                    {(requerimiento.documentos || []).filter((doc) => !removedDocumentKeys.includes(doc.nombreR2)).length === 0 ? (
                      <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                        Este requerimiento no tiene documentos adjuntos.
                      </p>
                    ) : (
                      (requerimiento.documentos || [])
                        .filter((doc) => !removedDocumentKeys.includes(doc.nombreR2))
                        .map((doc) => (
                          <div key={doc.nombreR2} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-700">{doc.nombre}</p>
                              <p className="text-xs text-slate-500">{(doc.tamanio / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <a
                                href={`/api/documentos?key=${encodeURIComponent(doc.nombreR2)}&requerimientoId=${encodeURIComponent(requerimiento.id)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-8 items-center rounded-[10px] border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-100"
                              >
                                Ver / Descargar
                              </a>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setRemovedDocumentKeys((prev) =>
                                    prev.includes(doc.nombreR2) ? prev : [...prev, doc.nombreR2]
                                  )
                                }
                              >
                                Quitar
                              </Button>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                  <FileUpload
                    label="Agregar documento PDF"
                    accept=".pdf"
                    maxSize={MAX_PDF_SIZE}
                    value={pdfFile}
                    onChange={handlePdfChange}
                    error={pdfError}
                  />
                </div>
              </div>
            </div>
          </div>

          {submitError && <Alert variant="error">{submitError}</Alert>}

          <ModalFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={isSubmitting} className="bg-blue-900 hover:bg-blue-950 text-white">
              Guardar datos
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
