import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider } from "@/src/contexts/AuthContext";
import { ThemeProvider, useTheme } from "@/src/contexts/ThemeContext";
import { LanguageProvider } from "@/src/contexts/LanguageContext";

// Suppress Expo Go errors (font loading, notifications, etc.)
LogBox.ignoreLogs([
  'ExpoFontLoader',
  'Font file for',
  'Uncaught (in promise',
  'Call to function',
  'loadAsync',
  'expo-notifications',
  'Push notifications',
  'remote notifications',
  'Listening to push token',
  'shadow*',
  'props.pointerEvents',
]);

SplashScreen.preventAutoHideAsync();

function InnerLayout() {
  const { mode, colors } = useTheme();
  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade',
        }}
      />
    </>
  );
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <InnerLayout />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
