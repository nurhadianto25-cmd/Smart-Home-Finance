import React from "react";
import { Tabs } from "expo-router";
import { ScrollableTabBar } from "@/src/components/scrollable-tabbar";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <ScrollableTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="transaksi" />
      <Tabs.Screen name="belanja" />
      <Tabs.Screen name="tagihan" />
      <Tabs.Screen name="pendidikan" />
      <Tabs.Screen name="tabungan" />
      <Tabs.Screen name="laporan" />
      <Tabs.Screen name="analisis" />
    </Tabs>
  );
}
