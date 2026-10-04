import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Modal, KeyboardAvoidingView, Platform, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { api, idr } from "@/src/api";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { EmptyState, PillButton, PrimaryButton } from "@/src/components/ui";
import { DonutChart, GroupedBarChart } from "@/src/components/charts";
import { useConfirm } from "@/src/confirm";
import { localeTag } from "@/src/i18n";

const CAT_COLORS = ["#4A8CFF", "#FF4757", "#10D96A", "#FF9D3D", "#9B6BFF", "#F7C948", "#22C3B8", "#8B9DA5"];
const SHOP_CATS = ["Makanan Pokok", "Protein", "Sayuran", "Bumbu & Dapur", "Minuman", "Kebersihan", "Kebutuhan Rumah", "Lainnya"];

const CAT_VIS: Record<string, { icon: string; grad: string[] }> = {
  "Makanan Pokok": { icon: "rice", grad: ["#4A8CFF", "#2A5FD6"] },
  Protein: { icon: "food-drumstick", grad: ["#FF5B69", "#E23544"] },
  Sayuran: { icon: "carrot", grad: ["#13E07A", "#0BA85A"] },
  "Bumbu & Dapur": { icon: "bottle-tonic", grad: ["#FFB44A", "#F7742F"] },
  Minuman: { icon: "cup", grad: ["#22C3B8", "#139B92"] },
  Kebersihan: { icon: "spray-bottle", grad: ["#A77BFF", "#7C4DFF"] },
  "Kebutuhan Rumah": { icon: "home-variant", grad: ["#4A8CFF", "#2A5FD6"] },
  Lainnya: { icon: "dots-horizontal", grad: ["#8B9DA5", "#6B7A82"] },
};
function itemVis(name: string, category: string) {
  const s = (name || "").toLowerCase();
  const base = CAT_VIS[category] || CAT_VIS.Lainnya;
  let icon = base.icon;
  if (/beras/.test(s)) icon = "rice";
  else if (/minyak/.test(s)) icon = "bottle-tonic";
  else if (/telur/.test(s)) icon = "egg";
  else if (/sayur/.test(s)) icon = "carrot";
  else if (/daging|ayam/.test(s)) icon = "food-drumstick";
  else if (/susu/.test(s)) icon = "cup";
  else if (/deterjen|sabun/.test(s)) icon = "spray-bottle";
  else if (/gas|lpg/.test(s)) icon = "gas-cylinder";
  else if (/air|minum/.test(s)) icon = "cup-water";
  return { icon, grad: base.grad };
}

function Glossy({ grad, icon, size = 44, iconSize = 21, rad = 14, style }: any) {
  return (
    <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ width: size, height: size, borderRadius: rad, alignItems: "center", justifyContent: "center" }, style]}>
      <Icon name={icon} size={iconSize} color="#FFFFFF" />
    </LinearGradient>
  );
}

function monthKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }

