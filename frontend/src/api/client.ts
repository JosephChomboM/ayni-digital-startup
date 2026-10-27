export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string = "unknown_error", status: number = 500) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = import.meta.env.VITE_API_URL;

  if (!baseUrl) {
    throw new ApiError(
      "La dirección de la API (VITE_API_URL) no está configurada.",
      "configuration_error",
      0
    );
  }

  const token = localStorage.getItem("ayni_token");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers,
    });
  } catch {
    throw new ApiError(
      "No pudimos conectar. Inténtalo de nuevo.",
      "network_error",
      0
    );
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      "No pudimos procesar la respuesta del servidor.",
      "parse_error",
      response.status
    );
  }

  if (!response.ok) {
    const errorObj = data as { detail?: { code?: string; message?: string } };
    const message =
      errorObj?.detail?.message || "Ocurrió un problema inesperado.";
    const code = errorObj?.detail?.code || "error";
    throw new ApiError(message, code, response.status);
  }

  return data as T;
}

