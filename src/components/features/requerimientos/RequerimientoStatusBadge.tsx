import { Badge } from "@/components/ui/Badge";
import { ESTADO_LABELS, ESTADO_COLORS, EstadoRequerimiento } from "@/types/requerimiento.types";

interface Props {
  estado: EstadoRequerimiento;
}

export function RequerimientoStatusBadge({ estado }: Props) {
  const color = ESTADO_COLORS[estado] as "yellow" | "blue" | "orange" | "green" | "red";
  return <Badge variant={color}>{ESTADO_LABELS[estado]}</Badge>;
}
