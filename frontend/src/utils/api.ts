const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const API_BASE = `${BACKEND_URL}/api`;

type FetchOptions = {
  method?: string;
  body?: any;
  token?: string | null;
};

export async function apiFetch<T = any>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = opts;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      // Return a safe error object instead of throwing
      const errorData = await res.json().catch(() => ({}));
      return { error: errorData.detail || `HTTP ${res.status}`, status: res.status } as any;
    }

    return res.json();
  } catch (e) {
    // Network error - return safe error object
    return { error: 'Network error' } as any;
  }
}
