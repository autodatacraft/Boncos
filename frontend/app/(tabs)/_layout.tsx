import React from "react";
import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useTheme } from "@/src/contexts/ThemeContext";
import { useLanguage } from "@/src/contexts/LanguageContext";
import { t } from "@/src/utils/i18n";

const TAB_ICONS: Record<string, string> = {
  home: "🏠",
  history: "📋",
  settings: "⚙️",
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.6 }}>
      {TAB_ICONS[name] || "•"}
    </Text>
  );
}

export default function TabLayout() {
  const { colors } = useTheme();
  const { s, lang } = useLanguage();
console.log("CURRENT LANG:", lang);
  console.log("RAW TAB HOME:", s("tab_home"));
  console.log("RAW T OBJECT:", t.tab_home);


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
        tabBarLabelStyle: { fontSize: 12, fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: s("tab_home"),
          tabBarIcon: ({ focused }) => (
            <TabIcon name="home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: s("tab_history"),
          tabBarIcon: ({ focused }) => (
            <TabIcon name="history" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: s("tab_settings"),
          tabBarIcon: ({ focused }) => (
            <TabIcon name="settings" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}