import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, TextInput, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { api, idr } from "@/src/api";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { EmptyState, PrimaryButton, ProgressBar } from "@/src/components/ui";

const GOAL_COLORS = ["#10D96A", "#3D7EFF", "#9B6BFF", "#FF9D3D", "#FF4757", "#F7C948"];

export default function Tabungan() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [form, setForm] = useState({ name: "", target: "", saved: "", color: GOAL_COLORS[0] });

  const load = useCallback(async () => {
    try { setItems(await api<any[]>("/savings")); } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEdit(null); setForm({ name: "", target: "", saved: "", color: GOAL_COLORS[0] }); setModal(true); };
  const openEdit = (g: any) => { setEdit(g); setForm({ name: g.name, target: String(g.target), saved: String(g.saved), color: g.color || GOAL_COLORS[0] }); setModal(true); };

  const submit = async () => {
    if (!form.name || !form.target) return;
    const body = { name: form.name, target: parseFloat(form.target || "0"), saved: parseFloat(form.saved || "0"), color: form.color, icon: "piggy-bank" };
    try {
      if (edit) await api(`/savings/${edit.goal_id}`, { method: "PUT", body: JSON.stringify(body) });
      else await api("/savings", { method: "POST", body: JSON.stringify(body) });
      setModal(false); load();
    } catch {}
  };
  const del = async (g: any) => { try { await api(`/savings/${g.goal_id}`, { method: "DELETE" }); load(); } catch {} };

  const totalTarget = items.reduce((s, g) => s + g.target, 0);
  const totalSaved = items.reduce((s, g) => s + g.saved, 0);
  const overall = totalTarget ? (totalSaved / totalTarget) * 100 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 24, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brandPrimary} />}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Target Tabungan</Text>
            <Text style={styles.sub}>Wujudkan impian keluarga Anda</Text>
          </View>
          <Pressable testID="add-goal" onPress={openAdd} style={styles.fab}><Icon name="plus" size={22} color={colors.onBrandPrimary} /></Pressable>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>TOTAL TERKUMPUL</Text>
          <Text style={styles.heroAmount}>{idr(totalSaved)}</Text>
          <Text style={styles.heroSub}>dari target {idr(totalTarget)}</Text>
          <View style={{ marginTop: 10 }}>
            <ProgressBar value={overall} color={colors.success} height={8} />
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 6 }}>{overall.toFixed(1)}% tercapai</Text>
          </View>
        </View>

        {items.length === 0 ? (
          <EmptyState icon="piggy-bank" title="Belum ada target" hint="Buat target menabung pertama Anda dengan tombol +." />
        ) : items.map((g, i) => {
          const pct = g.target ? Math.min(100, (g.saved / g.target) * 100) : 0;
          return (
            <View key={g.goal_id} style={styles.goal} testID={`goal-${g.goal_id}`}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={[styles.jarWrap, { borderColor: `${g.color}77` }]}>
                  <View style={[styles.jarFill, { height: `${pct}%`, backgroundColor: g.color }]} />
                  <Icon name="piggy-bank" size={22} color={colors.onSurface} style={styles.jarIcon} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={styles.goalName}>{g.name}</Text>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      <Pressable onPress={() => openEdit(g)} style={styles.iconBtn} testID={`edit-goal-${g.goal_id}`}>
                        <Icon name="pencil" size={16} color={colors.info} />
                      </Pressable>
                      <Pressable onPress={() => del(g)} style={styles.iconBtn} testID={`del-goal-${g.goal_id}`}>
                        <Icon name="trash-can-outline" size={16} color={colors.error} />
                      </Pressable>
                    </View>
                  </View>
                  <Text style={{ color: g.color, fontSize: 18, fontWeight: "800", marginTop: 2 }}>{idr(g.saved)}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>dari {idr(g.target)}</Text>
                  <View style={{ marginTop: 8 }}><ProgressBar value={pct} color={g.color} /></View>
                  <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>{pct.toFixed(1)}%</Text>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBg}>
          <View style={styles.modal}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
              <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "800" }}>{edit ? "Edit Target" : "Target Baru"}</Text>
              <Pressable onPress={() => setModal(false)}><Icon name="close" size={22} color={colors.onSurface} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ gap: 10 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Nama</Text>
              <TextInput testID="goal-name" style={styles.input} value={form.name} onChangeText={t => setForm(f => ({ ...f, name: t }))} placeholder="cth. Dana Darurat" placeholderTextColor={colors.muted} />
              <Text style={styles.label}>Target (Rp)</Text>
              <TextInput testID="goal-target" style={styles.input} keyboardType="numeric" value={form.target} onChangeText={t => setForm(f => ({ ...f, target: t.replace(/[^0-9]/g, "") }))} placeholder="0" placeholderTextColor={colors.muted} />
              <Text style={styles.label}>Sudah Terkumpul (Rp)</Text>
              <TextInput testID="goal-saved" style={styles.input} keyboardType="numeric" value={form.saved} onChangeText={t => setForm(f => ({ ...f, saved: t.replace(/[^0-9]/g, "") }))} placeholder="0" placeholderTextColor={colors.muted} />
              <Text style={styles.label}>Warna</Text>
              <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                {GOAL_COLORS.map(c => (
                  <Pressable key={c} onPress={() => setForm(f => ({ ...f, color: c }))} style={[styles.colorDot, { backgroundColor: c, borderWidth: form.color === c ? 3 : 0, borderColor: colors.onSurface }]} />
                ))}
              </View>
              <PrimaryButton label={edit ? "Simpan Perubahan" : "Buat Target"} onPress={submit} testID="goal-submit" />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  title: { color: colors.onSurface, fontSize: 24, fontWeight: "800" },
  sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  fab: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  hero: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: `${colors.success}55` },
  heroLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  heroAmount: { color: colors.success, fontSize: 28, fontWeight: "800", marginTop: 4 },
  heroSub: { color: colors.muted, fontSize: 12 },
  goal: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  jarWrap: {
    width: 56, height: 76, borderRadius: 12, borderWidth: 2,
    backgroundColor: colors.surfaceTertiary, overflow: "hidden", justifyContent: "flex-end", alignItems: "center",
  },
  jarFill: { width: "100%", position: "absolute", bottom: 0, opacity: 0.7 },
  jarIcon: { position: "absolute", top: 26 },
  goalName: { color: colors.onSurface, fontSize: 15, fontWeight: "700", flex: 1 },
  iconBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: "85%", borderWidth: 1, borderColor: colors.border },
  label: { color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", marginTop: 4 },
  input: { backgroundColor: colors.surfaceTertiary, color: colors.onSurface, borderRadius: radius.md, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: colors.border, fontSize: 14 },
  colorDot: { width: 34, height: 34, borderRadius: 17 },
}));
