import { formatReporteFecha } from "@/lib/reportes/formato-fecha-reporte";
import { RequerimientoDTO } from "@/types/requerimiento.types";

export function buildRespuestaAutomaticaCompletado(req: RequerimientoDTO): {
  asunto: string;
  mensaje: string;
} {
  const nombre = `${req.vecino.nombre} ${req.vecino.primerApellido}`.trim();
  const fechaIngreso = formatReporteFecha(req.fechaIngreso);
  const fechaCierre = formatReporteFecha(new Date());
  const direccion = req.direccionMunicipalLabel || "la dirección municipal correspondiente";

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const seguimientoUrl = `${appUrl}/seguimiento`;

  const asunto = `Respuesta a su ${req.tipoRequerimiento} — ${req.numeroSeguimiento}`;

  const evidencia = req.evidenciaResolucion;
  const parrafoEvidencia = evidencia
    ? evidencia.tipo === "link"
      ? "La dirección municipal responsable trabajó su requerimiento dentro del plazo establecido y ha dejado constancia de las acciones realizadas. Para conocer en detalle el resultado, los antecedentes técnicos y/o el respaldo de la intervención, le pedimos por favor revisar la evidencia disponible en el enlace indicado en este correo."
      : "La dirección municipal responsable trabajó su requerimiento dentro del plazo establecido y ha dejado constancia de las acciones realizadas. Para conocer en detalle el resultado, los antecedentes técnicos y/o el respaldo de la intervención, le pedimos por favor revisar la evidencia que se adjunta en este correo."
    : "La dirección municipal responsable trabajó su requerimiento dentro del plazo establecido y ha dejado constancia de las acciones realizadas en el sistema. Si requiere antecedentes adicionales, puede ingresar un nuevo requerimiento haciendo referencia al número de este caso.";

  const mensaje = [
    `Estimado/a ${nombre},`,
    "",
    `Junto con saludarle, la Ilustre Municipalidad de Molina, a través de su Sistema de Atención al Vecino, le comunica que su requerimiento de tipo «${req.tipoRequerimiento}», ingresado con fecha ${fechaIngreso}, ha sido gestionado y resuelto satisfactoriamente.`,
    "",
    "A partir de esta notificación, su requerimiento queda registrado en el estado de Requerimiento Completado, lo que significa que la dirección municipal a la que fue derivado revisó los antecedentes, ejecutó las acciones que correspondían y finalizó la atención de su caso.",
    "",
    "Detalle del requerimiento gestionado:",
    `• Número de seguimiento: ${req.numeroSeguimiento}`,
    `• Tipo de requerimiento: ${req.tipoRequerimiento}`,
    `• Dirección municipal responsable: ${direccion}`,
    `• Fecha de ingreso: ${fechaIngreso}`,
    `• Fecha de cierre: ${fechaCierre}`,
    `• Descripción registrada por usted: «${req.descripcion}»`,
    "",
    "Resultado de la gestión:",
    parrafoEvidencia,
    "",
    "Seguimiento de su caso:",
    `Si en algún momento necesita revisar el estado o el historial de su requerimiento, puede hacerlo en línea ingresando su número de seguimiento y RUT en la página oficial de Atención al Vecino de la Municipalidad: ${seguimientoUrl}`,
    "",
    "Su opinión es importante para nosotros. Si considera que la respuesta no resuelve completamente su solicitud, puede ingresar un nuevo requerimiento en el sistema indicando el número de este caso como referencia.",
    "",
    "Agradecemos sinceramente su confianza en la gestión municipal y el tiempo dedicado a comunicarnos su requerimiento. Seguimos trabajando por una comuna más cercana, transparente y al servicio de sus vecinos.",
    "",
    "Atentamente,",
    "Sistema de Atención al Vecino",
    "Ilustre Municipalidad de Molina",
  ].join("\n");

  return { asunto, mensaje };
}
