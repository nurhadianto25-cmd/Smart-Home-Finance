import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { useRouter } from "expo-router";
import { api, idr } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";
import { EmptyState, PrimaryButton, ProgressBar } from "@/src/components/ui";

export default function Pendidikan() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const month = new Date().toISOString().slice(0, 7);
  const [children, setChildren] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [childModal, setChildModal] = useState(false);
  const [itemModal, setItemModal] = useState(false);
  const [cf, setCf] = useState({ name: "", school: "", grade: "" });
  const [ifm, setIfm] = useState({ name: "", category: "SPP", budget: "", realized: "", frequency: "Bulanan" });

  const load = useCallback(async () => {
    try {
      const chs = await api<any[]>("/education/children");
      setChildren(chs);
      if (!active && chs[0]) setActive(chs[0].child_id);
      const list = await api<any[]>(`/education/items?month=${month}${active ? `&child_id=${active}` : ""}`);
      setItems(list);
    } catch {}
  }, [active, month]);
  useEffect(() => { load(); }, [load]);

  const submitChild = async () => {
    if (!cf.name) return;
    try {
      const c = await api<any>("/education/children", { method: "POST", body: JSON.stringify(cf) });
      setChildModal(false); setCf({ name: "", school: "", grade: "" }); setActive(c.child_id); load();
    } catch {}
  };
  const submitItem = async () => {
    if (!active || !ifm.name || !ifm.budget) return;
    const r = parseFloat(ifm.realized || "0");
    const b = parseFloat(ifm.budget);
    const status = r <= 0 ? "belum" : r < b ? "sebagian" : "lunas";
    try {
      await api("/education/items", { method: "POST", body: JSON.stringify({
        child_id: active, name: ifm.name, category: ifm.category, budget: b, realized: r,
        frequency: ifm.frequency, month, status,
      })});
      setItemModal(false); setIfm({ name: "", category: "SPP", budget: "", realized: "", frequency: "Bulanan" }); load();
    } catch {}
  };
  const delItem = async (id: string) => { try { await api(`/education/items/${id}`, { method: "DELETE" }); load(); } catch {} };
  const delChild = async (id: string) => {
    try { await api(`/education/children/${id}`, { method: "DELETE" }); setActive(null); load(); } catch {}
  };

  const filtered = items.filter(i => !active || i.child_id === active);
  const totalB = filtered.reduce((s, i) => s + i.budget, 0);
  const totalR = filtered.reduce((s, i) => s + i.realized, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}><Icon name="arrow-left" size={22} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Pendidikan</Text>
          <Text style={styles.sub}>Kebutuhan pendidikan keluarga</Text>
        </View>
        <Pressable onPress={() => setItemModal(true)} style={styles.fab} testID="add-edu-item"><Icon name="plus" size={22} color={colors.onBrandPrimary} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 24, gap: spacing.md }}>
        <View style={styles.summary}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View><Text style={styles.sumLabel}>ANGGARAN</Text><Text style={styles.sumVal}>{idr(totalB)}</Text></View>
            <View><Text style={styles.sumLabel}>REALISASI</Text><Text style={[styles.sumVal, { color: colors.success }]}>{idr(totalR)}</Text></View>
            <View><Text style={styles.sumLabel}>SISA</Text><Text style={[styles.sumVal, { color: colors.warning }]}>{idr(totalB - totalR)}</Text></View>
          </View>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: colors.onSurface, fontWeight: "800", fontSize: 15 }}>Anggota</Text>
          <Pressable onPress={() => setChildModal(true)} testID="add-child" style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Icon name="plus-circle" size={16} color={colors.brandPrimary} />
            <Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>Tambah Anak</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 12 }}>
          {children.map(c => (
            <Pressable key={c.child_id} onPress={() => setActive(c.child_id)} onLongPress={() => delChild(c.child_id)} style={[styles.child, active === c.child_id && { borderColor: colors.brandPrimary, backgroundColor: `${colors.brandPrimary}22` }]}>
              <View style={styles.childAvatar}><Icon name="account-child-circle" size={30} color={colors.brandPrimary} /></View>
              <View>
                <Text style={styles.childName}>{c.name}</Text>
                <Text style={styles.childInfo}>{c.school}</Text>
                <Text style={styles.childInfo}>Kelas {c.grade}</Text>
              </View>
            </Pressable>
          ))}
          {children.length === 0 && <Text style={{ color: colors.muted }}>Tambahkan anak untuk mulai.</Text>}
        </ScrollView>

        {filtered.length === 0 ? (
          <EmptyState icon="school-outline" title="Belum ada item pendidikan" hint="Tambahkan kebutuhan seperti SPP, buku, atau seragam." />
        ) : filtered.map(i => {
          const p = i.budget ? Math.min(100, (i.realized / i.budget) * 100) : 0;
          return (
            <View key={i.item_id} style={styles.card}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={styles.itemIcon}><Icon name="book-open-variant" size={18} color={colors.brandPrimary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{i.name}</Text>
                  <Text style={styles.cat}>{i.category} • {i.frequency}</Text>
                </View>
                <Text style={styles.amount}>{idr(i.budget)}</Text>
                <Pressable onPress={() => delItem(i.item_id)} style={styles.delBtn}><Icon name="trash-can-outline" size={16} color={colors.error} /></Pressable>
              </View>
              <View style={{ marginTop: 8 }}><ProgressBar value={p} color={p >= 100 ? colors.success : colors.warning} /></View>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>Realisasi {idr(i.realized)} • {p.toFixed(0)}%</Text>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={childModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBg}>
          <View style={styles.modal}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
              <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "800" }}>Tambah Anak</Text>
              <Pressable onPress={() => setChildModal(false)}><Icon name="close" size={22} color={colors.onSurface} /></Pressable>
            </View>
            <TextInput style={styles.input} placeholder="Nama" placeholderTextColor={colors.muted} value={cf.name} onChangeText={t => setCf(f => ({ ...f, name: t }))} />
            <TextInput style={styles.input} placeholder="Sekolah" placeholderTextColor={colors.muted} value={cf.school} onChangeText={t => setCf(f => ({ ...f, school: t }))} />
            <TextInput style={styles.input} placeholder="Kelas" placeholderTextColor={colors.muted} value={cf.grade} onChangeText={t => setCf(f => ({ ...f, grade: t }))} />
            <PrimaryButton label="Simpan Anak" onPress={submitChild} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={itemModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBg}>
          <View style={styles.modal}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
              <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "800" }}>Tambah Kebutuhan</Text>
              <Pressable onPress={() => setItemModal(false)}><Icon name="close" size={22} color={colors.onSurface} /></Pressable>
            </View>
            <TextInput style={styles.input} placeholder="Nama (cth. SPP)" placeholderTextColor={colors.muted} value={ifm.name} onChangeText={t => setIfm(f => ({ ...f, name: t }))} />
            <TextInput style={styles.input} placeholder="Kategori" placeholderTextColor={colors.muted} value={ifm.category} onChangeText={t => setIfm(f => ({ ...f, category: t }))} />
            <TextInput style={styles.input} placeholder="Anggaran (Rp)" keyboardType="numeric" placeholderTextColor={colors.muted} value={ifm.budget} onChangeText={t => setIfm(f => ({ ...f, budget: t.replace(/[^0-9]/g, "") }))} />
            <TextInput style={styles.input} placeholder="Realisasi (Rp)" keyboardType="numeric" placeholderTextColor={colors.muted} value={ifm.realized} onChangeText={t => setIfm(f => ({ ...f, realized: t.replace(/[^0-9]/g, "") }))} />
            <PrimaryButton label="Simpan Kebutuhan" onPress={submitItem} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  title: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
  sub: { color: colors.muted, fontSize: 12 },
  fab: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  summary: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  sumLabel: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  sumVal: { color: colors.onSurface, fontSize: 15, fontWeight: "800", marginTop: 4 },
  child: { flexDirection: "row", gap: 10, alignItems: "center", padding: 12, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, minWidth: 200 },
  childAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: `${colors.brandPrimary}22`, alignItems: "center", justifyContent: "center" },
  childName: { color: colors.onSurface, fontWeight: "800", fontSize: 14 },
  childInfo: { color: colors.muted, fontSize: 11 },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  itemIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: `${colors.brandPrimary}22`, borderWidth: 1, borderColor: `${colors.brandPrimary}55`, alignItems: "center", justifyContent: "center" },
  name: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  cat: { color: colors.muted, fontSize: 11, marginTop: 2 },
  amount: { color: colors.onSurface, fontWeight: "800" },
  delBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: `${colors.error}22`, alignItems: "center", justifyContent: "center" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, gap: 10, borderWidth: 1, borderColor: colors.border },
  input: { backgroundColor: colors.surfaceTertiary, color: colors.onSurface, borderRadius: radius.md, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: colors.border, fontSize: 14 },
});
