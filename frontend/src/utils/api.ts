const RAW_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "";

const BACKEND_URL = RAW_BACKEND_URL.replace(/\/+$/, "");
const API_BASE = `${BACKEND_URL}/api`;

type FetchOptions = {
  method?: string;
  body?: any;
  token?: string | null;
};

type ApiError = {
  error: string;
  status?: number;
};

function normalizePath(path: string) {
  if (!path) return "";
  return path.startsWith("/") ? path : `/${path}`;
}

export async function apiFetch<T = any>(
  path: string,
  opts: FetchOptions = {}
): Promise<T | ApiError> {
  const { method = "GET", body, token } = opts;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${API_BASE}${normalizePath(path)}`;

  console.log("API REQUEST:", method, url);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const contentType = res.headers.get("content-type") || "";
    const responseData = contentType.includes("application/json")
      ? await res.json()
      : await res.text();

    if (!res.ok) {
      console.log("API ERROR RESPONSE:", res.status, responseData);

      return {
        error:
          typeof responseData === "string"
            ? responseData
            : responseData?.detail || `HTTP ${res.status}`,
        status: res.status,
      };
    }

    return responseData as T;
  } catch (e: any) {
    console.log("API NETWORK ERROR:", e?.message || e);

    return {
      error: "Network error",
    };
  }
}