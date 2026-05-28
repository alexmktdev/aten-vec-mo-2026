import { MAIL_LOGO_CID } from "@/lib/mail/mailer";
import { mailAttr, mailText } from "@/lib/mail/templates/utils";
import { VecinoData } from "@/types/requerimiento.types";

interface ConfirmacionVecinoParams {
  numeroSeguimiento: string;
  vecino: VecinoData;
  tipoRequerimiento: string;
  descripcion: string;
  fechaIngreso: string;
}

export function getConfirmacionVecinoTemplate(params: ConfirmacionVecinoParams): {
  subject: string;
  html: string;
} {
  const {
    numeroSeguimiento,
    vecino,
    tipoRequerimiento,
    descripcion,
    fechaIngreso,
  } = params;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const seguimientoUrl = `${appUrl.replace(/\/$/, "")}/seguimiento`;
  const nombreCompleto = mailText(`${vecino.nombre} ${vecino.primerApellido}`);
  const descripcionCorta = mailText(
    `${descripcion.substring(0, 200)}${descripcion.length > 200 ? "..." : ""}`
  );

  const subject = `Confirmación de requerimiento ${numeroSeguimiento} - Municipalidad de Molina`;

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Confirmación de requerimiento</title>
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
                  <h1 style="margin:0;color:#1e293b;font-size:24px;line-height:1.25;font-weight:800;">Requerimiento Recibido</h1>
                  <p style="margin:8px 0 0;color:#1e3a8a;font-size:13px;font-weight:700;">
                    Sistema de Atención al Vecino
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 32px 0;">
                  <div style="background:#ecfdf5;border:1px solid #86efac;border-radius:12px;padding:14px 16px;text-align:center;">
                    <p style="margin:0;color:#166534;font-size:14px;font-weight:700;">Requerimiento recibido exitosamente</p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 32px 0;">
                  <p style="margin:0;color:#334155;font-size:14px;line-height:1.65;">
                    Estimado/a <strong>${nombreCompleto}</strong>, su requerimiento ha sido ingresado correctamente.
                  </p>
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
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                    <tr>
                      <td style="padding:9px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;font-weight:700;width:38%;">Fecha de ingreso</td>
                      <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:13px;">${mailText(fechaIngreso)}</td>
                    </tr>
                    <tr>
                      <td style="padding:9px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;font-weight:700;">Tipo de requerimiento</td>
                      <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:13px;">${mailText(tipoRequerimiento)}</td>
                    </tr>
                    <tr>
                      <td style="padding:9px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;font-weight:700;">Descripción</td>
                      <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:13px;">${descripcionCorta}</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 32px 0;">
                  <p style="margin:0;color:#64748b;font-size:12px;line-height:1.65;text-align:center;">
                    Puede consultar el estado de su requerimiento usando su número de seguimiento y RUT en la plataforma.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 32px 0;text-align:center;">
                  <a href="${mailAttr(seguimientoUrl)}" style="display:inline-block;background:#1e3a8a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:10px 18px;border-radius:10px;box-shadow:0 8px 16px rgba(30,58,138,0.28);">
                    Ir a Seguimiento
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

  return { subject, html };
}
