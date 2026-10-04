import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, TextInput, Modal, KeyboardAvoidingView, Platform, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { api, idr } from "@/src/api";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { EmptyState, PillButton, PrimaryButton } from "@/src/components/ui";
import { useConfirm } from "@/src/confirm";
import { localeTag } from "@/src/i18n";
import { LinearGradient } from "expo-linear-gradient";
import { DonutChart } from "@/src/components/charts";

const EDU_COLORS = ["#9B6BFF", "#3D7EFF", "#FF9D3D", "#10D96A", "#FF4757", "#F7C948"];
const CHILD_GRADS = [["#9B6BFF", "#6D3DFF"], ["#FF7FB0", "#FF4D8D"], ["#4A8CFF", "#2A5FD6"], ["#13E07A", "#0BA85A"], ["#FFB44A", "#F7742F"]];

const EDU_CAT_VIS: Record<string, { icon: string; grad: string[] }> = {
  SPP: { icon: "book-open-page-variant", grad: ["#A77BFF", "#7C4DFF"] },
  "Uang Saku": { icon: "wallet", grad: ["#4A8CFF", "#2A5FD6"] },
  "Buku & Materi": { icon: "book-multiple", grad: ["#FFB44A", "#F7742F"] },
  Seragam: { icon: "tshirt-crew", grad: ["#4A8CFF", "#2A5FD6"] },
  "Uang Kas": { icon: "cash-multiple", grad: ["#13E07A", "#0BA85A"] },
  "Les / Kursus": { icon: "human-male-board", grad: ["#A77BFF", "#7C4DFF"] },
  Transportasi: { icon: "bus", grad: ["#4A8CFF", "#2A5FD6"] },
  "Kegiatan Sekolah": { icon: "trophy", grad: ["#FFB44A", "#F7742F"] },
  Perlengkapan: { icon: "bag-personal", grad: ["#FF5B69", "#E23544"] },
  "Study Tour": { icon: "camera", grad: ["#4A8CFF", "#2A5FD6"] },
  Lainnya: { icon: "dots-horizontal", grad: ["#8B9DA5", "#6B7A82"] },
};
function catVis(cat: string) { return EDU_CAT_VIS[cat] || { icon: "school", grad: ["#A77BFF", "#7C4DFF"] }; }

function Glossy({ grad, icon, size = 44, iconSize = 21, rad = 14, style }: any) {
  return (
    <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ width: size, height: size, borderRadius: rad, alignItems: "center", justifyContent: "center" }, style]}>
      <Icon name={icon} size={iconSize} color="#FFFFFF" />
    </LinearGradient>
  );
}

function statusLabel(s: string) { return s === "lunas" ? "Lunas" : s === "sebagian" ? "Sebagian" : "Belum"; }
function statusIcon(s: string) { return s === "lunas" ? "check-circle" : s === "sebagian" ? "progress-clock" : "circle-outline"; }

type Child = { child_id: string; name: string; school: string; grade: string; photo_url?: string | null };
type Item = { item_id: string; child_id: string; name: string; category: string; budget: number; realized: number; auto_realized?: number; status: string; month: string; frequency?: string };

const EDU_CATS = ["SPP", "Uang Saku", "Buku & Materi", "Seragam", "Uang Kas", "Les / Kursus", "Transportasi", "Kegiatan Sekolah", "Perlengkapan", "Study Tour", "Lainnya"];
function monthKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }

