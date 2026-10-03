import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { api, idr } from "@/src/api";
import { useAuth } from "@/src/auth";
import { usePrefs } from "@/src/prefs";
import { localeTag } from "@/src/i18n";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Card, EmptyState, ProgressBar, SectionHeader } from "@/src/components/ui";
import { DonutChart, LineDualChart, ProgressRing } from "@/src/components/charts";
import { LinearGradient } from "expo-linear-gradient";

const CAT_COLORS = ["#3D7EFF", "#10D96A", "#FF9D3D", "#9B6BFF", "#FF4757", "#F7C948"];

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const { t } = usePrefs();
  const styles = useStyles();
  const [data, setData] = useState<any>(null);
  const [insight, setInsight] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [month, setMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });

  const load = useCallback(async () => {
    try {
      const s = await api<any>(`/dashboard/summary?month=${month}`);
      setData(s);
    } catch (e) { /* noop */ }
  }, [month]);

  const loadInsight = useCallback(async () => {
    setInsight(null);
    try {
      const r = await api<{ insight: string }>(`/insights/generate?month=${month}`);
      setInsight(r.insight);
    } catch { /* noop */ }
  }, [month]);

  useEffect(() => { load(); loadInsight(); }, [load, loadInsight]);

  const shiftMonth = (delta: number) => {
    const y = Number(month.slice(0, 4));
    const m = Number(month.slice(5, 7));
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const monthLabel = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1)
    .toLocaleDateString(localeTag(), { month: "long", year: "numeric" });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), loadInsight()]);
    setRefreshing(false);
  };

  const today = new Date().toLocaleDateString(localeTag(), { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase();
  const cats = (data?.expense_by_category || []).slice(0, 6);
  const cf = data?.cashflow || [];
  const heroStats = [
    { key: "income", label: t("income"), value: idr(data?.income ?? 0), icon: "arrow-down-bold-circle", color: colors.success },
    { key: "expense", label: t("expense"), value: idr(data?.expense ?? 0), icon: "arrow-up-bold-circle", color: colors.error },
    { key: "diff", label: t("difference"), value: idr(data?.balance ?? 0), icon: "swap-vertical-bold", color: colors.info },
    { key: "rate", label: t("savingRate"), value: `${data?.saving_rate ?? 0}%`, icon: "chart-line-variant", color: colors.brandPrimary },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: spacing.xl, paddingHorizontal: spacing.lg, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
      >
        <View style={styles.headerRow}>
          <Pressable testID="dashboard-avatar" onPress={() => router.push("/(app)/pengaturan")} style={styles.avatarWrap}>
            {user?.picture ? (
              <Image source={{ uri: user.picture }} style={styles.avatarImg} contentFit="cover" testID="dashboard-user-photo" />
            ) : (
              <View style={styles.avatar}><Icon name="account" size={26} color={colors.onBrandPrimary} /></View>
            )}
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.dateText}>{today}</Text>
            <Text style={styles.welcome}>{t("welcome")}</Text>
            <Text style={styles.name} testID="dashboard-user-name">{user?.name ?? t("user")} 👋</Text>
          </View>
          <Pressable testID="open-menu" onPress={() => router.push("/(app)/menu")} style={styles.iconBtn}>
            <Icon name="menu" size={22} color={colors.onSurface} />
          </Pressable>
        </View>

        {/* Month navigator */}
        <View style={styles.monthNav}>
          <Pressable testID="dash-month-prev" onPress={() => shiftMonth(-1)} style={styles.monthBtn}><Icon name="chevron-left" size={20} color={colors.onSurface} /></Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Icon name="calendar-month" size={16} color={colors.brandPrimary} />
            <Text style={styles.monthLabel} testID="dash-month-label">{monthLabel}</Text>
          </View>
          <Pressable testID="dash-month-next" onPress={() => shiftMonth(1)} style={styles.monthBtn}><Icon name="chevron-right" size={20} color={colors.onSurface} /></Pressable>
        </View>

        {/* Balance hero */}
        <LinearGradient colors={[`${colors.brandSecondary}2E`, colors.surfaceSecondary, colors.surfaceSecondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={[styles.houseGlow, { pointerEvents: "none" }]}>
            <Icon name="home-city" size={56} color={colors.brandSecondary} />
          </View>
          <View style={styles.heroIcon}><Icon name="wallet" size={24} color={colors.onBrandPrimary} /></View>
          <Text style={styles.heroLabel}>FINANCIAL BALANCE</Text>
          <Text style={[styles.heroAmount, { color: (data?.cumulative_balance ?? 0) >= 0 ? colors.success : colors.error }]} testID="dashboard-balance">
            {idr(data?.cumulative_balance ?? 0)}
          </Text>
          <Text style={styles.heroSub}>{t("runningBalanceSub")}</Text>
          <View style={styles.statGrid}>
            {heroStats.map((s) => (
              <View key={s.key} style={styles.statPill} testID={`hero-stat-${s.key}`}>
                <View style={[styles.statPillIcon, { backgroundColor: `${s.color}22`, borderColor: `${s.color}55` }]}>
                  <Icon name={s.icon as any} size={15} color={s.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statPillLabel}>{s.label.toUpperCase()}</Text>
                  <Text style={[styles.statPillVal, { color: s.color }]} numberOfLines={1}>{s.value}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroRow}>
            <View style={styles.heroCol}>
              <Text style={styles.heroColLabel}>{t("openingBalance")}</Text>
              <Text style={styles.heroColVal} testID="dashboard-opening">{idr(data?.opening_balance ?? 0)}</Text>
            </View>
            <View style={styles.heroColDiv} />
            <View style={styles.heroCol}>
              <Text style={styles.heroColLabel}>{t("netThisMonth")}</Text>
              <Text style={[styles.heroColVal, { color: (data?.balance ?? 0) >= 0 ? colors.success : colors.error }]} testID="dashboard-net-month">{idr(data?.balance ?? 0)}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Kewajiban Bulanan */}
        <Card>
          <SectionHeader title="Kewajiban Bulanan" />
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {[
              { k: "tagihan", label: "Tagihan", icon: "receipt-text", color: colors.info },
              { k: "pendidikan", label: "Pendidikan", icon: "school", color: colors.brandPrimary },
              { k: "belanja", label: "Belanja", icon: "cart", color: colors.warning },
            ].map((o) => {
              const ob = data?.obligations?.[o.k] || { total: 0, count: 0 };
              return (
                <View key={o.k} style={styles.obliCard} testID={`obli-${o.k}`}>
                  <View style={[styles.obliIcon, { backgroundColor: `${o.color}22`, borderColor: `${o.color}55` }]}><Icon name={o.icon as any} size={18} color={o.color} /></View>
                  <Text style={styles.obliLabel}>{o.label.toUpperCase()}</Text>
                  <Text style={styles.obliVal} numberOfLines={1}>{idr(ob.total)}</Text>
                  <Text style={styles.obliCount}>{ob.count} item</Text>
                </View>
              );
            })}
          </View>
          <LinearGradient colors={[colors.brandPrimary, colors.brandSecondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.commitCard}>
            <View>
              <Text style={styles.commitLabel}>TOTAL KOMITMEN BULANAN</Text>
              <Text style={styles.commitVal} testID="dashboard-commitment">{idr(data?.obligations?.total_commitment ?? 0)}</Text>
            </View>
            <View style={styles.commitIcon}><Icon name="wallet-plus" size={22} color={colors.onBrandPrimary} /></View>
          </LinearGradient>
        </Card>

        {/* Financial Health */}
        <Card>
          <SectionHeader title={t("financialHealth")} />
          <View style={styles.healthRow}>
            <View style={{ alignItems: "center", justifyContent: "center" }}>
              <ProgressRing value={data?.health_score ?? 0} size={140} thickness={14} color={(data?.health_score ?? 0) >= 60 ? colors.success : (data?.health_score ?? 0) >= 30 ? colors.warning : colors.error} />
              <View style={styles.healthCenter} pointerEvents="none">
                <Text style={styles.healthScore}>{data?.health_score ?? 0}</Text>
                <Text style={styles.healthOf}>/ 100</Text>
              </View>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.healthLabel}>{t("scoreLabel")}</Text>
              <Text style={styles.healthDesc}>
                {(data?.health_score ?? 0) >= 60
                  ? t("healthGood")
                  : (data?.health_score ?? 0) >= 30
                  ? t("healthWarn")
                  : t("healthNone")}
              </Text>
            </View>
          </View>
        </Card>

        {/* Expense distribution */}
        <Card>
          <SectionHeader title={t("expenseDistribution")} />
          {cats.length === 0 ? (
            <EmptyState icon="chart-donut" title={t("noExpense")} hint={t("noExpenseHint")} />
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
          <SectionHeader title={t("cashflow")} right={<Text style={styles.subLabel}>{t("sixMonths")}</Text>} />
          <View style={{ alignItems: "center" }}>
            <LineDualChart
              income={cf.map((c: any) => c.income)}
              expense={cf.map((c: any) => c.expense)}
              labels={cf.map((c: any) => c.month.slice(5))}
              width={300}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 16, justifyContent: "center", marginTop: 8 }}>
            <View style={styles.legend}><View style={[styles.dot, { backgroundColor: colors.success }]} /><Text style={styles.legendText}>{t("income")}</Text></View>
            <View style={styles.legend}><View style={[styles.dot, { backgroundColor: colors.error }]} /><Text style={styles.legendText}>{t("expense")}</Text></View>
          </View>
        </Card>

        {/* Upcoming bills */}
        <Card>
          <SectionHeader title={t("upcomingPayments")} right={
            <Pressable onPress={() => router.push("/(app)/(tabs)/tagihan")} testID="see-all-bills"><Text style={styles.subLabel}>{t("seeAll")}</Text></Pressable>
          }/>
          {(data?.upcoming_bills || []).length === 0 ? (
            <EmptyState icon="calendar-check" title={t("noUpcoming")} />
          ) : (
            <View style={{ gap: spacing.sm }}>
              {(data?.upcoming_bills || []).map((b: any) => (
                <View key={b.bill_id} style={styles.billRow}>
                  <View style={[styles.billIcon, { backgroundColor: `${colors.info}22`, borderColor: `${colors.info}55` }]}>
                    <Icon name="flash" size={18} color={colors.info} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.billName}>{b.name}</Text>
                    <Text style={styles.billDate}>{b.days_left >= 0 ? `${b.days_left} ${t("daysLeft")}` : `${t("overdue")} ${Math.abs(b.days_left)} ${t("days")}`}</Text>
                  </View>
                  <Text style={[styles.billAmount, { color: b.days_left < 0 ? colors.error : colors.onSurface }]}>{idr(b.amount)}</Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* Savings goals */}
        <Card>
          <SectionHeader title={t("savingsTarget")} right={
            <Pressable onPress={() => router.push("/(app)/(tabs)/tabungan")} testID="see-all-savings"><Text style={styles.subLabel}>{t("seeAll")}</Text></Pressable>
          }/>
          {(data?.savings || []).length === 0 ? (
            <EmptyState icon="piggy-bank" title={t("noSavings")} hint={t("noSavingsHint")} />
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
            <Text style={{ color: colors.onSurface, fontWeight: "800", fontSize: 15 }}>{t("financialInsight")}</Text>
          </View>
          <Text style={{ color: colors.muted, lineHeight: 20 }} testID="dashboard-insight">
            {insight ?? t("analyzing")}
          </Text>
        </Card>

        <Pressable onPress={logout} style={styles.logoutBtn} testID="dashboard-logout">
          <Icon name="logout" size={18} color={colors.error} />
          <Text style={{ color: colors.error, fontWeight: "700" }}>{t("logout")}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatarWrap: { width: 44, height: 44 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  avatarImg: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceTertiary },
  dateText: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  welcome: { color: colors.muted, fontSize: 13, marginTop: 2 },
  name: { color: colors.onSurface, fontSize: 22, fontWeight: "800" },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 8, height: 46 },
  monthBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  monthLabel: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
  hero: {
    borderRadius: radius.lg, padding: spacing.xl,
    borderWidth: 1, borderColor: `${colors.brandPrimary}55`, alignItems: "center", gap: 6, overflow: "hidden",
  },
  houseGlow: { position: "absolute", top: 8, right: 10 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.md, alignSelf: "stretch" },
  statPill: { flexBasis: "47%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 10 },
  statPillIcon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  statPillLabel: { color: colors.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.3 },
  statPillVal: { fontSize: 13, fontWeight: "800", marginTop: 1 },
  obliCard: { flex: 1, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 10, alignItems: "center", gap: 4 },
  obliIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  obliLabel: { color: colors.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.3 },
  obliVal: { color: colors.onSurface, fontSize: 13, fontWeight: "800" },
  obliCount: { color: colors.muted, fontSize: 10 },
  commitCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.md },
  commitLabel: { color: colors.onBrandPrimary, fontSize: 10, fontWeight: "800", letterSpacing: 0.5, opacity: 0.92 },
  commitVal: { color: colors.onBrandPrimary, fontSize: 22, fontWeight: "900", marginTop: 4 },
  commitIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  heroIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.info, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  heroLabel: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  heroAmount: { fontSize: 30, fontWeight: "800" },
  heroSub: { color: colors.muted, fontSize: 12 },
  heroDivider: { height: 1, alignSelf: "stretch", backgroundColor: colors.border, marginTop: spacing.md },
  heroRow: { flexDirection: "row", alignSelf: "stretch", marginTop: spacing.md },
  heroCol: { flex: 1, alignItems: "center", gap: 4 },
  heroColDiv: { width: 1, backgroundColor: colors.border },
  heroColLabel: { color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 0.3, textTransform: "uppercase", textAlign: "center" },
  heroColVal: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
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
}));
