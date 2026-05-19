import { getEmbeddedLogoAttachment, sendMail } from "@/lib/mail/mailer";
import { getConfirmacionVecinoTemplate } from "@/lib/mail/templates/confirmacion-vecino";
import { getAvisoAdminTemplate } from "@/lib/mail/templates/aviso-admin";
import { getDerivacionDirectorTemplate } from "@/lib/mail/templates/derivacion-director";
import { getRespuestaVecinoTemplate } from "@/lib/mail/templates/respuesta-vecino";
import { usuarioRepository } from "@/repositories/usuario.repository";
import { VecinoData } from "@/types/requerimiento.types";
import logger from "@/lib/logger";

interface NotificacionParams {
  numeroSeguimiento: string;
  vecino: VecinoData;
  tipoRequerimiento: string;
  direccionMunicipalLabel: string;
  categoria: string;
  descripcion: string;
  fechaIngreso: string;
}

export const notificacionService = {
  /**
   * Send confirmation email to the citizen
   */
  async enviarConfirmacionVecino(params: NotificacionParams): Promise<void> {
    try {
      const { subject, html } = getConfirmacionVecinoTemplate(params);
      await sendMail(params.vecino.email, subject, html, [getEmbeddedLogoAttachment()]);
      logger.info(
        { email: params.vecino.email, numero: params.numeroSeguimiento },
        "Confirmation email sent to citizen"
      );
    } catch (error) {
      logger.error({ error }, "Failed to send confirmation email to citizen");
      // Don't throw — email failure shouldn't block the flow
    }
  },

  /**
   * Send notification email to admins
   */
  async enviarAvisoAdmin(params: NotificacionParams): Promise<void> {
    try {
      const admins = await usuarioRepository.getAdmins();
      const { subject, html } = getAvisoAdminTemplate(params);

      for (const admin of admins) {
        try {
          await sendMail(admin.email, subject, html, [getEmbeddedLogoAttachment()]);
          logger.info(
            { email: admin.email, numero: params.numeroSeguimiento },
            "Admin notification email sent"
          );
        } catch (error) {
          logger.error({ error, email: admin.email }, "Failed to send admin notification");
        }
      }
    } catch (error) {
      logger.error({ error }, "Failed to fetch admins for notification");
    }
  },

  /**
   * Send derivation email to the director/person responsible
   */
  async enviarDerivacion(
    emailDestinatario: string,
    params: NotificacionParams & { fechaLimite: string }
  ): Promise<void> {
    const { subject, html } = getDerivacionDirectorTemplate(params);
    await sendMail(emailDestinatario, subject, html, [getEmbeddedLogoAttachment()]);
    logger.info(
      { email: emailDestinatario, numero: params.numeroSeguimiento },
      "Derivation email sent"
    );
  },

  async enviarRespuestaVecino(
    emailDestino: string,
    params: {
      numeroSeguimiento: string;
      vecino: VecinoData;
      asunto: string;
      mensaje: string;
      direccionMunicipalLabel: string;
      categoria: string;
      evidencia?: { tipo: "documento" | "link"; nombre?: string; url?: string };
    },
    evidenciaAdjunta?: { filename: string; content: Buffer }
  ): Promise<void> {
    try {
      const { subject, html } = getRespuestaVecinoTemplate(params);
      const attachments = [getEmbeddedLogoAttachment()];
      if (evidenciaAdjunta) {
        attachments.push({
          filename: evidenciaAdjunta.filename,
          content: evidenciaAdjunta.content,
          contentType: "application/pdf",
        });
      }
      await sendMail(emailDestino, subject, html, attachments);
      logger.info(
        { email: emailDestino, numero: params.numeroSeguimiento, hasEvidencia: !!evidenciaAdjunta },
        "Citizen response email sent"
      );
    } catch (error) {
      logger.error({ error, email: emailDestino, numero: params.numeroSeguimiento }, "Failed to send citizen response email");
      throw error;
    }
  },
};
