"use client";

import { useEffect, useState } from "react";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Loader2 } from "lucide-react";
import { fetchJson, ApiClientError } from "@/lib/api/fetch-json";

interface AdminOpt {
  uid: string;
  nombre: string;
  email: string;
  rol?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { adminUid: string; nota?: string }) => Promise<void>;
  tipoRequerimiento?: string;
}

export function DerivarRespuestaFinalModal({
  open,
  onClose,
  onSubmit,
  tipoRequerimiento,
}: Props) {
  const [admins, setAdmins] = useState<AdminOpt[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [adminUid, setAdminUid] = useState("");
  const [nota, setNota] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadError("");
    setLoadingAdmins(true);
    const url = tipoRequerimiento
      ? `/api/usuarios/admins?tipo=${encodeURIComponent(tipoRequerimiento)}`
      : "/api/usuarios/admins";
    fetchJson<AdminOpt[]>(url)
      .then((data) => {
        if (cancelled) return;
        setAdmins(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof ApiClientError || err instanceof Error
            ? err.message
            : "No se pudo cargar la lista de administradores";
        setLoadError(message);
      })
      .finally(() => {
        if (!cancelled) setLoadingAdmins(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, tipoRequerimiento]);

  useEffect(() => {
    if (!open) {
      setAdminUid("");
      setNota("");
      setError("");
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!adminUid) {
      setError("Seleccione el admin destinatario");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await onSubmit({ adminUid, nota: nota.trim() || undefined });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo derivar el requerimiento");
    } finally {
      setSubmitting(false);
    }
  };

  const options = admins.map((a) => ({
    value: a.uid,
    label: `${a.nombre} — ${a.email}`,
  }));

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Derivar para respuesta final al vecino</ModalTitle>
          <ModalDescription>
            {tipoRequerimiento === "Solicitud de transparencia"
              ? "Solo el admin de transparencia puede redactar y enviar la respuesta final de este requerimiento."
              : tipoRequerimiento === "Solicitud Vecinal"
                ? "El requerimiento está rechazado. Elija al admin municipal que redactará y enviará la respuesta formal al vecino."
                : "Elija al admin municipal que se hará cargo de redactar y enviar la respuesta final al vecino. Solo ese admin podrá enviar el correo desde el panel."}
          </ModalDescription>
        </ModalHeader>

        <div className="space-y-4">
          {loadingAdmins && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando administradores...
            </div>
          )}
          {loadError && <Alert variant="error">{loadError}</Alert>}
          {!loadingAdmins && !loadError && options.length === 0 && (
            <Alert variant="warning">
              {tipoRequerimiento === "Solicitud de transparencia"
                ? "No hay administradores de transparencia activos disponibles."
                : "No hay administradores municipales activos disponibles."}
            </Alert>
          )}
          {!loadingAdmins && !loadError && options.length > 0 && (
            <Select
              label="Admin destinatario"
              value={adminUid}
              onChange={(e) => setAdminUid(e.target.value)}
              options={options}
              placeholder="Seleccione un admin"
              required
            />
          )}
          <Textarea
            label="Nota interna (opcional)"
            rows={3}
            maxLength={1000}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Indique cualquier contexto adicional para el admin..."
          />
          {error && <Alert variant="error">{error}</Alert>}
        </div>

        <ModalFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            loading={submitting}
            disabled={submitting || loadingAdmins || !adminUid}
            className="bg-blue-900 hover:bg-blue-950 text-white"
          >
            Derivar al admin
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
