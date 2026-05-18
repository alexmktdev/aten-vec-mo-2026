import nodemailer, { type Transporter } from "nodemailer";
import { readFileSync } from "node:fs";
import path from "node:path";
import logger from "@/lib/logger";

export const MAIL_LOGO_CID = "logo-molina@atencion-vecino";

interface MailAttachment {
  filename: string;
  content: Buffer;
  cid?: string;
  contentType?: string;
}

let _transporter: Transporter | null = null;
let _logoAttachment: MailAttachment | null = null;

export function getMailTransporter(): Transporter {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("Missing SMTP environment variables");
  }

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });

  return _transporter;
}

export function getSmtpFrom(): string {
  return process.env.SMTP_FROM || "Municipalidad <noreply@municipalidad.cl>";
}

export function getEmbeddedLogoAttachment(): MailAttachment {
  if (_logoAttachment) return _logoAttachment;

  const logoPath = path.join(process.cwd(), "public", "logo-molina.png");
  _logoAttachment = {
    filename: "logo-molina.png",
    content: readFileSync(logoPath),
    cid: MAIL_LOGO_CID,
    contentType: "image/png",
  };

  return _logoAttachment;
}

export async function sendMail(
  to: string,
  subject: string,
  html: string,
  attachments: MailAttachment[] = []
): Promise<void> {
  const transporter = getMailTransporter();
  const configuredFrom = getSmtpFrom();
  const smtpUser = process.env.SMTP_USER || configuredFrom;

  try {
    await transporter.sendMail({
      from: configuredFrom,
      to,
      subject,
      html,
      attachments,
    });
  } catch (error) {
    if (smtpUser !== configuredFrom) {
      logger.warn(
        { error, configuredFrom, fallbackFrom: smtpUser, to, subject },
        "SMTP rejected configured sender, retrying with SMTP_USER"
      );
      await transporter.sendMail({
        from: smtpUser,
        to,
        subject,
        html,
        attachments,
      });
      return;
    }
    throw error;
  }
}
