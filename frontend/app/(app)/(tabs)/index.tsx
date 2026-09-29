import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { useRouter } from "expo-router";
import { api, idr } from "@/src/api";
import { useAuth } from "@/src/auth";
import { colors, radius, spacing } from "@/src/theme";
import { Card, EmptyState, ProgressBar, SectionHeader, StatCard } from "@/src/components/ui";
import { DonutChart, LineDualChart, ProgressRing } from "@/src/components/charts";

const CAT_COLORS = ["#3D7EFF", "#10D96A", "#FF9D3D", "#9B6BFF", "#FF4757", "#F7C948"];

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [data, setData] = useState<any>(null);
  const [insight, setInsight] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await api<any>("/dashboard/summary");
      setData(s);
    } catch (e) { /* noop */ }
  }, []);

  const loadInsight = useCallback(async () => {
    try {
      const r = await api<{ insight: string }>("/insights/generate");
      setInsight(r.insight);
    } catch { /* noop */ }
  }, []);

  useEffect(() => { load(); loadInsight(); }, [load, loadInsight]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), loadInsight()]);
    setRefreshing(false);
  };

  const today = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase();
  const cats = (data?.expense_by_category || []).slice(0, 6);
  const cf = data?.cashflow || [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: spacing.xl, paddingHorizontal: spacing.lg, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dateText}>{today}</Text>
            <Text style={styles.welcome}>Selamat datang,</Text>
            <Text style={styles.name} testID="dashboard-user-name">{user?.name ?? "Pengguna"} 👋</Text>
          </View>
          <Pressable testID="open-menu" onPress={() => router.push("/(app)/menu")} style={styles.iconBtn}>
            <Icon name="menu" size={22} color={colors.onSurface} />
          </Pressable>
        </View>

        {/* Balance hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}><Icon name="wallet" size={26} color={colors.onBrandPrimary} /></View>
          <Text style={styles.heroLabel}>FINANCIAL BALANCE</Text>
          <Text style={[styles.heroAmount, { color: (data?.balance ?? 0) >= 0 ? colors.success : colors.error }]} testID="dashboard-balance">
            {idr(data?.balance ?? 0)}
          </Text>
          <Text style={styles.heroSub}>Saldo bersih bulan ini</Text>
        </View>

        {/* Stats row */}
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <StatCard testID="stat-income" label="Pemasukan" value={idr(data?.income ?? 0)} icon="arrow-down-bold-circle" tone="success" />
          <StatCard testID="stat-expense" label="Pengeluaran" value={idr(data?.expense ?? 0)} icon="arrow-up-bold-circle" tone="error" />
        </View>
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <StatCard testID="stat-saving-rate" label="Saving Rate" value={`${data?.saving_rate ?? 0}%`} icon="chart-line-variant" tone="info" />
          <StatCard testID="stat-tx" label="Transaksi" value={String(data?.tx_count ?? 0)} icon="format-list-bulleted" tone="brand" />
        </View>

        {/* Financial Health */}
        <Card>
          <SectionHeader title="Financial Health" />
          <View style={styles.healthRow}>
            <View style={{ alignItems: "center", justifyContent: "center" }}>
              <ProgressRing value={data?.health_score ?? 0} size={140} thickness={14} color={(data?.health_score ?? 0) >= 60 ? colors.success : (data?.health_score ?? 0) >= 30 ? colors.warning : colors.error} />
              <View style={styles.healthCenter} pointerEvents="none">
                <Text style={styles.healthScore}>{data?.health_score ?? 0}</Text>
                <Text style={styles.healthOf}>/ 100</Text>
              </View>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.healthLabel}>Skor keuangan</Text>
              <Text style={styles.healthDesc}>
                {(data?.health_score ?? 0) >= 60
                  ? "Keuangan Anda dalam kondisi sehat."
                  : (data?.health_score ?? 0) >= 30
                  ? "Perlu perhatian pada pengeluaran."
                  : "Belum ada cukup data untuk skor."}
              </Text>
            </View>
          </View>
        </Card>

        {/* Expense distribution */}
        <Card>
          <SectionHeader title="Distribusi Pengeluaran" />
          {cats.length === 0 ? (
            <EmptyState icon="chart-donut" title="Belum ada pengeluaran" hint="Tambahkan transaksi pengeluaran untuk melihat distribusi." />
          ) : (
            <View style={{ flexDirection: "row", gap: spacing.lg, alignItems: "center" }}>
              <DonutChart data={cats.map((c: any, i: number) => ({ value: c.amount, color: CAT_COLORS[i % CAT_COLORS.length] }))} />
              <View style={{ flex: 1, gap: 8 }}>
                {cats.map((c: any, i: number) => (
                  <View key={c.category} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }} />
                    <Text style={{ color: colors.onSurface, fontSize: 12, flex: 1 }} numberOfLines={1}>{c.category}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{c.percent}%</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </Card>

        {/* Cashflow */}
        <Card>
          <SectionHeader title="Cash Flow" right={<Text style={styles.subLabel}>6 Bulan</Text>} />
          <View style={{ alignItems: "center" }}>
            <LineDualChart
              income={cf.map((c: any) => c.income)}
              expense={cf.map((c: any) => c.expense)}
              labels={cf.map((c: any) => c.month.slice(5))}
              width={300}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 16, justifyContent: "center", marginTop: 8 }}>
            <View style={styles.legend}><View style={[styles.dot, { backgroundColor: colors.success }]} /><Text style={styles.legendText}>Pemasukan</Text></View>
            <View style={styles.legend}><View style={[styles.dot, { backgroundColor: colors.error }]} /><Text style={styles.legendText}>Pengeluaran</Text></View>
          </View>
        </Card>

        {/* Upcoming bills */}
        <Card>
          <SectionHeader title="Pembayaran Terdekat" right={
            <Pressable onPress={() => router.push("/(app)/(tabs)/tagihan")} testID="see-all-bills"><Text style={styles.subLabel}>Lihat Semua ›</Text></Pressable>
          }/>
          {(data?.upcoming_bills || []).length === 0 ? (
            <EmptyState icon="calendar-check" title="Tidak ada tagihan mendatang" />
          ) : (
            <View style={{ gap: spacing.sm }}>
              {(data?.upcoming_bills || []).map((b: any) => (
                <View key={b.bill_id} style={styles.billRow}>
                  <View style={[styles.billIcon, { backgroundColor: `${colors.info}22`, borderColor: `${colors.info}55` }]}>
                    <Icon name="flash" size={18} color={colors.info} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.billName}>{b.name}</Text>
                    <Text style={styles.billDate}>{b.days_left >= 0 ? `${b.days_left} hari lagi` : `Terlambat ${Math.abs(b.days_left)} hari`}</Text>
                  </View>
                  <Text style={[styles.billAmount, { color: b.days_left < 0 ? colors.error : colors.onSurface }]}>{idr(b.amount)}</Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* Savings goals */}
        <Card>
          <SectionHeader title="Target Tabungan" right={
            <Pressable onPress={() => router.push("/(app)/(tabs)/tabungan")} testID="see-all-savings"><Text style={styles.subLabel}>Lihat Semua ›</Text></Pressable>
          }/>
          {(data?.savings || []).length === 0 ? (
            <EmptyState icon="piggy-bank" title="Belum ada target tabungan" hint="Buat target menabung dari menu Tabungan." />
          ) : (
            <View style={{ gap: spacing.md }}>
              {(data?.savings || []).slice(0, 3).map((g: any) => {
                const pct = g.target ? Math.min(100, (g.saved / g.target) * 100) : 0;
                return (
                  <View key={g.goal_id} style={{ gap: 6 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ color: colors.onSurface, fontWeight: "700" }}>{g.name}</Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>{idr(g.saved)} / {idr(g.target)}</Text>
                    </View>
                    <ProgressBar value={pct} color={g.color || colors.success} />
                    <Text style={{ color: colors.muted, fontSize: 11 }}>{pct.toFixed(0)}%</Text>
                  </View>
                );
              })}
            </View>
          )}
        </Card>

        {/* AI Insight */}
        <Card style={{ borderColor: `${colors.brandPrimary}55` }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <View style={[styles.billIcon, { backgroundColor: `${colors.brandPrimary}22`, borderColor: `${colors.brandPrimary}55` }]}>
              <Icon name="lightbulb-on" size={18} color={colors.brandPrimary} />
            </View>
            <Text style={{ color: colors.onSurface, fontWeight: "800", fontSize: 15 }}>Financial Insight</Text>
          </View>
          <Text style={{ color: colors.muted, lineHeight: 20 }} testID="dashboard-insight">
            {insight ?? "Menganalisis data keuangan Anda..."}
          </Text>
        </Card>

        <Pressable onPress={logout} style={styles.logoutBtn} testID="dashboard-logout">
          <Icon name="logout" size={18} color={colors.error} />
          <Text style={{ color: colors.error, fontWeight: "700" }}>Keluar</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  dateText: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  welcome: { color: colors.muted, fontSize: 13, marginTop: 2 },
  name: { color: colors.onSurface, fontSize: 22, fontWeight: "800" },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  hero: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl,
    borderWidth: 1, borderColor: `${colors.brandPrimary}55`, alignItems: "center", gap: 6,
  },
  heroIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.info, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  heroLabel: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  heroAmount: { fontSize: 30, fontWeight: "800" },
  heroSub: { color: colors.muted, fontSize: 12 },
  healthRow: { flexDirection: "row", gap: spacing.lg, alignItems: "center" },
  healthCenter: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  healthScore: { color: colors.onSurface, fontSize: 34, fontWeight: "800" },
  healthOf: { color: colors.muted, fontSize: 12 },
  healthLabel: { color: colors.muted, fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  healthDesc: { color: colors.onSurface, fontSize: 13, lineHeight: 20 },
  subLabel: { color: colors.brandPrimary, fontSize: 12, fontWeight: "700" },
  legend: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: colors.muted, fontSize: 11 },
  billRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  billIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  billName: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  billDate: { color: colors.muted, fontSize: 11 },
  billAmount: { fontSize: 14, fontWeight: "800" },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: spacing.md, marginTop: spacing.md },
});