export default function Pendidikan() {
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useTheme();
  const router = useRouter();
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
      const [c, s] = await Promise.all([api<Child[]>("/education/children"), api<any>(`/education/summary?month=${month}`)]);
      setChildren(c); setSummary(s);
      if (!selected && c.length > 0) setSelected(c[0].child_id);
    } catch {}
  }, [month]);
  const loadItems = useCallback(async () => {
    if (!selected) { setItems([]); return; }
    try { setItems(await api<Item[]>(`/education/items?child_id=${selected}&month=${month}`)); } catch {}
  }, [selected, month]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadItems(); }, [loadItems]);

  const pickChildPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true });
    if (!res.canceled && res.assets?.[0]?.base64) setChildForm((f) => ({ ...f, photo_url: `data:image/jpeg;base64,${res.assets![0].base64}` }));
  };

  const openAddChild = () => { setChildForm({ name: "", school: "", grade: "", photo_url: "" }); setChildModal({ open: true, edit: null }); };
  const openEditChild = (c: Child) => { setChildForm({ name: c.name, school: c.school, grade: c.grade, photo_url: c.photo_url || "" }); setChildModal({ open: true, edit: c }); };
  const submitChild = async () => {
    if (!childForm.name.trim()) return;
    try {
      if (childModal.edit) await api(`/education/children/${childModal.edit.child_id}`, { method: "PUT", body: JSON.stringify(childForm) });
      else { const created = await api<Child>("/education/children", { method: "POST", body: JSON.stringify(childForm) }); setSelected(created.child_id); }
      setChildModal({ open: false }); await load(); await loadItems();
    } catch {}
  };
  const deleteChild = async (c: Child) => {
    const ok = await confirm({ title: "Hapus Anak", message: `Hapus "${c.name}" beserta seluruh kebutuhan pendidikannya?`, danger: true });
    if (!ok) return;
    try { await api(`/education/children/${c.child_id}`, { method: "DELETE" }); if (selected === c.child_id) setSelected(null); await load(); await loadItems(); } catch {}
  };

  const openAddItem = () => { setItemForm({ name: "", category: "SPP", budget: "", frequency: "Bulanan" }); setItemModal({ open: true, edit: null }); };
  const openEditItem = (it: Item) => { setItemForm({ name: it.name, category: it.category, budget: String(it.budget), frequency: it.frequency || "Bulanan" }); setItemModal({ open: true, edit: it }); };
  const submitItem = async () => {
    if (!itemForm.name.trim() || !selected) return;
    const body = { child_id: selected, name: itemForm.name.trim(), category: itemForm.category, budget: parseFloat(itemForm.budget) || 0, realized: itemModal.edit?.realized || 0, frequency: itemForm.frequency, month, status: "belum" };
    try {
      if (itemModal.edit) await api(`/education/items/${itemModal.edit.item_id}`, { method: "PUT", body: JSON.stringify(body) });
      else await api("/education/items", { method: "POST", body: JSON.stringify(body) });
      setItemModal({ open: false }); await load(); await loadItems();
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
  const progress = totalBudget > 0 ? Math.round((totalRealized / totalBudget) * 100) : 0;

  const shiftMonth = (delta: number) => {
    const d = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const monthLabel = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1).toLocaleDateString(localeTag(), { month: "long", year: "numeric" });
  const today = new Date().toLocaleDateString(localeTag(), { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase();

  const catMap: Record<string, number> = {};
  for (const it of items) catMap[it.category] = (catMap[it.category] || 0) + (it.budget || 0);
  const catDist = Object.entries(catMap).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  const catMax = Math.max(1, ...catDist.map((c) => c.value));
  const itemBudgetTotal = items.reduce((s, i) => s + (i.budget || 0), 0);
  const itemRealizedTotal = items.reduce((s, i) => s + (i.realized || 0), 0);
  const upcomingCount = items.filter((i) => i.status !== "lunas").length;
  const selectedChild = children.find((c) => c.child_id === selected);

  const stats = [
    { key: "total", label: "TOTAL ANGGARAN", value: idr(totalBudget), sub: "100% dari rencana", grad: ["#A77BFF", "#7C4DFF"], tint: colors.brandPrimary, icon: "wallet" },
    { key: "paid", label: "SUDAH DIBAYAR", value: idr(totalRealized), sub: `${progress}% dari anggaran`, grad: ["#13E07A", "#0BA85A"], tint: colors.success, icon: "check-circle" },
    { key: "rest", label: "BELUM DIBAYAR", value: idr(totalRemaining), sub: `${100 - progress}% masih tersisa`, grad: ["#FFB44A", "#F7742F"], tint: colors.warning, icon: "clock-time-four" },
    { key: "progress", label: "PROGRESS", value: `${progress}%`, sub: "Dari anggaran", grad: ["#4A8CFF", "#2A5FD6"], tint: colors.info, icon: "chart-arc" },
    { key: "due", label: "KEWAJIBAN", value: String(upcomingCount), sub: "Belum lunas", grad: ["#FF5B69", "#E23544"], tint: colors.error, icon: "bell-ring" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); await loadItems(); setRefreshing(false); }} tintColor={colors.brandPrimary} />}
      >
        {/* HERO */}
        <LinearGradient colors={scheme === "dark" ? ["#231A52", "#0B1324"] : ["#EDE9FF", "#FFFFFF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + 14 }]}>
          <View style={styles.heroGlow} pointerEvents="none" />
          <View style={styles.cluster} pointerEvents="none">
            <LinearGradient colors={["#5B3FA6", "#3B2A73"]} style={[styles.cBadge, { top: 30, right: 44, transform: [{ rotate: "-8deg" }] }]}><Icon name="book-multiple" size={20} color="#E7DCFF" /></LinearGradient>
            <LinearGradient colors={["#2A3E66", "#16233F"]} style={[styles.cBadge, styles.cMain, { top: 8, right: 10 }]}><Icon name="school" size={30} color="#FFD37A" /></LinearGradient>
            <LinearGradient colors={["#4A8CFF", "#2A5FD6"]} style={[styles.cBadge, { top: 62, right: 58 }]}><Icon name="bag-personal" size={18} color="#FFFFFF" /></LinearGradient>
          </View>
          <View style={styles.heroTop}>
            <Text style={styles.heroDate}>{today}</Text>
            <Pressable testID="open-menu" onPress={() => router.push("/(app)/menu")} style={styles.menuBtn}><Icon name="menu" size={20} color="#FFFFFF" /></Pressable>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
            <Text style={styles.heroTitle}>Pendidikan</Text>
            <Icon name="school" size={22} color="#FFFFFF" />
          </View>
          <Text style={styles.heroSub}>Kelola seluruh kebutuhan pendidikan keluarga Anda.</Text>
          <View style={styles.monthPill}>
            <Pressable testID="edu-month-prev" onPress={() => shiftMonth(-1)} hitSlop={8} style={styles.monthArrow}><Icon name="chevron-left" size={20} color="#FFFFFF" /></Pressable>
            <Text style={styles.monthPillText} testID="edu-month-label">{monthLabel}</Text>
            <Pressable testID="edu-month-next" onPress={() => shiftMonth(1)} hitSlop={8} style={styles.monthArrow}><Icon name="chevron-right" size={20} color="#FFFFFF" /></Pressable>
          </View>
        </LinearGradient>

        {/* STAT CARDS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}>
          {stats.map((s) => (
            <LinearGradient key={s.key} testID={`edu-stat-${s.key}`} colors={[`${s.tint}26`, scheme === "dark" ? "rgba(18,24,43,0.9)" : "#FFFFFF"]} start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 1 }} style={[styles.statCard, { borderColor: `${s.tint}55`, shadowColor: s.tint }]}>
              <Glossy grad={s.grad} icon={s.icon} size={36} iconSize={18} rad={12} style={styles.statIcon} />
              <Text style={styles.statLabel} numberOfLines={1}>{s.label}</Text>
              <Text style={[styles.statVal, { color: s.tint }]} numberOfLines={1}>{s.value}</Text>
              <Text style={styles.statSub} numberOfLines={1}>{s.sub}</Text>
            </LinearGradient>
          ))}
        </ScrollView>

        {/* MEMBERS */}
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={styles.sectionTitle}>Pilih Anggota Pendidikan</Text>
            <Pressable testID="add-child-btn" onPress={openAddChild} style={styles.smallBtn}>
              <Icon name="plus" size={14} color="#FFFFFF" /><Text style={styles.smallBtnText}>Tambah</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 8 }}>
            {children.map((c, i) => {
              const on = selected === c.child_id;
              const grad = CHILD_GRADS[i % CHILD_GRADS.length];
              return (
                <Pressable key={c.child_id} onPress={() => setSelected(c.child_id)} onLongPress={() => openEditChild(c)} style={[styles.childCard, on && { borderColor: colors.brandPrimary, backgroundColor: `${colors.brandPrimary}1A` }]} testID={`select-child-${c.child_id}`}>
                  <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarRing}>
                    {c.photo_url ? <Image source={{ uri: c.photo_url }} style={styles.avatarImg} /> : <View style={styles.avatarInner}><Icon name="face-man" size={24} color="#FFFFFF" /></View>}
                  </LinearGradient>
                  <Text style={styles.childName} numberOfLines={1}>{c.name}</Text>
                  <Text style={styles.childSub} numberOfLines={1}>{c.school || "-"}</Text>
                  <Text style={styles.childGrade} numberOfLines={1}>{c.grade || ""}</Text>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                    <Pressable onPress={() => openEditChild(c)} style={styles.chipIconBtn} testID={`edit-child-${c.child_id}`}><Icon name="pencil" size={12} color={colors.info} /></Pressable>
                    <Pressable onPress={() => deleteChild(c)} style={styles.chipIconBtn} testID={`del-child-${c.child_id}`}><Icon name="trash-can-outline" size={12} color={colors.error} /></Pressable>
                  </View>
                </Pressable>
              );
            })}
            <Pressable onPress={openAddChild} style={styles.addChild} testID="add-child-empty">
              <View style={styles.addChildCircle}><Icon name="plus" size={24} color={colors.brandPrimary} /></View>
              <Text style={styles.addChildText}>Tambah Anggota</Text>
            </Pressable>
          </ScrollView>
        </View>

        {/* REQUIREMENTS */}
        {selectedChild ? (
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={styles.sectionTitle} numberOfLines={1}>Kebutuhan — {selectedChild.name}</Text>
              <Pressable testID="add-edu-item" onPress={openAddItem} style={styles.smallBtn}>
                <Icon name="plus" size={14} color="#FFFFFF" /><Text style={styles.smallBtnText}>Tambah</Text>
              </Pressable>
            </View>
            {items.length === 0 ? (
              <EmptyState icon="book-open-variant" title="Belum ada kebutuhan" hint="Tambahkan kebutuhan pendidikan pertama." />
            ) : (
              <>
                {items.map((it) => {
                  const p = it.budget > 0 ? Math.min(100, (it.realized / it.budget) * 100) : 0;
                  const v = catVis(it.category);
                  const stColor = it.status === "lunas" ? colors.success : it.status === "sebagian" ? colors.warning : colors.muted;
                  return (
                    <View key={it.item_id} style={styles.itemRow} testID={`edu-item-${it.item_id}`}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <Glossy grad={v.grad} icon={v.icon} size={44} iconSize={21} rad={14} style={styles.itemIcon} />
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={styles.itemName} numberOfLines={1}>{it.name}</Text>
                            <View style={styles.freqTag}><Text style={styles.freqText}>{it.frequency}</Text></View>
                          </View>
                          <Text style={styles.itemSub}>{it.category}</Text>
                        </View>
                        <View style={{ alignItems: "flex-end", gap: 4 }}>
                          <Text style={styles.itemBudget}>{idr(it.budget)}</Text>
                          <View style={[styles.statusChip, { backgroundColor: `${stColor}22` }]}>
                            <Icon name={statusIcon(it.status)} size={11} color={stColor} />
                            <Text style={[styles.statusChipText, { color: stColor }]}>{statusLabel(it.status)}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.trackSmall}><View style={{ height: 6, borderRadius: 3, width: `${p}%`, backgroundColor: stColor }} /></View>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                        <Text style={styles.sisaText}>Realisasi {idr(it.realized)} · Sisa {idr(Math.max(0, it.budget - it.realized))}</Text>
                        <View style={{ flexDirection: "row", gap: 6 }}>
                          <Pressable onPress={() => openEditItem(it)} style={styles.actionBtn} testID={`edit-item-${it.item_id}`}><Icon name="pencil" size={14} color={colors.info} /></Pressable>
                          <Pressable onPress={() => deleteItem(it)} style={styles.actionBtn} testID={`del-item-${it.item_id}`}><Icon name="trash-can-outline" size={14} color={colors.error} /></Pressable>
                        </View>
                      </View>
                    </View>
                  );
                })}
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>TOTAL</Text>
                  <View style={{ flexDirection: "row", gap: 14 }}>
                    <Text style={styles.totalVal}>{idr(itemBudgetTotal)}</Text>
                    <Text style={[styles.totalVal, { color: colors.success }]}>{idr(itemRealizedTotal)}</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        ) : (
          <View style={{ paddingHorizontal: spacing.lg }}><EmptyState icon="account-plus" title="Tambah anggota dulu" hint="Buat data anak untuk mulai mengelola anggaran pendidikan." /></View>
        )}

        {/* RINGKASAN DONUT */}
        {selectedChild && catDist.length > 0 ? (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>RINGKASAN PENDIDIKAN</Text>
              <View style={{ alignItems: "center", marginTop: spacing.md }}>
                <View style={{ width: 150, height: 150, alignItems: "center", justifyContent: "center" }}>
                  <DonutChart data={catDist.map((c, i) => ({ value: c.value, color: EDU_COLORS[i % EDU_COLORS.length] }))} size={150} thickness={26} />
                  <View style={styles.donutCenter} pointerEvents="none">
                    <Text style={styles.donutLbl}>Total</Text>
                    <Text style={styles.donutVal}>{idr(itemBudgetTotal)}</Text>
                    <Text style={styles.donutMonth}>{monthLabel}</Text>
                  </View>
                </View>
                <View style={{ alignSelf: "stretch", gap: 10, marginTop: spacing.md }}>
                  {catDist.slice(0, 6).map((c, i) => {
                    const pctv = itemBudgetTotal > 0 ? Math.round((c.value / itemBudgetTotal) * 100) : 0;
                    return (
                      <View key={c.label} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: EDU_COLORS[i % EDU_COLORS.length] }} />
                        <Text style={styles.legendCat} numberOfLines={1}>{c.label}</Text>
                        <Text style={styles.legendAmt}>{idr(c.value)}</Text>
                        <Text style={styles.legendPct}>{pctv}%</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {/* PER KATEGORI BARS */}
        {selectedChild && catDist.length > 0 ? (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>ANGGARAN PER KATEGORI</Text>
              <View style={{ gap: 12, marginTop: spacing.md }}>
                {catDist.map((c, i) => (
                  <View key={c.label} style={{ gap: 5 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={styles.barLabel}>{c.label}</Text>
                      <Text style={styles.barAmt}>{idr(c.value)}</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <LinearGradient colors={[EDU_COLORS[i % EDU_COLORS.length], `${EDU_COLORS[i % EDU_COLORS.length]}99`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 8, borderRadius: 4, width: `${Math.max(4, (c.value / catMax) * 100)}%` }} />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : null}
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
                <LinearGradient colors={[colors.brandPrimary, colors.brandSecondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.photoRing}>
                  {childForm.photo_url ? <Image source={{ uri: childForm.photo_url }} style={styles.photoImg} /> : (
                    <View style={styles.photoInner}><Icon name="camera-plus" size={30} color="#FFFFFF" /></View>
                  )}
                </LinearGradient>
              </Pressable>
              <Text style={styles.label}>Nama Anak</Text>
              <TextInput testID="child-name" style={styles.input} value={childForm.name} onChangeText={(t) => setChildForm((f) => ({ ...f, name: t }))} placeholder="cth. Andi" placeholderTextColor={colors.muted} />
              <Text style={styles.label}>Sekolah</Text>
              <TextInput style={styles.input} value={childForm.school} onChangeText={(t) => setChildForm((f) => ({ ...f, school: t }))} placeholder="cth. SD Negeri 1" placeholderTextColor={colors.muted} />
              <Text style={styles.label}>Kelas</Text>
              <TextInput style={styles.input} value={childForm.grade} onChangeText={(t) => setChildForm((f) => ({ ...f, grade: t }))} placeholder="cth. Kelas 6" placeholderTextColor={colors.muted} />
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
              <TextInput testID="edu-item-name" style={styles.input} value={itemForm.name} onChangeText={(t) => setItemForm((f) => ({ ...f, name: t }))} placeholder="cth. SPP September" placeholderTextColor={colors.muted} />
              <Text style={styles.label}>Kategori</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 12 }}>
                {EDU_CATS.map((c) => <PillButton key={c} label={c} active={itemForm.category === c} onPress={() => setItemForm((f) => ({ ...f, category: c }))} />)}
              </ScrollView>
              <Text style={styles.label}>Anggaran (Rp)</Text>
              <TextInput testID="edu-item-budget" style={styles.input} value={itemForm.budget} onChangeText={(t) => setItemForm((f) => ({ ...f, budget: t.replace(/[^0-9]/g, "") }))} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.muted} />
              <Text style={styles.label}>Frekuensi</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 12 }}>
                {["Bulanan", "Harian", "Mingguan", "Tahunan", "Sekali bayar"].map((f) => <PillButton key={f} label={f} active={itemForm.frequency === f} onPress={() => setItemForm((x) => ({ ...x, frequency: f }))} />)}
              </ScrollView>
              <PrimaryButton label={itemModal.edit ? "Simpan Perubahan" : "Simpan"} onPress={submitItem} testID="item-submit" />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  // Hero
  hero: { borderBottomLeftRadius: 28, borderBottomRightRadius: 28, paddingBottom: spacing.lg, paddingHorizontal: spacing.lg, overflow: "hidden" },
  heroGlow: { position: "absolute", width: 240, height: 240, borderRadius: 120, backgroundColor: "rgba(155,107,255,0.14)", top: -130, alignSelf: "center" },
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

  // Stat cards
  statCard: { width: 150, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, gap: 5, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 12, elevation: 4 },
  statIcon: { shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  statLabel: { color: colors.muted, fontSize: 9.5, fontWeight: "800", letterSpacing: 0.4, marginTop: 2 },
  statVal: { fontSize: 16, fontWeight: "900" },
  statSub: { color: colors.muted, fontSize: 10, fontWeight: "600" },

  // Members
  sectionTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "800", flexShrink: 1 },
  smallBtn: { flexDirection: "row", alignItems: "center", gap: 4, height: 32, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.brandPrimary },
  smallBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  childCard: { width: 132, padding: 12, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  avatarRing: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", padding: 3, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  avatarInner: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(0,0,0,0.18)", alignItems: "center", justifyContent: "center" },
  avatarImg: { width: 48, height: 48, borderRadius: 24 },
  childName: { color: colors.onSurface, fontSize: 13, fontWeight: "800", marginTop: 8 },
  childSub: { color: colors.muted, fontSize: 10, marginTop: 2, textAlign: "center" },
  childGrade: { color: colors.brandPrimary, fontSize: 10, fontWeight: "700", marginTop: 1 },
  chipIconBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  addChild: { width: 132, borderRadius: radius.lg, borderWidth: 1, borderColor: `${colors.brandPrimary}55`, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 20 },
  addChildCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: `${colors.brandPrimary}22`, alignItems: "center", justifyContent: "center" },
  addChildText: { color: colors.brandPrimary, fontSize: 12, fontWeight: "800" },

  // Items
  itemRow: { padding: 12, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  itemIcon: { shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  itemName: { color: colors.onSurface, fontSize: 14, fontWeight: "700", flexShrink: 1 },
  itemSub: { color: colors.muted, fontSize: 11, marginTop: 3 },
  freqTag: { paddingHorizontal: 8, height: 18, borderRadius: 9, backgroundColor: `${colors.brandPrimary}22`, alignItems: "center", justifyContent: "center" },
  freqText: { color: colors.brandPrimary, fontSize: 9.5, fontWeight: "800" },
  itemBudget: { color: colors.onSurface, fontSize: 14, fontWeight: "800" },
  statusChip: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, height: 20, borderRadius: radius.pill },
  statusChipText: { fontSize: 10, fontWeight: "800" },
  trackSmall: { height: 6, backgroundColor: colors.surfaceTertiary, borderRadius: 3, overflow: "hidden", marginTop: 10 },
  sisaText: { color: colors.muted, fontSize: 10.5, flex: 1 },
  actionBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: 14, height: 44, marginTop: 2 },
  totalLabel: { color: colors.onSurface, fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  totalVal: { color: colors.onSurface, fontSize: 13, fontWeight: "900" },

  // Panels
  panel: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  panelTitle: { color: colors.onSurface, fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },
  donutCenter: { position: "absolute", alignItems: "center", justifyContent: "center" },
  donutLbl: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  donutVal: { color: colors.onSurface, fontSize: 16, fontWeight: "900" },
  donutMonth: { color: colors.muted, fontSize: 9.5, marginTop: 1 },
  legendCat: { color: colors.onSurface, fontSize: 12.5, flex: 1, fontWeight: "600" },
  legendAmt: { color: colors.muted, fontSize: 11.5 },
  legendPct: { color: colors.onSurface, fontSize: 12.5, fontWeight: "800", width: 38, textAlign: "right" },
  barLabel: { color: colors.onSurface, fontSize: 12.5, fontWeight: "600" },
  barAmt: { color: colors.muted, fontSize: 11.5, fontWeight: "700" },
  barTrack: { height: 8, backgroundColor: colors.surfaceTertiary, borderRadius: 4, overflow: "hidden" },

  // Modals
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: "88%", borderWidth: 1, borderColor: colors.border },
  label: { color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", marginTop: 4 },
  input: { backgroundColor: colors.surfaceTertiary, color: colors.onSurface, borderRadius: radius.md, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: colors.border, fontSize: 14 },
  photoPicker: { alignSelf: "center", marginBottom: 8 },
  photoRing: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center", padding: 3 },
  photoInner: { width: 94, height: 94, borderRadius: 47, backgroundColor: "rgba(0,0,0,0.18)", alignItems: "center", justifyContent: "center" },
  photoImg: { width: 94, height: 94, borderRadius: 47 },
}));
