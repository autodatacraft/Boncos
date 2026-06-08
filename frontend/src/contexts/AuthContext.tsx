import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { Platform } from "react-native";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { storage } from "@/src/utils/storage";
import { apiFetch } from "@/src/utils/api";
import { configureGoogleSignIn, getGoogleIdToken } from "@/services/googleAuth";

type User = {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  subscription_plan?: string;
  supporter_badge?: string | null;
} | null;

type AuthContextType = {
  user: User;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  token: string | null;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  token: null,
});

export const useAuth = () => useContext(AuthContext);

const TOKEN_KEY = "boncos_session_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const saveToken = async (sessionToken: string) => {
    if (Platform.OS === "web") {
      await storage.setItem(TOKEN_KEY, sessionToken);
    } else {
      await storage.secureSet(TOKEN_KEY, sessionToken);
    }

    setToken(sessionToken);
  };

  const removeToken = async () => {
    if (Platform.OS === "web") {
      await storage.removeItem(TOKEN_KEY);
    } else {
      await storage.secureRemove(TOKEN_KEY);
    }

    setToken(null);
  };

  const getStoredToken = async () => {
    if (Platform.OS === "web") {
      return storage.getItem(TOKEN_KEY, "");
    }

    return storage.secureGet(TOKEN_KEY, "");
  };

  const setUserFromResponse = (data: any) => {
    setUser({
      user_id: data.user_id,
      email: data.email,
      name: data.name,
      picture: data.picture,
      subscription_plan: data.subscription_plan || "FREE",
      supporter_badge: data.supporter_badge ?? null,
    });
  };

  const checkSession = async () => {
    try {
      const storedToken = await getStoredToken();

      if (!storedToken) {
        setUser(null);
        setToken(null);
        return;
      }

      const data = await apiFetch("/auth/me", {
        token: storedToken,
      });

      if (data?.user_id) {
        setToken(storedToken);
        setUserFromResponse(data);
        return;
      }

      await removeToken();
      setUser(null);
    } catch (error) {
      console.error("Error checking session:", error);
      await removeToken();
      setUser(null);
    }
  };

  useEffect(() => {
    try {
      configureGoogleSignIn();
    } catch (e) {
      console.error("Google Sign-In config error:", e);
    }

    const init = async () => {
      try {
        await checkSession();
      } catch (e) {
        console.error("Auth init error:", e);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const login = async () => {
    try {
      setLoading(true);

      const idToken = await getGoogleIdToken();

      const data = await apiFetch("/auth/google", {
        method: "POST",
        body: {
          id_token: idToken,
        },
      });

      if (!data?.session_token) {
        throw new Error("Backend did not return session_token");
      }

      await saveToken(data.session_token);
      setUserFromResponse(data);
    } catch (error: any) {
      if (error?.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log("Google Sign-In cancelled");
      } else if (error?.code === statusCodes.IN_PROGRESS) {
        console.log("Google Sign-In already in progress");
      } else if (error?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        console.error("Google Play Services not available");
      } else if (
        error?.code === "10" ||
        String(error?.message).includes("DEVELOPER_ERROR")
      ) {
        console.error(
          "Google Sign-In Android OAuth belum cocok dengan APK ini. Development build wajib terdaftar sebagai package com.autodatacraft.boncos.dev dengan SHA-1 15:14:E3:78:75:40:94:ED:AB:FE:9E:DE:AA:12:6C:84:4D:80:63:85, lalu APK harus dibuild ulang."
        );
      } else {
        console.error("Login error:", error);
      }

      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);

      try {
        await apiFetch("/auth/logout", {
          method: "POST",
          token,
        });
      } catch {
        // ignore backend logout failure
      }

      try {
        await GoogleSignin.signOut();
      } catch {
        // ignore Google logout failure
      }

      await removeToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, token }}>
      {children}
    </AuthContext.Provider>
  );
}
