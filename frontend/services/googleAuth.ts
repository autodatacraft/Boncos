import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import Constants from "expo-constants";

function getGoogleWebClientId() {
  const extra = (Constants.expoConfig?.extra ??
    Constants.manifest2?.extra ??
    {}) as Record<string, unknown>;
  const clientId =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    extra?.googleWebClientId;

  return typeof clientId === "string" ? clientId.trim() : "";
}

let configured = false;

export function configureGoogleSignIn() {
  const googleWebClientId = getGoogleWebClientId();

  if (!googleWebClientId) {
    throw new Error(
      "Google Web Client ID belum kebaca. Isi EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID atau expo.extra.googleWebClientId, lalu rebuild APK."
    );
  }

  if (configured) return;

  GoogleSignin.configure({
    webClientId: googleWebClientId,
    scopes: ["openid", "email", "profile"],
    offlineAccess: false,
    forceCodeForRefreshToken: false,
  });

  configured = true;
}

export async function getGoogleIdToken() {
  configureGoogleSignIn();

  await GoogleSignin.hasPlayServices({
    showPlayServicesUpdateDialog: true,
  });

  const result = await GoogleSignin.signIn();

  if (result.type === "cancelled") {
    const error = new Error("Login Google dibatalkan.");
    Object.assign(error, { code: statusCodes.SIGN_IN_CANCELLED });
    throw error;
  }

  const signInIdToken = result.data?.idToken;
  if (signInIdToken) return signInIdToken;

  try {
    const tokens = await GoogleSignin.getTokens();
    if (tokens.idToken) return tokens.idToken;
  } catch {
    // Fall through to the current-user check below.
  }

  const currentUser = GoogleSignin.getCurrentUser();
  if (currentUser?.idToken) return currentUser.idToken;

  throw new Error(
    "Google login berhasil, tapi idToken kosong. Pastikan EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID memakai OAuth Client ID bertipe Web dan build app sudah memuat env terbaru."
  );
}
