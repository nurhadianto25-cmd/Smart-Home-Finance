import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, TextInput, Modal, KeyboardAvoidingView, Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Icon from "@react-native-vector-icons/material-design-icons";
import { api, idr } from "@/src/api";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { EmptyState, PrimaryButton, ProgressBar } from "@/src/components/ui";
import { DonutChart, ProgressRing, SavingsLineChart } from "@/src/components/charts";
import { useConfirm } from "@/src/confirm";
import { localeTag } from "@/src/i18n";

const HERO_IMG = require("../../assets/images/savings/hero.png");
const ASSET: Record<string, any> = {
  shield: require("../../assets/images/savings/shield.png"),
  vacation: require("../../assets/images/savings/vacation.png"),
  education: require("../../assets/images/savings/education.png"),
  car: require("../../assets/images/savings/car.png"),
  house: require("../../assets/images/savings/house.png"),
  piggy: require("../../assets/images/savings/piggy.png"),
  target: require("../../assets/images/savings/target.png"),
};

const GOAL_TYPES = [
  { key: "shield", label: "Dana Darurat", color: "#10D96A" },
  { key: "vacation", label: "Liburan", color: "#3D7EFF" },
  { key: "education", label: "Pendidikan", color: "#9B6BFF" },
  { key: "car", label: "Kendaraan", color: "#FF9D3D" },
  { key: "house", label: "Rumah", color: "#FF4757" },
  { key: "piggy", label: "Umum", color: "#F7C948" },
];
const assetFor = (icon?: string) => ASSET[icon || "piggy"] || ASSET.piggy;

function monthKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function addMonth(key: string, delta: number) {
  const y = Number(key.slice(0, 4)); const m = Number(key.slice(5, 7)) - 1;
  const d = new Date(y, m + delta, 1);
  return monthKey(d);
}
function shortMonth(key: string) {
  const d = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1);
  return d.toLocaleDateString(localeTag(), { month: "short" });
}

type Goal = { goal_id: string; name: string; target: number; saved: number; color?: string; icon?: string; monthly?: number; note?: string; auto_saved?: number };

