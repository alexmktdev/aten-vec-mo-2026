/** Misma regla que usuario.schema y /api/auth/password-reset/confirm */
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

export const PASSWORD_REQUIREMENTS_SHORT =
  "Mín. 8 caracteres, 1 mayúscula, 1 minúscula y 1 número";

export const PASSWORD_REQUIREMENTS_LABEL =
  "Requisitos: mínimo 8 caracteres, al menos una mayúscula, una minúscula y un número.";

export const PASSWORD_CONFIRM_PLACEHOLDER =
  "Repita la misma contraseña (mín. 8, mayúscula, minúscula y número)";
