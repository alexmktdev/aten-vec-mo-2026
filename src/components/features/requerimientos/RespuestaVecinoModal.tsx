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
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";

interface Props {
  open: boolean;
  onClose: () => void;
  defaultEmail: string;
  numeroSeguimiento: string;
  onSubmit: (payload: { emailDestino: string; asunto: string; mensaje: string }) => Promise<void>;
}

export function RespuestaVecinoModal({
  open,
  onClose,
  defaultEmail,
  numeroSeguimiento,
  onSubmit,
}: Props) {
  const [emailDestino, setEmailDestino] = useState(defaultEmail);
  const [asunto, setAsunto] = useState(`Respuesta a su requerimiento ${numeroSeguimiento}`);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const validate = (): boolean => {
    if (!emailDestino || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDestino)) {
      setError("Ingrese un correo electrónico válido");
      return false;
    }
    if (asunto.trim().length < 5) {
      setError("Ingrese un asunto más descriptivo");
      return false;
    }
    if (mensaje.trim().length < 20) {
      setError("Ingrese una respuesta más completa para el vecino");
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
        asunto: asunto.trim(),
        mensaje: mensaje.trim(),
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
            <ModalTitle>Enviar respuesta al vecino</ModalTitle>
            <ModalDescription>
              Este correo quedará registrado en el requerimiento y se enviará al vecino como respuesta formal.
            </ModalDescription>
          </ModalHeader>

          <div className="space-y-4">
            <Input
              label="Correo destino"
              type="email"
              value={emailDestino}
              onChange={(e) => setEmailDestino(e.target.value)}
              placeholder="vecino@correo.cl"
              error={error}
              required
            />
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
              placeholder="Escriba aquí la respuesta que se enviará al vecino..."
              required
            />
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
              ¿Está seguro de que desea enviar esta respuesta al vecino? Revise el correo, el asunto y el mensaje con
              atención antes de confirmar.
            </p>
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
