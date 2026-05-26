import { Alert } from "@/components/ui/Alert";

interface Props {
  diasHabilesRestantes?: number;
  vencido?: boolean;
}

function semanasAprox(dias: number): number {
  return Math.max(1, Math.round(dias / 5));
}

export function AlertaVencimiento({ diasHabilesRestantes, vencido }: Props) {
  if (vencido) {
    const diasExcedidos =
      diasHabilesRestantes !== undefined && diasHabilesRestantes < 0
        ? Math.abs(diasHabilesRestantes)
        : 0;
    return (
      <Alert variant="error" title="ALERTA">
        El plazo del requerimiento ya venció
        {diasExcedidos > 0 ? ` (${diasExcedidos} día${diasExcedidos !== 1 ? "s" : ""} hábil${diasExcedidos !== 1 ? "es" : ""} excedido${diasExcedidos !== 1 ? "s" : ""})` : ""}.
      </Alert>
    );
  }
  if (diasHabilesRestantes !== undefined && diasHabilesRestantes >= 0) {
    const semanas = semanasAprox(diasHabilesRestantes);
    if (diasHabilesRestantes <= 3) {
      return (
        <Alert variant="warning" title="Próximo a vencer">
          Quedan {diasHabilesRestantes} día{diasHabilesRestantes !== 1 ? "s" : ""} hábil
          {diasHabilesRestantes !== 1 ? "es" : ""} para resolver este requerimiento.
        </Alert>
      );
    }
    if (diasHabilesRestantes <= 10) {
      return (
        <Alert variant="info" title="Plazo vigente">
          Quedan {diasHabilesRestantes} día{diasHabilesRestantes !== 1 ? "s" : ""} hábil
          {diasHabilesRestantes !== 1 ? "es" : ""} (~{semanas} semana{semanas !== 1 ? "s" : ""}) para resolver
          el requerimiento.
        </Alert>
      );
    }
  }
  return null;
}
