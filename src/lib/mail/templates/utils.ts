import { escapeHtml, escapeHtmlAttribute } from "@/lib/utils/sanitize";

export function mailText(value: string | undefined): string {
  return escapeHtml(value || "");
}

export function mailAttr(value: string | undefined): string {
  return escapeHtmlAttribute(value || "");
}

export function mailMessageParagraphs(message: string): string {
  return message
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(
      (line) =>
        `<p style="margin:0 0 10px;color:#334155;font-size:14px;line-height:1.65;">${mailText(line)}</p>`
    )
    .join("");
}
