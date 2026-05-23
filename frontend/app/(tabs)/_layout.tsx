import React from 'react';
import { Tabs } from 'expo-router';
import { Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useLanguage } from '@/src/contexts/LanguageContext';
import { useAuth } from '@/src/contexts/AuthContext';
import { Redirect } from 'expo-router';

// Use emoji fallbacks since Ionicons font may fail on Expo Go
const TAB_ICONS: Record<string, string> = {
  home: '🏠',
  history: '📋',
  settings: '⚙️',
};

function TabIcon({ name, color, focused }: { name: string; color: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.6 }}>
      {TAB_ICONS[name] || '•'}
    </Text>
  );
}

export default function TabLayout() {
  const { colors } = useTheme();
  const { s } = useLanguage();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.statusAman} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 2,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.statusAman,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: s('tab_home'),
          tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: s('tab_history'),
          tabBarIcon: ({ color, focused }) => <TabIcon name="history" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: s('tab_settings'),
          tabBarIcon: ({ color, focused }) => <TabIcon name="settings" color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
