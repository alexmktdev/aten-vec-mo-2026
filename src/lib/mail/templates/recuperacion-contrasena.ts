import { MAIL_LOGO_CID } from "@/lib/mail/mailer";

interface RecuperacionContrasenaParams {
  resetUrl: string;
}

export function getRecuperacionContrasenaTemplate(
  params: RecuperacionContrasenaParams
): { subject: string; html: string } {
  const subject = "Recuperación de contraseña — Municipalidad de Molina";

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Recuperación de contraseña</title>
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
                  <h1 style="margin:0;color:#1e293b;font-size:24px;line-height:1.25;font-weight:800;">Recuperar Contraseña</h1>
                  <p style="margin:8px 0 0;color:#1e3a8a;font-size:13px;font-weight:700;">
                    Sistema de Atención al Vecino
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 32px 0;">
                  <p style="margin:0;color:#334155;font-size:14px;line-height:1.65;text-align:center;">
                    Recibimos una solicitud para restablecer tu contraseña. Haz clic en el siguiente botón para continuar.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 32px 8px;text-align:center;">
                  <a href="${params.resetUrl}" style="display:inline-block;background:#1e3a8a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:10px 20px;border-radius:10px;box-shadow:0 8px 16px rgba(30,58,138,0.35);">
                    Restablecer contraseña
                  </a>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 32px 0;">
                  <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;text-align:center;">
                    Si no solicitaste este cambio, puedes ignorar este correo con seguridad.
                  </p>
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
