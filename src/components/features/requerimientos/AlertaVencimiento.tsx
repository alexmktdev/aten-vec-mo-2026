import { Alert } from "@/components/ui/Alert";

interface Props {
  diasHabilesRestantes?: number;
  vencido?: boolean;
}

export function AlertaVencimiento({ diasHabilesRestantes, vencido }: Props) {
  if (vencido) {
    const diasSinResponder =
      diasHabilesRestantes !== undefined && diasHabilesRestantes < 0
        ? 20 + Math.abs(diasHabilesRestantes)
        : 20;
    return (
      <Alert variant="error" title="ALERTA">
        El requerimiento lleva {diasSinResponder} día{diasSinResponder !== 1 ? "s" : ""} hábil{diasSinResponder !== 1 ? "es" : ""} sin responder desde su ingreso.
      </Alert>
    );
  }
  if (diasHabilesRestantes !== undefined && diasHabilesRestantes <= 3 && diasHabilesRestantes >= 0) {
    return (
      <Alert variant="warning" title="Próximo a vencer">
        Quedan {diasHabilesRestantes} día{diasHabilesRestantes !== 1 ? "s" : ""} hábil{diasHabilesRestantes !== 1 ? "es" : ""} para responder este requerimiento.
      </Alert>
    );
  }
  return null;
}
