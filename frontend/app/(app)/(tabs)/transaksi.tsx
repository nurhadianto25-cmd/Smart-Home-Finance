import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, FlatList, RefreshControl, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { api, idr } from "@/src/api";
import { useAuth } from "@/src/auth";
import { usePrefs } from "@/src/prefs";
import { localeTag } from "@/src/i18n";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { EmptyState } from "@/src/components/ui";
import { ProgressRing } from "@/src/components/charts";
import { useConfirm } from "@/src/confirm";

function Glossy({ grad, icon, size = 44, iconSize = 21, rad = 14, style }: any) {
  return (
    <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ width: size, height: size, borderRadius: rad, alignItems: "center", justifyContent: "center" }, style]}>
      <Icon name={icon} size={iconSize} color="#FFFFFF" />
    </LinearGradient>
  );
}

const CAT_VIS: Record<string, { icon: string; grad: string[] }> = {
  Gaji: { icon: "briefcase-check", grad: ["#13E07A", "#0BA85A"] },
  Bonus: { icon: "gift", grad: ["#13E07A", "#0BA85A"] },
  Usaha: { icon: "storefront", grad: ["#13E07A", "#0BA85A"] },
  Investasi: { icon: "chart-line", grad: ["#13E07A", "#0BA85A"] },
  Hadiah: { icon: "gift-open", grad: ["#13E07A", "#0BA85A"] },
  Belanja: { icon: "cart", grad: ["#FF5B69", "#E23544"] },
  Makanan: { icon: "silverware-fork-knife", grad: ["#FFB44A", "#F7742F"] },
  Tagihan: { icon: "flash", grad: ["#FF5B69", "#E23544"] },
  Cicilan: { icon: "credit-card", grad: ["#FF9D3D", "#F7742F"] },
  Pinjaman: { icon: "cash", grad: ["#A77BFF", "#7C4DFF"] },
  Transportasi: { icon: "car", grad: ["#FFB44A", "#F7742F"] },
  Pendidikan: { icon: "school", grad: ["#A77BFF", "#7C4DFF"] },
  Tabungan: { icon: "piggy-bank", grad: ["#10D96A", "#0BB457"] },
  Kesehatan: { icon: "heart-pulse", grad: ["#FF5B69", "#E23544"] },
  Hiburan: { icon: "gamepad-variant", grad: ["#4A8CFF", "#2A5FD6"] },
  "Rumah Tangga": { icon: "home-variant", grad: ["#4A8CFF", "#2A5FD6"] },
  Lainnya: { icon: "dots-horizontal", grad: ["#8B9DA5", "#6B7A82"] },
};
function catVis(tx: any) {
  return CAT_VIS[tx.category] || (tx.type === "income" ? { icon: "arrow-down-bold", grad: ["#13E07A", "#0BA85A"] } : { icon: "arrow-up-bold", grad: ["#FF5B69", "#E23544"] });
}

