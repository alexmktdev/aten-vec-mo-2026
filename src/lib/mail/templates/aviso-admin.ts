import { MAIL_LOGO_CID } from "@/lib/mail/mailer";
import { VecinoData } from "@/types/requerimiento.types";

interface AvisoAdminParams {
  numeroSeguimiento: string;
  vecino: VecinoData;
  tipoRequerimiento: string;
  direccionMunicipalLabel: string;
  categoria: string;
  descripcion: string;
  fechaIngreso: string;
}

export function getAvisoAdminTemplate(params: AvisoAdminParams): {
  subject: string;
  html: string;
} {
  const {
    numeroSeguimiento,
    vecino,
    tipoRequerimiento,
    direccionMunicipalLabel,
    categoria,
    descripcion,
    fechaIngreso,
  } = params;
  const subject = `Nuevo requerimiento ${numeroSeguimiento} — ${tipoRequerimiento}`;

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Nuevo requerimiento</title>
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
                  <h1 style="margin:0;color:#1e293b;font-size:24px;line-height:1.25;font-weight:800;">Nuevo Requerimiento</h1>
                  <p style="margin:8px 0 0;color:#1e3a8a;font-size:13px;font-weight:700;">Panel de Administración</p>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 32px 0;">
                  <div style="background:#ecfdf5;border:1px solid #86efac;border-radius:12px;padding:14px 16px;text-align:center;">
                    <p style="margin:0;color:#166534;font-size:14px;font-weight:700;">Requiere revisión y derivación</p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 32px 0;">
                  <div style="background:#eff6ff;border:2px solid #2563eb;border-radius:12px;padding:20px;text-align:center;">
                    <p style="margin:0;color:#64748b;font-size:11px;letter-spacing:0.9px;text-transform:uppercase;font-weight:700;">Número de seguimiento</p>
                    <p style="margin:8px 0 0;color:#1e3a8a;font-size:28px;font-weight:800;letter-spacing:1.2px;">${numeroSeguimiento}</p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:18px 32px 0;">
                  <p style="margin:0 0 8px;color:#334155;font-size:15px;font-weight:700;">Datos del Vecino</p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                    <tr>
                      <td style="padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;font-weight:700;width:35%;">Nombre</td>
                      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:13px;">${vecino.nombre} ${vecino.primerApellido} ${vecino.segundoApellido || ""}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;font-weight:700;">RUT</td>
                      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:13px;">${vecino.rut}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;font-weight:700;">Email</td>
                      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:13px;">${vecino.email}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;font-weight:700;">Teléfono</td>
                      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:13px;">${vecino.telefono}</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 32px 0;">
                  <p style="margin:0 0 8px;color:#334155;font-size:15px;font-weight:700;">Datos del Requerimiento</p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                    <tr>
                      <td style="padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;font-weight:700;width:35%;">Fecha</td>
                      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:13px;">${fechaIngreso}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;font-weight:700;">Tipo</td>
                      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:13px;">${tipoRequerimiento}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;font-weight:700;">Dirección Municipal</td>
                      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:13px;">${direccionMunicipalLabel}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;font-weight:700;">Categoría</td>
                      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:13px;">${categoria}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;font-weight:700;">Descripción</td>
                      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:13px;">${descripcion}</td>
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