export default function Tabungan() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, scheme } = useTheme();
  const styles = useStyles();
  const confirm = useConfirm();
  const { width } = useWindowDimensions();

  const [items, setItems] = useState<Goal[]>([]);
  const [txs, setTxs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [month, setMonth] = useState(monthKey());
  const [depTab, setDepTab] = useState<"terakhir" | "rutin">("terakhir");

  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<Goal | null>(null);
  const [form, setForm] = useState({ name: "", type: "shield", target: "", saved: "", monthly: "", note: "", color: GOAL_TYPES[0].color });

  const load = useCallback(async () => {
    try {
      const [s, t] = await Promise.all([api<Goal[]>("/savings"), api<any[]>("/transactions").catch(() => [])]);
      setItems(s); setTxs(Array.isArray(t) ? t : []);
    } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEdit(null); setForm({ name: "", type: "shield", target: "", saved: "", monthly: "", note: "", color: GOAL_TYPES[0].color }); setModal(true); };
  const openEdit = (g: Goal) => {
    setEdit(g);
    setForm({ name: g.name, type: g.icon || "piggy", target: String(g.target), saved: String(g.saved), monthly: String(g.monthly || ""), note: g.note || "", color: g.color || GOAL_TYPES[0].color });
    setModal(true);
  };
  const submit = async () => {
    if (!form.name || !form.target) return;
    const body = {
      name: form.name, target: parseFloat(form.target || "0"), saved: parseFloat(form.saved || "0"),
      color: form.color, icon: form.type, monthly: parseFloat(form.monthly || "0"), note: form.note,
    };
    try {
      if (edit) await api(`/savings/${edit.goal_id}`, { method: "PUT", body: JSON.stringify(body) });
      else await api("/savings", { method: "POST", body: JSON.stringify(body) });
      setModal(false); load();
    } catch {}
  };
  const del = async (g: Goal) => {
    const ok = await confirm({ title: "Hapus Target", message: `Hapus target "${g.name}"?`, danger: true });
    if (!ok) return;
    try { await api(`/savings/${g.goal_id}`, { method: "DELETE" }); load(); } catch {}
  };

  // ---------- derived ----------
  const goalById = useMemo(() => Object.fromEntries(items.map((g) => [g.goal_id, g])), [items]);
  const savingsTx = useMemo(
    () => txs.filter((t) => t.link_type === "savings").map((t) => ({ ...t, m: String(t.date || t.created_at || "").slice(0, 7) })),
    [txs],
  );
  const totalTarget = items.reduce((s, g) => s + (g.target || 0), 0);
  const totalSaved = items.reduce((s, g) => s + (g.saved || 0), 0);
  const overall = totalTarget ? (totalSaved / totalTarget) * 100 : 0;
  const doneCount = items.filter((g) => g.target > 0 && g.saved >= g.target).length;
  const activeCount = items.length - doneCount;

  const depThis = savingsTx.filter((t) => t.m === month).reduce((s, t) => s + (t.amount || 0), 0);
  const prevMonth = addMonth(month, -1);
  const depPrev = savingsTx.filter((t) => t.m === prevMonth).reduce((s, t) => s + (t.amount || 0), 0);
  const depDelta = depPrev > 0 ? ((depThis - depPrev) / depPrev) * 100 : depThis > 0 ? 100 : 0;

  const months6 = useMemo(() => Array.from({ length: 6 }, (_, i) => addMonth(month, -(5 - i))), [month]);
  const growth = useMemo(
    () => months6.map((m) => savingsTx.filter((t) => t.m <= m).reduce((s, t) => s + (t.amount || 0), 0)),
    [months6, savingsTx],
  );
  const growthLabels = months6.map(shortMonth);

  const dist = useMemo(() => {
    const arr = [...items].filter((g) => g.saved > 0).sort((a, b) => b.saved - a.saved);
    return arr.map((g) => ({ name: g.name, value: g.saved, color: g.color || colors.brandPrimary, pct: totalSaved ? (g.saved / totalSaved) * 100 : 0 }));
  }, [items, totalSaved, colors.brandPrimary]);

  const deposits = useMemo(
    () => [...savingsTx].sort((a, b) => String(b.date || b.created_at).localeCompare(String(a.date || a.created_at))).slice(0, 8),
    [savingsTx],
  );
  const rutin = items.filter((g) => (g.monthly || 0) > 0);

  const insights = useMemo(() => {
    const out: { icon: string; tone: string; text: string }[] = [];
    if (depThis > 0 || depPrev > 0) {
      const up = depDelta >= 0;
      out.push({ icon: up ? "trending-up" : "trending-down", tone: up ? colors.success : colors.error, text: `Setoran bulan ini ${up ? "naik" : "turun"} ${Math.abs(depDelta).toFixed(0)}% dibanding bulan lalu.` });
    }
    const remain = Math.max(0, totalTarget - totalSaved);
    if (remain > 0) out.push({ icon: "target", tone: colors.brandPrimary, text: `Sisakan ${idr(Math.round(remain / 12))}/bulan untuk capai semua target dalam 12 bulan.` });
    const firstOpen = items.find((g) => g.saved < g.target && (g.monthly || 0) > 0);
    if (firstOpen) {
      const mNeed = Math.ceil((firstOpen.target - firstOpen.saved) / (firstOpen.monthly || 1));
      const done = addMonth(month, mNeed);
      const lbl = new Date(Number(done.slice(0, 4)), Number(done.slice(5, 7)) - 1, 1).toLocaleDateString(localeTag(), { month: "long", year: "numeric" });
      out.push({ icon: "clock-outline", tone: colors.warning, text: `"${firstOpen.name}" diperkirakan tercapai pada ${lbl}.` });
    }
    if (!out.length) out.push({ icon: "lightbulb-on", tone: colors.brandPrimary, text: "Mulai menabung dan alokasikan transaksi ke target untuk melihat insight." });
    return out;
  }, [depThis, depPrev, depDelta, totalTarget, totalSaved, items, month, colors]);

  const monthLabel = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1).toLocaleDateString(localeTag(), { month: "long", year: "numeric" });
  const today = new Date().toLocaleDateString(localeTag(), { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase();
  const chartW = width - spacing.lg * 2 - spacing.lg * 2;

  const monthsLeft = (g: Goal) => {
    if (!(g.monthly && g.monthly > 0)) return null;
    const left = Math.max(0, g.target - g.saved);
    if (left <= 0) return "Tercapai";
    return `${Math.ceil(left / g.monthly)} bulan lagi`;
  };

  const stats = [
    { key: "total", label: "TOTAL TABUNGAN", value: idr(totalSaved), sub: "Dari semua target", tint: colors.brandPrimary, grad: ["#A77BFF", "#7C4DFF"] as const, icon: "safe" },
    { key: "aktif", label: "TARGET AKTIF", value: `${activeCount} Target`, sub: "Sedang berjalan", tint: colors.success, grad: ["#13E07A", "#0BA85A"] as const, icon: "bullseye-arrow" },
    { key: "setoran", label: "SETORAN BULAN INI", value: idr(depThis), sub: `${depDelta >= 0 ? "▲" : "▼"} ${Math.abs(depDelta).toFixed(0)}% dari bulan lalu`, tint: colors.info, grad: ["#4A8CFF", "#2A5FD6"] as const, icon: "cash-plus" },
    { key: "tercapai", label: "TARGET TERCAPAI", value: `${doneCount} Target`, sub: `${items.length ? Math.round((doneCount / items.length) * 100) : 0}% dari total`, tint: colors.warning, grad: ["#FFB44A", "#F7742F"] as const, icon: "trophy" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brandPrimary} />}
      >
        {/* ---------------- HERO ---------------- */}
        <LinearGradient colors={scheme === "dark" ? ["#2A1E63", "#140E33", "#0A0E1A"] : ["#E9E2FF", "#F4F0FF", "#FFFFFF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + 12 }]}>
          <View style={styles.heroGlow} pointerEvents="none" />
          <View style={styles.heroTop}>
            <Pressable testID="tabungan-back" onPress={() => router.back()} hitSlop={8} style={styles.circleBtn}><Icon name="chevron-left" size={24} color="#FFFFFF" /></Pressable>
            <View style={styles.monthPill}>
              <Pressable testID="sav-month-prev" onPress={() => setMonth((m) => addMonth(m, -1))} hitSlop={8} style={styles.monthArrow}><Icon name="chevron-left" size={18} color="#FFFFFF" /></Pressable>
              <Text style={styles.monthPillText} testID="sav-month-label">{monthLabel}</Text>
              <Pressable testID="sav-month-next" onPress={() => setMonth((m) => addMonth(m, 1))} hitSlop={8} style={styles.monthArrow}><Icon name="chevron-right" size={18} color="#FFFFFF" /></Pressable>
            </View>
          </View>
          <Text style={styles.heroDate}>{today}</Text>
          <View style={styles.heroBody}>
            <View style={{ flex: 1, paddingRight: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={styles.heroTitle}>Tabungan</Text>
                <Icon name="diamond-stone" size={22} color="#B79BFF" />
              </View>
              <Text style={styles.heroSub}>Wujudkan tujuan keuangan Anda dengan disiplin menabung.</Text>
            </View>
            <Image source={HERO_IMG} style={styles.heroImg} contentFit="contain" testID="tabungan-hero-img" />
          </View>
        </LinearGradient>

        {/* ---------------- STATS ---------------- */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
          {stats.map((s) => (
            <LinearGradient key={s.key} testID={`sav-stat-${s.key}`} colors={[`${s.tint}26`, scheme === "dark" ? "rgba(18,24,43,0.92)" : "#FFFFFF"]} start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 1 }} style={[styles.statCard, { borderColor: `${s.tint}55` }]}>
              {s.key === "tercapai" ? (
                <View style={styles.statRing}>
                  <ProgressRing value={overall} size={40} thickness={5} color={colors.brandPrimary} />
                  <View style={styles.statRingInner}><Text style={styles.statRingText}>{overall.toFixed(0)}%</Text></View>
                </View>
              ) : (
                <LinearGradient colors={s.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statIcon}><Icon name={s.icon as any} size={18} color="#FFFFFF" /></LinearGradient>
              )}
              <Text style={styles.statLabel} numberOfLines={1}>{s.label}</Text>
              <Text style={[styles.statVal, { color: s.tint }]} numberOfLines={1}>{s.value}</Text>
              <Text style={styles.statSub} numberOfLines={1}>{s.sub}</Text>
            </LinearGradient>
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg, marginTop: spacing.lg }}>
          {/* ---------------- GOALS ---------------- */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Target Tabungan</Text>
            <Pressable testID="add-goal" onPress={openAdd} style={styles.addBtn}><Icon name="plus" size={16} color="#FFFFFF" /><Text style={styles.addBtnText}>Tambah Target</Text></Pressable>
          </View>

          {items.length === 0 ? (
            <EmptyState icon="piggy-bank" title="Belum ada target" hint="Buat target menabung pertama Anda dengan tombol Tambah Target." />
          ) : items.map((g) => {
            const pct = g.target ? Math.min(100, (g.saved / g.target) * 100) : 0;
            const left = monthsLeft(g);
            const col = g.color || colors.brandPrimary;
            return (
              <View key={g.goal_id} style={styles.goalCard} testID={`goal-${g.goal_id}`}>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <LinearGradient colors={[`${col}2E`, `${col}10`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.goalIconTile, { borderColor: `${col}55` }]}>
                    <Image source={assetFor(g.icon)} style={styles.goalIconImg} contentFit="contain" />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.goalName} numberOfLines={1}>{g.name}</Text>
                        {g.note ? <Text style={styles.goalNote} numberOfLines={1}>{g.note}</Text> : null}
                      </View>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        <Pressable onPress={() => openEdit(g)} style={styles.iconBtn} testID={`edit-goal-${g.goal_id}`}><Icon name="pencil" size={15} color={colors.info} /></Pressable>
                        <Pressable onPress={() => del(g)} style={styles.iconBtn} testID={`del-goal-${g.goal_id}`}><Icon name="trash-can-outline" size={15} color={colors.error} /></Pressable>
                      </View>
                    </View>
                    <View style={styles.goalAmtRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.goalAmtLabel}>Terkumpul</Text>
                        <Text style={[styles.goalAmtVal, { color: col }]} numberOfLines={1}>{idr(g.saved)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.goalAmtLabel}>Target</Text>
                        <Text style={styles.goalAmtVal} numberOfLines={1}>{idr(g.target)}</Text>
                      </View>
                    </View>
                  </View>
                </View>
                <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ flex: 1 }}><ProgressBar value={pct} color={col} height={8} /></View>
                  <Text style={[styles.goalPct, { color: col }]}>{pct.toFixed(1)}%</Text>
                </View>
                {left ? (
                  <View style={styles.leftBadge}><Icon name="calendar-clock" size={12} color={colors.muted} /><Text style={styles.leftBadgeText}>{left}</Text></View>
                ) : null}
              </View>
            );
          })}

          {/* ---------------- GROWTH ---------------- */}
          {items.length > 0 ? (
            <View style={styles.card}>
              <View style={styles.sectionRow}>
                <Text style={styles.cardTitle}>Perkembangan Tabungan</Text>
                <Text style={styles.cardHint}>6 Bulan Terakhir</Text>
              </View>
              <SavingsLineChart data={growth} labels={growthLabels} color={colors.brandPrimary} width={chartW} height={180} />
              <View style={styles.legendRow}><View style={[styles.dot, { backgroundColor: colors.brandPrimary }]} /><Text style={styles.legendText}>Total Terkumpul</Text></View>
            </View>
          ) : null}

          {/* ---------------- DISTRIBUTION ---------------- */}
          {dist.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Distribusi Target</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 12 }}>
                <View style={{ width: 130, height: 130, alignItems: "center", justifyContent: "center" }}>
                  <DonutChart data={dist.map((d) => ({ value: d.value, color: d.color }))} size={130} thickness={20} />
                  <View style={styles.donutCenter}>
                    <Text style={styles.donutCenterLabel}>Total</Text>
                    <Text style={styles.donutCenterVal} numberOfLines={1}>{idr(totalSaved)}</Text>
                  </View>
                </View>
                <View style={{ flex: 1, gap: 8 }}>
                  {dist.slice(0, 5).map((d) => (
                    <View key={d.name} style={styles.legendItem}>
                      <View style={[styles.dot, { backgroundColor: d.color }]} />
                      <Text style={styles.legendName} numberOfLines={1}>{d.name}</Text>
                      <Text style={styles.legendPct}>{d.pct.toFixed(1)}%</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          ) : null}

          {/* ---------------- INSIGHT ---------------- */}
          <View style={styles.card}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Icon name="lightbulb-on" size={18} color={colors.brandPrimary} />
              <Text style={styles.cardTitle}>Insight Tabungan</Text>
            </View>
            <View style={{ gap: 12 }}>
              {insights.map((ins, i) => (
                <View key={i} style={styles.insightRow}>
                  <View style={[styles.insightIcon, { backgroundColor: `${ins.tone}22`, borderColor: `${ins.tone}55` }]}><Icon name={ins.icon as any} size={16} color={ins.tone} /></View>
                  <Text style={styles.insightText}>{ins.text}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ---------------- MILESTONE ---------------- */}
          {items.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Milestone</Text>
              <View style={{ gap: 16, marginTop: 12 }}>
                {items.slice(0, 4).map((g) => {
                  const pct = g.target ? (g.saved / g.target) * 100 : 0;
                  return (
                    <View key={g.goal_id}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <Image source={assetFor(g.icon)} style={{ width: 20, height: 20 }} contentFit="contain" />
                        <Text style={styles.msName} numberOfLines={1}>{g.name}</Text>
                      </View>
                      <View style={styles.msRow}>
                        {[25, 50, 75, 100].map((mk) => {
                          const on = pct >= mk;
                          return (
                            <View key={mk} style={{ alignItems: "center", flex: 1 }}>
                              <View style={[styles.msDot, on ? { backgroundColor: g.color || colors.brandPrimary, borderColor: g.color || colors.brandPrimary } : {}]}>
                                <Icon name={on ? "check" : "circle-small"} size={on ? 13 : 16} color={on ? "#FFFFFF" : colors.muted} />
                              </View>
                              <Text style={[styles.msPct, on && { color: colors.onSurface }]}>{mk}%</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* ---------------- DEPOSITS ---------------- */}
          <View style={styles.card}>
            <View style={styles.depTabs}>
              <Pressable testID="dep-tab-terakhir" onPress={() => setDepTab("terakhir")} style={[styles.depTab, depTab === "terakhir" && styles.depTabActive]}>
                <Text style={[styles.depTabText, depTab === "terakhir" && styles.depTabTextActive]}>Setoran Terakhir</Text>
              </Pressable>
              <Pressable testID="dep-tab-rutin" onPress={() => setDepTab("rutin")} style={[styles.depTab, depTab === "rutin" && styles.depTabActive]}>
                <Text style={[styles.depTabText, depTab === "rutin" && styles.depTabTextActive]}>Tabungan Rutin</Text>
              </Pressable>
            </View>
            {depTab === "terakhir" ? (
              deposits.length === 0 ? (
                <Text style={styles.emptyLine}>Belum ada setoran. Catat transaksi & alokasikan ke target tabungan.</Text>
              ) : deposits.map((t, i) => {
                const g = goalById[t.link_id];
                return (
                  <View key={t.tx_id || i} style={styles.depRow}>
                    <Image source={assetFor(g?.icon)} style={styles.depIcon} contentFit="contain" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.depName} numberOfLines={1}>{g?.name || t.title || "Setoran"}</Text>
                      <Text style={styles.depDate}>{String(t.date || t.created_at).slice(0, 10)}</Text>
                    </View>
                    <Text style={[styles.depAmt, { color: colors.success }]}>{idr(t.amount)}</Text>
                  </View>
                );
              })
            ) : (
              rutin.length === 0 ? (
                <Text style={styles.emptyLine}>Belum ada target dengan setoran rutin. Isi "Setoran per bulan" saat menambah target.</Text>
              ) : rutin.map((g) => (
                <View key={g.goal_id} style={styles.depRow}>
                  <Image source={assetFor(g.icon)} style={styles.depIcon} contentFit="contain" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.depName} numberOfLines={1}>{g.name}</Text>
                    <Text style={styles.depDate}>Setiap bulan</Text>
                  </View>
                  <Text style={[styles.depAmt, { color: g.color || colors.brandPrimary }]}>{idr(g.monthly || 0)}</Text>
                </View>
              ))
            )}
          </View>

          {/* ---------------- HOW IT WORKS ---------------- */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Cara Kerja Tabungan</Text>
            <View style={{ gap: 12, marginTop: 12 }}>
              {[
                { n: 1, icon: "wallet", t: "Catat transaksi di menu Transaksi", s: "Pilih jenis transaksi pengeluaran." },
                { n: 2, icon: "bullseye-arrow", t: "Pilih target tabungan", s: "Alokasikan ke target yang ingin diisi." },
                { n: 3, icon: "chart-line", t: "Saldo otomatis bertambah", s: "Progress target diperbarui otomatis." },
                { n: 4, icon: "view-dashboard", t: "Dashboard & Laporan ikut update", s: "Keuangan selalu akurat dan tercatat." },
              ].map((st) => (
                <View key={st.n} style={styles.stepRow}>
                  <LinearGradient colors={["#A77BFF", "#7C4DFF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.stepNum}><Text style={styles.stepNumText}>{st.n}</Text></LinearGradient>
                  <View style={styles.stepIcon}><Icon name={st.icon as any} size={18} color={colors.brandPrimary} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepTitle}>{st.t}</Text>
                    <Text style={styles.stepSub}>{st.s}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ---------------- MODAL ---------------- */}
      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBg}>
          <View style={styles.modal}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={styles.modalTitle}>{edit ? "Edit Target" : "Target Baru"}</Text>
              <Pressable testID="goal-close" onPress={() => setModal(false)} style={styles.iconBtn}><Icon name="close" size={20} color={colors.onSurface} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 8 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Jenis Target</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 2 }}>
                {GOAL_TYPES.map((tp) => {
                  const on = form.type === tp.key;
                  return (
                    <Pressable key={tp.key} testID={`goal-type-${tp.key}`} onPress={() => setForm((f) => ({ ...f, type: tp.key, color: tp.color }))} style={[styles.typeChip, on && { borderColor: tp.color, backgroundColor: `${tp.color}1A` }]}>
                      <Image source={assetFor(tp.key)} style={styles.typeChipImg} contentFit="contain" />
                      <Text style={[styles.typeChipText, on && { color: colors.onSurface }]} numberOfLines={1}>{tp.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Text style={styles.label}>Nama Target</Text>
              <TextInput testID="goal-name" style={styles.input} value={form.name} onChangeText={(t) => setForm((f) => ({ ...f, name: t }))} placeholder="cth. Dana Darurat" placeholderTextColor={colors.muted} />
              <Text style={styles.label}>Deskripsi (opsional)</Text>
              <TextInput testID="goal-note" style={styles.input} value={form.note} onChangeText={(t) => setForm((f) => ({ ...f, note: t }))} placeholder="cth. Untuk kebutuhan mendesak" placeholderTextColor={colors.muted} />
              <Text style={styles.label}>Target (Rp)</Text>
              <TextInput testID="goal-target" style={styles.input} keyboardType="numeric" value={form.target} onChangeText={(t) => setForm((f) => ({ ...f, target: t.replace(/[^0-9]/g, "") }))} placeholder="0" placeholderTextColor={colors.muted} />
              <Text style={styles.label}>Sudah Terkumpul (Rp)</Text>
              <TextInput testID="goal-saved" style={styles.input} keyboardType="numeric" value={form.saved} onChangeText={(t) => setForm((f) => ({ ...f, saved: t.replace(/[^0-9]/g, "") }))} placeholder="0" placeholderTextColor={colors.muted} />
              <Text style={styles.label}>Setoran per Bulan (Rp)</Text>
              <TextInput testID="goal-monthly" style={styles.input} keyboardType="numeric" value={form.monthly} onChangeText={(t) => setForm((f) => ({ ...f, monthly: t.replace(/[^0-9]/g, "") }))} placeholder="0 (untuk estimasi bulan lagi)" placeholderTextColor={colors.muted} />
              <View style={{ marginTop: 6 }}>
                <PrimaryButton label={edit ? "Simpan Perubahan" : "Buat Target"} onPress={submit} testID="goal-submit" />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: "hidden" },
  heroGlow: { position: "absolute", top: -60, right: -40, width: 220, height: 220, borderRadius: 110, backgroundColor: "#7C4DFF", opacity: 0.25 },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  circleBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  monthPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: radius.pill, paddingHorizontal: 6, height: 38 },
  monthArrow: { width: 26, height: 26, alignItems: "center", justifyContent: "center" },
  monthPillText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700", minWidth: 96, textAlign: "center" },
  heroDate: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "700", letterSpacing: 0.5, marginTop: 14 },
  heroBody: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  heroTitle: { color: "#FFFFFF", fontSize: 30, fontWeight: "800" },
  heroSub: { color: "rgba(255,255,255,0.78)", fontSize: 12, marginTop: 6, lineHeight: 17 },
  heroImg: { width: 148, height: 108 },

  statCard: { width: 164, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, gap: 6 },
  statIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  statRing: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  statRingInner: { ...StyleSheetAbsoluteFill(), alignItems: "center", justifyContent: "center" },
  statRingText: { color: colors.onSurface, fontSize: 11, fontWeight: "800" },
  statLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  statVal: { fontSize: 19, fontWeight: "800" },
  statSub: { color: colors.muted, fontSize: 10 },

  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingHorizontal: 12, height: 34 },
  addBtnText: { color: colors.onBrandPrimary, fontSize: 12, fontWeight: "700" },

  goalCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  goalIconTile: { width: 64, height: 64, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  goalIconImg: { width: 54, height: 54 },
  goalName: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
  goalNote: { color: colors.muted, fontSize: 11, marginTop: 1 },
  goalAmtRow: { flexDirection: "row", marginTop: 8, gap: 8 },
  goalAmtLabel: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  goalAmtVal: { color: colors.onSurface, fontSize: 14, fontWeight: "800", marginTop: 1 },
  goalPct: { fontSize: 12, fontWeight: "800", minWidth: 44, textAlign: "right" },
  leftBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: 10, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  leftBadgeText: { color: colors.muted, fontSize: 11, fontWeight: "600" },

  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  cardTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
  cardHint: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  legendRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4 },
  legendText: { color: colors.muted, fontSize: 11 },
  dot: { width: 10, height: 10, borderRadius: 5 },

  donutCenter: { position: "absolute", alignItems: "center", justifyContent: "center" },
  donutCenterLabel: { color: colors.muted, fontSize: 9, fontWeight: "700" },
  donutCenterVal: { color: colors.onSurface, fontSize: 12, fontWeight: "800" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendName: { color: colors.onSurface, fontSize: 12, fontWeight: "600", flex: 1 },
  legendPct: { color: colors.muted, fontSize: 12, fontWeight: "700" },

  insightRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  insightIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  insightText: { color: colors.onSurfaceSecondary, fontSize: 12.5, flex: 1, lineHeight: 18 },

  msName: { color: colors.onSurface, fontSize: 13, fontWeight: "700", flex: 1 },
  msRow: { flexDirection: "row", alignItems: "center" },
  msDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  msPct: { color: colors.muted, fontSize: 10, fontWeight: "700", marginTop: 4 },

  depTabs: { flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, padding: 4, marginBottom: 12 },
  depTab: { flex: 1, height: 34, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  depTabActive: { backgroundColor: colors.brandPrimary },
  depTabText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  depTabTextActive: { color: colors.onBrandPrimary },
  depRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider },
  depIcon: { width: 32, height: 32 },
  depName: { color: colors.onSurface, fontSize: 13, fontWeight: "700" },
  depDate: { color: colors.muted, fontSize: 11, marginTop: 1 },
  depAmt: { fontSize: 14, fontWeight: "800" },
  emptyLine: { color: colors.muted, fontSize: 12, lineHeight: 18 },

  stepRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepNum: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  stepNumText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  stepIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: `${colors.brandPrimary}1A`, borderWidth: 1, borderColor: `${colors.brandPrimary}44`, alignItems: "center", justifyContent: "center" },
  stepTitle: { color: colors.onSurface, fontSize: 13, fontWeight: "700" },
  stepSub: { color: colors.muted, fontSize: 11, marginTop: 1 },

  iconBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },

  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: "88%", borderWidth: 1, borderColor: colors.border },
  modalTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  label: { color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", marginTop: 4 },
  input: { backgroundColor: colors.surfaceTertiary, color: colors.onSurface, borderRadius: radius.md, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: colors.border, fontSize: 14 },
  typeChip: { width: 92, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, alignItems: "center", paddingVertical: 10, gap: 4 },
  typeChipImg: { width: 40, height: 40 },
  typeChipText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
}));

function StyleSheetAbsoluteFill() {
  return { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };
}
