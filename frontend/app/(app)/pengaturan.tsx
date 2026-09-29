import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { colors, radius, spacing } from "@/src/theme";
import { Card, PrimaryButton, SectionHeader } from "@/src/components/ui";

export default function Pengaturan() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}><Icon name="arrow-left" size={22} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Pengaturan</Text>
          <Text style={styles.sub}>Profil dan preferensi</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 24, gap: spacing.md }}>
        <Card>
          <SectionHeader title="Profil" />
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <View style={styles.avatar}><Icon name="account" size={28} color={colors.onBrandPrimary} /></View>
            <View>
              <Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: "800" }}>{user?.name}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{user?.email}</Text>
            </View>
          </View>
        </Card>
        <Card>
          <SectionHeader title="Aplikasi" />
          <View style={{ gap: 8 }}>
            <View style={styles.row}><Icon name="theme-light-dark" size={20} color={colors.brandPrimary} /><Text style={styles.rowText}>Tema</Text><Text style={styles.rowVal}>Gelap</Text></View>
            <View style={styles.row}><Icon name="translate" size={20} color={colors.info} /><Text style={styles.rowText}>Bahasa</Text><Text style={styles.rowVal}>Indonesia</Text></View>
            <View style={styles.row}><Icon name="currency-usd" size={20} color={colors.success} /><Text style={styles.rowText}>Mata Uang</Text><Text style={styles.rowVal}>IDR</Text></View>
          </View>
        </Card>
        <PrimaryButton label="Keluar" onPress={logout} icon="logout" testID="settings-logout" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  title: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
  sub: { color: colors.muted, fontSize: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowText: { color: colors.onSurface, fontSize: 14, fontWeight: "600", flex: 1 },
  rowVal: { color: colors.muted, fontSize: 13 },
});
