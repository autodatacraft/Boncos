import { storage } from "@/src/utils/storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

const TOKEN_KEY = "boncos_session_token";

function getConfiguredBackendUrl() {
  const extra = (Constants.expoConfig?.extra ??
    Constants.manifest2?.extra ??
    {}) as Record<string, unknown>;
  const value =
    process.env.EXPO_PUBLIC_BACKEND_URL ||
    (typeof extra.backendUrl === "string" ? extra.backendUrl : "");

  return value.trim();
}

function getExpoHost() {
  const config = Constants.expoConfig as any;
  const manifest = Constants.manifest as any;
  const manifest2 = Constants.manifest2 as any;
  const hostUri =
    config?.hostUri ||
    manifest?.debuggerHost ||
    manifest2?.extra?.expoClient?.hostUri ||
    manifest2?.extra?.expoGo?.debuggerHost;

  if (typeof hostUri !== "string") return "";

  try {
    return new URL(
      hostUri.includes("://") ? hostUri : `http://${hostUri}`
    ).hostname;
  } catch {
    return "";
  }
}

function resolveBackendUrl() {
  const configuredUrl = getConfiguredBackendUrl();
  if (configuredUrl && !["auto", "local", "development"].includes(configuredUrl.toLowerCase())) {
    return configuredUrl.replace(/\/+$/, "");
  }

  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.hostname) {
    return `http://${window.location.hostname}:8000`;
  }

  const expoHost = getExpoHost();
  if (expoHost) return `http://${expoHost}:8000`;

  return "http://localhost:8000";
}

const BACKEND_URL = resolveBackendUrl();
const API_BASE = `${BACKEND_URL}/api`;

export function getBackendUrl() {
  return BACKEND_URL;
}

type FetchOptions = {
  method?: string;
  body?: any;
  token?: string | null;
};

type ApiError = {
  error: string;
  status?: number;
};

let dataMutationRevision = 0;

export function getDataMutationRevision() {
  return dataMutationRevision;
}

function isDataMutation(method: string) {
  return ["POST", "PATCH", "PUT", "DELETE"].includes(method.toUpperCase());
}

function normalizePath(path: string) {
  if (!path) return "";
  return path.startsWith("/") ? path : `/${path}`;
}

export async function apiFetchWithAuth<T = any>(
  path: string,
  opts: FetchOptions = {}
): Promise<T | ApiError> {
  const token = await storage.secureGet(TOKEN_KEY, "");

  return apiFetch<T>(path, {
    ...opts,
    token,
  });
}

export async function apiFetch<T = any>(
  path: string,
  opts: FetchOptions = {}
): Promise<T | ApiError> {
  const { method = "GET", body, token } = opts;
  const normalizedMethod = method.toUpperCase();

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
      method: normalizedMethod,
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

    if (isDataMutation(normalizedMethod)) {
      dataMutationRevision += 1;
    }

    return responseData as T;
  } catch (e: any) {
    console.log("API NETWORK ERROR:", e?.message || e);

    return {
      error: "Network error",
    };
  }
}
