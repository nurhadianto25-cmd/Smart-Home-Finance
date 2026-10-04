import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { makeStyles, useTheme } from "@/src/theme";

const CONFIG: Record<string, { label: string; icon: string }> = {
  index: { label: "Dashboard", icon: "view-dashboard" },
  transaksi: { label: "Transaksi", icon: "swap-horizontal" },
  belanja: { label: "Belanja", icon: "cart" },
  tagihan: { label: "Tagihan", icon: "receipt-text" },
  pendidikan: { label: "Pendidikan", icon: "school" },
  tabungan: { label: "Tabungan", icon: "piggy-bank" },
  laporan: { label: "Laporan", icon: "chart-box" },
  analisis: { label: "Analisis", icon: "chart-line" },
};

export function ScrollableTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom, height: 62 + insets.bottom }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {state.routes.map((route: any, i: number) => {
          const cfg = CONFIG[route.name];
          if (!cfg) return null;
          const focused = state.index === i;
          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <Pressable key={route.key} onPress={onPress} testID={`tab-${route.name}`} style={styles.item}>
              <View style={[styles.iconWrap, focused && { backgroundColor: `${colors.brandPrimary}1F` }]}>
                <Icon name={cfg.icon as any} size={22} color={focused ? colors.brandPrimary : colors.muted} />
              </View>
              <Text style={[styles.label, { color: focused ? colors.brandPrimary : colors.muted }]} numberOfLines={1}>{cfg.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  bar: { backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border },
  content: { paddingHorizontal: 6, alignItems: "center" },
  item: { width: 74, height: 60, alignItems: "center", justifyContent: "center", gap: 3 },
  iconWrap: { width: 42, height: 30, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 10, fontWeight: "700" },
}));
