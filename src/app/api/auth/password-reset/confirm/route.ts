import { NextRequest } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { createErrorResponse, createSuccessResponse } from "@/lib/utils/response";
import { createRouteLogger } from "@/lib/logger";
import { sanitizeText } from "@/lib/utils/sanitize";

const log = createRouteLogger("/api/auth/password-reset/confirm");

const bodySchema = z
  .object({
    token: z.string().min(1, "Token requerido"),
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "La contraseña debe contener al menos una mayúscula, una minúscula y un número"
      ),
    confirmPassword: z.string().min(1, "Debe confirmar la contraseña"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    body.token = sanitizeText(body.token || "");
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(400, "Datos inválidos", parsed.error.issues);
    }

    const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
    const tokenDocRef = adminDb.collection("password_reset_tokens").doc(tokenHash);
    const tokenDoc = await tokenDocRef.get();

    if (!tokenDoc.exists) {
      return createErrorResponse(400, "El enlace de recuperación no es válido");
    }

    const data = tokenDoc.data() as {
      uid: string;
      email: string;
      expiresAt: number;
    };

    if (!data?.uid || !data?.expiresAt || Date.now() > data.expiresAt) {
      await tokenDocRef.delete();
      return createErrorResponse(400, "El enlace de recuperación ha expirado");
    }

    await adminAuth.updateUser(data.uid, { password: parsed.data.password });
    await tokenDocRef.delete();

    return createSuccessResponse(null, "Contraseña actualizada exitosamente");
  } catch (error) {
    log.error({ error }, "Error confirming password reset");
    return createErrorResponse(500, "No fue posible actualizar la contraseña");
  }
}
