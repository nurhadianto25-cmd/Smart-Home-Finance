import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { usePrefs } from "@/src/prefs";
import { colors as C, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const ITEMS = [
  { name: "Dashboard", labelKey: "dashboard", icon: "view-dashboard", route: "/(app)/(tabs)", color: C.brandPrimary },
  { name: "Transaksi", labelKey: "transactions", icon: "swap-horizontal", route: "/(app)/(tabs)/transaksi", color: C.info },
  { name: "Tagihan", labelKey: "billsLong", icon: "receipt-text", route: "/(app)/(tabs)/tagihan", color: C.warning },
  { name: "Pendidikan", labelKey: "education", icon: "school", route: "/(app)/(tabs)/pendidikan", color: C.brandPrimary },
  { name: "Tabungan", labelKey: "savings", icon: "piggy-bank", route: "/(app)/tabungan", color: C.success },
  { name: "Belanja", labelKey: "shopping", icon: "cart", route: "/(app)/belanja", color: C.brandSecondary },
  { name: "Laporan", labelKey: "reports", icon: "file-chart", route: "/(app)/laporan", color: C.info },
  { name: "Analisis", labelKey: "analysis", icon: "chart-bar", route: "/(app)/analisis", color: C.brandPrimary },
  { name: "Pengaturan", labelKey: "settings", icon: "cog", route: "/(app)/pengaturan", color: C.muted },
] as const;

export default function Menu() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const { t } = usePrefs();
  const styles = useStyles();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="close-menu">
          <Icon name="close" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>{t("menu")}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + 24 }}>
        <View style={styles.userCard}>
          <View style={styles.avatar}><Icon name="account" size={28} color={colors.onBrandPrimary} /></View>
          <View>
            <Text style={styles.userName}>{user?.name}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
        </View>
        {ITEMS.map(it => (
          <Pressable
            key={it.name}
            testID={`menu-${it.name}`}
            onPress={() => { router.back(); setTimeout(() => router.push(it.route as any), 50); }}
            style={({ pressed }) => [styles.item, pressed && { opacity: 0.8 }]}
          >
            <View style={[styles.itemIcon, { backgroundColor: `${it.color}22`, borderColor: `${it.color}55` }]}>
              <Icon name={it.icon as any} size={22} color={it.color} />
            </View>
            <Text style={styles.itemText}>{t(it.labelKey)}</Text>
            <Icon name="chevron-right" size={22} color={colors.muted} />
          </Pressable>
        ))}
        <Pressable testID="menu-logout" onPress={async () => { await logout(); }} style={[styles.item, { borderColor: `${colors.error}55` }]}>
          <View style={[styles.itemIcon, { backgroundColor: `${colors.error}22`, borderColor: `${colors.error}55` }]}>
            <Icon name="logout" size={22} color={colors.error} />
          </View>
          <Text style={[styles.itemText, { color: colors.error }]}>{t("logout")}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md },
  title: { color: colors.onSurface, fontSize: 18, fontWeight: "800", flex: 1, textAlign: "center" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  userCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  userName: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
  userEmail: { color: colors.muted, fontSize: 12 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  itemIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  itemText: { flex: 1, color: colors.onSurface, fontSize: 15, fontWeight: "700" },
}));
