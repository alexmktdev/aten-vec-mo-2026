import { RequerimientoDTO } from "@/types/requerimiento.types";
import { Card, CardContent } from "@/components/ui/Card";
import { RequerimientoStatusBadge } from "./RequerimientoStatusBadge";
import { AlertaVencimiento } from "./AlertaVencimiento";
import { Calendar, MapPin } from "lucide-react";

interface Props {
  requerimiento: RequerimientoDTO;
  onClick?: () => void;
}

export function RequerimientoCard({ requerimiento, onClick }: Props) {
  const fecha = new Date(requerimiento.fechaIngreso).toLocaleDateString("es-CL");
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-sm font-bold text-blue-600">{requerimiento.numeroSeguimiento}</p>
            <p className="text-xs text-slate-500 mt-0.5">{requerimiento.vecino.nombre} {requerimiento.vecino.primerApellido}</p>
          </div>
          <RequerimientoStatusBadge estado={requerimiento.estado} />
        </div>
        <p className="text-sm text-slate-700 line-clamp-2 mb-3">{requerimiento.descripcion}</p>
        <div className="flex flex-wrap gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{requerimiento.direccionMunicipalLabel}</span>
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{fecha}</span>
        </div>
        <AlertaVencimiento diasHabilesRestantes={requerimiento.diasHabilesRestantes} vencido={requerimiento.vencido} />
      </CardContent>
    </Card>
  );
}
