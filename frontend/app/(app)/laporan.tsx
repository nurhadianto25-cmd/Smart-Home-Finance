import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Linking, Platform, RefreshControl, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "@react-native-vector-icons/material-design-icons";
import { useRouter } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { api, idr, getMemToken, getToken } from "@/src/api";
import { useAuth } from "@/src/auth";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { DonutChart, LineDualChart, BarsChart, ReportHeroArt, ExportArt } from "@/src/components/charts";
import { formatDateInput } from "@/src/utils/date";
import { localeTag } from "@/src/i18n";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
const CAT_META: Record<string, { icon: string; color: string }> = {
  "Belanja": { icon: "cart", color: "#10D96A" },
  "Tagihan & Cicilan": { icon: "file-document-outline", color: "#9B6BFF" },
  "Tagihan": { icon: "file-document-outline", color: "#9B6BFF" },
  "Cicilan": { icon: "credit-card-outline", color: "#9B6BFF" },
  "Pendidikan": { icon: "school", color: "#3D7EFF" },
  "Makanan": { icon: "food", color: "#FF9D3D" },
  "Transportasi": { icon: "car", color: "#4AC6FF" },
  "Kesehatan": { icon: "heart-pulse", color: "#FF4757" },
  "Hiburan": { icon: "gamepad-variant", color: "#F7C948" },
  "Tabungan": { icon: "piggy-bank", color: "#10D96A" },
  "Gaji": { icon: "cash", color: "#10D96A" },
};
const catMeta = (c: string) => CAT_META[c] || { icon: "dots-horizontal", color: "#8A94A6" };

const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const DOW = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
type Period = "hari" | "minggu" | "bulan" | "tahun" | "custom";

const d2s = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const txDate = (t: any) => String(t.date || t.created_at || "").slice(0, 10);

