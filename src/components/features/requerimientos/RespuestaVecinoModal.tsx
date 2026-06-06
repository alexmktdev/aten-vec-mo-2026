"use client";

import { useState } from "react";
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
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { MAX_PDF_UPLOAD_BYTES } from "@/lib/validations/upload.schema";

export type CierreRespuesta = "completado" | "rechazado";

export interface RespuestaVecinoPayload {
  emailDestino: string;
  asunto: string;
  mensaje: string;
  cierre?: CierreRespuesta;
  evidenciaPdf?: File | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  defaultEmail: string;
  numeroSeguimiento: string;
  /** Si es true, el modal exige al usuario elegir cierre (completado/rechazado). */
  requireCierre?: boolean;
  /** Si completado, no exige mensaje manual (respuesta automática server-side). */
  autoMensajeSiCompletado?: boolean;
  /** Permite adjuntar un PDF de evidencia (respuesta inmediata). */
  allowEvidenciaPdf?: boolean;
  title?: string;
  onSubmit: (payload: RespuestaVecinoPayload) => Promise<void>;
}

export function RespuestaVecinoModal({
  open,
  onClose,
  defaultEmail,
  numeroSeguimiento,
  requireCierre = false,
  autoMensajeSiCompletado = false,
  allowEvidenciaPdf = false,
  title = "Enviar respuesta al vecino",
  onSubmit,
}: Props) {
  const [emailDestino, setEmailDestino] = useState(defaultEmail);
  const [asunto, setAsunto] = useState(`Respuesta a su requerimiento ${numeroSeguimiento}`);
  const [mensaje, setMensaje] = useState("");
  const [cierre, setCierre] = useState<CierreRespuesta | "">("");
  const [evidenciaPdf, setEvidenciaPdf] = useState<File | null>(null);
  const [evidenciaPdfError, setEvidenciaPdfError] = useState("");
  const [error, setError] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const usaRespuestaAutomatica =
    autoMensajeSiCompletado && requireCierre && cierre === "completado";
  const requiereMensajeManual = !usaRespuestaAutomatica;

  const handleEvidenciaPdfChange = (file: File | null) => {
    setEvidenciaPdfError("");
    if (file) {
      if (file.type !== "application/pdf") {
        setEvidenciaPdfError("Solo se permiten archivos PDF");
        return;
      }
      if (file.size > MAX_PDF_UPLOAD_BYTES) {
        setEvidenciaPdfError("El archivo no puede superar 1 MB");
        return;
      }
    }
    setEvidenciaPdf(file);
  };

  const validate = (): boolean => {
    if (!emailDestino || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDestino)) {
      setError("Ingrese un correo electrónico válido");
      return false;
    }
    if (requiereMensajeManual && asunto.trim().length < 5) {
      setError("Ingrese un asunto más descriptivo");
      return false;
    }
    if (requiereMensajeManual && mensaje.trim().length < 20) {
      setError("Ingrese una respuesta más completa para el vecino");
      return false;
    }
    if (requireCierre && !cierre) {
      setError("Debe indicar si el cierre es completado o rechazado");
      return false;
    }
    setError("");
    return true;
  };

  const handleOpenConfirm = () => {
    if (!validate()) return;
    setShowConfirm(true);
  };

  const handleConfirmSend = async () => {
    setConfirmLoading(true);
    try {
      await onSubmit({
        emailDestino: emailDestino.trim(),
        asunto: usaRespuestaAutomatica
          ? `Respuesta a su requerimiento ${numeroSeguimiento}`
          : asunto.trim(),
        mensaje: usaRespuestaAutomatica ? "" : mensaje.trim(),
        cierre: requireCierre && cierre ? cierre : undefined,
        evidenciaPdf: allowEvidenciaPdf ? evidenciaPdf : undefined,
      });
      setShowConfirm(false);
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No fue posible enviar la respuesta");
      setShowConfirm(false);
    } finally {
      setConfirmLoading(false);
    }
  };

  return (
    <>
      <Modal open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>{title}</ModalTitle>
            <ModalDescription>
              Este correo quedará registrado en el requerimiento y se enviará al vecino como respuesta formal.
              {requireCierre
                ? " Al enviar, el requerimiento se cerrará como Completado o Rechazado según indique."
                : ""}
            </ModalDescription>
          </ModalHeader>

          <div className="space-y-4">
            <Input
              label="Correo destino"
              type="email"
              value={emailDestino}
              onChange={(e) => setEmailDestino(e.target.value)}
              placeholder="vecino@correo.cl"
              error={error && !emailDestino ? error : undefined}
              required
            />
            <Input
              label="Número de requerimiento"
              value={numeroSeguimiento}
              readOnly
              disabled
            />
            {requireCierre && (
              <Select
                label="Cierre del requerimiento"
                value={cierre}
                onChange={(e) => setCierre(e.target.value as CierreRespuesta)}
                options={[
                  { value: "completado", label: "Requerimiento Completado" },
                  { value: "rechazado", label: "Requerimiento Rechazado" },
                ]}
                placeholder="Seleccione el resultado del requerimiento"
                required
              />
            )}
            {usaRespuestaAutomatica ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                Se enviará al vecino una respuesta automática con los datos del requerimiento y un mensaje
                formal de cierre. No necesita redactar el texto manualmente.
              </div>
            ) : (
              <>
                <Input
                  label="Asunto"
                  value={asunto}
                  onChange={(e) => setAsunto(e.target.value)}
                  placeholder="Respuesta a su requerimiento"
                  required
                />
                <Textarea
                  label="Mensaje"
                  rows={7}
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  placeholder={
                    requireCierre && cierre === "rechazado"
                      ? "Escriba aquí la respuesta que se enviará al vecino explicando el rechazo..."
                      : "Escriba aquí la respuesta que se enviará al vecino..."
                  }
                  required
                />
              </>
            )}
            {allowEvidenciaPdf && (
              <FileUpload
                label="Evidencia PDF (opcional, máx. 1 MB)"
                accept=".pdf"
                maxSize={MAX_PDF_UPLOAD_BYTES}
                showCompressHint
                value={evidenciaPdf}
                onChange={handleEvidenciaPdfChange}
                error={evidenciaPdfError}
              />
            )}
            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
          </div>

          <ModalFooter>
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleOpenConfirm} className="bg-blue-900 hover:bg-blue-950 text-white">
              Enviar correo
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmDeleteModal
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="Confirmar envío al vecino"
        danger={false}
        confirmLabel="Sí, enviar respuesta"
        cancelLabel="Volver a revisar"
        description={
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              ¿Está seguro de que desea enviar esta respuesta al vecino? Revise el correo destino
              {requiereMensajeManual ? ", el asunto y el mensaje" : ""} con atención antes de confirmar.
            </p>
            {requireCierre && cierre && (
              <p>
                El requerimiento quedará registrado como{" "}
                <strong>
                  {cierre === "completado" ? "Requerimiento Completado" : "Requerimiento Rechazado"}
                </strong>
                {usaRespuestaAutomatica
                  ? ". Se enviará una respuesta automática al vecino con los datos del caso."
                  : "."}
              </p>
            )}
            <p>
              Una vez enviado, el correo quedará registrado en el requerimiento y <strong>no habrá vuelta atrás</strong>:
              no se podrá deshacer ni anular el envío.
            </p>
          </div>
        }
        onConfirm={handleConfirmSend}
        loading={confirmLoading}
      />
    </>
  );
}
