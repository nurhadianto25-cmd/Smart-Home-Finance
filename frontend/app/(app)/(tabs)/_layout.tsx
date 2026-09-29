import React from "react";
import { Platform } from "react-native";
import { Tabs } from "expo-router";
import Icon from "@react-native-vector-icons/material-design-icons";
import { colors } from "@/src/theme";

export default function TabsLayout() {
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
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => <Icon name="view-dashboard" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="transaksi"
        options={{
          title: "Transaksi",
          tabBarIcon: ({ color, size }) => <Icon name="swap-horizontal" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tagihan"
        options={{
          title: "Tagihan",
          tabBarIcon: ({ color, size }) => <Icon name="receipt-text" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tabungan"
        options={{
          title: "Tabungan",
          tabBarIcon: ({ color, size }) => <Icon name="piggy-bank" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
