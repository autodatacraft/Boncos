import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useLanguage } from '@/src/contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';

export default function IndexScreen() {
  const { user, loading, login } = useAuth();
  const { colors, mode } = useTheme();
  const { s } = useLanguage();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && user) {
      router.replace('/(tabs)');
    }
  }, [loading, user]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.statusAman} />
      </View>
    );
  }

  if (user) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} testID="login-screen">
      <View style={styles.content}>
        {/* Logo area */}
        <View style={[styles.logoBox, { backgroundColor: colors.statusAman, borderColor: colors.border }]}>
          <Text style={[styles.logoText, { color: '#111' }]}>B</Text>
        </View>

        <Text style={[styles.appName, { color: colors.text }]}>{s('app_name')}</Text>
        <Text style={[styles.tagline, { color: colors.textSecondary }]}>{s('tagline')}</Text>

        {/* Status preview */}
        <View style={styles.statusRow}>
          {['🟢', '🟡', '🟠', '🔴'].map((dot, i) => (
            <View
              key={i}
              style={[
                styles.statusDot,
                {
                  backgroundColor: [
                    colors.statusAman,
                    colors.statusAgakPanas,
                    colors.statusRemDikit,
                    colors.statusBoncos,
                  ][i],
                  borderColor: colors.border,
                },
              ]}
            />
          ))}
        </View>

        {/* Google Login Button */}
        <TouchableOpacity
          testID="login-google-btn"
          style={[
            styles.loginBtn,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              shadowColor: colors.shadow,
            },
          ]}
          onPress={login}
          activeOpacity={0.8}
        >
          <Ionicons name="logo-google" size={22} color={colors.text} />
          <Text style={[styles.loginBtnText, { color: colors.text }]}>
            {s('login_google')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  logoBox: {
    width: 96,
    height: 96,
    borderRadius: 24,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  logoText: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -2,
  },
  appName: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -2,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 48,
  },
  statusDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    borderWidth: 3,
    width: '100%',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  loginBtnText: {
    fontSize: 17,
    fontWeight: '700',
  },
});
