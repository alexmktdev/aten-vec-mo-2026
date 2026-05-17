const TAG_REGEX = /<[^>]*>/g;
const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function stripUnsafeCharacters(value: string): string {
  return value.replace(CONTROL_CHARS_REGEX, "");
}

export function sanitizeText(value: string): string {
  return stripUnsafeCharacters(value).replace(TAG_REGEX, "").trim();
}

export function sanitizeMultilineText(value: string): string {
  return stripUnsafeCharacters(value).replace(TAG_REGEX, "").trim();
}

export function sanitizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const sanitized = sanitizeText(value);
  return sanitized.length > 0 ? sanitized : undefined;
}

export function normalizeEmail(value: string): string {
  return sanitizeText(value).toLowerCase();
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] || char);
}

export function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
