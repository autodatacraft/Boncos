import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { storage } from "@/src/utils/storage";
import { apiFetch } from "@/src/utils/api";

const TOKEN_KEY = "boncos_session_token";

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});

export default function Index() {
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    async function checkExistingSession() {
      try {
        const token = await storage.secureGet(TOKEN_KEY, "");

        if (!token) return;

        const data = await apiFetch("/auth/me", {
          token,
        });

        if ("error" in data) {
          await storage.secureRemove(TOKEN_KEY);
          return;
        }

        if (data?.user_id) {
          router.replace("/(tabs)/");
        }
      } catch (error) {
        console.error("SESSION CHECK ERROR:", error);
      } finally {
        setCheckingSession(false);
      }
    }

    checkExistingSession();
  }, []);

  async function handleLogin() {
    try {
      setLoading(true);

      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });

      const result = await GoogleSignin.signIn();
      const tokens = await GoogleSignin.getTokens();
      const idToken = result.data?.idToken || tokens.idToken;

      if (!idToken) {
        throw new Error("Google login berhasil, tapi idToken kosong.");
      }

      const data = await apiFetch("/auth/google", {
        method: "POST",
        body: {
          id_token: idToken,
        },
      });

      if ("error" in data) {
        throw new Error(data.error);
      }

      if (!data?.session_token) {
        throw new Error("Backend tidak mengembalikan session_token.");
      }

      await storage.secureSet(TOKEN_KEY, data.session_token);

      router.replace("/(tabs)/");
    } catch (error: any) {
      console.error("LOGIN ERROR:", error);
      Alert.alert(
        "Login gagal",
        error?.message || "Ada error waktu login Google."
      );
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#000",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color="#fff" />
        <Text style={{ color: "#aaa", marginTop: 16 }}>
          Ngecek dompet dulu...
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#000",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <Text
        style={{
          color: "white",
          fontSize: 36,
          fontWeight: "900",
          marginBottom: 8,
        }}
      >
        Boncos
      </Text>

      <Text
        style={{
          color: "#aaa",
          textAlign: "center",
          marginBottom: 32,
          fontSize: 16,
        }}
      >
        Cek dulu, hari ini masih aman nggak?
      </Text>

      <TouchableOpacity
        onPress={handleLogin}
        disabled={loading}
        style={{
          backgroundColor: loading ? "#777" : "white",
          paddingVertical: 14,
          paddingHorizontal: 28,
          borderRadius: 16,
          minWidth: 220,
        }}
      >
        <Text
          style={{
            color: "#000",
            fontWeight: "800",
            textAlign: "center",
            fontSize: 16,
          }}
        >
          {loading ? "Masuk..." : "Login with Google"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}