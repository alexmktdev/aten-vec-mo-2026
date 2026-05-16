import { NextRequest } from "next/server";
import { z } from "zod";
import { adminDb, adminAuth } from "@/lib/firebase/admin";
import { getEmbeddedLogoAttachment, sendMail } from "@/lib/mail/mailer";
import { createErrorResponse, createSuccessResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";
import { getRecuperacionContrasenaTemplate } from "@/lib/mail/templates/recuperacion-contrasena";
import { createHash, randomBytes } from "crypto";
import { normalizeEmail } from "@/lib/utils/sanitize";

const log = createRouteLogger("/api/auth/password-reset");

const bodySchema = z.object({
  email: z.string().email("El correo electrónico no es válido"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    body.email = normalizeEmail(body.email || "");
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(400, "Datos inválidos", parsed.error.issues);
    }

    try {
      const userRecord = await adminAuth.getUserByEmail(parsed.data.email);

      // Invalidate previous active reset tokens for this email
      const existingTokens = await adminDb
        .collection("password_reset_tokens")
        .where("email", "==", parsed.data.email)
        .get();
      if (!existingTokens.empty) {
        const batch = adminDb.batch();
        existingTokens.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }

      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour

      await adminDb.collection("password_reset_tokens").doc(tokenHash).set({
        uid: userRecord.uid,
        email: parsed.data.email,
        expiresAt,
        createdAt: Date.now(),
      });

      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
      const resetUrl = `${appUrl}/auth/restablecer-contrasena?token=${encodeURIComponent(rawToken)}`;
      const { subject, html } = getRecuperacionContrasenaTemplate({ resetUrl });
      await sendMail(
        parsed.data.email,
        subject,
        html,
        [getEmbeddedLogoAttachment()]
      );
      log.info({ email: parsed.data.email }, "Password reset email sent through SMTP");
    } catch (error) {
      // Keep response generic to avoid account enumeration
      log.warn({ email: parsed.data.email, error }, "Password reset request handled with generic response");
    }

    return createSuccessResponse(null, "Si el correo existe, recibirá un enlace de recuperación.");
  } catch (error) {
    log.error({ error }, "Error sending password reset email");
    return createErrorResponse(500, "No fue posible procesar la solicitud de recuperación");
  }
}
