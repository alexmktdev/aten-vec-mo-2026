export class ApiClientError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.details = details;
  }
}

interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

interface ApiFailure {
  success: false;
  error: string;
  details?: unknown;
}

type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await res.json() : null;
  const json = payload as ApiEnvelope<T> | null;

  if (!res.ok || !json?.success) {
    const message = json && !json.success ? json.error : `Solicitud fallida (${res.status})`;
    const details = json && !json.success ? json.details : undefined;
    throw new ApiClientError(message, res.status, details);
  }

  return json.data;
}
