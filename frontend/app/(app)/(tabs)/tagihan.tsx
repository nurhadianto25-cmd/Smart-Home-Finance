import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, TextInput, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "@react-native-vector-icons/material-design-icons";
import { api, idr } from "@/src/api";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { EmptyState, PillButton, PrimaryButton } from "@/src/components/ui";
import { DonutChart, GroupedBarChart } from "@/src/components/charts";
import { isoToDisplay } from "@/src/utils/date";
import { useConfirm } from "@/src/confirm";
import { localeTag } from "@/src/i18n";

const KINDS = [
  { k: "rutin", label: "Tagihan Rutin", icon: "flash", color: "#3D7EFF" },
  { k: "cicilan", label: "Cicilan / Kredit", icon: "credit-card", color: "#FF9D3D" },
  { k: "pinjaman", label: "Pinjaman", icon: "cash", color: "#9B6BFF" },
  { k: "lainnya", label: "Lainnya", icon: "dots-horizontal", color: "#8B9DA5" },
];

const GROUPS = [
  { k: "segera", label: "SEGERA JATUH TEMPO", tone: "warning" as const },
  { k: "belum", label: "BELUM DIBAYAR", tone: "info" as const },
  { k: "terlambat", label: "TERLAMBAT", tone: "error" as const },
  { k: "lunas", label: "LUNAS BULAN INI", tone: "success" as const },
  { k: "ditangguhkan", label: "DITANGGUHKAN", tone: "muted" as const },
];

const emptyForm = { name: "", kind: "rutin", category: "Umum", amount: "", due_day: "", status: "belum", note: "" };

function billVisual(b: any): { icon: string; color: string } {
  const s = `${b.category || ""} ${b.name || ""}`.toLowerCase();
  if (/listrik|pln|token/.test(s)) return { icon: "flash", color: "#FF9D3D" };
  if (/galon/.test(s)) return { icon: "cup-water", color: "#EF4444" };
  if (/air|pdam/.test(s)) return { icon: "water", color: "#3D7EFF" };
  if (/internet|wifi|indihome|data|pulsa/.test(s)) return { icon: "wifi", color: "#10D96A" };
  if (/mobil|toyota|avanza|kendaraan/.test(s)) return { icon: "car", color: "#3D7EFF" };
  if (/motor|nmax|honda|vario|beat/.test(s)) return { icon: "motorbike", color: "#10D96A" };
  if (/kartu kredit|credit/.test(s)) return { icon: "credit-card", color: "#3D7EFF" };
  if (/asuransi|bpjs|kesehatan/.test(s)) return { icon: "shield-plus", color: "#10D96A" };
  if (/kredit|pinjaman|bank|bca|mandiri|bri|bni/.test(s)) return { icon: "bank", color: "#9B6BFF" };
  if (/sekolah|pendidikan|spp|kampus/.test(s)) return { icon: "school", color: "#FF9D3D" };
  if (/cicilan/.test(s)) return { icon: "credit-card", color: "#FF9D3D" };
  return { icon: "receipt", color: "#8B9DA5" };
}

