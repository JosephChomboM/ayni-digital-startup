const API_BASE_URL = import.meta.env.VITE_API_URL || "https://ayni-api-stage.onrender.com";

export interface ApiErrorDetail {
  code: string;
  message: string;
}

export interface ApiResponseError {
  detail: ApiErrorDetail;
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem("ayni_token");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return {} as T;
  }

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as ApiResponseError;
    throw new Error(
      errorData.detail?.message || `Error ${response.status}: Ocurrió un problema`
    );
  }

  return data as T;
}

