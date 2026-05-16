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
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!emailDestino || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDestino)) {
      setError("Ingrese un correo electrónico válido");
      return;
    }
    if (asunto.trim().length < 5) {
      setError("Ingrese un asunto más descriptivo");
      return;
    }
    if (mensaje.trim().length < 20) {
      setError("Ingrese una respuesta más completa para el vecino");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await onSubmit({
        emailDestino: emailDestino.trim(),
        asunto: asunto.trim(),
        mensaje: mensaje.trim(),
      });
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No fue posible enviar la respuesta");
    } finally {
      setLoading(false);
    }
  };

  return (
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
          <Button onClick={handleSubmit} loading={loading} className="bg-blue-900 hover:bg-blue-950 text-white">
            Enviar correo
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
