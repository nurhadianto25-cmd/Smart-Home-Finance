import React from "react";
import { Platform } from "react-native";
import { Tabs } from "expo-router";
import Icon from "@react-native-vector-icons/material-design-icons";
import { useTheme } from "@/src/theme";
import { usePrefs } from "@/src/prefs";

export default function TabsLayout() {
  const { colors } = useTheme();
  const { t } = usePrefs();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("dashboard"),
          tabBarIcon: ({ color, size }) => <Icon name="view-dashboard" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="transaksi"
        options={{
          title: t("transactions"),
          tabBarIcon: ({ color, size }) => <Icon name="swap-horizontal" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tagihan"
        options={{
          title: t("bills"),
          tabBarIcon: ({ color, size }) => <Icon name="receipt-text" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="pendidikan"
        options={{
          title: t("education"),
          tabBarIcon: ({ color, size }) => <Icon name="school" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