export default function Belanja() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, scheme } = useTheme();
  const styles = useStyles();
  const confirm = useConfirm();
  const [month, setMonth] = useState(monthKey());
  const [items, setItems] = useState<any[]>([]);
  const [sixMonth, setSixMonth] = useState<{ label: string; a: number; b: number }[]>([]);
  const [prevBudget, setPrevBudget] = useState(0);
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; edit?: any | null }>({ open: false, edit: null });
  const [form, setForm] = useState({ name: "", category: "Makanan Pokok", budget: "", realized: "", frequency: "Rutin" });

  const load = useCallback(async () => {
    try {
      const cur = await api<any[]>(`/shopping?month=${month}`);
      setItems(cur);
      const months: string[] = [];
      for (let i = 5; i >= 0; i--) { const d = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 - i, 1); months.push(monthKey(d)); }
      const res = await Promise.all(months.map((m) => (m === month ? Promise.resolve(cur) : api<any[]>(`/shopping?month=${m}`).catch(() => []))));
      setSixMonth(res.map((arr, i) => ({ label: new Date(Number(months[i].slice(0, 4)), Number(months[i].slice(5, 7)) - 1, 1).toLocaleDateString(localeTag(), { month: "short" }), a: arr.reduce((s, x) => s + (x.budget || 0), 0), b: arr.reduce((s, x) => s + (x.realized || 0), 0) })));
      setPrevBudget(res[4]?.reduce((s, x) => s + (x.realized || 0), 0) || 0);
    } catch {}
  }, [month]);
  useEffect(() => { load(); }, [load]);

  const shiftMonth = (delta: number) => {
    const d = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + delta, 1);
    setMonth(monthKey(d));
  };
  const monthLabel = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1).toLocaleDateString(localeTag(), { month: "long", year: "numeric" });
  const today = new Date().toLocaleDateString(localeTag(), { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase();

  const totalBudget = items.reduce((s, i) => s + i.budget, 0);
  const totalReal = items.reduce((s, i) => s + i.realized, 0);
  const remain = totalBudget - totalReal;
  const pct = totalBudget ? (totalReal / totalBudget) * 100 : 0;
  const daysLeft = (() => { const now = new Date(); const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); return monthKey() === month ? Math.max(0, end.getDate() - now.getDate()) : 0; })();

  const stats = [
    { key: "total", label: "TOTAL ANGGARAN", value: idr(totalBudget), sub: "Anggaran bulan ini", grad: ["#4A8CFF", "#2A5FD6"], tint: colors.info, icon: "wallet" },
    { key: "real", label: "REALISASI", value: idr(totalReal), sub: "Sudah dibelanjakan", grad: ["#13E07A", "#0BA85A"], tint: colors.success, icon: "cart-check" },
    { key: "rest", label: "SISA ANGGARAN", value: idr(remain), sub: "Sisa anggaran", grad: ["#FFB44A", "#F7742F"], tint: colors.warning, icon: "wallet-outline" },
    { key: "pct", label: "PERSENTASE TERPAKAI", value: `${pct.toFixed(1)}%`, sub: "Digunakan", grad: ["#A77BFF", "#7C4DFF"], tint: colors.brandPrimary, icon: "chart-arc" },
  ];

  const q = query.trim().toLowerCase();
  const filtered = items
    .filter((i) => (catFilter === "all" ? true : i.category === catFilter))
    .filter((i) => (statusFilter === "all" ? true : i.status === statusFilter))
    .filter((i) => (q ? `${i.name} ${i.category}`.toLowerCase().includes(q) : true));

  const catMap: Record<string, number> = {};
  for (const it of items) catMap[it.category] = (catMap[it.category] || 0) + (it.budget || 0);
  const catDist = Object.entries(catMap).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

  const notBought = items.filter((i) => i.status === "belum").length;
  const topCat = catDist[0];
  const spendDelta = prevBudget > 0 ? Math.round(((totalReal - prevBudget) / prevBudget) * 100) : 0;
  const insights = [
    spendDelta <= 0
      ? `Pengeluaran belanja bulan ini ${Math.abs(spendDelta)}% lebih rendah dibanding bulan lalu.`
      : `Pengeluaran belanja bulan ini ${spendDelta}% lebih tinggi dibanding bulan lalu.`,
    notBought > 0 ? `${notBought} item belum dibeli. Masih ada sisa anggaran ${idr(remain)}.` : "Semua item sudah dibelanjakan bulan ini. 🎉",
    topCat ? `Kategori ${topCat.label} adalah pengeluaran terbesar (${totalBudget ? Math.round((topCat.value / totalBudget) * 100) : 0}%).` : "Tambahkan item untuk melihat analisis kategori.",
  ];

  const openAdd = () => { setForm({ name: "", category: "Makanan Pokok", budget: "", realized: "", frequency: "Rutin" }); setModal({ open: true, edit: null }); };
  const openEdit = (i: any) => { setForm({ name: i.name, category: i.category, budget: String(i.budget), realized: String(i.realized), frequency: i.frequency || "Rutin" }); setModal({ open: true, edit: i }); };
  const submit = async () => {
    if (!form.name || !form.budget) return;
    const r = parseFloat(form.realized || "0");
    const b = parseFloat(form.budget);
    const status = r <= 0 ? "belum" : r < b ? "sebagian" : "selesai";
    const body = { name: form.name, category: form.category, budget: b, realized: r, status, frequency: form.frequency, month };
    try {
      if (modal.edit) await api(`/shopping/${modal.edit.item_id}`, { method: "PUT", body: JSON.stringify(body) });
      else await api("/shopping", { method: "POST", body: JSON.stringify(body) });
      setModal({ open: false }); load();
    } catch {}
  };
  const del = async (i: any) => {
    const ok = await confirm({ title: "Hapus Item Belanja", message: `Hapus "${i.name}"?`, danger: true });
    if (!ok) return;
    try { await api(`/shopping/${i.item_id}`, { method: "DELETE" }); load(); } catch {}
  };
  const copyLastMonth = async () => {
    const d = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 2, 1);
    const prev = await api<any[]>(`/shopping?month=${monthKey(d)}`).catch(() => []);
    if (prev.length === 0) { await confirm({ title: "Tidak Ada Data", message: "Bulan lalu belum ada item belanja untuk disalin.", confirmText: "OK" }); return; }
    const ok = await confirm({ title: "Salin Bulan Lalu", message: `Salin ${prev.length} item dari bulan lalu ke ${monthLabel}?`, confirmText: "Salin" });
    if (!ok) return;
    for (const p of prev) await api("/shopping", { method: "POST", body: JSON.stringify({ name: p.name, category: p.category, budget: p.budget, realized: 0, status: "belum", frequency: p.frequency || "Rutin", month }) }).catch(() => {});
    load();
  };

  const STATUS: any = { belum: { c: colors.info, l: "Belum", i: "progress-clock" }, sebagian: { c: colors.warning, l: "Sebagian", i: "progress-check" }, selesai: { c: colors.success, l: "Selesai", i: "check-circle" } };

  const schedules = [
    { label: "Belanja Mingguan", sub: "Setiap Minggu", budget: "Rp450.000", grad: ["#4A8CFF", "#2A5FD6"] },
    { label: "Belanja Bulanan", sub: "1 - 5 Setiap Bulan", budget: "Rp1.750.000", grad: ["#A77BFF", "#7C4DFF"] },
    { label: "Belanja Besar", sub: "15 Setiap Bulan", budget: "Rp600.000", grad: ["#13E07A", "#0BA85A"] },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brandPrimary} />}
      >
        {/* HERO */}
        <LinearGradient colors={scheme === "dark" ? ["#14244A", "#0B1324"] : ["#E8EEFF", "#FFFFFF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + 14 }]}>
          <View style={styles.heroGlow} pointerEvents="none" />
          <View style={styles.cluster} pointerEvents="none">
            <LinearGradient colors={["#FFFFFF", "#DDE6FF"]} style={[styles.cBadge, { top: 2, right: 48, transform: [{ rotate: "-6deg" }] }]}><Icon name="clipboard-list" size={20} color="#2A5FD6" /></LinearGradient>
            <LinearGradient colors={["#3D6FD6", "#2447A0"]} style={[styles.cBadge, styles.cMain, { top: 24, right: 8 }]}><Icon name="cart" size={30} color="#FFD37A" /></LinearGradient>
            <LinearGradient colors={["#13E07A", "#0BA85A"]} style={[styles.cBadge, { top: 66, right: 54 }]}><Icon name="leaf" size={18} color="#FFFFFF" /></LinearGradient>
          </View>
          <View style={styles.heroTop}>
            <Text style={styles.heroDate}>{today}</Text>
            <Pressable testID="open-menu" onPress={() => router.push("/(app)/menu")} style={styles.menuBtn}><Icon name="menu" size={20} color="#FFFFFF" /></Pressable>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
            <Text style={styles.heroTitle}>Belanja Bulanan</Text>
            <Icon name="cart" size={22} color="#FFFFFF" />
          </View>
          <Text style={styles.heroSub}>Kelola kebutuhan belanja rutin keluarga Anda.</Text>
          <View style={styles.monthPill}>
            <Pressable testID="shop-month-prev" onPress={() => shiftMonth(-1)} hitSlop={8} style={styles.monthArrow}><Icon name="chevron-left" size={20} color="#FFFFFF" /></Pressable>
            <Text style={styles.monthPillText} testID="shop-month-label">{monthLabel}</Text>
            <Pressable testID="shop-month-next" onPress={() => shiftMonth(1)} hitSlop={8} style={styles.monthArrow}><Icon name="chevron-right" size={20} color="#FFFFFF" /></Pressable>
          </View>
        </LinearGradient>

        {/* STAT CARDS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}>
          {stats.map((s) => (
            <LinearGradient key={s.key} testID={`shop-stat-${s.key}`} colors={[`${s.tint}26`, scheme === "dark" ? "rgba(18,24,43,0.9)" : "#FFFFFF"]} start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 1 }} style={[styles.statCard, { borderColor: `${s.tint}55`, shadowColor: s.tint }]}>
              <Glossy grad={s.grad} icon={s.icon} size={36} iconSize={18} rad={12} style={styles.statIcon} />
              <Text style={styles.statLabel} numberOfLines={1}>{s.label}</Text>
              <Text style={[styles.statVal, { color: s.tint }]} numberOfLines={1}>{s.value}</Text>
              <Text style={styles.statSub} numberOfLines={1}>{s.sub}</Text>
            </LinearGradient>
          ))}
        </ScrollView>

        {/* COPY + FILTERS */}
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          <Pressable onPress={copyLastMonth} style={styles.copyBtn} testID="copy-last-month">
            <Icon name="content-copy" size={16} color={colors.brandPrimary} />
            <Text style={styles.copyText}>Salin Bulan Lalu</Text>
          </Pressable>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Chip label="Semua Kategori" on={catFilter === "all"} onPress={() => setCatFilter("all")} styles={styles} />
            {SHOP_CATS.map((c) => <Chip key={c} label={c} on={catFilter === c} onPress={() => setCatFilter(c)} styles={styles} />)}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {([["all", "Semua Status"], ["belum", "Belum"], ["sebagian", "Sebagian"], ["selesai", "Selesai"]] as const).map(([k, l]) => (
              <Chip key={k} label={l} on={statusFilter === k} onPress={() => setStatusFilter(k)} styles={styles} />
            ))}
          </ScrollView>
          <View style={styles.search}>
            <Icon name="magnify" size={18} color={colors.muted} />
            <TextInput testID="shop-search" style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Cari item belanja..." placeholderTextColor={colors.muted} />
            {query ? <Pressable onPress={() => setQuery("")} hitSlop={8}><Icon name="close-circle" size={18} color={colors.muted} /></Pressable> : null}
          </View>
        </View>

        {/* ITEM LIST */}
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          <Text style={styles.sectionTitle}>DAFTAR ITEM BELANJA</Text>
          {filtered.length === 0 ? (
            <EmptyState icon="cart-outline" title="Belum ada item" hint="Buat daftar belanja bulanan Anda." />
          ) : filtered.map((i) => {
            const p = i.budget ? Math.min(100, (i.realized / i.budget) * 100) : 0;
            const s = STATUS[i.status] || STATUS.belum;
            const v = itemVis(i.name, i.category);
            return (
              <View key={i.item_id} style={styles.card} testID={`shop-item-${i.item_id}`}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Glossy grad={v.grad} icon={v.icon} size={44} iconSize={21} rad={14} style={styles.itemIcon} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={styles.name} numberOfLines={1}>{i.name}</Text>
                      <View style={styles.freqTag}><Text style={styles.freqText}>{i.frequency}</Text></View>
                    </View>
                    <Text style={styles.cat}>{i.category}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text style={styles.budget}>{idr(i.budget)}</Text>
                    <View style={[styles.statusChip, { backgroundColor: `${s.c}22` }]}>
                      <Icon name={s.i} size={11} color={s.c} /><Text style={[styles.statusChipText, { color: s.c }]}>{s.l}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.track}><View style={{ height: 6, borderRadius: 3, width: `${p}%`, backgroundColor: s.c }} /></View>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                  <Text style={styles.realText}>Realisasi {idr(i.realized)}</Text>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <Pressable onPress={() => openEdit(i)} style={styles.actionBtn} testID={`edit-shop-${i.item_id}`}><Icon name="pencil" size={14} color={colors.info} /></Pressable>
                    <Pressable onPress={() => del(i)} style={styles.actionBtn} testID={`del-shop-${i.item_id}`}><Icon name="trash-can-outline" size={14} color={colors.error} /></Pressable>
                  </View>
                </View>
              </View>
            );
          })}
          <Pressable onPress={openAdd} style={styles.addBtn} testID="add-shopping">
            <Icon name="plus" size={18} color={colors.brandPrimary} /><Text style={styles.addBtnText}>Tambah Item Belanja</Text>
          </Pressable>
        </View>

        {/* RINGKASAN DONUT */}
        {items.length > 0 ? (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>RINGKASAN BELANJA</Text>
              <View style={{ alignItems: "center", marginTop: spacing.md }}>
                <View style={{ width: 160, height: 160, alignItems: "center", justifyContent: "center" }}>
                  <DonutChart data={[{ value: Math.max(totalReal, 0.0001), color: colors.success }, { value: Math.max(remain, 0), color: colors.warning }]} size={160} thickness={26} />
                  <View style={styles.donutCenter} pointerEvents="none">
                    <Text style={styles.donutLbl}>Total Anggaran</Text>
                    <Text style={styles.donutVal}>{idr(totalBudget)}</Text>
                    <Text style={styles.donutMonth}>{monthLabel}</Text>
                  </View>
                </View>
                <View style={{ alignSelf: "stretch", gap: 10, marginTop: spacing.md }}>
                  <Legend color={colors.success} label="Realisasi" amt={idr(totalReal)} pctv={`${pct.toFixed(1)}%`} styles={styles} />
                  <Legend color={colors.warning} label="Sisa Anggaran" amt={idr(remain)} pctv={`${(100 - pct).toFixed(1)}%`} styles={styles} />
                  <Legend color={colors.info} label="Sisa Hari" amt={`${daysLeft} Hari Lagi`} pctv="" styles={styles} />
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {/* PER KATEGORI */}
        {catDist.length > 0 ? (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>BELANJA PER KATEGORI</Text>
              <View style={{ flexDirection: "row", gap: spacing.lg, alignItems: "center", marginTop: spacing.md }}>
                <View style={{ width: 120, height: 120, alignItems: "center", justifyContent: "center" }}>
                  <DonutChart data={catDist.map((c, i) => ({ value: c.value, color: CAT_COLORS[i % CAT_COLORS.length] }))} size={120} thickness={22} />
                </View>
                <View style={{ flex: 1, gap: 9 }}>
                  {catDist.slice(0, 6).map((c, i) => (
                    <View key={c.label} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }} />
                      <View style={{ flex: 1 }}><Text style={styles.legendCat} numberOfLines={1}>{c.label}</Text><Text style={styles.legendSmall}>{idr(c.value)}</Text></View>
                      <Text style={styles.legendPct}>{totalBudget ? Math.round((c.value / totalBudget) * 100) : 0}%</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {/* 6 MONTH */}
        {sixMonth.some((m) => m.a > 0 || m.b > 0) ? (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>PERBANDINGAN 6 BULAN</Text>
              <View style={{ marginTop: spacing.sm, alignItems: "center" }}>
                <GroupedBarChart data={sixMonth} colorA={colors.info} colorB={colors.success} width={300} height={150} />
              </View>
              <View style={{ flexDirection: "row", gap: spacing.lg, marginTop: 4 }}>
                <View style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: colors.info }]} /><Text style={styles.legendCat}>Anggaran</Text></View>
                <View style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: colors.success }]} /><Text style={styles.legendCat}>Realisasi</Text></View>
              </View>
            </View>
          </View>
        ) : null}

        {/* SCHEDULES */}
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          <Text style={styles.sectionTitle}>JADWAL & CATATAN BELANJA</Text>
          {schedules.map((s) => (
            <View key={s.label} style={styles.schedCard}>
              <Glossy grad={s.grad} icon="calendar-month" size={44} iconSize={21} rad={14} />
              <View style={{ flex: 1 }}>
                <Text style={styles.schedLabel}>{s.label}</Text>
                <Text style={styles.schedSub}>{s.sub}</Text>
              </View>
              <Text style={styles.schedBudget}>{s.budget}</Text>
            </View>
          ))}
        </View>

        {/* INSIGHT */}
        <View style={{ paddingHorizontal: spacing.lg }}>
          <LinearGradient colors={scheme === "dark" ? ["#231A52", "#121033"] : ["#EDE9FF", "#F6F4FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.insightCard}>
            <View style={styles.insightGlow} pointerEvents="none" />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <Glossy grad={["#FFD54A", "#F7A825"]} icon="lightbulb-on" size={42} iconSize={21} rad={13} />
              <Text style={styles.insightTitle}>INSIGHT BELANJA</Text>
            </View>
            {insights.map((t, i) => (
              <View key={i} style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                <Icon name="circle-medium" size={18} color={colors.brandPrimary} />
                <Text style={styles.insightBody}>{t}</Text>
              </View>
            ))}
            <View style={styles.tipRow}>
              <Icon name="lightbulb-on-outline" size={16} color={colors.warning} />
              <Text style={styles.tipText}>Buat daftar belanja sebelum membeli untuk menghindari pengeluaran tak terencana.</Text>
            </View>
          </LinearGradient>
        </View>
      </ScrollView>

      {/* MODAL */}
      <Modal visible={modal.open} transparent animationType="slide" onRequestClose={() => setModal({ open: false })}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBg}>
          <View style={styles.modal}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "800" }}>{modal.edit ? "Edit Item Belanja" : "Tambah Item Belanja"}</Text>
              <Pressable onPress={() => setModal({ open: false })} testID="close-shop-modal"><Icon name="close" size={22} color={colors.onSurface} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ gap: 10 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Nama</Text>
              <TextInput testID="shop-name" style={styles.input} value={form.name} onChangeText={(t) => setForm((f) => ({ ...f, name: t }))} placeholder="cth. Beras" placeholderTextColor={colors.muted} />
              <Text style={styles.label}>Kategori</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 12 }}>
                {SHOP_CATS.map((c) => <PillButton key={c} label={c} active={form.category === c} onPress={() => setForm((f) => ({ ...f, category: c }))} />)}
              </ScrollView>
              <Text style={styles.label}>Anggaran (Rp)</Text>
              <TextInput testID="shop-budget" style={styles.input} keyboardType="numeric" value={form.budget} onChangeText={(t) => setForm((f) => ({ ...f, budget: t.replace(/[^0-9]/g, "") }))} placeholderTextColor={colors.muted} placeholder="0" />
              <Text style={styles.label}>Realisasi (Rp)</Text>
              <TextInput testID="shop-realized" style={styles.input} keyboardType="numeric" value={form.realized} onChangeText={(t) => setForm((f) => ({ ...f, realized: t.replace(/[^0-9]/g, "") }))} placeholderTextColor={colors.muted} placeholder="0" />
              <PrimaryButton label={modal.edit ? "Simpan Perubahan" : "Simpan"} onPress={submit} testID="shop-submit" />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Chip({ label, on, onPress, styles }: any) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && styles.chipActive]}>
      <Text style={[styles.chipText, on && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}
function Legend({ color, label, amt, pctv, styles }: any) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={styles.legendCat}>{label}</Text>
      <Text style={styles.legendAmt}>{amt}</Text>
      {pctv ? <Text style={styles.legendPct}>{pctv}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  hero: { borderBottomLeftRadius: 28, borderBottomRightRadius: 28, paddingBottom: spacing.lg, paddingHorizontal: spacing.lg, overflow: "hidden" },
  heroGlow: { position: "absolute", width: 240, height: 240, borderRadius: 120, backgroundColor: "rgba(61,126,255,0.12)", top: -130, alignSelf: "center" },
  cluster: { position: "absolute", top: 44, right: 10, width: 110, height: 100 },
  cBadge: { position: "absolute", width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  cMain: { width: 58, height: 58, borderRadius: 17 },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroDate: { color: "rgba(255,255,255,0.85)", fontSize: 10.5, fontWeight: "700", letterSpacing: 0.5 },
  menuBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  heroTitle: { color: "#FFFFFF", fontSize: 26, fontWeight: "800" },
  heroSub: { color: "rgba(255,255,255,0.82)", fontSize: 12.5, marginTop: 2, maxWidth: "66%" },
  monthPill: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginTop: spacing.md, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: radius.pill, paddingHorizontal: 6, height: 40, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  monthArrow: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  monthPillText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800", minWidth: 120, textAlign: "center" },

  statCard: { width: 158, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, gap: 5, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 12, elevation: 4 },
  statIcon: { shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  statLabel: { color: colors.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.3, marginTop: 2 },
  statVal: { fontSize: 17, fontWeight: "900" },
  statSub: { color: colors.muted, fontSize: 10, fontWeight: "600" },

  copyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  copyText: { color: colors.brandPrimary, fontSize: 13.5, fontWeight: "700" },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, flexShrink: 0 },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.muted, fontSize: 12.5, fontWeight: "700" },
  chipTextActive: { color: colors.onBrandPrimary },
  search: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, height: 46 },
  searchInput: { flex: 1, color: colors.onSurface, fontSize: 14, paddingVertical: 0 },

  sectionTitle: { color: colors.onSurface, fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: 12, borderWidth: 1, borderColor: colors.border },
  itemIcon: { shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  name: { color: colors.onSurface, fontSize: 14.5, fontWeight: "700", flexShrink: 1 },
  cat: { color: colors.muted, fontSize: 11, marginTop: 3 },
  freqTag: { paddingHorizontal: 8, height: 18, borderRadius: 9, backgroundColor: `${colors.brandSecondary}22`, alignItems: "center", justifyContent: "center" },
  freqText: { color: colors.brandSecondary, fontSize: 9.5, fontWeight: "800" },
  budget: { color: colors.onSurface, fontSize: 14, fontWeight: "800" },
  statusChip: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, height: 20, borderRadius: radius.pill },
  statusChipText: { fontSize: 10, fontWeight: "800" },
  track: { height: 6, backgroundColor: colors.surfaceTertiary, borderRadius: 3, overflow: "hidden", marginTop: 10 },
  realText: { color: colors.muted, fontSize: 11 },
  actionBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: `${colors.brandPrimary}55`, borderStyle: "dashed" },
  addBtnText: { color: colors.brandPrimary, fontSize: 14, fontWeight: "800" },

  panel: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  panelTitle: { color: colors.onSurface, fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },
  donutCenter: { position: "absolute", alignItems: "center", justifyContent: "center" },
  donutLbl: { color: colors.muted, fontSize: 10.5, fontWeight: "700" },
  donutVal: { color: colors.onSurface, fontSize: 18, fontWeight: "900", marginTop: 2 },
  donutMonth: { color: colors.muted, fontSize: 10, marginTop: 1 },
  legendCat: { color: colors.onSurface, fontSize: 12.5, flex: 1, fontWeight: "600" },
  legendSmall: { color: colors.muted, fontSize: 10.5 },
  legendAmt: { color: colors.muted, fontSize: 11.5 },
  legendPct: { color: colors.onSurface, fontSize: 12.5, fontWeight: "800" },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },

  schedCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: 12, borderWidth: 1, borderColor: colors.border },
  schedLabel: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  schedSub: { color: colors.muted, fontSize: 11, marginTop: 2 },
  schedBudget: { color: colors.brandPrimary, fontSize: 13, fontWeight: "800" },

  insightCard: { borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: `${colors.brandPrimary}44`, overflow: "hidden" },
  insightGlow: { position: "absolute", width: 170, height: 170, borderRadius: 85, backgroundColor: "rgba(155,107,255,0.14)", top: -85, right: -35 },
  insightTitle: { color: colors.onSurface, fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },
  insightBody: { color: colors.onSurface, fontSize: 12.5, lineHeight: 18, flex: 1, opacity: 0.92 },
  tipRow: { flexDirection: "row", gap: 8, marginTop: 6, backgroundColor: `${colors.warning}1A`, borderRadius: radius.md, padding: 10 },
  tipText: { color: colors.onSurface, fontSize: 11.5, lineHeight: 17, flex: 1 },

  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: "88%", borderWidth: 1, borderColor: colors.border },
  label: { color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", marginTop: 4 },
  input: { backgroundColor: colors.surfaceTertiary, color: colors.onSurface, borderRadius: radius.md, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: colors.border, fontSize: 14 },
}));
