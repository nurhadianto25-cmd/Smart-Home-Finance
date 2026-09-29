import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Icon from "@react-native-vector-icons/material-design-icons";
import { colors, radius, spacing } from "@/src/theme";

export function StatCard({
  label, value, icon, tone = "brand", delta, testID,
}: {
  label: string; value: string; icon: string; tone?: "success" | "error" | "info" | "brand" | "warning";
  delta?: string; testID?: string;
}) {
  const tint = { success: colors.success, error: colors.error, info: colors.info, brand: colors.brandPrimary, warning: colors.warning }[tone];
  return (
    <View style={styles.statCard} testID={testID}>
      <View style={[styles.iconCircle, { backgroundColor: `${tint}22`, borderColor: `${tint}55` }]}>
        <Icon name={icon as any} size={20} color={tint} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: tone === "brand" ? colors.onSurface : tint }]} numberOfLines={1}>{value}</Text>
      {delta ? <Text style={styles.statDelta}>{delta}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right}
    </View>
  );
}

export function PillButton({
  label, active, onPress, testID,
}: { label: string; active?: boolean; onPress: () => void; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        active && styles.pillActive,
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function PrimaryButton({
  label, onPress, disabled, testID, icon,
}: { label: string; onPress: () => void; disabled?: boolean; testID?: string; icon?: string }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryBtn,
        pressed && { opacity: 0.85 },
        disabled && { opacity: 0.5 },
      ]}
    >
      {icon ? <Icon name={icon as any} size={18} color={colors.onBrandPrimary} /> : null}
      <Text style={styles.primaryBtnText}>{label}</Text>
    </Pressable>
  );
}

export function ProgressBar({ value, color = colors.success, height = 6 }: { value: number; color?: string; height?: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={[styles.pbTrack, { height, borderRadius: height / 2 }]}>
      <View style={{ height, width: `${pct}%`, backgroundColor: color, borderRadius: height / 2 }} />
    </View>
  );
}

export function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon as any} size={36} color={colors.brandPrimary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint ? <Text style={styles.emptyHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  statCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    minWidth: 150,
    flex: 1,
  },
  iconCircle: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center", borderWidth: 1,
  },
  statLabel: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  statValue: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
  statDelta: { color: colors.muted, fontSize: 11 },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  sectionTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
  pill: {
    height: 36, paddingHorizontal: 14, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1, borderColor: colors.border,
    flexShrink: 0,
  },
  pillActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  pillText: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  pillTextActive: { color: colors.onBrandPrimary, fontWeight: "700" },
  primaryBtn: {
    backgroundColor: colors.brandPrimary,
    height: 52, borderRadius: radius.md,
    alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 8,
  },
  primaryBtnText: { color: colors.onBrandPrimary, fontSize: 15, fontWeight: "700" },
  pbTrack: { width: "100%", backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  empty: {
    alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md,
  },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: `${colors.brandPrimary}22`,
    borderWidth: 1, borderColor: `${colors.brandPrimary}44`,
    alignItems: "center", justifyContent: "center",
  },
  emptyTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "700", textAlign: "center" },
  emptyHint: { color: colors.muted, fontSize: 13, textAlign: "center" },
});
