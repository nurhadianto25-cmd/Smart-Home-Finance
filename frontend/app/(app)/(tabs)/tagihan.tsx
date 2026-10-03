import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, TextInput, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { api, idr } from "@/src/api";
import { usePrefs } from "@/src/prefs";
import { colors as C, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { EmptyState, PillButton, PrimaryButton } from "@/src/components/ui";
import { isoToDisplay } from "@/src/utils/date";
import { useConfirm } from "@/src/confirm";
import { localeTag } from "@/src/i18n";

const STATUS_COLORS: Record<string, string> = {
  segera: C.warning, belum: C.error, terlambat: C.error, lunas: C.success, ditangguhkan: C.muted,
};
const STATUS_KEY: Record<string, string> = {
  segera: "stSegera", belum: "stBelum", terlambat: "stTerlambat", lunas: "stLunas", ditangguhkan: "stDitangguhkan",
};
const KINDS = [
  { k: "rutin", labelKey: "billRutin", icon: "flash", color: C.info },
  { k: "cicilan", labelKey: "billCicilan", icon: "credit-card", color: C.warning },
  { k: "pinjaman", labelKey: "billPinjaman", icon: "cash", color: C.brandPrimary },
  { k: "lainnya", labelKey: "billLainnya", icon: "dots-horizontal", color: C.muted },
];

const emptyForm = { name: "", kind: "rutin", category: "Umum", amount: "", due_day: "", status: "belum", note: "" };

export default function Tagihan() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = usePrefs();
  const styles = useStyles();
  const confirm = useConfirm();
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);
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

  const today = new Date();
  const withDaysLeft = items.map(b => {
    let dl = 999;
    try {
      const d = new Date(b.due_date);
      dl = Math.floor((d.getTime() - today.getTime()) / 86400000);
    } catch {}
    return { ...b, days_left: dl };
  });
  const filtered = filter === "all" ? withDaysLeft : withDaysLeft.filter(b => b.kind === filter);

  const totalActive = withDaysLeft.filter(b => b.status !== "lunas").reduce((s, b) => s + b.amount, 0);
  const paid = withDaysLeft.filter(b => b.status === "lunas").reduce((s, b) => s + b.amount, 0);
  const dueSoon = withDaysLeft.filter(b => b.status !== "lunas" && b.days_left >= 0 && b.days_left <= 7).length;

  const openAdd = () => { setForm(emptyForm); setModal({ open: true, edit: null }); };
  const openEdit = (b: any) => {
    setForm({
      name: b.name, kind: b.kind, category: b.category, amount: String(b.amount),
      due_day: String(b.due_day || (b.due_date || "").slice(8, 10) || ""),
      status: "belum", note: b.note || "",
    });
    setModal({ open: true, edit: b });
  };
  const submit = async () => {
    const day = parseInt(form.due_day, 10);
    if (!form.name || !form.amount || !day || day < 1 || day > 31) return;
    const body = {
      name: form.name, kind: form.kind, category: form.category,
      amount: parseFloat(form.amount), due_day: day,
      status: form.status, note: form.note,
    };
    try {
      if (modal.edit) {
        await api(`/bills/${modal.edit.bill_id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await api("/bills", { method: "POST", body: JSON.stringify(body) });
      }
      setModal({ open: false });
      setForm(emptyForm);
      load();
    } catch {}
  };

  const del = async (b: any) => {
    const ok = await confirm({ title: "Hapus Tagihan", message: `Hapus "${b.name}"? Data ini tidak dapat dikembalikan.`, danger: true });
    if (!ok) return;
    try { await api(`/bills/${b.bill_id}`, { method: "DELETE" }); load(); } catch {}
  };

  const grouped: Record<string, any[]> = {};
  for (const b of filtered) {
    const key = b.status;
    (grouped[key] ||= []).push(b);
  }
  const order = ["segera", "belum", "terlambat", "lunas", "ditangguhkan"];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 24, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brandPrimary} />}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t("billsLong")}</Text>
            <Text style={styles.sub}>{t("billsSub")}</Text>
          </View>
          <Pressable testID="add-bill" onPress={openAdd} style={styles.fab}>
            <Icon name="plus" size={22} color={colors.onBrandPrimary} />
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <MiniStat label={t("totalActive")} value={idr(totalActive)} color={colors.brandPrimary} icon="wallet" />
          <MiniStat label={t("paid")} value={idr(paid)} color={colors.success} icon="check-circle" />
        </View>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <MiniStat label={t("count")} value={String(items.length)} color={colors.info} icon="format-list-bulleted" />
          <MiniStat label={t("soon")} value={String(dueSoon)} color={colors.warning} icon="bell-ring" />
        </View>

        <View style={styles.monthNav}>
          <Pressable testID="bill-month-prev" onPress={() => shiftMonth(-1)} style={styles.monthNavBtn}><Icon name="chevron-left" size={20} color={colors.onSurface} /></Pressable>
          <Text style={styles.monthNavLabel} testID="bill-month-label">{monthLabel}</Text>
          <Pressable testID="bill-month-next" onPress={() => shiftMonth(1)} style={styles.monthNavBtn}><Icon name="chevron-right" size={20} color={colors.onSurface} /></Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 12 }}>
          <PillButton testID="fbill-all" label={t("all")} active={filter === "all"} onPress={() => setFilter("all")} />
          {KINDS.map(k => (
            <PillButton key={k.k} testID={`fbill-${k.k}`} label={t(k.labelKey)} active={filter === k.k} onPress={() => setFilter(k.k)} />
          ))}
        </ScrollView>

        {filtered.length === 0 ? (
          <EmptyState icon="receipt-text-outline" title={t("noBills")} hint={t("noBillsHint")} />
        ) : order.map(k => grouped[k] ? (
          <View key={k} style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: STATUS_COLORS[k] }} />
              <Text style={styles.sectionHeader}>{t(STATUS_KEY[k])}</Text>
              <View style={styles.countBadge}><Text style={styles.countText}>{grouped[k].length}</Text></View>
            </View>
            {grouped[k].map(b => (
              <View key={b.bill_id} style={styles.row}>
                <View style={[styles.rowIcon, { backgroundColor: `${STATUS_COLORS[k]}22`, borderColor: `${STATUS_COLORS[k]}55` }]}>
                  <Icon name={(KINDS.find(x => x.k === b.kind)?.icon || "receipt") as any} size={20} color={STATUS_COLORS[k]} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{b.name}</Text>
                    {b.auto_paid ? (
                      <View style={styles.autoBadge}>
                        <Icon name="flash" size={10} color={colors.success} />
                        <Text style={styles.autoBadgeText}>Auto</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.rowSub}>{b.category} • {isoToDisplay(b.due_date)}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text style={styles.rowAmount}>{idr(b.amount)}</Text>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <Pressable onPress={() => openEdit(b)} style={styles.iconBtn} testID={`edit-bill-${b.bill_id}`}>
                      <Icon name="pencil" size={16} color={colors.info} />
                    </Pressable>
                    <Pressable onPress={() => del(b)} style={styles.iconBtn} testID={`del-bill-${b.bill_id}`}>
                      <Icon name="trash-can-outline" size={16} color={colors.error} />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : null)}
      </ScrollView>

      <Modal visible={modal.open} animationType="slide" transparent onRequestClose={() => setModal({ open: false })}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBg}>
          <View style={styles.modal}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "800" }}>{modal.edit ? t("editObligation") : t("addObligation")}</Text>
              <Pressable onPress={() => setModal({ open: false })} testID="close-bill-modal"><Icon name="close" size={22} color={colors.onSurface} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ gap: 10 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>{t("kind")}</Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {KINDS.map(k => (
                  <PillButton key={k.k} label={t(k.labelKey)} active={form.kind === k.k} onPress={() => setForm((f: any) => ({ ...f, kind: k.k }))} />
                ))}
              </View>
              <Text style={styles.label}>{t("name")}</Text>
              <TextInput testID="bill-name" style={styles.input} value={form.name} onChangeText={t2 => setForm((f: any) => ({ ...f, name: t2 }))} placeholder="cth. Listrik PLN" placeholderTextColor={colors.muted} />
              <Text style={styles.label}>{t("categoryMatch")}</Text>
              <TextInput style={styles.input} value={form.category} onChangeText={t2 => setForm((f: any) => ({ ...f, category: t2 }))} placeholder="Tagihan" placeholderTextColor={colors.muted} />
              <Text style={styles.label}>{t("amountRp")}</Text>
              <TextInput testID="bill-amount" style={styles.input} value={form.amount} onChangeText={t2 => setForm((f: any) => ({ ...f, amount: t2.replace(/[^0-9]/g, "") }))} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.muted} />
              <Text style={styles.label}>Tanggal Jatuh Tempo (1-31) — berulang tiap bulan</Text>
              <TextInput
                testID="bill-day"
                style={styles.input}
                value={form.due_day}
                onChangeText={(t2) => setForm((f: any) => ({ ...f, due_day: t2.replace(/[^0-9]/g, "").slice(0, 2) }))}
                keyboardType="numeric"
                maxLength={2}
                placeholder="cth. 20"
                placeholderTextColor={colors.muted}
              />
              <PrimaryButton label={modal.edit ? t("saveChanges") : t("save")} onPress={submit} testID="bill-submit" />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function MiniStat({ label, value, color, icon }: any) {
  const styles = useStyles();
  return (
    <View style={[styles.mini, { borderColor: `${color}55` }]}>
      <View style={[styles.miniIcon, { backgroundColor: `${color}22` }]}><Icon name={icon} size={16} color={color} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.miniLabel}>{label}</Text>
        <Text style={[styles.miniVal, { color }]} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  title: { color: colors.onSurface, fontSize: 24, fontWeight: "800" },
  sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  fab: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  mini: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: 12, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  miniIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  miniLabel: { color: colors.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  miniVal: { fontSize: 14, fontWeight: "800" },
  sectionHeader: { color: colors.onSurface, fontSize: 13, fontWeight: "800", flex: 1 },
  countBadge: { backgroundColor: colors.surfaceTertiary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  countText: { color: colors.onSurface, fontSize: 11, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.border },
  rowIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  rowTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "700", flexShrink: 1 },
  rowSub: { color: colors.muted, fontSize: 11, marginTop: 2 },
  rowAmount: { color: colors.onSurface, fontSize: 14, fontWeight: "800" },
  iconBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  autoBadge: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 6, height: 16, borderRadius: 8, backgroundColor: `${colors.success}22` },
  autoBadgeText: { color: colors.success, fontSize: 9, fontWeight: "800" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: "88%", borderWidth: 1, borderColor: colors.border },
  label: { color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", marginTop: 4 },
  input: { backgroundColor: colors.surfaceTertiary, color: colors.onSurface, borderRadius: radius.md, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: colors.border, fontSize: 14 },
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 8, height: 46 },
  monthNavBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  monthNavLabel: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
}));
