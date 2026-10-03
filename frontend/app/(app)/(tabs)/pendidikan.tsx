import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, TextInput, Modal, KeyboardAvoidingView, Platform, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import * as ImagePicker from "expo-image-picker";
import { api, idr } from "@/src/api";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Card, EmptyState, PillButton, PrimaryButton, SectionHeader } from "@/src/components/ui";
import { useConfirm } from "@/src/confirm";

type Child = { child_id: string; name: string; school: string; grade: string; photo_url?: string | null };
type Item = { item_id: string; child_id: string; name: string; category: string; budget: number; realized: number; auto_realized?: number; status: string; month: string; frequency?: string };

const EDU_CATS = ["SPP", "Uang Saku", "Buku & Materi", "Seragam", "Les / Kursus", "Transportasi", "Kegiatan Sekolah", "Perlengkapan", "Lainnya"];

function monthKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }

export default function Pendidikan() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const confirm = useConfirm();
  const [children, setChildren] = useState<Child[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [month, setMonth] = useState(monthKey());
  const [refreshing, setRefreshing] = useState(false);

  const [childModal, setChildModal] = useState<{ open: boolean; edit?: Child | null }>({ open: false, edit: null });
  const [childForm, setChildForm] = useState({ name: "", school: "", grade: "", photo_url: "" });

  const [itemModal, setItemModal] = useState<{ open: boolean; edit?: Item | null }>({ open: false, edit: null });
  const [itemForm, setItemForm] = useState({ name: "", category: "SPP", budget: "", frequency: "Bulanan" });

  const load = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([
        api<Child[]>("/education/children"),
        api<any>(`/education/summary?month=${month}`),
      ]);
      setChildren(c);
      setSummary(s);
      if (!selected && c.length > 0) setSelected(c[0].child_id);
    } catch {}
  }, [month]);

  const loadItems = useCallback(async () => {
    if (!selected) { setItems([]); return; }
    try {
      const its = await api<Item[]>(`/education/items?child_id=${selected}&month=${month}`);
      setItems(its);
    } catch {}
  }, [selected, month]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadItems(); }, [loadItems]);

  const pickChildPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true,
    });
    if (!res.canceled && res.assets?.[0]?.base64) {
      setChildForm(f => ({ ...f, photo_url: `data:image/jpeg;base64,${res.assets![0].base64}` }));
    }
  };

  const openAddChild = () => {
    setChildForm({ name: "", school: "", grade: "", photo_url: "" });
    setChildModal({ open: true, edit: null });
  };
  const openEditChild = (c: Child) => {
    setChildForm({ name: c.name, school: c.school, grade: c.grade, photo_url: c.photo_url || "" });
    setChildModal({ open: true, edit: c });
  };
  const submitChild = async () => {
    if (!childForm.name.trim()) return;
    const body = { ...childForm };
    try {
      if (childModal.edit) {
        await api(`/education/children/${childModal.edit.child_id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        const created = await api<Child>("/education/children", { method: "POST", body: JSON.stringify(body) });
        setSelected(created.child_id);
      }
      setChildModal({ open: false });
      await load();
      await loadItems();
    } catch {}
  };
  const deleteChild = async (c: Child) => {
    const ok = await confirm({ title: "Hapus Anak", message: `Hapus "${c.name}" beserta seluruh kebutuhan pendidikannya? Tindakan ini tidak dapat dibatalkan.`, danger: true });
    if (!ok) return;
    try {
      await api(`/education/children/${c.child_id}`, { method: "DELETE" });
      if (selected === c.child_id) setSelected(null);
      await load();
      await loadItems();
    } catch {}
  };

  const openAddItem = () => {
    setItemForm({ name: "", category: "SPP", budget: "", frequency: "Bulanan" });
    setItemModal({ open: true, edit: null });
  };
  const openEditItem = (it: Item) => {
    setItemForm({ name: it.name, category: it.category, budget: String(it.budget), frequency: it.frequency || "Bulanan" });
    setItemModal({ open: true, edit: it });
  };
  const submitItem = async () => {
    if (!itemForm.name.trim() || !selected) return;
    const body = {
      child_id: selected,
      name: itemForm.name.trim(),
      category: itemForm.category,
      budget: parseFloat(itemForm.budget) || 0,
      realized: itemModal.edit?.realized || 0,
      frequency: itemForm.frequency,
      month,
      status: "belum",
    };
    try {
      if (itemModal.edit) {
        await api(`/education/items/${itemModal.edit.item_id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await api("/education/items", { method: "POST", body: JSON.stringify(body) });
      }
      setItemModal({ open: false });
      await load();
      await loadItems();
    } catch {}
  };
  const deleteItem = async (it: Item) => {
    const ok = await confirm({ title: "Hapus Kebutuhan", message: `Hapus "${it.name}"?`, danger: true });
    if (!ok) return;
    try { await api(`/education/items/${it.item_id}`, { method: "DELETE" }); await load(); await loadItems(); } catch {}
  };

  const totalBudget = summary?.total_budget || 0;
  const totalRealized = summary?.total_realized || 0;
  const totalRemaining = summary?.total_remaining || 0;
  const percentUsed = totalBudget > 0 ? Math.min(100, (totalRealized / totalBudget) * 100) : 0;

  const selectedChild = children.find(c => c.child_id === selected);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 24, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); await loadItems(); setRefreshing(false); }} tintColor={colors.brandPrimary} />}
      >
        <View>
          <Text style={styles.title}>Pendidikan</Text>
          <Text style={styles.sub}>Kelola kebutuhan pendidikan keluarga Anda</Text>
        </View>

        {/* TOTAL SALDO ANGGARAN — semua anak */}
        <Card>
          <Text style={styles.heroLabel}>TOTAL SALDO ANGGARAN — SEMUA ANAK</Text>
          <Text style={styles.heroValue}>{idr(totalBudget)}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${percentUsed}%` }]} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
            <Mini label="Terpakai" value={idr(totalRealized)} color={colors.error} />
            <Mini label="Sisa" value={idr(totalRemaining)} color={colors.success} />
            <Mini label="Bulan" value={month} color={colors.info} />
          </View>
        </Card>

        {/* Per anak ringkas */}
        {summary?.per_child?.length ? (
          <View style={{ gap: 8 }}>
            <SectionHeader title={`Anggaran Per Anak (${summary.child_count})`} />
            {summary.per_child.map((c: any) => (
              <View key={c.child_id} style={styles.childSummary}>
                <View style={styles.childAvatar}>
                  {c.photo_url ? <Image source={{ uri: c.photo_url }} style={{ width: 40, height: 40, borderRadius: 20 }} /> : (
                    <Icon name="account-child-circle" size={30} color={colors.brandPrimary} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.childName}>{c.name}</Text>
                  <Text style={styles.childSub}>{c.school || "-"}{c.grade ? ` • ${c.grade}` : ""}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: colors.onSurface, fontWeight: "800", fontSize: 13 }}>{idr(c.budget)}</Text>
                  <Text style={{ color: c.realized >= c.budget ? colors.success : colors.muted, fontSize: 11 }}>Realisasi {idr(c.realized)}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* Pilih anggota + kelola */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={styles.sectionTitle}>Pilih Anggota Pendidikan</Text>
          <Pressable testID="add-child-btn" onPress={openAddChild} style={styles.smallBtn}>
            <Icon name="plus" size={14} color={colors.onBrandPrimary} />
            <Text style={styles.smallBtnText}>Tambah Anak</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 12 }}>
          {children.map(c => (
            <Pressable
              key={c.child_id}
              onPress={() => setSelected(c.child_id)}
              onLongPress={() => openEditChild(c)}
              style={[styles.childChip, selected === c.child_id && { borderColor: colors.brandPrimary, backgroundColor: `${colors.brandPrimary}22` }]}
              testID={`select-child-${c.child_id}`}
            >
              <View style={styles.childChipAvatar}>
                {c.photo_url ? <Image source={{ uri: c.photo_url }} style={{ width: 36, height: 36, borderRadius: 18 }} /> : (
                  <Icon name="account-child" size={22} color={colors.brandPrimary} />
                )}
              </View>
              <Text style={styles.childChipName} numberOfLines={1}>{c.name}</Text>
              <Text style={styles.childChipSub} numberOfLines={1}>{c.grade || "-"}</Text>
              <View style={{ flexDirection: "row", gap: 4, marginTop: 4 }}>
                <Pressable onPress={() => openEditChild(c)} style={styles.chipIconBtn} testID={`edit-child-${c.child_id}`}><Icon name="pencil" size={12} color={colors.info} /></Pressable>
                <Pressable onPress={() => deleteChild(c)} style={styles.chipIconBtn} testID={`del-child-${c.child_id}`}><Icon name="trash-can-outline" size={12} color={colors.error} /></Pressable>
              </View>
            </Pressable>
          ))}
          {children.length === 0 ? (
            <Pressable onPress={openAddChild} style={styles.addChildEmpty}>
              <Icon name="account-plus" size={24} color={colors.brandPrimary} />
              <Text style={{ color: colors.brandPrimary, fontSize: 12, fontWeight: "700" }}>Tambah anggota</Text>
            </Pressable>
          ) : null}
        </ScrollView>

        {/* Kebutuhan pendidikan */}
        {selectedChild ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={styles.sectionTitle}>Kebutuhan — {selectedChild.name}</Text>
              <Pressable testID="add-edu-item" onPress={openAddItem} style={styles.smallBtn}>
                <Icon name="plus" size={14} color={colors.onBrandPrimary} />
                <Text style={styles.smallBtnText}>Tambah</Text>
              </Pressable>
            </View>
            {items.length === 0 ? (
              <EmptyState icon="book-open-variant" title="Belum ada kebutuhan" hint="Tambahkan kebutuhan pendidikan pertama." />
            ) : items.map(it => {
              const p = it.budget > 0 ? Math.min(100, (it.realized / it.budget) * 100) : 0;
              const stColor = it.status === "lunas" ? colors.success : it.status === "sebagian" ? colors.warning : colors.muted;
              return (
                <View key={it.item_id} style={styles.itemRow}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={[styles.itemIcon, { backgroundColor: `${stColor}22`, borderColor: `${stColor}55` }]}>
                      <Icon name={statusIcon(it.status)} size={18} color={stColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{it.name}</Text>
                      <Text style={styles.itemSub}>{it.category} • {it.frequency}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.itemBudget}>{idr(it.budget)}</Text>
                      <Text style={[styles.itemReal, { color: stColor }]}>{idr(it.realized)}</Text>
                    </View>
                  </View>
                  <View style={styles.progressTrackSmall}>
                    <View style={[styles.progressFillSmall, { width: `${p}%`, backgroundColor: stColor }]} />
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                    <Text style={styles.autoTag}>{(it.auto_realized || 0) > 0 ? `Realisasi otomatis dari transaksi: ${idr(it.auto_realized || 0)}` : "Belum ada transaksi terkait"}</Text>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      <Pressable onPress={() => openEditItem(it)} style={styles.actionBtn} testID={`edit-item-${it.item_id}`}>
                        <Icon name="pencil" size={14} color={colors.info} />
                      </Pressable>
                      <Pressable onPress={() => deleteItem(it)} style={styles.actionBtn} testID={`del-item-${it.item_id}`}>
                        <Icon name="trash-can-outline" size={14} color={colors.error} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </>
        ) : (
          <EmptyState icon="account-plus" title="Tambah anggota dulu" hint="Buat data anak untuk mulai mengelola anggaran pendidikan." />
        )}
      </ScrollView>

      {/* Child Modal */}
      <Modal visible={childModal.open} animationType="slide" transparent onRequestClose={() => setChildModal({ open: false })}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBg}>
          <View style={styles.modal}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "800" }}>{childModal.edit ? "Edit Anak" : "Tambah Anak"}</Text>
              <Pressable onPress={() => setChildModal({ open: false })} testID="close-child-modal"><Icon name="close" size={22} color={colors.onSurface} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ gap: 10 }} keyboardShouldPersistTaps="handled">
              <Pressable onPress={pickChildPhoto} style={styles.photoPicker} testID="child-photo-picker">
                {childForm.photo_url ? (
                  <Image source={{ uri: childForm.photo_url }} style={{ width: 96, height: 96, borderRadius: 48 }} />
                ) : (
                  <View style={styles.photoEmpty}>
                    <Icon name="camera-plus" size={32} color={colors.brandPrimary} />
                    <Text style={{ color: colors.brandPrimary, fontSize: 11, fontWeight: "700", marginTop: 6 }}>Pilih Foto</Text>
                  </View>
                )}
              </Pressable>
              <Text style={styles.label}>Nama Anak</Text>
              <TextInput testID="child-name" style={styles.input} value={childForm.name} onChangeText={t => setChildForm(f => ({ ...f, name: t }))} placeholder="cth. Andi" placeholderTextColor={colors.muted} />
              <Text style={styles.label}>Sekolah</Text>
              <TextInput style={styles.input} value={childForm.school} onChangeText={t => setChildForm(f => ({ ...f, school: t }))} placeholder="cth. SD Negeri 1" placeholderTextColor={colors.muted} />
              <Text style={styles.label}>Kelas</Text>
              <TextInput style={styles.input} value={childForm.grade} onChangeText={t => setChildForm(f => ({ ...f, grade: t }))} placeholder="cth. Kelas 6" placeholderTextColor={colors.muted} />
              <PrimaryButton label={childModal.edit ? "Simpan Perubahan" : "Simpan"} onPress={submitChild} testID="child-submit" />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Item Modal */}
      <Modal visible={itemModal.open} animationType="slide" transparent onRequestClose={() => setItemModal({ open: false })}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBg}>
          <View style={styles.modal}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "800" }}>{itemModal.edit ? "Edit Kebutuhan" : "Tambah Kebutuhan"}</Text>
              <Pressable onPress={() => setItemModal({ open: false })} testID="close-item-modal"><Icon name="close" size={22} color={colors.onSurface} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ gap: 10 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Nama Kebutuhan</Text>
              <TextInput testID="edu-item-name" style={styles.input} value={itemForm.name} onChangeText={t => setItemForm(f => ({ ...f, name: t }))} placeholder="cth. SPP September" placeholderTextColor={colors.muted} />
              <Text style={styles.label}>Kategori</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 12 }}>
                {EDU_CATS.map(c => (
                  <PillButton key={c} label={c} active={itemForm.category === c} onPress={() => setItemForm(f => ({ ...f, category: c }))} />
                ))}
              </ScrollView>
              <Text style={styles.label}>Anggaran (Rp)</Text>
              <TextInput testID="edu-item-budget" style={styles.input} value={itemForm.budget} onChangeText={t => setItemForm(f => ({ ...f, budget: t.replace(/[^0-9]/g, "") }))} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.muted} />
              <Text style={styles.label}>Frekuensi</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 12 }}>
                {["Bulanan", "Harian", "Mingguan", "Tahunan", "Sekali bayar"].map(f => (
                  <PillButton key={f} label={f} active={itemForm.frequency === f} onPress={() => setItemForm(x => ({ ...x, frequency: f }))} />
                ))}
              </ScrollView>
              <PrimaryButton label={itemModal.edit ? "Simpan Perubahan" : "Simpan"} onPress={submitItem} testID="item-submit" />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function statusIcon(s: string) {
  if (s === "lunas") return "check-circle";
  if (s === "sebagian") return "clock-alert";
  return "circle-outline";
}

function Mini({ label, value, color }: any) {
  const { colors } = useTheme();
  return (
    <View>
      <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700" }}>{label}</Text>
      <Text style={{ color, fontWeight: "800", fontSize: 13, marginTop: 2 }}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  title: { color: colors.onSurface, fontSize: 24, fontWeight: "800" },
  sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  heroLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
  heroValue: { color: colors.brandPrimary, fontSize: 28, fontWeight: "900", marginTop: 6 },
  progressTrack: { height: 8, backgroundColor: colors.surfaceTertiary, borderRadius: 4, overflow: "hidden", marginTop: 12 },
  progressFill: { height: "100%", backgroundColor: colors.brandPrimary },
  sectionTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "800", flex: 1 },
  smallBtn: { flexDirection: "row", alignItems: "center", gap: 4, height: 32, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.brandPrimary },
  smallBtnText: { color: colors.onBrandPrimary, fontSize: 12, fontWeight: "800" },
  childSummary: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  childAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: `${colors.brandPrimary}22`, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  childName: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  childSub: { color: colors.muted, fontSize: 11, marginTop: 2 },
  childChip: { width: 128, padding: 10, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  childChipAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: `${colors.brandPrimary}22`, alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: 6 },
  childChipName: { color: colors.onSurface, fontSize: 12, fontWeight: "800" },
  childChipSub: { color: colors.muted, fontSize: 10, marginTop: 2 },
  chipIconBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  addChildEmpty: { width: 128, height: 96, borderRadius: radius.md, borderWidth: 1, borderColor: `${colors.brandPrimary}55`, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 4 },
  itemRow: { padding: 12, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  itemIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  itemName: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  itemSub: { color: colors.muted, fontSize: 11, marginTop: 2 },
  itemBudget: { color: colors.onSurface, fontSize: 13, fontWeight: "800" },
  itemReal: { fontSize: 11, marginTop: 2 },
  progressTrackSmall: { height: 5, backgroundColor: colors.surfaceTertiary, borderRadius: 3, overflow: "hidden", marginTop: 10 },
  progressFillSmall: { height: "100%" },
  autoTag: { color: colors.muted, fontSize: 10, flex: 1 },
  actionBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: "88%", borderWidth: 1, borderColor: colors.border },
  label: { color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", marginTop: 4 },
  input: { backgroundColor: colors.surfaceTertiary, color: colors.onSurface, borderRadius: radius.md, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: colors.border, fontSize: 14 },
  photoPicker: { alignSelf: "center", marginBottom: 8 },
  photoEmpty: { width: 96, height: 96, borderRadius: 48, backgroundColor: `${colors.brandPrimary}22`, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: `${colors.brandPrimary}55`, borderStyle: "dashed" },
}));
