import { formatReporteFecha } from "@/lib/reportes/formato-fecha-reporte";
import { RequerimientoDTO } from "@/types/requerimiento.types";

export function buildRespuestaAutomaticaCompletado(req: RequerimientoDTO): {
  asunto: string;
  mensaje: string;
} {
  const nombre = `${req.vecino.nombre} ${req.vecino.primerApellido}`.trim();
  const fechaIngreso = formatReporteFecha(req.fechaIngreso);
  const direccion = req.direccionMunicipalLabel || "la dirección municipal correspondiente";

  const asunto = `Respuesta a su ${req.tipoRequerimiento} — ${req.numeroSeguimiento}`;

  const evidencia = req.evidenciaResolucion;
  const parrafoCierre = evidencia
    ? `La gestión de su caso fue realizada por la dirección municipal indicada. ${
        evidencia.tipo === "link"
          ? "Para saber más detalles, por favor revise la evidencia indicada en este correo."
          : "Para saber más detalles, por favor revise la evidencia que se adjunta en este correo."
      }`
    : "La gestión de su caso fue realizada por la dirección municipal indicada.";

  const mensaje = [
    `Estimado/a ${nombre},`,
    "",
    `Por medio del presente correo informamos que su requerimiento de tipo «${req.tipoRequerimiento}» registrado en el Sistema de Atención al Vecino de la Municipalidad de Molina ha sido atendido y se encuentra en estado de Requerimiento Completado.`,
    "",
    "Detalle de su requerimiento:",
    `• Número de seguimiento: ${req.numeroSeguimiento}`,
    `• Tipo de requerimiento: ${req.tipoRequerimiento}`,
    `• Dirección municipal asignada: ${direccion}`,
    `• Fecha de ingreso: ${fechaIngreso}`,
    `• Descripción: ${req.descripcion}`,
    "",
    parrafoCierre,
    "",
    "Atentamente,",
    "Municipalidad de Molina — Atención al Vecino",
  ].join("\n");

  return { asunto, mensaje };
}
