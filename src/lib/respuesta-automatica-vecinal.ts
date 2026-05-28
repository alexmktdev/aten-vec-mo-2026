import { formatReporteFecha } from "@/lib/reportes/formato-fecha-reporte";
import { RequerimientoDTO } from "@/types/requerimiento.types";

export function buildRespuestaAutomaticaVecinalCompletado(req: RequerimientoDTO): {
  asunto: string;
  mensaje: string;
} {
  const nombre = `${req.vecino.nombre} ${req.vecino.primerApellido}`.trim();
  const fechaIngreso = formatReporteFecha(req.fechaIngreso);
  const direccion = req.direccionMunicipalLabel || "la dirección municipal correspondiente";

  const asunto = `Respuesta a su Solicitud Vecinal — ${req.numeroSeguimiento}`;

  const mensaje = [
    `Estimado/a ${nombre},`,
    "",
    "Por medio del presente correo informamos que su Solicitud Vecinal registrada en el Sistema de Atención al Vecino de la Municipalidad de Molina ha sido atendida y se encuentra en estado de Requerimiento Completado.",
    "",
    "Detalle de su solicitud:",
    `• Número de seguimiento: ${req.numeroSeguimiento}`,
    `• Tipo de requerimiento: ${req.tipoRequerimiento}`,
    `• Dirección municipal asignada: ${direccion}`,
    `• Fecha de ingreso: ${fechaIngreso}`,
    `• Descripción: ${req.descripcion}`,
    "",
    "La respuesta a su solicitud ha sido gestionada por la dirección municipal indicada. Si requiere antecedentes adicionales, puede responder a este correo o consultar el estado de su trámite en la página de seguimiento del sistema.",
    "",
    "Atentamente,",
    "Municipalidad de Molina — Atención al Vecino",
  ].join("\n");

  return { asunto, mensaje };
}
