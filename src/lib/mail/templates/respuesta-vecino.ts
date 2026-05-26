import { MAIL_LOGO_CID } from "@/lib/mail/mailer";
import { mailAttr, mailMessageParagraphs, mailText } from "@/lib/mail/templates/utils";
import { VecinoData } from "@/types/requerimiento.types";

interface RespuestaVecinoTemplateParams {
  numeroSeguimiento: string;
  vecino: VecinoData;
  asunto: string;
  mensaje: string;
  evidencia?: { tipo: "documento" | "link"; nombre?: string; url?: string };
}

export function getRespuestaVecinoTemplate(params: RespuestaVecinoTemplateParams): {
  subject: string;
  html: string;
} {
  const { numeroSeguimiento, vecino, asunto, mensaje, evidencia } = params;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const seguimientoUrl = `${appUrl.replace(/\/$/, "")}/seguimiento`;
  const nombreCompleto = mailText(`${vecino.nombre} ${vecino.primerApellido}`);

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${mailText(asunto)}</title>
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
                  <h1 style="margin:0;color:#1e293b;font-size:24px;line-height:1.25;font-weight:800;">Respuesta a su Requerimiento</h1>
                  <p style="margin:8px 0 0;color:#1e3a8a;font-size:13px;font-weight:700;">Sistema de Atención al Vecino</p>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 32px 0;">
                  <div style="background:#ecfdf5;border:1px solid #86efac;border-radius:12px;padding:14px 16px;text-align:center;">
                    <p style="margin:0;color:#166534;font-size:14px;font-weight:700;">Se ha emitido una respuesta formal a su solicitud</p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 32px 0;">
                  <p style="margin:0;color:#334155;font-size:14px;line-height:1.65;">
                    Estimado/a <strong>${nombreCompleto}</strong>, a continuación compartimos la respuesta asociada a su requerimiento <strong>${mailText(numeroSeguimiento)}</strong>.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 32px 0;">
                  <div style="background:#f8fafc;border:1px solid #dbeafe;border-radius:14px;padding:18px 18px 8px;">
                    <p style="margin:0 0 10px;color:#1e3a8a;font-size:11px;letter-spacing:0.9px;text-transform:uppercase;font-weight:700;">Mensaje enviado</p>
                    ${mailMessageParagraphs(mensaje)}
                  </div>
                </td>
              </tr>
              ${evidencia ? `<tr>
                <td style="padding:16px 32px 0;">
                  <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:14px 18px;">
                    <p style="margin:0 0 6px;color:#065f46;font-size:12px;letter-spacing:0.8px;text-transform:uppercase;font-weight:700;">Documentación de resolución</p>
                    ${evidencia.tipo === "documento"
                      ? `<p style="margin:0;color:#334155;font-size:13px;line-height:1.5;">Se adjunta el documento <strong>${mailText(evidencia.nombre || "evidencia-resolucion.pdf")}</strong> con la evidencia de resolución de su requerimiento.</p>`
                      : `<p style="margin:0;color:#334155;font-size:13px;line-height:1.5;">Puede acceder a la documentación de resolución de su requerimiento en el siguiente enlace:</p>
                         <p style="margin:8px 0 0;"><a href="${mailAttr(evidencia.url || "")}" style="color:#1e3a8a;font-size:13px;font-weight:600;text-decoration:underline;">${mailText(evidencia.url || "")}</a></p>`}
                  </div>
                </td>
              </tr>` : ""}
              <tr>
                <td style="padding:18px 32px 0;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                    <tr>
                      <td style="padding:9px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;font-weight:700;width:38%;">Número de seguimiento</td>
                      <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:13px;">${mailText(numeroSeguimiento)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 32px 0;text-align:center;">
                  <a href="${mailAttr(seguimientoUrl)}" style="display:inline-block;background:#1e3a8a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:10px 18px;border-radius:10px;">
                    Revisar seguimiento
                  </a>
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

  return { subject: mailText(asunto), html };
}
