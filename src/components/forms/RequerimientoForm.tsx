"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Script from "next/script";
import { requerimientoFormSchema, type RequerimientoFormInput } from "@/lib/validations/requerimiento.schema";
import { DIRECCIONES_MUNICIPALES, getCategorias, getDireccionLabel } from "@/constants/direcciones";
import { TIPOS_REQUERIMIENTO, REGIONES_CHILE, TIPOS_INMUEBLE } from "@/types/requerimiento.types";
import { formatRut } from "@/lib/utils/rut";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { FileUpload } from "@/components/ui/FileUpload";
import { CheckCircle, Info } from "lucide-react";

const MAX_PDF_SIZE = Math.floor(2.5 * 1024 * 1024);
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";

function sanitizeUploadFileName(fileName: string): string {
  const normalized = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._\-\s]/g, "_");
  return normalized || "documento.pdf";
}

declare global {
  interface Window {
    onRecaptchaSuccess?: (token: string) => void;
    onRecaptchaExpired?: () => void;
    grecaptcha?: {
      render: (
        container: HTMLElement,
        parameters: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
        }
      ) => number;
      reset: (widgetId?: number) => void;
    };
  }
}

export function RequerimientoForm() {
  const [submitted, setSubmitted] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitStatus, setSubmitStatus] = useState("");
  const [submitProgress, setSubmitProgress] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaError, setCaptchaError] = useState("");
  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);
  const recaptchaWidgetIdRef = useRef<number | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<RequerimientoFormInput>({
    resolver: zodResolver(requerimientoFormSchema),
    defaultValues: {
      vecino: { nombre: "", primerApellido: "", segundoApellido: "", rut: "", telefono: "", email: "", confirmarEmail: "", region: "" as typeof REGIONES_CHILE[number], comuna: "", direccion: "", tipoInmueble: "" as typeof TIPOS_INMUEBLE[number] },
      tipoRequerimiento: "" as typeof TIPOS_REQUERIMIENTO[number],
      direccionMunicipal: "",
      categoria: "",
      descripcion: "",
    },
  });

  const selectedDireccion = useWatch({ control, name: "direccionMunicipal" });
  const descripcionValue = useWatch({ control, name: "descripcion" }) || "";
  const categorias = selectedDireccion ? getCategorias(selectedDireccion) : [];

  useEffect(() => {
    window.onRecaptchaSuccess = (token: string) => {
      setCaptchaToken(token);
      setCaptchaError("");
    };
    window.onRecaptchaExpired = () => {
      setCaptchaToken("");
    };

    return () => {
      delete window.onRecaptchaSuccess;
      delete window.onRecaptchaExpired;
    };
  }, []);

  useEffect(() => {
    if (submitted) {
      recaptchaWidgetIdRef.current = null;
      return;
    }
    if (!RECAPTCHA_SITE_KEY) return;

    let cancelled = false;
    const tryRender = () => {
      if (cancelled) return;
      const grecaptcha = window.grecaptcha;
      const container = recaptchaContainerRef.current;
      if (!grecaptcha || !container) return;
      if (recaptchaWidgetIdRef.current !== null) return;

      recaptchaWidgetIdRef.current = grecaptcha.render(container, {
        sitekey: RECAPTCHA_SITE_KEY,
        callback: (token: string) => {
          setCaptchaToken(token);
          setCaptchaError("");
        },
        "expired-callback": () => {
          setCaptchaToken("");
        },
      });
    };

    tryRender();
    const interval = window.setInterval(tryRender, 250);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      recaptchaWidgetIdRef.current = null;
    };
  }, [submitted]);

  useEffect(() => {
    if (!isSubmitting) return;

    const interval = window.setInterval(() => {
      setDisplayProgress((current) => {
        if (current >= submitProgress) return current;
        return Math.min(current + 1, submitProgress);
      });
    }, 25);

    return () => window.clearInterval(interval);
  }, [isSubmitting, submitProgress]);

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

  const onSubmit = async (data: RequerimientoFormInput) => {
    setSubmitError("");
    setSubmitStatus("Iniciando envio...");
    setSubmitProgress(0);
    setDisplayProgress(0);
    setCaptchaError("");
    if (!captchaToken) {
      setCaptchaError("Debe completar la verificacion reCAPTCHA");
      return;
    }
    try {
      let documentos: { nombre: string; nombreR2: string; url: string; tipo: string; tamanio: number }[] = [];

      // Upload PDF if present
      if (pdfFile) {
        setSubmitStatus("Subiendo documento adjunto...");
        setSubmitProgress(45);
        const safeFileName = sanitizeUploadFileName(pdfFile.name);
        const safeContentType = pdfFile.type || "application/pdf";
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: safeFileName,
            contentType: safeContentType,
            size: pdfFile.size,
            isPublic: true,
          }),
        });
        const uploadData = await uploadRes.json();
        if (uploadData.success) {
          const putRes = await fetch(uploadData.data.uploadUrl, {
            method: "PUT",
            body: pdfFile,
            headers: { "Content-Type": safeContentType },
          });
          if (!putRes.ok) {
            throw new Error("No se pudo subir el documento adjunto. Intente nuevamente.");
          }
          documentos = [{ nombre: pdfFile.name, nombreR2: uploadData.data.fileKey, url: uploadData.data.publicUrl, tipo: pdfFile.type, tamanio: pdfFile.size }];
        } else {
          throw new Error(uploadData.error || "No se pudo preparar la subida del documento adjunto");
        }
      }

      setSubmitStatus("Validando y registrando requerimiento...");
      setSubmitProgress(85);
      const payload = {
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
        recaptchaToken: captchaToken,
      };

      const res = await fetch("/api/requerimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Error al enviar");

      setTrackingNumber(json.data.numeroSeguimiento);
      setSubmitProgress(100);
      setSubmitted(true);
      setSubmitStatus("");
      setSubmitProgress(0);
      setDisplayProgress(0);
      setCaptchaToken("");
      window.grecaptcha?.reset();
    } catch (err) {
      setSubmitStatus("");
      setSubmitProgress(0);
      setDisplayProgress(0);
      setSubmitError(err instanceof Error ? err.message : "Error al enviar el requerimiento");
    }
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="h-10 w-10 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">¡Requerimiento ingresado exitosamente!</h2>
        <p className="text-slate-500 mb-6">Su requerimiento ha sido registrado en el sistema.</p>
        <div className="bg-blue-50 border-2 border-blue-500 rounded-2xl p-6 mb-6">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Número de Seguimiento</p>
          <p className="text-3xl font-extrabold text-blue-600 tracking-wider">{trackingNumber}</p>
        </div>
        <p className="text-sm text-slate-500 mb-8">Recibirá un correo de confirmación con los datos de su requerimiento.</p>
        <Button
          type="button"
          size="lg"
          onClick={() => {
            setSubmitted(false);
            setTrackingNumber("");
            setPdfFile(null);
            setPdfError("");
            setSubmitError("");
            setCaptchaToken("");
            setCaptchaError("");
            reset();
          }}
        >
          Ingresar otro requerimiento
        </Button>
      </div>
    );
  }

  const regionOptions = REGIONES_CHILE.map((r) => ({ value: r, label: r }));
  const inmuebleOptions = TIPOS_INMUEBLE.map((t) => ({ value: t, label: t }));
  const tipoReqOptions = TIPOS_REQUERIMIENTO.map((t) => ({ value: t, label: t }));
  const direccionOptions = Object.entries(DIRECCIONES_MUNICIPALES).map(([key, val]) => ({ value: key, label: val.label }));
  const categoriaOptions = categorias.map((c) => ({ value: c, label: c }));

  return (
    <>
      <Script src="https://www.google.com/recaptcha/api.js?render=explicit" async defer />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-8">
      {/* Card 1 — Datos del Vecino */}
      <Card className="border-blue-100 shadow-sm">
        <CardHeader>
          <CardTitle>Datos del Vecino</CardTitle>
        </CardHeader>
        <CardContent>
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
            <Input label="Dirección" required placeholder="Ej: Av. Libertador Bernardo O'Higgins 1234, Depto 201" {...register("vecino.direccion")} error={errors.vecino?.direccion?.message} />
            <Select label="Tipo de inmueble" required options={inmuebleOptions} placeholder="Seleccione tipo" {...register("vecino.tipoInmueble")} error={errors.vecino?.tipoInmueble?.message} />
          </div>
        </CardContent>
      </Card>

      {/* Card 2 — Datos del Requerimiento */}
      <Card className="border-blue-100 shadow-sm">
        <CardHeader>
          <CardTitle>Datos del Requerimiento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800">
              Primero seleccione la dirección municipal correspondiente. Luego el sistema mostrará las categorías relacionadas.
            </p>
          </div>

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
              <FileUpload
                label="Documento PDF (opcional)"
                accept=".pdf"
                maxSize={MAX_PDF_SIZE}
                value={pdfFile}
                onChange={handlePdfChange}
                error={pdfError}
              />
            </div>
            <div className="md:col-span-2">
              <Textarea
                label="Descripción"
                required
                rows={7}
                maxLength={1500}
                placeholder="Describa detalladamente el requerimiento..."
                {...register("descripcion")}
                error={errors.descripcion?.message}
              />
              <div className="mt-1 flex items-center justify-between">
                <p className={descripcionValue.length >= 1500 ? "text-xs font-semibold text-red-600" : "text-xs text-slate-500"}>
                  {descripcionValue.length >= 1500
                    ? "Has llegado al máximo de caracteres permitidos."
                    : "Máximo 1500 caracteres."}
                </p>
                <p className={descripcionValue.length >= 1500 ? "text-xs font-semibold text-red-600" : "text-xs text-slate-500"}>
                  {descripcionValue.length}/1500
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

        <div className="space-y-2">
          <div className="flex justify-center">
            <div className="origin-center scale-110 sm:scale-[1.15]">
              <div ref={recaptchaContainerRef} />
            </div>
          </div>
          {!RECAPTCHA_SITE_KEY && (
            <Alert variant="error">
              Falta configurar `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` para habilitar el formulario.
            </Alert>
          )}
          {captchaError && <p className="text-sm text-red-600">{captchaError}</p>}
        </div>

        {submitError && (
          <Alert variant="error" title="Error">{submitError}</Alert>
        )}

        {isSubmitting && submitStatus && (
          <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-emerald-800">{submitStatus}</p>
              <p className="text-sm font-semibold text-emerald-700">{displayProgress}%</p>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-300 ease-out"
                style={{ width: `${Math.max(2, displayProgress)}%` }}
              />
            </div>
            <p className="text-xs font-medium text-emerald-700">Unos segundos por favor.</p>
          </div>
        )}

        <Button
          type="submit"
          size="full"
          loading={isSubmitting}
          disabled={isSubmitting || !RECAPTCHA_SITE_KEY}
          className="bg-[#1e3a8a] hover:bg-[#1e40af] text-white h-12 text-base font-semibold"
        >
          Enviar requerimiento
        </Button>
      </form>
    </>
  );
}