export default function Transaksi() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [type, setType] = useState<"all" | "income" | "expense">("all");
  const [sortDesc, setSortDesc] = useState(true);
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const [allItems, setAllItems] = useState<any[]>([]);
  const [prevTotals, setPrevTotals] = useState({ income: 0, expense: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const { colors, scheme } = useTheme();
  const { t } = usePrefs();
  const { user } = useAuth();
  const styles = useStyles();
  const confirm = useConfirm();

  const prevMonth = (() => {
    const d = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  const load = useCallback(async () => {
    try {
      const [cur, prev] = await Promise.all([
        api<any[]>(`/transactions?month=${month}`),
        api<any[]>(`/transactions?month=${prevMonth}`).catch(() => []),
      ]);
      setAllItems(cur);
      setPrevTotals({
        income: prev.filter((i) => i.type === "income").reduce((s, i) => s + i.amount, 0),
        expense: prev.filter((i) => i.type === "expense").reduce((s, i) => s + i.amount, 0),
      });
    } catch {}
  }, [month, prevMonth]);
  useEffect(() => { load(); }, [load]);

  const shiftMonth = (delta: number) => {
    const d = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const monthLabel = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1).toLocaleDateString(localeTag(), { month: "long", year: "numeric" });
  const today = new Date().toLocaleDateString(localeTag(), { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase();

  const onDelete = async (id: string) => {
    const ok = await confirm({ title: "Hapus Transaksi", message: "Transaksi ini akan dihapus permanen. Lanjutkan?", danger: true });
    if (!ok) return;
    try { await api(`/transactions/${id}`, { method: "DELETE" }); load(); } catch {}
  };

  const q = query.trim().toLowerCase();
  const items = allItems
    .filter((i) => (type === "all" ? true : i.type === type))
    .filter((i) => (q ? `${i.title} ${i.category}`.toLowerCase().includes(q) : true));

  const grouped: Record<string, any[]> = {};
  for (const it of items) { const d = (it.date || "").slice(0, 10); (grouped[d] ||= []).push(it); }
  const sections = Object.entries(grouped).sort((a, b) => (sortDesc ? b[0].localeCompare(a[0]) : a[0].localeCompare(b[0])));

  const totalIn = allItems.filter((i) => i.type === "income").reduce((s, i) => s + i.amount, 0);
  const totalOut = allItems.filter((i) => i.type === "expense").reduce((s, i) => s + i.amount, 0);
  const countIn = allItems.filter((i) => i.type === "income").length;
  const countOut = allItems.filter((i) => i.type === "expense").length;
  const pct = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : a > 0 ? 100 : 0);
  const inDelta = pct(totalIn, prevTotals.income);
  const outDelta = pct(totalOut, prevTotals.expense);
  const selisih = totalIn - totalOut;

  const statCards = [
    { key: "income", label: "PEMASUKAN", value: idr(totalIn), icon: "arrow-up-bold", grad: ["#13E07A", "#0BA85A"], tint: colors.success, delta: `${inDelta >= 0 ? "↑" : "↓"} ${Math.abs(inDelta)}% dari bulan lalu`, up: inDelta >= 0 },
    { key: "expense", label: "PENGELUARAN", value: idr(totalOut), icon: "arrow-down-bold", grad: ["#FF5B69", "#E23544"], tint: colors.error, delta: `${outDelta <= 0 ? "↓" : "↑"} ${Math.abs(outDelta)}% dari bulan lalu`, up: outDelta <= 0 },
    { key: "diff", label: "SELISIH", value: idr(selisih), icon: "swap-vertical-bold", grad: ["#4A8CFF", "#2A5FD6"], tint: colors.info, delta: selisih >= 0 ? "Surplus bulan ini" : "Defisit bulan ini", up: selisih >= 0 },
    { key: "count", label: "TRANSAKSI", value: String(allItems.length), icon: "chart-box", grad: ["#A77BFF", "#7C4DFF"], tint: colors.brandPrimary, delta: "Jumlah transaksi", up: true },
  ];

  const tip = outDelta > 0
    ? `Pengeluaran bulan ini meningkat ${Math.abs(outDelta)}% dibanding bulan lalu. Tinjau kembali kategori terbesar.`
    : outDelta < 0
    ? `Mantap! Pengeluaran turun ${Math.abs(outDelta)}% dibanding bulan lalu. Pertahankan kebiasaan hemat Anda.`
    : "Catat setiap transaksi agar analisis keuangan Anda makin akurat.";

  const Header = (
    <View style={{ gap: spacing.lg }}>
      {/* HERO */}
      <LinearGradient colors={scheme === "dark" ? ["#14244A", "#0B1324"] : ["#E8EEFF", "#FFFFFF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + 14 }]}>
        <View style={styles.heroGlow} pointerEvents="none" />
        <View style={styles.cluster} pointerEvents="none">
          <LinearGradient colors={["#2A3E66", "#16233F"]} style={styles.walletBadge}><Icon name="wallet" size={30} color="#9Fc0FF" /></LinearGradient>
          <LinearGradient colors={["#FFD66B", "#F59E0B"]} style={[styles.coin, { top: 2, right: 2 }]}><Icon name="currency-usd" size={14} color="#6B4E00" /></LinearGradient>
          <LinearGradient colors={["#FFD66B", "#F59E0B"]} style={[styles.coin, { top: 34, right: 44 }]}><Icon name="currency-usd" size={12} color="#6B4E00" /></LinearGradient>
        </View>
        <View style={styles.heroTop}>
          <Text style={styles.heroDate}>{today}</Text>
          <Pressable testID="open-menu" onPress={() => router.push("/(app)/menu")} style={styles.menuBtn}><Icon name="menu" size={20} color="#FFFFFF" /></Pressable>
        </View>
        <Text style={styles.heroWelcome}>Selamat datang kembali,</Text>
        <Text style={styles.heroName} testID="tx-user-name">{user?.name ?? "Pengguna"} 👋</Text>
        <Text style={styles.heroSub}>Kelola setiap transaksi dengan mudah dan terukur.</Text>
        <View style={styles.actionRow}>
          <Pressable testID="add-income" onPress={() => router.push({ pathname: "/(app)/add-transaction", params: { type: "income" } })} style={{ flex: 1 }}>
            <LinearGradient colors={["#13E07A", "#0BA85A"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionBtn}>
              <Icon name="plus" size={18} color="#FFFFFF" /><Text style={styles.actionText}>Pemasukan</Text>
            </LinearGradient>
          </Pressable>
          <Pressable testID="add-expense" onPress={() => router.push({ pathname: "/(app)/add-transaction", params: { type: "expense" } })} style={{ flex: 1 }}>
            <LinearGradient colors={["#FF5B69", "#E23544"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionBtn}>
              <Icon name="plus" size={18} color="#FFFFFF" /><Text style={styles.actionText}>Pengeluaran</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </LinearGradient>

      {/* STAT CARDS */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}>
        {statCards.map((s) => (
          <LinearGradient key={s.key} testID={`tx-stat-${s.key}`} colors={[`${s.tint}26`, scheme === "dark" ? "rgba(18,24,43,0.9)" : "#FFFFFF"]} start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 1 }} style={[styles.statCard, { borderColor: `${s.tint}55`, shadowColor: s.tint }]}>
            <Glossy grad={s.grad} icon={s.icon} size={36} iconSize={18} rad={12} style={styles.statIcon} />
            <Text style={styles.statLabel}>{s.label}</Text>
            <Text style={[styles.statVal, { color: s.tint }]} numberOfLines={1}>{s.value}</Text>
            <Text style={[styles.statDelta, { color: s.up ? colors.success : colors.error }]} numberOfLines={1}>{s.delta}</Text>
          </LinearGradient>
        ))}
      </ScrollView>

      {/* MONTH + FILTERS */}
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
        <View style={styles.monthNav}>
          <Pressable testID="tx-month-prev" onPress={() => shiftMonth(-1)} style={styles.monthBtn}><Icon name="chevron-left" size={20} color={colors.onSurface} /></Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Icon name="calendar-month" size={16} color={colors.brandPrimary} />
            <Text style={styles.monthLabel} testID="tx-month-label">{monthLabel}</Text>
          </View>
          <Pressable testID="tx-month-next" onPress={() => shiftMonth(1)} style={styles.monthBtn}><Icon name="chevron-right" size={20} color={colors.onSurface} /></Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {([["all", "Semua"], ["income", "Pemasukan"], ["expense", "Pengeluaran"]] as const).map(([k, lbl]) => (
            <Pressable key={k} testID={`filter-${k}`} onPress={() => setType(k)} style={[styles.chip, type === k && styles.chipActive]}>
              <Text style={[styles.chipText, type === k && styles.chipTextActive]}>{lbl}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.search}>
          <Icon name="magnify" size={18} color={colors.muted} />
          <TextInput testID="tx-search" style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Cari transaksi..." placeholderTextColor={colors.muted} />
          {query ? <Pressable onPress={() => setQuery("")} hitSlop={8}><Icon name="close-circle" size={18} color={colors.muted} /></Pressable> : null}
        </View>
        <View style={styles.listHeadRow}>
          <Text style={styles.listHeadTitle}>DAFTAR TRANSAKSI</Text>
          <Pressable onPress={() => setSortDesc((s) => !s)} style={styles.sortPill} testID="tx-sort">
            <Text style={styles.sortText}>Urutkan: {sortDesc ? "Terbaru" : "Terlama"}</Text>
            <Icon name="swap-vertical" size={15} color={colors.brandPrimary} />
          </Pressable>
        </View>
      </View>
    </View>
  );

  const Footer = allItems.length > 0 ? (
    <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg, marginTop: spacing.lg }}>
      {/* Activity */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>AKTIVITAS TRANSAKSI</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg, marginTop: spacing.md }}>
          <View style={{ width: 96, height: 96, alignItems: "center", justifyContent: "center" }}>
            <ProgressRing value={allItems.length ? (countIn / allItems.length) * 100 : 0} size={96} thickness={12} color={colors.success} bg={`${colors.error}55`} />
            <View style={styles.ringCenter} pointerEvents="none">
              <Text style={styles.ringNum}>{allItems.length}</Text>
              <Text style={styles.ringLbl}>Total</Text>
            </View>
          </View>
          <View style={{ flex: 1, gap: 12 }}>
            <View style={styles.actStat}>
              <Glossy grad={["#13E07A", "#0BA85A"]} icon="arrow-up-bold" size={32} iconSize={16} rad={10} />
              <View><Text style={styles.actNum}>{countIn}</Text><Text style={styles.actLbl}>Pemasukan</Text></View>
            </View>
            <View style={styles.actStat}>
              <Glossy grad={["#FF5B69", "#E23544"]} icon="arrow-down-bold" size={32} iconSize={16} rad={10} />
              <View><Text style={styles.actNum}>{countOut}</Text><Text style={styles.actLbl}>Pengeluaran</Text></View>
            </View>
          </View>
        </View>
      </View>

      {/* Tips */}
      <LinearGradient colors={scheme === "dark" ? ["#231A52", "#121033"] : ["#EDE9FF", "#F6F4FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tipCard}>
        <View style={styles.tipGlow} pointerEvents="none" />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <Glossy grad={["#FFD54A", "#F7A825"]} icon="lightbulb-on" size={40} iconSize={20} rad={13} />
          <Text style={styles.tipTitle}>Tips Hemat</Text>
        </View>
        <Text style={styles.tipBody}>{tip}</Text>
      </LinearGradient>
    </View>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <FlatList
        data={sections}
        keyExtractor={([d]) => d}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={Header}
        ListFooterComponent={Footer}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brandPrimary} />}
        ListEmptyComponent={<View style={{ paddingHorizontal: spacing.lg }}><EmptyState icon="receipt-text-outline" title={t("noTx")} hint={t("noTxHint")} /></View>}
        renderItem={({ item: [date, arr] }) => {
          const daySum = (arr as any[]).reduce((s, x) => s + (x.type === "income" ? x.amount : -x.amount), 0);
          const dateLabel = new Date(date + "T00:00:00").toLocaleDateString(localeTag(), { day: "numeric", month: "long", year: "numeric" });
          return (
            <View style={{ gap: 8, paddingHorizontal: spacing.lg }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                <Text style={styles.dateHeader}>{dateLabel.toUpperCase()}</Text>
                <Text style={[styles.dateHeader, { color: daySum >= 0 ? colors.success : colors.error }]}>{daySum >= 0 ? "+" : ""}{idr(daySum)}</Text>
              </View>
              {(arr as any[]).map((x) => {
                const v = catVis(x);
                const time = (x.date || "").slice(11, 16);
                return (
                  <View key={x.tx_id} style={styles.row} testID={`tx-${x.tx_id}`}>
                    <Glossy grad={v.grad} icon={v.icon} size={44} iconSize={21} rad={14} style={styles.rowIcon} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{x.title}</Text>
                      <Text style={styles.rowSub}>{x.category}{time ? ` · ${time}` : ""}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 6 }}>
                      <Text style={[styles.rowAmount, { color: x.type === "income" ? colors.success : colors.error }]}>{x.type === "income" ? "+" : "-"}{idr(x.amount)}</Text>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        <Pressable
                          onPress={() => router.push({ pathname: "/(app)/add-transaction", params: { tx_id: x.tx_id, type: x.type, amount: String(x.amount), category: x.category, title: x.title, note: x.note || "", date: x.date, child_id: x.child_id || "", link_type: x.link_type || "", link_id: x.link_id || "" } })}
                          style={styles.actBtn} testID={`edit-${x.tx_id}`}
                        ><Icon name="pencil" size={15} color={colors.info} /></Pressable>
                        <Pressable onPress={() => onDelete(x.tx_id)} style={styles.actBtn} testID={`del-${x.tx_id}`}><Icon name="close" size={15} color={colors.error} /></Pressable>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          );
        }}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  // Hero
  hero: { borderBottomLeftRadius: 28, borderBottomRightRadius: 28, paddingBottom: spacing.lg, paddingHorizontal: spacing.lg, overflow: "hidden" },
  heroGlow: { position: "absolute", width: 240, height: 240, borderRadius: 120, backgroundColor: "rgba(61,126,255,0.12)", top: -130, alignSelf: "center" },
  cluster: { position: "absolute", top: 46, right: 12, width: 86, height: 76 },
  walletBadge: { position: "absolute", top: 14, right: 18, width: 58, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center", shadowColor: "#3D7EFF", shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  coin: { position: "absolute", width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroDate: { color: "rgba(255,255,255,0.85)", fontSize: 10.5, fontWeight: "700", letterSpacing: 0.5 },
  menuBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  heroWelcome: { color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: 6 },
  heroName: { color: "#FFFFFF", fontSize: 24, fontWeight: "800" },
  heroSub: { color: "rgba(255,255,255,0.8)", fontSize: 12.5, marginTop: 2, maxWidth: "72%" },
  actionRow: { flexDirection: "row", gap: 10, marginTop: spacing.lg },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 46, borderRadius: radius.md },
  actionText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },

  // Stat cards
  statCard: { width: 156, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, gap: 5, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 12, elevation: 4 },
  statIcon: { shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  statLabel: { color: colors.muted, fontSize: 9.5, fontWeight: "800", letterSpacing: 0.4, marginTop: 2 },
  statVal: { fontSize: 17, fontWeight: "900" },
  statDelta: { fontSize: 9.5, fontWeight: "700" },

  // Month + filters
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 8, height: 46 },
  monthBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  monthLabel: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
  chip: { height: 36, paddingHorizontal: 16, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, flexShrink: 0 },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: colors.onBrandPrimary },
  search: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, height: 46 },
  searchInput: { flex: 1, color: colors.onSurface, fontSize: 14, paddingVertical: 0 },
  listHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  listHeadTitle: { color: colors.onSurface, fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },
  sortPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, height: 30, borderRadius: radius.pill, backgroundColor: `${colors.brandPrimary}1F` },
  sortText: { color: colors.brandPrimary, fontSize: 12, fontWeight: "700" },

  // Rows
  dateHeader: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: 12, borderWidth: 1, borderColor: colors.border },
  rowIcon: { shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  rowTitle: { color: colors.onSurface, fontSize: 14.5, fontWeight: "700" },
  rowSub: { color: colors.muted, fontSize: 11.5, marginTop: 2 },
  rowAmount: { fontSize: 14.5, fontWeight: "900" },
  actBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },

  // Footer panels
  panel: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  panelTitle: { color: colors.onSurface, fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },
  ringCenter: { position: "absolute", alignItems: "center", justifyContent: "center" },
  ringNum: { color: colors.onSurface, fontSize: 26, fontWeight: "900" },
  ringLbl: { color: colors.muted, fontSize: 10, fontWeight: "700", marginTop: -2 },
  actStat: { flexDirection: "row", alignItems: "center", gap: 10 },
  actNum: { color: colors.onSurface, fontSize: 18, fontWeight: "900" },
  actLbl: { color: colors.muted, fontSize: 11.5 },
  tipCard: { borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: `${colors.brandPrimary}44`, overflow: "hidden" },
  tipGlow: { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(155,107,255,0.14)", top: -80, right: -30 },
  tipTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "800" },
  tipBody: { color: colors.onSurface, fontSize: 13, lineHeight: 19, opacity: 0.92 },
}));
