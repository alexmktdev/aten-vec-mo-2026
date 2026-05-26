"use client";

import { useMemo, useState } from "react";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from "@/components/ui/Modal";
import { Alert } from "@/components/ui/Alert";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { DIRECCIONES_DERIVACION_OPTIONS, getCorreoDireccion } from "@/constants/direcciones-correos";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { direccionMunicipal: string; emailDestinatario: string }) => Promise<void>;
  direccionMunicipalInicial: string;
  /** Si el requerimiento es Solicitud de transparencia, se fuerza Secretaría Municipal. */
  tipoRequerimiento?: string;
}

const TRANSPARENCIA_DIRECCION = "SECRETARIA";

export function DerivacionModal({
  open,
  onClose,
  onSubmit,
  direccionMunicipalInicial,
  tipoRequerimiento,
}: Props) {
  const esTransparencia = tipoRequerimiento === "Solicitud de transparencia";

  const direccionInicial = esTransparencia
    ? TRANSPARENCIA_DIRECCION
    : direccionMunicipalInicial || "";
  const [direccionMunicipal, setDireccionMunicipal] = useState(direccionInicial);
  const [email, setEmail] = useState(getCorreoDireccion(direccionInicial));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const options = useMemo(() => {
    if (esTransparencia) {
      return DIRECCIONES_DERIVACION_OPTIONS.filter((o) => o.value === TRANSPARENCIA_DIRECCION);
    }
    return DIRECCIONES_DERIVACION_OPTIONS;
  }, [esTransparencia]);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al derivar el requerimiento");
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
            {esTransparencia
              ? "Las solicitudes de transparencia se derivan a Secretaría Municipal."
              : "Seleccione la dirección y confirme el correo del director para enviar la derivación."}
          </ModalDescription>
        </ModalHeader>
        <div className="space-y-4">
          {esTransparencia && (
            <Alert variant="info">
              Este requerimiento es <strong>Solicitud de transparencia</strong>. Se deriva siempre a{" "}
              <strong>Secretaría Municipal</strong>.
            </Alert>
          )}
          <Select
            label="Dirección municipal"
            value={direccionMunicipal}
            onChange={(e) => {
              if (esTransparencia) return;
              const nextDireccion = e.target.value;
              setDireccionMunicipal(nextDireccion);
              setEmail(getCorreoDireccion(nextDireccion));
              setError("");
            }}
            options={options}
            placeholder="Seleccione dirección"
            disabled={esTransparencia}
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
          <Button onClick={handleSubmit} loading={loading}>
            Enviar derivación
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