export default function Laporan() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { colors, scheme } = useTheme();
  const styles = useStyles();
  const { width } = useWindowDimensions();

  const [txs, setTxs] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [savings, setSavings] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>("bulan");
  const [month, setMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const [selectedDay, setSelectedDay] = useState(() => d2s(new Date()));
  const [cfRange, setCfRange] = useState<6 | 12>(12);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [startF, setStartF] = useState<{ display: string; iso: string | null }>({ display: "", iso: null });
  const [endF, setEndF] = useState<{ display: string; iso: string | null }>({ display: "", iso: null });

  const scrollRef = useRef<ScrollView>(null);
  const exportY = useRef(0);

  const load = useCallback(async () => {
    try {
      const [t, b, s] = await Promise.all([
        api<any[]>("/transactions").catch(() => []),
        api<any[]>("/bills").catch(() => []),
        api<any[]>("/savings").catch(() => []),
      ]);
      setTxs(Array.isArray(t) ? t : []); setBills(Array.isArray(b) ? b : []); setSavings(Array.isArray(s) ? s : []);
    } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const year = Number(month.slice(0, 4));
  const mNum = Number(month.slice(5, 7));

  // ---------- period range ----------
  const range = useMemo((): { start: string; end: string; label: string; cmpStart: string; cmpEnd: string; cmpLabel: string } => {
    const monthLabel = new Date(year, mNum - 1, 1).toLocaleDateString(localeTag(), { month: "long", year: "numeric" });
    if (period === "bulan") {
      const pm = new Date(year, mNum - 2, 1);
      return { start: `${month}-01`, end: `${month}-31`, label: monthLabel, cmpStart: d2s(new Date(pm.getFullYear(), pm.getMonth(), 1)), cmpEnd: d2s(new Date(pm.getFullYear(), pm.getMonth() + 1, 0)), cmpLabel: pm.toLocaleDateString(localeTag(), { month: "long", year: "numeric" }) };
    }
    if (period === "tahun") {
      return { start: `${year}-01-01`, end: `${year}-12-31`, label: `${year}`, cmpStart: `${year - 1}-01-01`, cmpEnd: `${year - 1}-12-31`, cmpLabel: `${year - 1}` };
    }
    if (period === "hari") {
      const td = new Date(); const yd = new Date(Date.now() - 864e5);
      return { start: d2s(td), end: d2s(td), label: "Hari Ini", cmpStart: d2s(yd), cmpEnd: d2s(yd), cmpLabel: "Kemarin" };
    }
    if (period === "minggu") {
      const now = new Date(); const dow = (now.getDay() + 6) % 7;
      const mon = new Date(now); mon.setDate(now.getDate() - dow);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      const lmon = new Date(mon); lmon.setDate(mon.getDate() - 7); const lsun = new Date(sun); lsun.setDate(sun.getDate() - 7);
      return { start: d2s(mon), end: d2s(sun), label: "Minggu Ini", cmpStart: d2s(lmon), cmpEnd: d2s(lsun), cmpLabel: "Minggu Lalu" };
    }
    const s = startF.iso || `${month}-01`; const e = endF.iso || `${month}-31`;
    return { start: s, end: e, label: "Custom", cmpStart: s, cmpEnd: e, cmpLabel: "Periode" };
  }, [period, month, year, mNum, startF.iso, endF.iso]);

  const sumRange = useCallback((start: string, end: string) => {
    let income = 0, expense = 0; const cat: Record<string, number> = {};
    for (const t of txs) {
      const ds = txDate(t); if (ds < start || ds > end) continue;
      if (t.type === "income") income += t.amount;
      else { expense += t.amount; cat[t.category] = (cat[t.category] || 0) + t.amount; }
    }
    return { income, expense, balance: income - expense, saving: income > 0 ? ((income - expense) / income) * 100 : 0, cat };
  }, [txs]);

  const cur = useMemo(() => sumRange(range.start, range.end), [sumRange, range]);
  const cmp = useMemo(() => sumRange(range.cmpStart, range.cmpEnd), [sumRange, range]);

  const pct = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : a > 0 ? 100 : 0);
  const cats = useMemo(() => {
    const tot = Object.values(cur.cat).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(cur.cat).map(([category, amount]) => ({ category, amount, percent: (amount / tot) * 100, ...catMeta(category) })).sort((a, b) => b.amount - a.amount);
  }, [cur.cat]);

  // ---------- cashflow ----------
  const cashflow = useMemo(() => {
    const n = cfRange; const out: { key: string; label: string; income: number; expense: number }[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(year, mNum - 1 - i, 1); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      let inc = 0, exp = 0;
      for (const t of txs) { if (txDate(t).slice(0, 7) === key) { if (t.type === "income") inc += t.amount; else exp += t.amount; } }
      out.push({ key, label: MONTHS_ID[d.getMonth()], income: inc, expense: exp });
    }
    return out;
  }, [txs, cfRange, year, mNum]);
  const cfTotalIn = cashflow.reduce((s, c) => s + c.income, 0);
  const cfTotalExp = cashflow.reduce((s, c) => s + c.expense, 0);

  // ---------- obligations ----------
  const oblig = useMemo(() => {
    const g: Record<string, number> = {};
    for (const b of bills) { if (b.status === "lunas") continue; const k = b.kind || "lainnya"; g[k] = (g[k] || 0) + (b.amount || 0); }
    const labels: Record<string, string> = { rutin: "Tagihan Rutin", cicilan: "Cicilan", pinjaman: "Pinjaman", lainnya: "Lainnya" };
    const rows = Object.entries(g).map(([k, v]) => ({ label: labels[k] || k, value: v }));
    const total = rows.reduce((s, r) => s + r.value, 0);
    return { rows, total, ofIncome: cur.income > 0 ? (total / cur.income) * 100 : 0 };
  }, [bills, cur.income]);

  // ---------- savings year ----------
  const savYear = useMemo(() => {
    const arr = new Array(12).fill(0);
    for (const t of txs) { if (t.link_type === "savings" && txDate(t).slice(0, 4) === String(year)) arr[Number(txDate(t).slice(5, 7)) - 1] += t.amount; }
    const total = arr.reduce((s, v) => s + v, 0);
    const active = arr.filter((v) => v > 0).length || 1;
    let yearIncome = 0; for (const t of txs) if (t.type === "income" && txDate(t).slice(0, 4) === String(year)) yearIncome += t.amount;
    return { arr, total, avg: total / active, rate: yearIncome > 0 ? (total / yearIncome) * 100 : 0 };
  }, [txs, year]);

  // ---------- calendar ----------
  const calendar = useMemo(() => {
    const first = new Date(year, mNum - 1, 1); const lead = (first.getDay() + 6) % 7;
    const days = new Date(year, mNum, 0).getDate();
    const map: Record<string, { inc: boolean; exp: boolean }> = {};
    for (const t of txs) { const ds = txDate(t); if (ds.slice(0, 7) !== month) continue; const d = map[ds] || { inc: false, exp: false }; if (t.type === "income") d.inc = true; else d.exp = true; map[ds] = d; }
    const cells: ({ day: number; ds: string; inc: boolean; exp: boolean } | null)[] = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= days; d++) { const ds = `${month}-${String(d).padStart(2, "0")}`; cells.push({ day: d, ds, inc: !!map[ds]?.inc, exp: !!map[ds]?.exp }); }
    return cells;
  }, [txs, month, year, mNum]);

  const dayActivities = useMemo(() => txs.filter((t) => txDate(t) === selectedDay).sort((a, b) => (a.type === "income" ? -1 : 1)), [txs, selectedDay]);

  const insights = useMemo(() => {
    const out: { icon: string; tone: string; text: string }[] = [];
    const incUp = pct(cur.income, cmp.income);
    out.push({ icon: incUp >= 0 ? "arrow-up-bold" : "arrow-down-bold", tone: incUp >= 0 ? colors.success : colors.error, text: `Pemasukan ${incUp >= 0 ? "meningkat" : "menurun"} ${Math.abs(incUp).toFixed(0)}% dibanding ${range.cmpLabel}.` });
    if (cats[0]) out.push({ icon: cats[0].icon, tone: cats[0].color, text: `${cats[0].category} merupakan kategori pengeluaran terbesar (${cats[0].percent.toFixed(0)}%).` });
    const expUp = pct(cur.expense, cmp.expense);
    out.push({ icon: "swap-vertical", tone: expUp <= 0 ? colors.success : colors.warning, text: `Total pengeluaran ${expUp <= 0 ? "turun" : "naik"} ${Math.abs(expUp).toFixed(0)}% dari ${range.cmpLabel}.` });
    out.push({ icon: "percent", tone: colors.brandPrimary, text: `Saving rate periode ini ${cur.saving.toFixed(1)}%.` });
    const g = savings.find((x) => x.target > 0);
    if (g) out.push({ icon: "piggy-bank", tone: colors.info, text: `Tabungan "${g.name}" mencapai ${((g.saved / g.target) * 100).toFixed(0)}% dari target.` });
    return out;
  }, [cur, cmp, cats, savings, range.cmpLabel, colors]);

  // ---------- export ----------
  const share = async (kind: "pdf" | "excel" | "csv") => {
    setMsg(null); setBusy(kind);
    const labelName = range.start === range.end ? range.start : `${range.start}_${range.end}`;
    try {
      if (kind === "csv") {
        const rows = txs.filter((t) => { const ds = txDate(t); return ds >= range.start && ds <= range.end; }).sort((a, b) => txDate(a).localeCompare(txDate(b)));
        const head = "Tanggal,Tipe,Kategori,Judul,Jumlah\n";
        const body = rows.map((r) => `${txDate(r)},${r.type},"${(r.category || "").replace(/"/g, "'")}","${(r.title || "").replace(/"/g, "'")}",${r.amount}`).join("\n");
        const csv = head + body;
        if (Platform.OS === "web") {
          const blob = new Blob([csv], { type: "text/csv" }); const url = URL.createObjectURL(blob);
          const a = document.createElement("a"); a.href = url; a.download = `Laporan-${labelName}.csv`; document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 500);
        } else {
          const uri = FileSystem.cacheDirectory + `Laporan-${labelName}.csv`;
          await FileSystem.writeAsStringAsync(uri, csv);
          if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "text/csv" }); else setMsg(`Tersimpan ke ${uri}`);
        }
        return;
      }
      const rq = period === "custom" && startF.iso && endF.iso ? `?start=${startF.iso}&end=${endF.iso}` : period === "bulan" ? `?month=${month}` : "";
      const path = (kind === "pdf" ? "/api/report/pdf" : "/api/report/excel") + rq;
      const ext = kind === "pdf" ? "pdf" : "xlsx";
      const token = getMemToken() ?? (await getToken());
      const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
      if (Platform.OS === "web") {
        const res = await fetch(`${BASE}${path}`, { headers: authHeader as any }); if (!res.ok) throw new Error("Gagal unduh");
        const blob = await res.blob(); const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `Laporan-${labelName}.${ext}`; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 500);
        return;
      }
      const fileUri = FileSystem.cacheDirectory + `Laporan-${labelName}.${ext}`;
      const dl = await FileSystem.downloadAsync(`${BASE}${path}`, fileUri, { headers: authHeader as any });
      if (dl.status !== 200) throw new Error("Gagal unduh");
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(dl.uri, { mimeType: kind === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      else setMsg(`Tersimpan ke ${dl.uri}`);
    } catch (e: any) { setMsg(e.message || "Gagal"); } finally { setBusy(null); }
  };

  const shiftMonth = (delta: number) => { const d = new Date(year, mNum - 1 + delta, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };
  const chartW = width - spacing.lg * 2 - spacing.lg * 2;
  const DONUT_COLORS = ["#10D96A", "#9B6BFF", "#3D7EFF", "#FF9D3D", "#4AC6FF", "#F7C948", "#FF4757"];
  const monthLabel = new Date(year, mNum - 1, 1).toLocaleDateString(localeTag(), { month: "long", year: "numeric" });

  const periodBtns: { key: Period; label: string }[] = [
    { key: "hari", label: "Hari Ini" }, { key: "minggu", label: "Minggu Ini" }, { key: "bulan", label: "Bulan Ini" }, { key: "tahun", label: "Tahun Ini" }, { key: "custom", label: "Custom" },
  ];
  const stats = [
    { key: "in", label: "PEMASUKAN", value: idr(cur.income), icon: "arrow-down", grad: ["#13E07A", "#0BA85A"] as const, tint: colors.success, delta: pct(cur.income, cmp.income), good: (d: number) => d >= 0 },
    { key: "out", label: "PENGELUARAN", value: idr(cur.expense), icon: "arrow-up", grad: ["#FF6B6B", "#E23B4E"] as const, tint: colors.error, delta: pct(cur.expense, cmp.expense), good: (d: number) => d <= 0 },
    { key: "net", label: "SELISIH", value: idr(cur.balance), icon: "wallet", grad: ["#4A8CFF", "#2A5FD6"] as const, tint: colors.info, delta: pct(cur.balance, cmp.balance), good: (d: number) => d >= 0 },
    { key: "rate", label: "SAVING RATE", value: `${cur.saving.toFixed(1)}%`, icon: "percent", grad: ["#A77BFF", "#7C4DFF"] as const, tint: colors.brandPrimary, delta: cur.saving - cmp.saving, good: (d: number) => d >= 0, pp: true },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brandPrimary} />}
      >
        {/* HERO */}
        <LinearGradient colors={scheme === "dark" ? ["#15275A", "#101A3A", "#0A0E1A"] : ["#DCE8FF", "#EEF3FF", "#FFFFFF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + 12 }]}>
          <View style={styles.heroGlow} pointerEvents="none" />
          <View style={styles.heroTop}>
            <Pressable testID="back-report" onPress={() => router.back()} hitSlop={8} style={styles.circleBtn}><Icon name="chevron-left" size={24} color="#FFFFFF" /></Pressable>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={styles.monthPill}>
                <Pressable testID="rep-month-prev" onPress={() => shiftMonth(-1)} hitSlop={8} style={styles.monthArrow}><Icon name="chevron-left" size={18} color="#FFFFFF" /></Pressable>
                <Text style={styles.monthPillText} testID="rep-month-label">{monthLabel}</Text>
                <Pressable testID="rep-month-next" onPress={() => shiftMonth(1)} hitSlop={8} style={styles.monthArrow}><Icon name="chevron-right" size={18} color="#FFFFFF" /></Pressable>
              </View>
              <Pressable testID="rep-export-top" onPress={() => scrollRef.current?.scrollTo({ y: exportY.current - 12, animated: true })} style={styles.exportTopBtn}>
                <Icon name="tray-arrow-down" size={16} color="#FFFFFF" /><Text style={styles.exportTopText}>Export</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.heroBody}>
            <View style={{ flex: 1, paddingRight: 6 }}>
              <Text style={styles.heroTitle}>Laporan</Text>
              <Text style={styles.heroSub}>Ringkasan lengkap kondisi keuangan Anda.</Text>
            </View>
            <ReportHeroArt width={150} height={112} />
          </View>
        </LinearGradient>

        {/* PERIOD SELECTOR */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pilih Periode</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 10 }}>
              {periodBtns.map((p) => {
                const on = period === p.key;
                return (
                  <Pressable key={p.key} testID={`period-${p.key}`} onPress={() => setPeriod(p.key)} style={[styles.periodChip, on && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
                    <Text style={[styles.periodChipText, on && { color: colors.onBrandPrimary }]}>{p.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {period === "custom" ? (
              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.miniLabel}>Tanggal Mulai</Text>
                  <TextInput testID="report-start" style={styles.input} value={startF.display} onChangeText={(x) => setStartF(formatDateInput(x))} keyboardType="numeric" maxLength={10} placeholder="DD-MM-YYYY" placeholderTextColor={colors.muted} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.miniLabel}>Tanggal Akhir</Text>
                  <TextInput testID="report-end" style={styles.input} value={endF.display} onChangeText={(x) => setEndF(formatDateInput(x))} keyboardType="numeric" maxLength={10} placeholder="DD-MM-YYYY" placeholderTextColor={colors.muted} />
                </View>
              </View>
            ) : (
              <View style={styles.cmpRow}><Icon name="compare-horizontal" size={14} color={colors.muted} /><Text style={styles.cmpText}>Dibandingkan dengan <Text style={{ color: colors.onSurface, fontWeight: "700" }}>{range.cmpLabel}</Text></Text></View>
            )}
          </View>
        </View>

        {/* STAT CARDS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          {stats.map((s) => {
            const up = s.delta >= 0; const good = s.good(s.delta);
            return (
              <LinearGradient key={s.key} testID={`rep-stat-${s.key}`} colors={[`${s.tint}26`, scheme === "dark" ? "rgba(18,24,43,0.92)" : "#FFFFFF"]} start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 1 }} style={[styles.statCard, { borderColor: `${s.tint}55` }]}>
                <LinearGradient colors={s.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statIcon}><Icon name={s.icon as any} size={18} color="#FFFFFF" /></LinearGradient>
                <Text style={styles.statLabel} numberOfLines={1}>{s.label}</Text>
                <Text style={[styles.statVal, { color: s.tint }]} numberOfLines={1}>{s.value}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                  <Icon name={up ? "triangle" : "triangle-down"} size={8} color={good ? colors.success : colors.error} />
                  <Text style={[styles.statDelta, { color: good ? colors.success : colors.error }]} numberOfLines={1}>{Math.abs(s.delta).toFixed(1)}{s.pp ? "pp" : "%"} vs {range.cmpLabel}</Text>
                </View>
              </LinearGradient>
            );
          })}
        </ScrollView>

        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg, marginTop: spacing.lg }}>
          {/* CASH FLOW */}
          <View style={styles.card}>
            <View style={styles.sectionRow}>
              <Text style={styles.cardTitle}>Cash Flow</Text>
              <View style={styles.segment}>
                {[6, 12].map((r) => (
                  <Pressable key={r} testID={`cf-${r}`} onPress={() => setCfRange(r as 6 | 12)} style={[styles.segBtn, cfRange === r && styles.segBtnActive]}>
                    <Text style={[styles.segText, cfRange === r && styles.segTextActive]}>{r} Bulan</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 14, marginTop: 6 }}>
              <View style={styles.legendRow}><View style={[styles.dot, { backgroundColor: colors.success }]} /><Text style={styles.legendText}>Pemasukan</Text></View>
              <View style={styles.legendRow}><View style={[styles.dot, { backgroundColor: colors.error }]} /><Text style={styles.legendText}>Pengeluaran</Text></View>
            </View>
            <View style={{ alignItems: "center", marginTop: 6 }}>
              <LineDualChart income={cashflow.map((c) => c.income)} expense={cashflow.map((c) => c.expense)} labels={cashflow.map((c) => c.label)} width={chartW} />
            </View>
            <View style={styles.totalsRow}>
              <View style={[styles.totalBox, { borderColor: `${colors.success}55` }]}><Text style={styles.totalLabel}>Total Pemasukan</Text><Text style={[styles.totalVal, { color: colors.success }]} numberOfLines={1}>{idr(cfTotalIn)}</Text></View>
              <View style={[styles.totalBox, { borderColor: `${colors.error}55` }]}><Text style={styles.totalLabel}>Total Pengeluaran</Text><Text style={[styles.totalVal, { color: colors.error }]} numberOfLines={1}>{idr(cfTotalExp)}</Text></View>
              <View style={[styles.totalBox, { borderColor: `${colors.info}55` }]}><Text style={styles.totalLabel}>Selisih</Text><Text style={[styles.totalVal, { color: colors.info }]} numberOfLines={1}>{idr(cfTotalIn - cfTotalExp)}</Text></View>
            </View>
          </View>

          {/* EXPENSE CATEGORY DONUT */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pengeluaran per Kategori</Text>
            {cats.length === 0 ? (
              <Text style={styles.emptyLine}>Belum ada pengeluaran pada periode ini.</Text>
            ) : (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 12 }}>
                  <View style={{ width: 140, height: 140, alignItems: "center", justifyContent: "center" }}>
                    <DonutChart data={cats.map((c, i) => ({ value: c.amount, color: DONUT_COLORS[i % DONUT_COLORS.length] }))} size={140} thickness={22} />
                    <View style={styles.donutCenter}><Text style={styles.donutCenterLabel}>Total</Text><Text style={styles.donutCenterVal} numberOfLines={1}>{idr(cur.expense)}</Text></View>
                  </View>
                  <View style={{ flex: 1, gap: 7 }}>
                    {cats.slice(0, 6).map((c, i) => (
                      <View key={c.category} style={styles.legendItem}>
                        <View style={[styles.dot, { backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }]} />
                        <Text style={styles.legendName} numberOfLines={1}>{c.category}</Text>
                        <Text style={styles.legendPct}>{c.percent.toFixed(0)}%</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <Pressable testID="cat-detail" onPress={() => router.push("/transaksi")} style={styles.detailBtn}><Text style={styles.detailText}>Lihat Detail</Text><Icon name="arrow-right" size={16} color={colors.brandPrimary} /></Pressable>
              </>
            )}
          </View>

          {/* BREAKDOWN + KEWAJIBAN */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Breakdown Pengeluaran</Text>
            {cats.length === 0 ? <Text style={styles.emptyLine}>Tidak ada data.</Text> : (
              <View style={{ marginTop: 10, gap: 4 }}>
                {cats.map((c) => (
                  <View key={c.category} style={styles.breakRow}>
                    <View style={[styles.breakIcon, { backgroundColor: `${c.color}22`, borderColor: `${c.color}55` }]}><Icon name={c.icon as any} size={15} color={c.color} /></View>
                    <Text style={styles.breakName} numberOfLines={1}>{c.category}</Text>
                    <Text style={styles.breakAmt} numberOfLines={1}>{idr(c.amount)}</Text>
                    <Text style={[styles.breakPct, { color: c.color }]}>{c.percent.toFixed(0)}%</Text>
                  </View>
                ))}
                <View style={[styles.breakRow, { borderBottomWidth: 0, marginTop: 4 }]}>
                  <Text style={[styles.breakName, { fontWeight: "800", marginLeft: 2 }]}>TOTAL</Text>
                  <Text style={[styles.breakAmt, { color: colors.onSurface, fontWeight: "800" }]}>{idr(cur.expense)}</Text>
                  <Text style={[styles.breakPct, { color: colors.onSurface }]}>100%</Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.card}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Icon name="shield-check" size={18} color={colors.brandPrimary} /><Text style={styles.cardTitle}>Kewajiban Finansial</Text></View>
            {oblig.rows.length === 0 ? <Text style={[styles.emptyLine, { marginTop: 8 }]}>Belum ada tagihan atau cicilan aktif.</Text> : (
              <View style={{ marginTop: 10 }}>
                {oblig.rows.map((r) => (
                  <View key={r.label} style={styles.obRow}><Text style={styles.obName}>{r.label}</Text><Text style={styles.obVal} numberOfLines={1}>{idr(r.value)}</Text></View>
                ))}
                <View style={[styles.obRow, { borderBottomWidth: 0 }]}><Text style={[styles.obName, { color: colors.brandPrimary, fontWeight: "800" }]}>TOTAL KOMITMEN</Text><Text style={[styles.obVal, { color: colors.brandPrimary, fontWeight: "800" }]}>{idr(oblig.total)}</Text></View>
                <View style={styles.obNote}><Icon name="alert-circle-outline" size={16} color={colors.warning} /><Text style={styles.obNoteText}>Komitmen rutin mengambil {oblig.ofIncome.toFixed(1)}% dari pemasukan Anda.</Text></View>
              </View>
            )}
          </View>

          {/* CALENDAR */}
          <View style={styles.card}>
            <View style={styles.sectionRow}>
              <Text style={styles.cardTitle}>Kalender Keuangan</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Pressable testID="cal-prev" onPress={() => shiftMonth(-1)} hitSlop={6}><Icon name="chevron-left" size={20} color={colors.muted} /></Pressable>
                <Text style={styles.calMonth}>{monthLabel}</Text>
                <Pressable testID="cal-next" onPress={() => shiftMonth(1)} hitSlop={6}><Icon name="chevron-right" size={20} color={colors.muted} /></Pressable>
              </View>
            </View>
            <View style={{ flexDirection: "row", marginTop: 12 }}>
              {DOW.map((d) => <Text key={d} style={styles.dow}>{d}</Text>)}
            </View>
            <View style={styles.calGrid}>
              {calendar.map((c, i) => c === null ? <View key={`e${i}`} style={styles.calCell} /> : (
                <Pressable key={c.ds} testID={`cal-day-${c.day}`} onPress={() => setSelectedDay(c.ds)} style={[styles.calCell, selectedDay === c.ds && styles.calCellActive]}>
                  <Text style={[styles.calDay, selectedDay === c.ds && { color: colors.onBrandPrimary, fontWeight: "800" }]}>{c.day}</Text>
                  <View style={{ flexDirection: "row", gap: 2, height: 5, marginTop: 1 }}>
                    {c.inc ? <View style={[styles.calDot, { backgroundColor: colors.success }]} /> : null}
                    {c.exp ? <View style={[styles.calDot, { backgroundColor: colors.error }]} /> : null}
                  </View>
                </Pressable>
              ))}
            </View>
            <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: 12 }} />
            <Text style={styles.dayTitle}>{new Date(selectedDay + "T00:00:00").toLocaleDateString(localeTag(), { weekday: "long", day: "numeric", month: "long" })}</Text>
            {dayActivities.length === 0 ? <Text style={[styles.emptyLine, { marginTop: 8 }]}>Tidak ada aktivitas pada tanggal ini.</Text> : dayActivities.slice(0, 6).map((t, i) => {
              const m = catMeta(t.category); const inc = t.type === "income";
              return (
                <View key={t.tx_id || i} style={styles.actRow}>
                  <View style={[styles.actIcon, { backgroundColor: `${inc ? colors.success : m.color}22` }]}><Icon name={(inc ? "cash-plus" : m.icon) as any} size={14} color={inc ? colors.success : m.color} /></View>
                  <Text style={styles.actName} numberOfLines={1}>{t.title || t.category}</Text>
                  <Text style={[styles.actAmt, { color: inc ? colors.success : colors.error }]}>{inc ? "+" : "-"}{idr(t.amount)}</Text>
                </View>
              );
            })}
            <Pressable testID="all-activity" onPress={() => router.push("/transaksi")} style={styles.detailBtn}><Text style={styles.detailText}>Lihat Semua Aktivitas</Text><Icon name="arrow-right" size={16} color={colors.brandPrimary} /></Pressable>
          </View>

          {/* SAVINGS */}
          <View style={styles.card}>
            <View style={styles.sectionRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Icon name="piggy-bank" size={18} color={colors.success} /><Text style={styles.cardTitle}>Tabungan</Text></View>
              <View style={styles.yearPill}><Text style={styles.yearPillText}>Tahun {year}</Text></View>
            </View>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
              <View style={{ flex: 1, gap: 10 }}>
                <View><Text style={styles.sLabel}>Total Ditabung ({year})</Text><Text style={[styles.sVal, { color: colors.success }]} numberOfLines={1}>{idr(savYear.total)}</Text></View>
                <View><Text style={styles.sLabel}>Rata-rata per bulan</Text><Text style={styles.sVal2} numberOfLines={1}>{idr(Math.round(savYear.avg))}</Text></View>
                <View><Text style={styles.sLabel}>Saving Rate rata-rata</Text><Text style={styles.sVal2}>{savYear.rate.toFixed(1)}%</Text></View>
              </View>
              <View style={{ flex: 1.3, alignItems: "flex-end" }}>
                <BarsChart data={savYear.arr} labels={MONTHS_ID} color={colors.success} width={chartW * 0.52} height={150} />
              </View>
            </View>
          </View>

          {/* INSIGHTS */}
          <View style={styles.card}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}><Icon name="lightbulb-on" size={18} color={colors.brandPrimary} /><Text style={styles.cardTitle}>Financial Insights</Text></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {insights.map((ins, i) => (
                <View key={i} style={[styles.insightCard, { borderColor: `${ins.tone}44` }]}>
                  <View style={[styles.insightIcon, { backgroundColor: `${ins.tone}22` }]}><Icon name={ins.icon as any} size={16} color={ins.tone} /></View>
                  <Text style={styles.insightText}>{ins.text}</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* EXPORT */}
          <View style={styles.card} onLayout={(e) => { exportY.current = e.nativeEvent.layout.y; }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Export Laporan</Text>
                <Text style={[styles.emptyLine, { marginTop: 4 }]}>Unduh laporan periode yang sedang dilihat.</Text>
              </View>
              <ExportArt width={96} height={74} />
            </View>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <Pressable testID="report-excel" disabled={busy === "excel"} onPress={() => share("excel")} style={({ pressed }) => [styles.expBtn, { backgroundColor: colors.success }, pressed && { opacity: 0.8 }]}>
                <Icon name={busy === "excel" ? "loading" : "microsoft-excel"} size={20} color="#FFFFFF" /><Text style={styles.expText}>Excel</Text><Text style={styles.expExt}>.xlsx</Text>
              </Pressable>
              <Pressable testID="report-pdf" disabled={busy === "pdf"} onPress={() => share("pdf")} style={({ pressed }) => [styles.expBtn, { backgroundColor: colors.error }, pressed && { opacity: 0.8 }]}>
                <Icon name={busy === "pdf" ? "loading" : "file-pdf-box"} size={20} color="#FFFFFF" /><Text style={styles.expText}>PDF</Text><Text style={styles.expExt}>.pdf</Text>
              </Pressable>
              <Pressable testID="report-csv" disabled={busy === "csv"} onPress={() => share("csv")} style={({ pressed }) => [styles.expBtn, { backgroundColor: "#FF9D3D" }, pressed && { opacity: 0.8 }]}>
                <Icon name={busy === "csv" ? "loading" : "file-delimited"} size={20} color="#FFFFFF" /><Text style={styles.expText}>CSV</Text><Text style={styles.expExt}>.csv</Text>
              </Pressable>
            </View>
            {msg ? <Text style={{ color: colors.warning, fontSize: 12, marginTop: 10 }}>{msg}</Text> : null}
          </View>

          {/* RIWAYAT */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Riwayat Laporan</Text>
            <Text style={[styles.emptyLine, { marginTop: 4, marginBottom: 10 }]}>Pilih periode laporan yang ingin dilihat kembali.</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 10 }}>
              {[year - 2, year - 1, year, new Date().getFullYear()].filter((v, i, a) => a.indexOf(v) === i).map((y) => (
                <Pressable key={y} testID={`year-${y}`} onPress={() => setMonth(`${y}-${month.slice(5, 7)}`)} style={[styles.yearChip, Number(month.slice(0, 4)) === y && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
                  <Text style={[styles.yearChipText, Number(month.slice(0, 4)) === y && { color: colors.onBrandPrimary }]}>{y}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.monthGrid}>
              {MONTHS_ID.map((mo, i) => {
                const on = mNum === i + 1;
                return (
                  <Pressable key={mo} testID={`hist-month-${i + 1}`} onPress={() => { setMonth(`${month.slice(0, 4)}-${String(i + 1).padStart(2, "0")}`); setPeriod("bulan"); }} style={[styles.monthChip, on && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
                    <Text style={[styles.monthChipText, on && { color: colors.onBrandPrimary }]}>{mo}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: "hidden" },
  heroGlow: { position: "absolute", top: -60, right: -30, width: 220, height: 220, borderRadius: 110, backgroundColor: "#3D7EFF", opacity: 0.22 },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  circleBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  monthPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.14)", borderRadius: radius.pill, paddingHorizontal: 4, height: 38 },
  monthArrow: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  monthPillText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700", minWidth: 86, textAlign: "center" },
  exportTopBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.14)", borderRadius: radius.pill, paddingHorizontal: 12, height: 38 },
  exportTopText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  heroBody: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  heroTitle: { color: "#FFFFFF", fontSize: 30, fontWeight: "800" },
  heroSub: { color: "rgba(255,255,255,0.78)", fontSize: 12, marginTop: 6, lineHeight: 17 },

  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  cardTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  emptyLine: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  miniLabel: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  input: { backgroundColor: colors.surfaceTertiary, color: colors.onSurface, borderRadius: radius.md, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: colors.border, fontSize: 14 },

  periodChip: { flexShrink: 0, paddingHorizontal: 16, height: 36, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  periodChipText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  cmpRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  cmpText: { color: colors.muted, fontSize: 12 },

  statCard: { width: 168, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, gap: 6 },
  statIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  statLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  statVal: { fontSize: 20, fontWeight: "800" },
  statDelta: { fontSize: 10, fontWeight: "700", flex: 1 },

  segment: { flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, padding: 3 },
  segBtn: { paddingHorizontal: 12, height: 28, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  segBtnActive: { backgroundColor: colors.brandPrimary },
  segText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  segTextActive: { color: colors.onBrandPrimary },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendText: { color: colors.muted, fontSize: 11 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  totalsRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  totalBox: { flex: 1, borderRadius: radius.md, borderWidth: 1, padding: 10, backgroundColor: colors.surfaceTertiary },
  totalLabel: { color: colors.muted, fontSize: 9.5, fontWeight: "700" },
  totalVal: { fontSize: 13, fontWeight: "800", marginTop: 3 },

  donutCenter: { position: "absolute", alignItems: "center", justifyContent: "center" },
  donutCenterLabel: { color: colors.muted, fontSize: 9, fontWeight: "700" },
  donutCenterVal: { color: colors.onSurface, fontSize: 12, fontWeight: "800" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendName: { color: colors.onSurface, fontSize: 12, fontWeight: "600", flex: 1 },
  legendPct: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  detailBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 14, height: 40, borderRadius: radius.md, backgroundColor: `${colors.brandPrimary}1A`, borderWidth: 1, borderColor: `${colors.brandPrimary}44` },
  detailText: { color: colors.brandPrimary, fontSize: 13, fontWeight: "700" },

  breakRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider },
  breakIcon: { width: 30, height: 30, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  breakName: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "600", flex: 1 },
  breakAmt: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "700" },
  breakPct: { fontSize: 12, fontWeight: "800", minWidth: 38, textAlign: "right" },

  obRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.divider },
  obName: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "600" },
  obVal: { color: colors.onSurface, fontSize: 14, fontWeight: "800" },
  obNote: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 12, backgroundColor: `${colors.warning}14`, borderRadius: radius.md, padding: 10 },
  obNoteText: { color: colors.onSurfaceSecondary, fontSize: 12, flex: 1, lineHeight: 17 },

  calMonth: { color: colors.onSurface, fontSize: 13, fontWeight: "700" },
  dow: { flex: 1, textAlign: "center", color: colors.muted, fontSize: 10, fontWeight: "700" },
  calGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  calCell: { width: `${100 / 7}%`, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  calCellActive: { backgroundColor: colors.brandPrimary },
  calDay: { color: colors.onSurface, fontSize: 13, fontWeight: "600" },
  calDot: { width: 5, height: 5, borderRadius: 2.5 },
  dayTitle: { color: colors.onSurface, fontSize: 13, fontWeight: "800" },
  actRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 },
  actIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  actName: { color: colors.onSurfaceSecondary, fontSize: 13, flex: 1 },
  actAmt: { fontSize: 13, fontWeight: "800" },

  yearPill: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, paddingHorizontal: 12, height: 28, justifyContent: "center" },
  yearPillText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  sLabel: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  sVal: { fontSize: 18, fontWeight: "800", marginTop: 2 },
  sVal2: { color: colors.onSurface, fontSize: 14, fontWeight: "800", marginTop: 2 },

  insightCard: { width: 190, borderRadius: radius.md, padding: 12, borderWidth: 1, backgroundColor: colors.surfaceTertiary, gap: 8 },
  insightIcon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  insightText: { color: colors.onSurfaceSecondary, fontSize: 12, lineHeight: 17 },

  expBtn: { flex: 1, height: 58, borderRadius: radius.md, alignItems: "center", justifyContent: "center", gap: 1 },
  expText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  expExt: { color: "rgba(255,255,255,0.85)", fontSize: 9.5, fontWeight: "600" },

  yearChip: { flexShrink: 0, paddingHorizontal: 18, height: 34, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  yearChipText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  monthChip: { width: `${(100 - 5 * 2) / 6}%`, height: 34, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  monthChipText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
}));
