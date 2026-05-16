const TAG_REGEX = /<[^>]*>/g;

export function sanitizeText(value: string): string {
  return value.replace(TAG_REGEX, "").trim();
}

export function sanitizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const sanitized = sanitizeText(value);
  return sanitized.length > 0 ? sanitized : undefined;
}

export function normalizeEmail(value: string): string {
  return sanitizeText(value).toLowerCase();
}