export default function Tagihan() {
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useTheme();
  const styles = useStyles();
  const confirm = useConfirm();
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [addMenu, setAddMenu] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; edit?: any | null }>({ open: false, edit: null });
  const [form, setForm] = useState<any>(emptyForm);
  const [month, setMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });

  const load = useCallback(async () => {
    try { setItems(await api<any[]>(`/bills?month=${month}`)); } catch {}
  }, [month]);
  useEffect(() => { load(); }, [load]);

  const shiftMonth = (delta: number) => {
    const y = Number(month.slice(0, 4)); const m = Number(month.slice(5, 7));
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const monthLabel = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1).toLocaleDateString(localeTag(), { month: "long", year: "numeric" });
  const todayLabel = new Date().toLocaleDateString(localeTag(), { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase();

  const today = new Date();
  const withDaysLeft = items.map(b => {
    let dl = 999;
    try { dl = Math.floor((new Date(b.due_date).getTime() - today.getTime()) / 86400000); } catch {}
    return { ...b, days_left: dl };
  });

  const q = query.trim().toLowerCase();
  const filtered = withDaysLeft
    .filter(b => (filter === "all" ? true : b.kind === filter))
    .filter(b => (q ? `${b.name} ${b.category}`.toLowerCase().includes(q) : true));

  // ---- Summary metrics ----
  const monthTotal = withDaysLeft.reduce((s, b) => s + b.amount, 0);
  const paidSum = withDaysLeft.filter(b => b.status === "lunas").reduce((s, b) => s + b.amount, 0);
  const unpaidSum = monthTotal - paidSum;
  const cicilanSum = withDaysLeft.filter(b => b.kind === "cicilan").reduce((s, b) => s + b.amount, 0);
  const paidPct = monthTotal > 0 ? Math.round((paidSum / monthTotal) * 1000) / 10 : 0;
  const unpaidPct = monthTotal > 0 ? Math.round((unpaidSum / monthTotal) * 1000) / 10 : 0;
  const attention = withDaysLeft.filter(b => b.status === "segera" || b.status === "terlambat").length;

  const statCards = [
    { id: "total", label: "TOTAL KEWAJIBAN", value: idr(monthTotal), sub: `${items.length} kewajiban aktif`, tint: colors.brandPrimary, icon: "wallet" },
    { id: "cicilan", label: "CICILAN BULAN INI", value: idr(cicilanSum), sub: "Cicilan & kredit", tint: colors.success, icon: "calendar-month" },
    { id: "paid", label: "SUDAH DIBAYAR", value: idr(paidSum), sub: `${paidPct}% dari bulan ini`, tint: colors.info, icon: "check-circle" },
    { id: "rest", label: "SISA BULAN INI", value: idr(unpaidSum), sub: `${unpaidPct}% belum dibayar`, tint: colors.warning, icon: "clock-time-four" },
    { id: "attn", label: "SEGERA / TERLAMBAT", value: String(attention), sub: "Perlu perhatian", tint: colors.error, icon: "bell-ring" },
  ];

  // ---- Donut status ----
  const statusMeta: { k: string; label: string; color: string }[] = [
    { k: "lunas", label: "Lunas", color: colors.success },
    { k: "belum", label: "Belum Dibayar", color: colors.info },
    { k: "segera", label: "Segera Jatuh Tempo", color: colors.warning },
    { k: "terlambat", label: "Terlambat", color: colors.error },
    { k: "ditangguhkan", label: "Ditangguhkan", color: colors.muted },
  ];
  const statusCounts = statusMeta.map(m => ({ ...m, count: withDaysLeft.filter(b => b.status === m.k).length }));
  const donutData = statusCounts.filter(s => s.count > 0).map(s => ({ value: s.count, color: s.color }));

  // ---- Beban per month (recurring, grouped) ----
  const rutinTotal = withDaysLeft.filter(b => b.kind === "rutin" || b.kind === "lainnya").reduce((s, b) => s + b.amount, 0);
  const kreditTotal = withDaysLeft.filter(b => b.kind === "cicilan" || b.kind === "pinjaman").reduce((s, b) => s + b.amount, 0);
  const barData = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 - (5 - i), 1);
    return { label: d.toLocaleDateString(localeTag(), { month: "short" }), a: rutinTotal, b: kreditTotal };
  });

  // ---- Upcoming & biggest ----
  const upcoming = withDaysLeft
    .filter(b => b.status !== "lunas" && b.days_left >= -3 && b.days_left <= 14)
    .sort((x, y) => x.days_left - y.days_left)
    .slice(0, 4);
  const biggest = [...withDaysLeft].sort((x, y) => y.amount - x.amount).slice(0, 3);

  // ---- CRUD ----
  const openAdd = (kind: string) => { setForm({ ...emptyForm, kind }); setAddMenu(false); setModal({ open: true, edit: null }); };
  const openEdit = (b: any) => {
    setForm({ name: b.name, kind: b.kind, category: b.category, amount: String(b.amount), due_day: String(b.due_day || (b.due_date || "").slice(8, 10) || ""), status: "belum", note: b.note || "" });
    setModal({ open: true, edit: b });
  };
  const submit = async () => {
    const day = parseInt(form.due_day, 10);
    if (!form.name || !form.amount || !day || day < 1 || day > 31) return;
    const body = { name: form.name, kind: form.kind, category: form.category, amount: parseFloat(form.amount), due_day: day, status: form.status, note: form.note };
    try {
      if (modal.edit) await api(`/bills/${modal.edit.bill_id}`, { method: "PUT", body: JSON.stringify(body) });
      else await api("/bills", { method: "POST", body: JSON.stringify(body) });
      setModal({ open: false }); setForm(emptyForm); load();
    } catch {}
  };
  const del = async (b: any) => {
    const ok = await confirm({ title: "Hapus Tagihan", message: `Hapus "${b.name}"? Data ini tidak dapat dikembalikan.`, danger: true });
    if (!ok) return;
    try { await api(`/bills/${b.bill_id}`, { method: "DELETE" }); load(); } catch {}
  };

  const statusInfo = (b: any) => {
    switch (b.status) {
      case "segera": return { text: b.days_left <= 0 ? "Jatuh tempo hari ini" : `${b.days_left} hari lagi`, color: colors.warning };
      case "belum": return { text: "Belum dibayar", color: colors.info };
      case "terlambat": return { text: `Terlambat ${Math.abs(b.days_left)} hari`, color: colors.error };
      case "lunas": return { text: `Lunas ${isoToDisplay(b.due_date)}`, color: colors.success };
      case "ditangguhkan": return { text: "Ditangguhkan", color: colors.muted };
      default: return { text: b.status, color: colors.muted };
    }
  };

  const grouped: Record<string, any[]> = {};
  for (const b of filtered) (grouped[b.status] ||= []).push(b);

  const bottomChrome = insets.bottom;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomChrome + 120, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brandPrimary} />}
      >
        {/* ---------- HERO ---------- */}
        <LinearGradient
          colors={[colors.brandPrimary, colors.brandSecondary]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 16 }]}
        >
          <View style={styles.heroDecor1} />
          <View style={styles.heroDecor2} />

          {/* 3D icon cluster */}
          <View style={styles.cluster} pointerEvents="none">
            <LinearGradient colors={["#FFE2A8", "#FF9D3D"]} style={[styles.clusterBadge, { top: 2, right: 56, transform: [{ rotate: "-8deg" }] }]}>
              <Icon name="calculator-variant" size={22} color="#7A3E00" />
            </LinearGradient>
            <LinearGradient colors={["#FFFFFF", "#DCE4FF"]} style={[styles.clusterBadge, styles.clusterMain, { top: 22, right: 8 }]}>
              <Icon name="calendar-check" size={30} color={colors.brandSecondary} />
            </LinearGradient>
            <LinearGradient colors={["#FFD66B", "#F59E0B"]} style={[styles.clusterBadge, { top: 70, right: 60 }]}>
              <Icon name="cash-multiple" size={20} color="#6B4E00" />
            </LinearGradient>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg }}>
            <Text style={styles.heroDate}>{todayLabel}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: spacing.lg, marginTop: 4 }}>
            <Text style={styles.heroTitle}>Tagihan & Cicilan</Text>
            <Icon name="clipboard-text" size={22} color="#FFFFFF" />
          </View>
          <Text style={styles.heroSub}>Kelola semua tagihan rutin dan cicilan Anda dengan mudah.</Text>

          <View style={styles.monthPill}>
            <Pressable testID="bill-month-prev" onPress={() => shiftMonth(-1)} hitSlop={8} style={styles.monthArrow}>
              <Icon name="chevron-left" size={20} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.monthPillText} testID="bill-month-label">{monthLabel}</Text>
            <Pressable testID="bill-month-next" onPress={() => shiftMonth(1)} hitSlop={8} style={styles.monthArrow}>
              <Icon name="chevron-right" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </LinearGradient>

        {/* ---------- STAT CARDS ---------- */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}>
          {statCards.map(c => (
            <LinearGradient
              key={c.id}
              testID={`stat-${c.id}`}
              colors={[`${c.tint}26`, scheme === "dark" ? "rgba(18,24,43,0.9)" : "#FFFFFF"]}
              start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 1 }}
              style={[styles.statCard, { borderColor: `${c.tint}55`, shadowColor: c.tint }]}
            >
              <LinearGradient colors={[c.tint, `${c.tint}AA`]} style={styles.statIcon}>
                <Icon name={c.icon as any} size={20} color="#FFFFFF" />
              </LinearGradient>
              <Text style={styles.statLabel} numberOfLines={1}>{c.label}</Text>
              <Text style={[styles.statValue, { color: c.tint }]} numberOfLines={1}>{c.value}</Text>
              <Text style={styles.statSub} numberOfLines={1}>{c.sub}</Text>
            </LinearGradient>
          ))}
        </ScrollView>

        {/* ---------- FILTER CHIPS ---------- */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.lg }}>
          <PillButton testID="fbill-all" label="Semua" active={filter === "all"} onPress={() => setFilter("all")} />
          {KINDS.map(k => (
            <PillButton key={k.k} testID={`fbill-${k.k}`} label={k.label} active={filter === k.k} onPress={() => setFilter(k.k)} />
          ))}
        </ScrollView>

        {/* ---------- SEARCH ---------- */}
        <View style={{ paddingHorizontal: spacing.lg }}>
          <View style={styles.search}>
            <Icon name="magnify" size={18} color={colors.muted} />
            <TextInput
              testID="bill-search"
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Cari tagihan atau cicilan..."
              placeholderTextColor={colors.muted}
            />
            {query ? <Pressable onPress={() => setQuery("")} hitSlop={8}><Icon name="close-circle" size={18} color={colors.muted} /></Pressable> : null}
          </View>
        </View>

        {/* ---------- RINGKASAN STATUS (donut) ---------- */}
        {items.length > 0 ? (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>RINGKASAN STATUS</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg, marginTop: spacing.md }}>
                <View style={{ width: 128, height: 128, alignItems: "center", justifyContent: "center" }}>
                  <DonutChart data={donutData.length ? donutData : [{ value: 1, color: colors.surfaceTertiary }]} size={128} thickness={18} />
                  <View style={styles.donutCenter} pointerEvents="none">
                    <Text style={styles.donutBig}>{items.length}</Text>
                    <Text style={styles.donutSmall}>Kewajiban</Text>
                  </View>
                </View>
                <View style={{ flex: 1, gap: 8 }}>
                  {statusCounts.map(s => {
                    const pct = items.length ? Math.round((s.count / items.length) * 100) : 0;
                    return (
                      <View key={s.k} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: s.color }} />
                        <Text style={styles.legendLabel}>{s.label}</Text>
                        <Text style={styles.legendValue}>{s.count} ({pct}%)</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {/* ---------- BEBAN KEWAJIBAN (bar) ---------- */}
        {items.length > 0 ? (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <View style={styles.panel}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={styles.panelTitle}>BEBAN KEWAJIBAN</Text>
                <Text style={styles.panelHint}>6 bulan</Text>
              </View>
              <View style={{ marginTop: spacing.sm }}>
                <GroupedBarChart data={barData} colorA={colors.brandPrimary} colorB={colors.brandSecondary} width={300} height={150} />
              </View>
              <View style={{ flexDirection: "row", gap: spacing.lg, marginTop: 4 }}>
                <View style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: colors.brandPrimary }]} /><Text style={styles.legendLabel}>Tagihan Rutin</Text></View>
                <View style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: colors.brandSecondary }]} /><Text style={styles.legendLabel}>Cicilan / Kredit</Text></View>
              </View>
            </View>
          </View>
        ) : null}

        {/* ---------- UPCOMING ---------- */}
        {upcoming.length > 0 ? (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>TAGIHAN AKAN DATANG</Text>
              <Text style={styles.panelHint}>{upcoming.length} tagihan dalam 14 hari ke depan</Text>
              <View style={{ marginTop: spacing.sm, gap: 10 }}>
                {upcoming.map(b => (
                  <View key={b.bill_id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Text style={styles.upDate}>{isoToDisplay(b.due_date)}</Text>
                    <Text style={styles.upName} numberOfLines={1}>{b.name}</Text>
                    <Text style={styles.upAmount}>{idr(b.amount)}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : null}

        {/* ---------- BIGGEST ---------- */}
        {biggest.length > 0 ? (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>KEWAJIBAN TERBESAR</Text>
              <View style={{ marginTop: spacing.sm, gap: 12 }}>
                {biggest.map(b => {
                  const pct = b.amount > 0 ? Math.min(100, Math.round(((b.paid_amount || 0) / b.amount) * 100)) : 0;
                  const v = billVisual(b);
                  return (
                    <View key={b.bill_id} style={{ gap: 6 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Text style={styles.bigName} numberOfLines={1}>{b.name}</Text>
                        <Text style={styles.bigAmount}>{idr(b.amount)}</Text>
                      </View>
                      <View style={styles.pbTrack}>
                        <View style={{ height: 6, width: `${pct}%`, borderRadius: 3, backgroundColor: v.color }} />
                      </View>
                      <Text style={styles.bigPct}>{pct}% terbayar</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        ) : null}

        {/* ---------- GROUPED LIST ---------- */}
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          {filtered.length === 0 ? (
            <EmptyState icon="receipt-text-outline" title="Belum ada tagihan" hint="Tambahkan tagihan atau cicilan pertama Anda." />
          ) : GROUPS.map(g => grouped[g.k] ? (
            <View key={g.k} style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: (colors as any)[g.tone] }} />
                <Text style={styles.sectionHeader}>{g.label}</Text>
                <View style={styles.countBadge}><Text style={styles.countText}>{grouped[g.k].length}</Text></View>
              </View>
              {grouped[g.k].map(b => {
                const v = billVisual(b);
                const si = statusInfo(b);
                return (
                  <View key={b.bill_id} style={styles.row} testID={`bill-row-${b.bill_id}`}>
                    <LinearGradient colors={[`${v.color}`, `${v.color}B0`]} style={styles.rowIcon}>
                      <Icon name={v.icon as any} size={20} color="#FFFFFF" />
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={styles.rowTitle} numberOfLines={1}>{b.name}</Text>
                        {b.auto_paid ? (
                          <View style={styles.autoBadge}><Icon name="flash" size={10} color={colors.success} /><Text style={styles.autoBadgeText}>Auto</Text></View>
                        ) : null}
                      </View>
                      <Text style={styles.rowSub} numberOfLines={1}>{b.category} • Jatuh tempo {isoToDisplay(b.due_date)}</Text>
                      <Text style={[styles.rowStatus, { color: si.color }]}>{si.text}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 6 }}>
                      <Text style={styles.rowAmount}>{idr(b.amount)}</Text>
                      <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                        {b.status === "lunas" ? <Icon name="check-circle" size={20} color={colors.success} /> : null}
                        <Pressable onPress={() => openEdit(b)} style={styles.iconBtn} testID={`edit-bill-${b.bill_id}`}><Icon name="pencil" size={15} color={colors.info} /></Pressable>
                        <Pressable onPress={() => del(b)} style={styles.iconBtn} testID={`del-bill-${b.bill_id}`}><Icon name="trash-can-outline" size={15} color={colors.error} /></Pressable>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null)}
        </View>
      </ScrollView>

      {/* ---------- FAB ---------- */}
      <Pressable testID="add-bill" onPress={() => setAddMenu(true)} style={[styles.fabWrap, { bottom: bottomChrome + 16 }]}>
        <LinearGradient colors={[colors.brandPrimary, colors.brandSecondary]} style={styles.fab}>
          <Icon name="plus" size={28} color="#FFFFFF" />
        </LinearGradient>
      </Pressable>

      {/* ---------- ADD MENU (speed dial) ---------- */}
      <Modal visible={addMenu} transparent animationType="fade" onRequestClose={() => setAddMenu(false)}>
        <Pressable style={styles.sheetBg} onPress={() => setAddMenu(false)}>
          <View style={[styles.sheet, { paddingBottom: bottomChrome + 16 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Pilih Jenis Kewajiban</Text>
            {KINDS.map(k => (
              <Pressable key={k.k} testID={`add-kind-${k.k}`} onPress={() => openAdd(k.k)} style={styles.sheetItem}>
                <LinearGradient colors={[k.color, `${k.color}B0`]} style={styles.sheetIcon}>
                  <Icon name={k.icon as any} size={20} color="#FFFFFF" />
                </LinearGradient>
                <Text style={styles.sheetItemText}>Tambah {k.label}</Text>
                <Icon name="chevron-right" size={20} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* ---------- FORM MODAL ---------- */}
      <Modal visible={modal.open} animationType="slide" transparent onRequestClose={() => setModal({ open: false })}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBg}>
          <View style={styles.modal}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "800" }}>{modal.edit ? "Edit Kewajiban" : "Tambah Kewajiban"}</Text>
              <Pressable onPress={() => setModal({ open: false })} testID="close-bill-modal"><Icon name="close" size={22} color={colors.onSurface} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ gap: 10 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Jenis</Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {KINDS.map(k => (
                  <PillButton key={k.k} label={k.label} active={form.kind === k.k} onPress={() => setForm((f: any) => ({ ...f, kind: k.k }))} />
                ))}
              </View>
              <Text style={styles.label}>Nama</Text>
              <TextInput testID="bill-name" style={styles.input} value={form.name} onChangeText={t2 => setForm((f: any) => ({ ...f, name: t2 }))} placeholder="cth. Listrik PLN" placeholderTextColor={colors.muted} />
              <Text style={styles.label}>Kategori</Text>
              <TextInput style={styles.input} value={form.category} onChangeText={t2 => setForm((f: any) => ({ ...f, category: t2 }))} placeholder="Tagihan" placeholderTextColor={colors.muted} />
              <Text style={styles.label}>Nominal (Rp)</Text>
              <TextInput testID="bill-amount" style={styles.input} value={form.amount} onChangeText={t2 => setForm((f: any) => ({ ...f, amount: t2.replace(/[^0-9]/g, "") }))} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.muted} />
              <Text style={styles.label}>Tanggal Jatuh Tempo (1-31) — berulang tiap bulan</Text>
              <TextInput testID="bill-day" style={styles.input} value={form.due_day} onChangeText={(t2) => setForm((f: any) => ({ ...f, due_day: t2.replace(/[^0-9]/g, "").slice(0, 2) }))} keyboardType="numeric" maxLength={2} placeholder="cth. 20" placeholderTextColor={colors.muted} />
              <PrimaryButton label={modal.edit ? "Simpan Perubahan" : "Simpan"} onPress={submit} testID="bill-submit" />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  // Hero
  hero: { borderBottomLeftRadius: 28, borderBottomRightRadius: 28, paddingBottom: spacing.lg, overflow: "hidden" },
  heroDecor1: { position: "absolute", width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(255,255,255,0.08)", top: -90, left: -60 },
  heroDecor2: { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.06)", bottom: -70, right: -30 },
  cluster: { position: "absolute", top: 40, right: 8, width: 120, height: 120 },
  clusterBadge: { position: "absolute", width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  clusterMain: { width: 60, height: 60, borderRadius: 18 },
  heroDate: { color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  heroTitle: { color: "#FFFFFF", fontSize: 26, fontWeight: "800" },
  heroSub: { color: "rgba(255,255,255,0.85)", fontSize: 12.5, marginTop: 4, paddingHorizontal: spacing.lg, maxWidth: "72%" },
  monthPill: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginTop: spacing.md, marginHorizontal: spacing.lg, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: radius.pill, paddingHorizontal: 6, height: 40, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  monthArrow: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  monthPillText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800", minWidth: 120, textAlign: "center" },

  // Stat cards
  statCard: { width: 158, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, gap: 6, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 12, elevation: 4 },
  statIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 4 },
  statLabel: { color: colors.muted, fontSize: 9.5, fontWeight: "800", letterSpacing: 0.4 },
  statValue: { fontSize: 18, fontWeight: "900" },
  statSub: { color: colors.muted, fontSize: 10.5, fontWeight: "600" },

  // Search
  search: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, height: 46 },
  searchInput: { flex: 1, color: colors.onSurface, fontSize: 14, paddingVertical: 0 },

  // Panels
  panel: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  panelTitle: { color: colors.onSurface, fontSize: 12.5, fontWeight: "800", letterSpacing: 0.6 },
  panelHint: { color: colors.muted, fontSize: 11, marginTop: 2 },
  donutCenter: { position: "absolute", alignItems: "center", justifyContent: "center" },
  donutBig: { color: colors.onSurface, fontSize: 28, fontWeight: "900" },
  donutSmall: { color: colors.muted, fontSize: 10, fontWeight: "700", marginTop: -2 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendLabel: { color: colors.muted, fontSize: 12, fontWeight: "600", flex: 1 },
  legendValue: { color: colors.onSurface, fontSize: 12, fontWeight: "800" },
  upDate: { color: colors.muted, fontSize: 11, fontWeight: "700", width: 54 },
  upName: { color: colors.onSurface, fontSize: 13, fontWeight: "600", flex: 1 },
  upAmount: { color: colors.onSurface, fontSize: 13, fontWeight: "800" },
  bigName: { color: colors.onSurface, fontSize: 13.5, fontWeight: "700", flex: 1 },
  bigAmount: { color: colors.onSurface, fontSize: 13.5, fontWeight: "800" },
  bigPct: { color: colors.muted, fontSize: 10.5, fontWeight: "600" },
  pbTrack: { height: 6, width: "100%", backgroundColor: colors.surfaceTertiary, borderRadius: 3, overflow: "hidden" },

  // List
  sectionHeader: { color: colors.onSurface, fontSize: 12.5, fontWeight: "800", letterSpacing: 0.4, flex: 1 },
  countBadge: { backgroundColor: colors.surfaceTertiary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  countText: { color: colors.onSurface, fontSize: 11, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: 12, borderWidth: 1, borderColor: colors.border },
  rowIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 3 },
  rowTitle: { color: colors.onSurface, fontSize: 14.5, fontWeight: "700", flexShrink: 1 },
  rowSub: { color: colors.muted, fontSize: 11, marginTop: 2 },
  rowStatus: { fontSize: 11.5, fontWeight: "700", marginTop: 3 },
  rowAmount: { color: colors.onSurface, fontSize: 14.5, fontWeight: "900" },
  iconBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  autoBadge: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 6, height: 16, borderRadius: 8, backgroundColor: `${colors.success}22` },
  autoBadgeText: { color: colors.success, fontSize: 9, fontWeight: "800" },

  // FAB
  fabWrap: { position: "absolute", right: 20, shadowColor: colors.brandPrimary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 },
  fab: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },

  // Add sheet
  sheetBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, gap: 10, borderWidth: 1, borderColor: colors.border },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 6 },
  sheetTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "800", marginBottom: 4 },
  sheetItem: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.border },
  sheetIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sheetItemText: { color: colors.onSurface, fontSize: 14.5, fontWeight: "700", flex: 1 },

  // Form modal
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: "88%", borderWidth: 1, borderColor: colors.border },
  label: { color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", marginTop: 4 },
  input: { backgroundColor: colors.surfaceTertiary, color: colors.onSurface, borderRadius: radius.md, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: colors.border, fontSize: 14 },
}));
