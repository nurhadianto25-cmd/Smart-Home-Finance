import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { api, idr } from "@/src/api";
import { useAuth } from "@/src/auth";
import { usePrefs } from "@/src/prefs";
import { localeTag } from "@/src/i18n";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { EmptyState } from "@/src/components/ui";
import { DonutChart, LineDualChart, ProgressRing } from "@/src/components/charts";

const CAT_COLORS = ["#F7C948", "#FF9D3D", "#FF4757", "#10D96A", "#3D7EFF", "#9B6BFF"];

function Glossy({ grad, icon, size = 48, iconSize = 24, rad = 16, style }: any) {
  return (
    <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ width: size, height: size, borderRadius: rad, alignItems: "center", justifyContent: "center" }, style]}>
      <Icon name={icon} size={iconSize} color="#FFFFFF" />
    </LinearGradient>
  );
}

function iconForBill(name: string): { icon: string; grad: string[] } {
  const s = (name || "").toLowerCase();
  if (/listrik|pln|internet|wifi|indihome/.test(s)) return { icon: "flash", grad: ["#FF9D3D", "#F7742F"] };
  if (/air|pdam|galon/.test(s)) return { icon: "water", grad: ["#3D7EFF", "#2A5FD6"] };
  if (/spp|sekolah|pendidikan|kampus/.test(s)) return { icon: "school", grad: ["#9B6BFF", "#7C4DFF"] };
  if (/belanja|cart|bulanan/.test(s)) return { icon: "cart", grad: ["#10D96A", "#0BB457"] };
  if (/mobil|motor|kendaraan|cicilan/.test(s)) return { icon: "car", grad: ["#3D7EFF", "#2A5FD6"] };
  return { icon: "receipt", grad: ["#8B9DA5", "#6B7A82"] };
}

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { colors, scheme } = useTheme();
  const { t } = usePrefs();
  const styles = useStyles();
  const [data, setData] = useState<any>(null);
  const [insight, setInsight] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [month, setMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });

  const load = useCallback(async () => {
    try { setData(await api<any>(`/dashboard/summary?month=${month}`)); } catch { /* noop */ }
  }, [month]);
  const loadInsight = useCallback(async () => {
    setInsight(null);
    try { const r = await api<{ insight: string }>(`/insights/generate?month=${month}`); setInsight(r.insight); } catch { /* noop */ }
  }, [month]);
  useEffect(() => { load(); loadInsight(); }, [load, loadInsight]);

  const shiftMonth = (delta: number) => {
    const y = Number(month.slice(0, 4)); const m = Number(month.slice(5, 7));
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const monthLabel = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1).toLocaleDateString(localeTag(), { month: "long", year: "numeric" });
  const today = new Date().toLocaleDateString(localeTag(), { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase();

  const onRefresh = async () => { setRefreshing(true); await Promise.all([load(), loadInsight()]); setRefreshing(false); };

  const cats = (data?.expense_by_category || []).slice(0, 6);
  const cf = data?.cashflow || [];
  const prev = cf[cf.length - 2] || { income: 0, expense: 0 };
  const pct = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : a > 0 ? 100 : 0);
  const income = data?.income ?? 0;
  const expense = data?.expense ?? 0;
  const balance = data?.balance ?? 0;
  const savingRate = data?.saving_rate ?? 0;
  const health = data?.health_score ?? 0;
  const incomeDelta = pct(income, prev.income);
  const expenseDelta = pct(expense, prev.expense);
  const healthColor = health >= 60 ? colors.success : health >= 30 ? colors.warning : colors.error;

  const statCards = [
    { key: "income", label: "PEMASUKAN", value: idr(income), icon: "arrow-up-bold", grad: ["#13E07A", "#0BA85A"], tint: colors.success, delta: `${incomeDelta >= 0 ? "↑" : "↓"} ${Math.abs(incomeDelta)}% dari bulan lalu`, deltaUp: incomeDelta >= 0 },
    { key: "expense", label: "PENGELUARAN", value: idr(expense), icon: "arrow-down-bold", grad: ["#FF5B69", "#E23544"], tint: colors.error, delta: `${expenseDelta <= 0 ? "↓" : "↑"} ${Math.abs(expenseDelta)}% dari bulan lalu`, deltaUp: expenseDelta <= 0 },
    { key: "diff", label: "SELISIH", value: idr(balance), icon: "swap-vertical-bold", grad: ["#4A8CFF", "#2A5FD6"], tint: colors.info, delta: balance >= 0 ? "Surplus" : "Defisit", deltaUp: balance >= 0 },
    { key: "rate", label: "SAVING RATE", value: `${savingRate}%`, icon: "chart-line-variant", grad: ["#A77BFF", "#7C4DFF"], tint: colors.brandPrimary, delta: savingRate >= 20 ? "Baik 👍" : "Perlu perbaikan", deltaUp: savingRate >= 20 },
  ];

  const checks = [
    { ok: income > expense, text: "Pemasukan lebih besar dari pengeluaran" },
    { ok: savingRate >= 20, text: "Saving rate berada pada level yang baik" },
    { ok: health >= 60, text: "Pengeluaran rutin masih terkendali" },
  ];

  const upcoming = (data?.upcoming_bills || []) as any[];
  const within14 = upcoming.filter((b) => b.days_left >= 0 && b.days_left <= 14).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120, paddingHorizontal: spacing.lg, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
      >
        {/* ---------- HEADER ---------- */}
        <View style={styles.headerRow}>
          <Pressable testID="dashboard-avatar" onPress={() => router.push("/(app)/pengaturan")} style={styles.avatarWrap}>
            {user?.picture ? (
              <Image source={{ uri: user.picture }} style={styles.avatarImg} contentFit="cover" testID="dashboard-user-photo" />
            ) : (
              <Glossy grad={[colors.brandPrimary, colors.brandSecondary]} icon="account" size={46} iconSize={26} rad={23} />
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

        {/* ---------- BALANCE HERO ---------- */}
        <LinearGradient colors={scheme === "dark" ? ["#14244A", "#0B1324"] : ["#E8EEFF", "#FFFFFF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroGlow} pointerEvents="none" />
          {/* 3D house badge */}
          <View style={styles.houseWrap} pointerEvents="none">
            <LinearGradient colors={["#2A3E66", "#16233F"]} style={styles.housePlatform}>
              <Icon name="home-modern" size={38} color="#FFD37A" />
            </LinearGradient>
            <Icon name="pine-tree" size={16} color="#1EA860" style={{ position: "absolute", left: -4, bottom: 8 }} />
            <Icon name="pine-tree" size={12} color="#17894D" style={{ position: "absolute", right: -2, bottom: 6 }} />
          </View>

          <Glossy grad={[colors.brandSecondary, "#2A5FD6"]} icon="wallet" size={54} iconSize={26} rad={18} style={styles.walletBadge} />
          <Text style={styles.heroLabel}>FINANCIAL BALANCE</Text>
          <Text style={[styles.heroAmount, { color: (data?.cumulative_balance ?? 0) >= 0 ? colors.success : colors.error, textShadowColor: (data?.cumulative_balance ?? 0) >= 0 ? "rgba(16,217,106,0.55)" : "rgba(255,71,87,0.5)" }]} testID="dashboard-balance">
            {idr(data?.cumulative_balance ?? 0)}
          </Text>
          <Text style={styles.heroSub}>SALDO BERSIH</Text>

          <View style={styles.statGrid}>
            {statCards.map((s) => (
              <View key={s.key} style={styles.statCard} testID={`hero-stat-${s.key}`}>
                <Glossy grad={s.grad} icon={s.icon} size={34} iconSize={17} rad={11} style={styles.statIcon} />
                <Text style={styles.statLabel}>{s.label}</Text>
                <Text style={[styles.statVal, { color: s.tint }]} numberOfLines={1}>{s.value}</Text>
                <Text style={[styles.statDelta, { color: s.deltaUp ? colors.success : colors.error }]} numberOfLines={1}>{s.delta}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* ---------- FINANCIAL HEALTH ---------- */}
        <View style={styles.panel}>
          <View style={styles.panelHead}><Text style={styles.panelTitle}>FINANCIAL HEALTH</Text></View>
          <View style={{ alignItems: "center", marginTop: spacing.sm }}>
            <View style={{ width: 160, height: 160, alignItems: "center", justifyContent: "center" }}>
              <ProgressRing value={health} size={160} thickness={16} color={healthColor} />
              <View style={styles.ringCenter} pointerEvents="none">
                <Text style={[styles.healthScore, { textShadowColor: `${healthColor}88` }]}>{health}</Text>
                <Text style={styles.healthOf}>/ 100</Text>
                <Text style={[styles.healthState, { color: healthColor }]}>{health >= 60 ? "KEUANGAN SEHAT" : health >= 30 ? "PERLU PERHATIAN" : "BELUM ADA DATA"}</Text>
              </View>
              <View style={[styles.heartBadge, { borderColor: `${healthColor}66` }]}>
                <Icon name="heart-pulse" size={16} color={healthColor} />
              </View>
            </View>
          </View>
          <Text style={styles.healthDesc}>
            {health >= 60 ? "Keuangan Anda dalam kondisi sehat." : health >= 30 ? t("healthWarn") : t("healthNone")}
          </Text>
          <View style={{ gap: 8, marginTop: spacing.sm }}>
            {checks.map((c, i) => (
              <View key={i} style={styles.checkRow}>
                <Icon name={c.ok ? "check-circle" : "circle-outline"} size={17} color={c.ok ? colors.success : colors.muted} />
                <Text style={[styles.checkText, { color: c.ok ? colors.onSurface : colors.muted }]}>{c.text}</Text>
              </View>
            ))}
          </View>
          <Pressable onPress={() => router.push("/(app)/analisis")} style={styles.ctaRow} testID="see-analysis">
            <Text style={styles.ctaText}>Lihat Analisis Lengkap</Text>
            <Icon name="arrow-right" size={18} color={colors.brandPrimary} />
          </Pressable>
        </View>

        {/* ---------- EXPENSE DISTRIBUTION ---------- */}
        <View style={styles.panel}>
          <View style={styles.panelHead}><Text style={styles.panelTitle}>EXPENSE DISTRIBUTION</Text></View>
          {cats.length === 0 ? (
            <EmptyState icon="chart-donut" title={t("noExpense")} hint={t("noExpenseHint")} />
          ) : (
            <>
              <View style={{ flexDirection: "row", gap: spacing.lg, alignItems: "center", marginTop: spacing.sm }}>
                <View style={{ width: 132, height: 132, alignItems: "center", justifyContent: "center" }}>
                  <DonutChart data={cats.map((c: any, i: number) => ({ value: c.amount, color: CAT_COLORS[i % CAT_COLORS.length] }))} size={132} thickness={26} />
                  <View style={styles.donutHole} pointerEvents="none" />
                </View>
                <View style={{ flex: 1, gap: 10 }}>
                  {cats.map((c: any, i: number) => (
                    <View key={c.category} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }} />
                      <Text style={styles.legendCat} numberOfLines={1}>{c.category}</Text>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.legendPct}>{c.percent}%</Text>
                        <Text style={styles.legendAmt}>{idr(c.amount)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
              <Pressable onPress={() => router.push("/(app)/analisis")} style={styles.ctaRow} testID="see-expense-detail">
                <Text style={styles.ctaText}>Lihat Detail</Text>
                <Icon name="arrow-right" size={18} color={colors.brandPrimary} />
              </Pressable>
            </>
          )}
        </View>

        {/* ---------- CASH FLOW ---------- */}
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>CASH FLOW ANALYTICS</Text>
          <Text style={styles.panelSub}>Pemasukan vs Pengeluaran · {t("sixMonths")}</Text>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
            <View style={[styles.pillTag, { backgroundColor: `${colors.success}1F` }]}><View style={[styles.dot, { backgroundColor: colors.success }]} /><Text style={[styles.pillTagText, { color: colors.success }]}>{idr(income)}</Text></View>
            <View style={[styles.pillTag, { backgroundColor: `${colors.error}1F` }]}><View style={[styles.dot, { backgroundColor: colors.error }]} /><Text style={[styles.pillTagText, { color: colors.error }]}>{idr(expense)}</Text></View>
          </View>
          <View style={{ alignItems: "center", marginTop: 8 }}>
            <LineDualChart
              income={cf.map((c: any) => c.income)}
              expense={cf.map((c: any) => c.expense)}
              labels={cf.map((c: any) => c.month.slice(5))}
              width={300}
              height={170}
            />
          </View>
        </View>

        {/* ---------- KEWAJIBAN BULANAN ---------- */}
        <View style={styles.panel}>
          <Text style={[styles.panelTitle, { textAlign: "center" }]}>KEWAJIBAN BULANAN</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
            {[
              { k: "tagihan", label: "TAGIHAN", icon: "receipt-text", grad: ["#4A8CFF", "#2A5FD6"] },
              { k: "pendidikan", label: "PENDIDIKAN", icon: "school", grad: ["#A77BFF", "#7C4DFF"] },
              { k: "belanja", label: "BELANJA", icon: "cart", grad: ["#FFB44A", "#F7742F"] },
            ].map((o) => {
              const ob = data?.obligations?.[o.k] || { total: 0, count: 0 };
              return (
                <View key={o.k} style={styles.obliCard} testID={`obli-${o.k}`}>
                  <Glossy grad={o.grad} icon={o.icon} size={40} iconSize={19} rad={13} style={styles.obliIcon} />
                  <Text style={styles.obliLabel}>{o.label}</Text>
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
            <View style={styles.commitIcon}><Icon name="wallet-plus" size={22} color="#FFFFFF" /></View>
          </LinearGradient>
        </View>

        {/* ---------- PEMBAYARAN TERDEKAT ---------- */}
        <View style={styles.panel}>
          <Text style={[styles.panelTitle, { textAlign: "center" }]}>PEMBAYARAN TERDEKAT</Text>
          {upcoming.length === 0 ? (
            <EmptyState icon="calendar-check" title={t("noUpcoming")} />
          ) : (
            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              {upcoming.slice(0, 3).map((b: any) => {
                const v = iconForBill(b.name);
                return (
                  <View key={b.bill_id} style={styles.payRow}>
                    <Glossy grad={v.grad} icon={v.icon} size={40} iconSize={19} rad={13} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.payName} numberOfLines={1}>{b.name}</Text>
                      <Text style={styles.payDate}>{new Date(b.due_date).toLocaleDateString(localeTag(), { day: "numeric", month: "long" })}</Text>
                    </View>
                    <Text style={[styles.payAmount, { color: b.days_left < 0 ? colors.error : colors.onSurface }]}>{idr(b.amount)}</Text>
                  </View>
                );
              })}
              <Pressable onPress={() => router.push("/(app)/(tabs)/tagihan")} style={styles.payFooter} testID="see-all-bills">
                <Icon name="calendar-clock" size={16} color={colors.brandPrimary} />
                <Text style={styles.payFooterText}>{within14} pembayaran dalam 14 hari</Text>
                <Icon name="arrow-right" size={16} color={colors.brandPrimary} />
              </Pressable>
            </View>
          )}
        </View>

        {/* ---------- TARGET TABUNGAN ---------- */}
        <View style={styles.panel}>
          <Text style={[styles.panelTitle, { textAlign: "center" }]}>TARGET TABUNGAN</Text>
          {(data?.savings || []).length === 0 ? (
            <EmptyState icon="piggy-bank" title={t("noSavings")} hint={t("noSavingsHint")} />
          ) : (
            <View style={{ gap: spacing.md, marginTop: spacing.md }}>
              {(data?.savings || []).slice(0, 3).map((g: any) => {
                const p = g.target ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0;
                const col = g.color || colors.success;
                return (
                  <View key={g.goal_id} style={styles.saveRow}>
                    <View style={styles.jar}>
                      <LinearGradient colors={[`${col}FF`, `${col}99`]} style={{ width: "100%", height: `${p}%` }} />
                      <View style={styles.jarLid} />
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.saveName}>{g.name}</Text>
                      <Text style={styles.saveAmt}>{idr(g.saved)} / {idr(g.target)}</Text>
                      <View style={styles.saveTrack}><View style={{ height: 6, borderRadius: 3, width: `${p}%`, backgroundColor: col }} /></View>
                    </View>
                    <Text style={[styles.savePct, { color: col }]}>{p}%</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ---------- FINANCIAL INSIGHT ---------- */}
        <LinearGradient colors={scheme === "dark" ? ["#231A52", "#121033"] : ["#EDE9FF", "#F6F4FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.insightCard}>
          <View style={styles.insightGlow} pointerEvents="none" />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <Glossy grad={["#FFD54A", "#F7A825"]} icon="lightbulb-on" size={44} iconSize={22} rad={14} />
            <Text style={styles.insightTitle}>FINANCIAL INSIGHT</Text>
          </View>
          <Text style={styles.insightBody} testID="dashboard-insight">{insight ?? t("analyzing")}</Text>
          <Pressable onPress={() => router.push("/(app)/analisis")} style={styles.insightBtn} testID="see-all-insight">
            <Text style={styles.insightBtnText}>Lihat Semua Insight</Text>
            <Icon name="arrow-right" size={16} color="#FFFFFF" />
          </Pressable>
        </LinearGradient>

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
  avatarWrap: { width: 46, height: 46 },
  avatarImg: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surfaceTertiary },
  dateText: { color: colors.muted, fontSize: 10.5, fontWeight: "700", letterSpacing: 0.5 },
  welcome: { color: colors.muted, fontSize: 13, marginTop: 2 },
  name: { color: colors.onSurface, fontSize: 22, fontWeight: "800" },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 8, height: 46 },
  monthBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  monthLabel: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },

  // Hero
  hero: { borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: `${colors.brandSecondary}44`, alignItems: "center", gap: 4, overflow: "hidden" },
  heroGlow: { position: "absolute", width: 260, height: 260, borderRadius: 130, backgroundColor: "rgba(61,126,255,0.12)", top: -140, alignSelf: "center" },
  houseWrap: { position: "absolute", top: 14, right: 14, width: 74, height: 60, alignItems: "center", justifyContent: "center" },
  housePlatform: { width: 66, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", shadowColor: "#FFD37A", shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  walletBadge: { marginBottom: 6, shadowColor: colors.brandSecondary, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  heroLabel: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  heroAmount: { fontSize: 34, fontWeight: "900", textShadowRadius: 18, textShadowOffset: { width: 0, height: 0 } },
  heroSub: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.md, alignSelf: "stretch" },
  statCard: { flexBasis: "47%", flexGrow: 1, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 11, gap: 4 },
  statIcon: { shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  statLabel: { color: colors.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.3, marginTop: 2 },
  statVal: { fontSize: 15, fontWeight: "900" },
  statDelta: { fontSize: 9.5, fontWeight: "700" },

  // Panels
  panel: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  panelHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  panelTitle: { color: colors.onSurface, fontSize: 13, fontWeight: "800", letterSpacing: 0.6 },
  panelSub: { color: colors.muted, fontSize: 11.5, marginTop: 3 },

  ringCenter: { position: "absolute", alignItems: "center", justifyContent: "center" },
  healthScore: { color: colors.onSurface, fontSize: 44, fontWeight: "900", textShadowRadius: 16, textShadowOffset: { width: 0, height: 0 } },
  healthOf: { color: colors.muted, fontSize: 12, marginTop: -4 },
  healthState: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5, marginTop: 4 },
  heartBadge: { position: "absolute", top: 6, alignSelf: "center", width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceSecondary, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  healthDesc: { color: colors.onSurface, fontSize: 13.5, fontWeight: "600", marginTop: spacing.md },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkText: { fontSize: 12.5, flex: 1 },
  ctaRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, height: 46 },
  ctaText: { color: colors.brandPrimary, fontSize: 13.5, fontWeight: "700" },

  donutHole: { position: "absolute", width: 54, height: 54, borderRadius: 27, backgroundColor: colors.surfaceSecondary },
  legendCat: { color: colors.onSurface, fontSize: 12.5, flex: 1, fontWeight: "600" },
  legendPct: { color: colors.onSurface, fontSize: 13, fontWeight: "800" },
  legendAmt: { color: colors.muted, fontSize: 10.5 },

  pillTag: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, height: 26, borderRadius: radius.pill },
  pillTagText: { fontSize: 12, fontWeight: "800" },
  dot: { width: 8, height: 8, borderRadius: 4 },

  // Kewajiban
  obliCard: { flex: 1, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 10, alignItems: "center", gap: 4 },
  obliIcon: { shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  obliLabel: { color: colors.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.3, marginTop: 2 },
  obliVal: { color: colors.onSurface, fontSize: 13, fontWeight: "800" },
  obliCount: { color: colors.muted, fontSize: 10 },
  commitCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.md, shadowColor: colors.brandPrimary, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  commitLabel: { color: "#FFFFFF", fontSize: 10, fontWeight: "800", letterSpacing: 0.5, opacity: 0.92 },
  commitVal: { color: "#FFFFFF", fontSize: 22, fontWeight: "900", marginTop: 4 },
  commitIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },

  // Pembayaran
  payRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  payName: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  payDate: { color: colors.muted, fontSize: 11, marginTop: 2 },
  payAmount: { fontSize: 14, fontWeight: "800" },
  payFooter: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 6, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, height: 44 },
  payFooterText: { color: colors.brandPrimary, fontSize: 13, fontWeight: "700" },

  // Savings
  saveRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  jar: { width: 40, height: 52, borderRadius: 10, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surfaceTertiary, overflow: "hidden", justifyContent: "flex-end" },
  jarLid: { position: "absolute", top: -2, alignSelf: "center", width: 24, height: 5, borderRadius: 3, backgroundColor: colors.muted },
  saveName: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  saveAmt: { color: colors.muted, fontSize: 11.5 },
  saveTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  savePct: { fontSize: 18, fontWeight: "900" },

  // Insight
  insightCard: { borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: `${colors.brandPrimary}44`, overflow: "hidden" },
  insightGlow: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(155,107,255,0.14)", top: -90, right: -40 },
  insightTitle: { color: colors.onSurface, fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },
  insightBody: { color: colors.onSurface, fontSize: 13.5, lineHeight: 20, opacity: 0.92 },
  insightBtn: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, marginTop: spacing.md, backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingHorizontal: 16, height: 40 },
  insightBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },

  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: spacing.md },
}));
