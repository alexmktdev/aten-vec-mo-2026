"use client";

import { useState } from "react";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { DIRECCIONES_DERIVACION_OPTIONS, getCorreoDireccion } from "@/constants/direcciones-correos";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { direccionMunicipal: string; emailDestinatario: string }) => Promise<void>;
  direccionMunicipalInicial: string;
}

export function DerivacionModal({ open, onClose, onSubmit, direccionMunicipalInicial }: Props) {
  const [direccionMunicipal, setDireccionMunicipal] = useState(direccionMunicipalInicial || "");
  const [email, setEmail] = useState(getCorreoDireccion(direccionMunicipalInicial || ""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!direccionMunicipal) {
      setError("Seleccione una dirección");
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Ingrese un correo electrónico válido");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onSubmit({ direccionMunicipal, emailDestinatario: email });
      setEmail("");
      onClose();
    } catch {
      setError("Error al derivar el requerimiento");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Derivar Requerimiento</ModalTitle>
          <ModalDescription>
            Seleccione la dirección y confirme el correo del director para enviar la derivación.
          </ModalDescription>
        </ModalHeader>
        <div className="space-y-4">
          <Select
            label="Dirección municipal"
            value={direccionMunicipal}
            onChange={(e) => {
              const nextDireccion = e.target.value;
              setDireccionMunicipal(nextDireccion);
              setEmail(getCorreoDireccion(nextDireccion));
              setError("");
            }}
            options={DIRECCIONES_DERIVACION_OPTIONS}
            placeholder="Seleccione dirección"
            required
          />
          <Input
            label="Correo del destinatario"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="director@municipalidad.cl"
            error={error}
            required
          />
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} loading={loading}>Enviar derivación</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
