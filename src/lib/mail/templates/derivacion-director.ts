import { MAIL_LOGO_CID } from "@/lib/mail/mailer";
import { mailText } from "@/lib/mail/templates/utils";
import { VecinoData } from "@/types/requerimiento.types";

interface DerivacionDirectorParams {
  numeroSeguimiento: string;
  vecino: VecinoData;
  tipoRequerimiento: string;
  direccionMunicipalLabel: string;
  categoria: string;
  descripcion: string;
  fechaIngreso: string;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
}

export function getDerivacionDirectorTemplate(params: DerivacionDirectorParams): {
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
  const fechaIngresoFormateada = formatDateTime(fechaIngreso);

  const subject = `Requerimiento derivado ${numeroSeguimiento} - ${direccionMunicipalLabel}`;
  const nombreCompleto = mailText(
    `${vecino.nombre} ${vecino.primerApellido} ${vecino.segundoApellido || ""}`.trim()
  );

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Requerimiento derivado</title>
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
                  <h1 style="margin:0;color:#1e293b;font-size:24px;line-height:1.25;font-weight:800;">Requerimiento Derivado</h1>
                  <p style="margin:8px 0 0;color:#1e3a8a;font-size:13px;font-weight:700;">
                    Derivado a: ${mailText(direccionMunicipalLabel)}
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 32px 0;">
                  <div style="background:#ecfdf5;border:1px solid #86efac;border-radius:12px;padding:14px 16px;text-align:center;">
                    <p style="margin:0;color:#166534;font-size:14px;font-weight:700;">
                      Se le ha derivado un nuevo requerimiento para su gestión. Por favor, revíselo y actualice el estado correspondiente.
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
                      <td style="padding:9px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;font-weight:700;">Categoría</td>
                      <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:13px;">${mailText(categoria)}</td>
                    </tr>
                    <tr>
                      <td style="padding:9px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;font-weight:700;">Fecha de ingreso</td>
                      <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:13px;">${mailText(fechaIngresoFormateada)}</td>
                    </tr>
                    <tr>
                      <td style="padding:9px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;font-weight:700;">Descripción</td>
                      <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:13px;">${mailText(descripcion)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
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
                    <tr>
                      <td style="padding:9px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;font-weight:700;">Dirección</td>
                      <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:13px;">${mailText(`${vecino.direccion}, ${vecino.comuna}`)}</td>
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
