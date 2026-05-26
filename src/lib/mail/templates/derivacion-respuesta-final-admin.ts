import { MAIL_LOGO_CID } from "@/lib/mail/mailer";
import { mailText } from "@/lib/mail/templates/utils";
import { VecinoData } from "@/types/requerimiento.types";

interface DerivacionRespuestaFinalParams {
  adminNombre: string;
  numeroSeguimiento: string;
  vecino: VecinoData;
  tipoRequerimiento: string;
  direccionMunicipalLabel: string;
  descripcion: string;
  fechaIngreso: string;
  fechaLimite: string;
  evidencia?: { tipo: "documento" | "link"; nombre?: string; url?: string };
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

export function getDerivacionRespuestaFinalAdminTemplate(
  params: DerivacionRespuestaFinalParams
): { subject: string; html: string } {
  const {
    adminNombre,
    numeroSeguimiento,
    vecino,
    tipoRequerimiento,
    direccionMunicipalLabel,
    descripcion,
    fechaIngreso,
    fechaLimite,
    evidencia,
  } = params;

  const subject = `Requerimiento ${numeroSeguimiento} derivado para respuesta final al vecino`;
  const nombreCompleto = mailText(
    `${vecino.nombre} ${vecino.primerApellido} ${vecino.segundoApellido || ""}`.trim()
  );

  const evidenciaBlock = evidencia
    ? `
      <tr>
        <td style="padding:18px 32px 0;">
          <div style="background:#f5f3ff;border:1px solid #c4b5fd;border-radius:12px;padding:14px 16px;">
            <p style="margin:0;color:#5b21b6;font-size:13px;font-weight:700;">Evidencia adjuntada por el director</p>
            <p style="margin:6px 0 0;color:#334155;font-size:13px;">
              ${
                evidencia.tipo === "documento"
                  ? mailText(evidencia.nombre || "Documento adjunto")
                  : `<a href="${mailText(evidencia.url || "")}" style="color:#1d4ed8;">${mailText(evidencia.url || "Enlace de evidencia")}</a>`
              }
            </p>
          </div>
        </td>
      </tr>
    `
    : "";

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Requerimiento para respuesta final</title>
    </head>
    <body style="margin:0;padding:0;background:#eef0f5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef0f5;padding:18px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:720px;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;box-shadow:0 20px 40px rgba(15,23,42,0.08);">
              <tr>
                <td style="padding:24px 32px 12px;text-align:center;">
                  <img src="cid:${MAIL_LOGO_CID}" alt="Municipalidad de Molina" width="200" style="max-width:200px;height:auto;display:inline-block;">
                </td>
              </tr>
              <tr>
                <td style="padding:0 32px 8px;text-align:center;">
                  <h1 style="margin:0;color:#1e293b;font-size:24px;line-height:1.25;font-weight:800;">Requerimiento listo para respuesta final</h1>
                  <p style="margin:8px 0 0;color:#5b21b6;font-size:13px;font-weight:700;">
                    Asignado a: ${mailText(adminNombre)}
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 32px 0;">
                  <div style="background:#f5f3ff;border:1px solid #c4b5fd;border-radius:12px;padding:14px 16px;text-align:center;">
                    <p style="margin:0;color:#5b21b6;font-size:14px;font-weight:700;">
                      El director de ${mailText(direccionMunicipalLabel)} terminó la gestión del requerimiento. Por favor revise la evidencia, redacte la respuesta y envíela al vecino desde el panel.
                    </p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 32px 0;">
                  <div style="background:#eff6ff;border:2px solid #2563eb;border-radius:12px;padding:20px;text-align:center;">
                    <p style="margin:0;color:#64748b;font-size:11px;letter-spacing:0.9px;text-transform:uppercase;font-weight:700;">Número de seguimiento</p>
                    <p style="margin:8px 0 0;color:#1e3a8a;font-size:28px;font-weight:800;letter-spacing:1.2px;">${mailText(numeroSeguimiento)}</p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:18px 32px 0;">
                  <h3 style="color:#334155;margin:0 0 10px;font-size:15px;">Información del Requerimiento</h3>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                    <tr>
                      <td style="padding:9px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;font-weight:700;width:38%;">Tipo</td>
                      <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:13px;">${mailText(tipoRequerimiento)}</td>
                    </tr>
                    <tr>
                      <td style="padding:9px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;font-weight:700;">Área que resolvió</td>
                      <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:13px;">${mailText(direccionMunicipalLabel)}</td>
                    </tr>
                    <tr>
                      <td style="padding:9px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;font-weight:700;">Fecha de ingreso</td>
                      <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:13px;">${mailText(formatDate(fechaIngreso))}</td>
                    </tr>
                    <tr>
                      <td style="padding:9px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;font-weight:700;">Fecha límite vigente</td>
                      <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:13px;">${mailText(formatDate(fechaLimite))}</td>
                    </tr>
                    <tr>
                      <td style="padding:9px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;font-weight:700;">Descripción</td>
                      <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:13px;">${mailText(descripcion)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
              ${evidenciaBlock}
              <tr>
                <td style="padding:18px 32px 0;">
                  <h3 style="color:#334155;margin:0 0 10px;font-size:15px;">Datos del Vecino</h3>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                    <tr>
                      <td style="padding:9px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;font-weight:700;width:38%;">Nombre</td>
                      <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:13px;">${nombreCompleto}</td>
                    </tr>
                    <tr>
                      <td style="padding:9px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;font-weight:700;">Email</td>
                      <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:13px;">${mailText(vecino.email)}</td>
                    </tr>
                    <tr>
                      <td style="padding:9px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;font-weight:700;">Teléfono</td>
                      <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:13px;">${mailText(vecino.telefono)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:22px 32px 24px;">
                  <p style="margin:0;color:#0f172a;font-size:11px;line-height:1.6;text-align:center;">
                    © ${new Date().getFullYear()} MUNICIPALIDAD DE MOLINA · ATENCIÓN AL VECINO
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return { subject, html };
}
