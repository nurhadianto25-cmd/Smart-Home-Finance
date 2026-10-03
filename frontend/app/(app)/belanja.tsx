import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { useRouter } from "expo-router";
import { api, idr } from "@/src/api";
import { colors as C, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { EmptyState, PrimaryButton, ProgressBar } from "@/src/components/ui";
import { useConfirm } from "@/src/confirm";

const STATUS: any = { belum: { c: C.muted, l: "Belum" }, sebagian: { c: C.warning, l: "Sebagian" }, selesai: { c: C.success, l: "Selesai" } };

export default function Belanja() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const confirm = useConfirm();
  const month = new Date().toISOString().slice(0, 7);
  const [items, setItems] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Makanan Pokok", budget: "", realized: "", frequency: "Rutin" });

  const load = useCallback(async () => {
    try { setItems(await api<any[]>(`/shopping?month=${month}`)); } catch {}
  }, [month]);
  useEffect(() => { load(); }, [load]);

  const totalBudget = items.reduce((s, i) => s + i.budget, 0);
  const totalReal = items.reduce((s, i) => s + i.realized, 0);
  const remain = totalBudget - totalReal;
  const pct = totalBudget ? (totalReal / totalBudget) * 100 : 0;

  const submit = async () => {
    if (!form.name || !form.budget) return;
    const r = parseFloat(form.realized || "0");
    const b = parseFloat(form.budget);
    const status = r <= 0 ? "belum" : r < b ? "sebagian" : "selesai";
    try {
      await api("/shopping", { method: "POST", body: JSON.stringify({
        name: form.name, category: form.category, budget: b, realized: r,
        status, frequency: form.frequency, month,
      })});
      setModal(false); setForm({ name: "", category: "Makanan Pokok", budget: "", realized: "", frequency: "Rutin" });
      load();
    } catch {}
  };
  const del = async (i: any) => {
    const ok = await confirm({ title: "Hapus Item Belanja", message: `Hapus "${i.name}"?`, danger: true });
    if (!ok) return;
    try { await api(`/shopping/${i.item_id}`, { method: "DELETE" }); load(); } catch {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}><Icon name="arrow-left" size={22} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Belanja Bulanan</Text>
          <Text style={styles.sub}>Kebutuhan rutin keluarga</Text>
        </View>
        <Pressable onPress={() => setModal(true)} style={styles.fab} testID="add-shopping"><Icon name="plus" size={22} color={colors.onBrandPrimary} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 24, gap: spacing.md }}>
        <View style={styles.summary}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View><Text style={styles.sumLabel}>ANGGARAN</Text><Text style={styles.sumVal}>{idr(totalBudget)}</Text></View>
            <View><Text style={styles.sumLabel}>REALISASI</Text><Text style={[styles.sumVal, { color: colors.success }]}>{idr(totalReal)}</Text></View>
            <View><Text style={styles.sumLabel}>SISA</Text><Text style={[styles.sumVal, { color: colors.info }]}>{idr(remain)}</Text></View>
          </View>
          <View style={{ marginTop: 10 }}><ProgressBar value={pct} color={pct > 100 ? colors.error : colors.brandPrimary} height={8} /></View>
          <Text style={{ color: colors.muted, fontSize: 11, marginTop: 6 }}>{pct.toFixed(1)}% terpakai</Text>
          <Text style={{ color: colors.muted, fontSize: 10, marginTop: 4 }}>Realisasi bertambah otomatis dari transaksi yang dialokasikan ke item ini di menu Transaksi.</Text>
        </View>

        {items.length === 0 ? (
          <EmptyState icon="cart-outline" title="Belum ada item" hint="Buat daftar belanja bulanan Anda." />
        ) : items.map(i => {
          const p = i.budget ? Math.min(100, (i.realized / i.budget) * 100) : 0;
          const s = STATUS[i.status];
          return (
            <View key={i.item_id} style={styles.card}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={styles.itemIcon}><Icon name="cart" size={18} color={colors.brandSecondary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{i.name}</Text>
                  <Text style={styles.cat}>{i.category} • {i.frequency}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: `${s.c}22`, borderColor: `${s.c}55` }]}>
                  <Text style={{ color: s.c, fontSize: 11, fontWeight: "700" }}>{s.l}</Text>
                </View>
                <Pressable onPress={() => del(i)} style={styles.delBtn}><Icon name="trash-can-outline" size={16} color={colors.error} /></Pressable>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Anggaran {idr(i.budget)}</Text>
                <Text style={{ color: colors.success, fontSize: 12, fontWeight: "700" }}>Realisasi {idr(i.realized)}</Text>
              </View>
              <View style={{ marginTop: 6 }}><ProgressBar value={p} color={p >= 100 ? colors.success : colors.warning} /></View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBg}>
          <View style={styles.modal}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "800" }}>Tambah Item Belanja</Text>
              <Pressable onPress={() => setModal(false)}><Icon name="close" size={22} color={colors.onSurface} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ gap: 10 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Nama</Text>
              <TextInput style={styles.input} value={form.name} onChangeText={t => setForm(f => ({ ...f, name: t }))} placeholder="cth. Beras" placeholderTextColor={colors.muted} />
              <Text style={styles.label}>Kategori</Text>
              <TextInput style={styles.input} value={form.category} onChangeText={t => setForm(f => ({ ...f, category: t }))} placeholderTextColor={colors.muted} />
              <Text style={styles.label}>Anggaran (Rp)</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={form.budget} onChangeText={t => setForm(f => ({ ...f, budget: t.replace(/[^0-9]/g, "") }))} placeholderTextColor={colors.muted} placeholder="0" />
              <Text style={styles.label}>Realisasi (Rp)</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={form.realized} onChangeText={t => setForm(f => ({ ...f, realized: t.replace(/[^0-9]/g, "") }))} placeholderTextColor={colors.muted} placeholder="0" />
              <PrimaryButton label="Simpan" onPress={submit} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  title: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
  sub: { color: colors.muted, fontSize: 12 },
  fab: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  summary: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  sumLabel: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  sumVal: { color: colors.onSurface, fontSize: 15, fontWeight: "800", marginTop: 4 },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  itemIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: `${colors.brandSecondary}22`, borderWidth: 1, borderColor: `${colors.brandSecondary}55`, alignItems: "center", justifyContent: "center" },
  name: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  cat: { color: colors.muted, fontSize: 11, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  delBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: `${colors.error}22`, alignItems: "center", justifyContent: "center" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: "85%", borderWidth: 1, borderColor: colors.border },
  label: { color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  input: { backgroundColor: colors.surfaceTertiary, color: colors.onSurface, borderRadius: radius.md, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: colors.border, fontSize: 14 },
}));
