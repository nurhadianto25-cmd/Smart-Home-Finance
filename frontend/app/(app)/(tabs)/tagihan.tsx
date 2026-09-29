import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, TextInput, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { api, idr } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";
import { EmptyState, PillButton, PrimaryButton } from "@/src/components/ui";

const STATUS_COLORS: Record<string, string> = {
  segera: colors.warning, belum: colors.error, terlambat: colors.error, lunas: colors.success, ditangguhkan: colors.muted,
};
const STATUS_LABEL: Record<string, string> = {
  segera: "Segera Jatuh Tempo", belum: "Belum Dibayar", terlambat: "Terlambat", lunas: "Lunas", ditangguhkan: "Ditangguhkan",
};
const KINDS = [
  { k: "rutin", label: "Tagihan Rutin", icon: "flash", color: colors.info },
  { k: "cicilan", label: "Cicilan / Kredit", icon: "credit-card", color: colors.warning },
  { k: "pinjaman", label: "Pinjaman", icon: "cash", color: colors.brandPrimary },
  { k: "lainnya", label: "Lainnya", icon: "dots-horizontal", color: colors.muted },
];

export default function Tagihan() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: "", kind: "rutin", category: "Umum", amount: "", due_date: "", status: "belum", note: "" });

  const load = useCallback(async () => {
    try { setItems(await api<any[]>("/bills")); } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

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

  const submit = async () => {
    if (!form.name || !form.amount || !form.due_date) return;
    try {
      await api("/bills", { method: "POST", body: JSON.stringify({
        name: form.name, kind: form.kind, category: form.category,
        amount: parseFloat(form.amount), due_date: form.due_date, status: form.status, note: form.note,
      }) });
      setModal(false);
      setForm({ name: "", kind: "rutin", category: "Umum", amount: "", due_date: "", status: "belum", note: "" });
      load();
    } catch {}
  };

  const toggleLunas = async (b: any) => {
    try { await api(`/bills/${b.bill_id}`, { method: "PUT", body: JSON.stringify({ ...b, status: b.status === "lunas" ? "belum" : "lunas" }) }); load(); } catch {}
  };
  const del = async (b: any) => { try { await api(`/bills/${b.bill_id}`, { method: "DELETE" }); load(); } catch {} };

  const grouped: Record<string, any[]> = {};
  for (const b of filtered) {
    const key = b.status === "lunas" ? "lunas" : b.status === "terlambat" || b.days_left < 0 ? "terlambat" : b.days_left <= 14 ? "segera" : "belum";
    (grouped[key] ||= []).push(b);
  }
  const order = ["segera", "belum", "terlambat", "lunas"];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 24, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brandPrimary} />}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Tagihan & Cicilan</Text>
            <Text style={styles.sub}>Kelola semua kewajiban Anda</Text>
          </View>
          <Pressable testID="add-bill" onPress={() => setModal(true)} style={styles.fab}>
            <Icon name="plus" size={22} color={colors.onBrandPrimary} />
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <MiniStat label="TOTAL AKTIF" value={idr(totalActive)} color={colors.brandPrimary} icon="wallet" />
          <MiniStat label="SUDAH DIBAYAR" value={idr(paid)} color={colors.success} icon="check-circle" />
        </View>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <MiniStat label="JUMLAH" value={String(items.length)} color={colors.info} icon="format-list-bulleted" />
          <MiniStat label="SEGERA" value={String(dueSoon)} color={colors.warning} icon="bell-ring" />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 12 }}>
          <PillButton testID="fbill-all" label="Semua" active={filter === "all"} onPress={() => setFilter("all")} />
          {KINDS.map(k => (
            <PillButton key={k.k} testID={`fbill-${k.k}`} label={k.label} active={filter === k.k} onPress={() => setFilter(k.k)} />
          ))}
        </ScrollView>

        {filtered.length === 0 ? (
          <EmptyState icon="receipt-text-outline" title="Belum ada tagihan" hint="Tambahkan tagihan atau cicilan pertama Anda." />
        ) : order.map(k => grouped[k] ? (
          <View key={k} style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: STATUS_COLORS[k] }} />
              <Text style={styles.sectionHeader}>{STATUS_LABEL[k]}</Text>
              <View style={styles.countBadge}><Text style={styles.countText}>{grouped[k].length}</Text></View>
            </View>
            {grouped[k].map(b => (
              <View key={b.bill_id} style={styles.row}>
                <View style={[styles.rowIcon, { backgroundColor: `${STATUS_COLORS[k]}22`, borderColor: `${STATUS_COLORS[k]}55` }]}>
                  <Icon name={(KINDS.find(x => x.k === b.kind)?.icon || "receipt") as any} size={20} color={STATUS_COLORS[k]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{b.name}</Text>
                  <Text style={styles.rowSub}>{b.category} • Jatuh tempo {new Date(b.due_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text style={styles.rowAmount}>{idr(b.amount)}</Text>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <Pressable onPress={() => toggleLunas(b)} style={styles.iconBtn} testID={`pay-${b.bill_id}`}>
                      <Icon name={b.status === "lunas" ? "close-circle" : "check-circle"} size={18} color={b.status === "lunas" ? colors.muted : colors.success} />
                    </Pressable>
                    <Pressable onPress={() => del(b)} style={styles.iconBtn} testID={`del-bill-${b.bill_id}`}>
                      <Icon name="trash-can-outline" size={18} color={colors.error} />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : null)}
      </ScrollView>

      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBg}>
          <View style={styles.modal}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "800" }}>Tambah Kewajiban</Text>
              <Pressable onPress={() => setModal(false)} testID="close-bill-modal"><Icon name="close" size={22} color={colors.onSurface} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ gap: 10 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Jenis</Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {KINDS.map(k => (
                  <PillButton key={k.k} label={k.label} active={form.kind === k.k} onPress={() => setForm(f => ({ ...f, kind: k.k }))} />
                ))}
              </View>
              <Text style={styles.label}>Nama</Text>
              <TextInput testID="bill-name" style={styles.input} value={form.name} onChangeText={t => setForm(f => ({ ...f, name: t }))} placeholder="cth. Listrik PLN" placeholderTextColor={colors.muted} />
              <Text style={styles.label}>Kategori</Text>
              <TextInput style={styles.input} value={form.category} onChangeText={t => setForm(f => ({ ...f, category: t }))} placeholder="Umum" placeholderTextColor={colors.muted} />
              <Text style={styles.label}>Nominal (Rp)</Text>
              <TextInput testID="bill-amount" style={styles.input} value={form.amount} onChangeText={t => setForm(f => ({ ...f, amount: t.replace(/[^0-9]/g, "") }))} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.muted} />
              <Text style={styles.label}>Jatuh Tempo (YYYY-MM-DD)</Text>
              <TextInput testID="bill-date" style={styles.input} value={form.due_date} onChangeText={t => setForm(f => ({ ...f, due_date: t }))} placeholder="2026-09-15" placeholderTextColor={colors.muted} />
              <PrimaryButton label="Simpan" onPress={submit} testID="bill-submit" />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function MiniStat({ label, value, color, icon }: any) {
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

const styles = StyleSheet.create({
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
  rowTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  rowSub: { color: colors.muted, fontSize: 11, marginTop: 2 },
  rowAmount: { color: colors.onSurface, fontSize: 14, fontWeight: "800" },
  iconBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: "88%", borderWidth: 1, borderColor: colors.border },
  label: { color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", marginTop: 4 },
  input: { backgroundColor: colors.surfaceTertiary, color: colors.onSurface, borderRadius: radius.md, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: colors.border, fontSize: 14 },
});
