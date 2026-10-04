import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Modal, KeyboardAvoidingView, Platform, Switch, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Icon from "@react-native-vector-icons/material-design-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import * as LocalAuthentication from "expo-local-authentication";
import { api, idr } from "@/src/api";
import { useAuth } from "@/src/auth";
import { usePrefs } from "@/src/prefs";
import { useConfirm } from "@/src/confirm";
import { storage } from "@/src/utils/storage";
import { CURRENCY_META, Currency } from "@/src/store";
import { CatStore, loadCats, saveCats, newCat, CAT_ICON_CHOICES, CAT_COLOR_CHOICES, DEFAULT_CATS } from "@/src/customcats";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { PrimaryButton } from "@/src/components/ui";
import { SettingsHeroArt, AboutHouseArt } from "@/src/components/charts";

const AVATAR = require("../../assets/images/savings/avatar.png");
const LOCK_OPTS = [
  { label: "Tidak Pernah", value: 0 }, { label: "1 menit", value: 1 }, { label: "5 menit", value: 5 }, { label: "15 menit", value: 15 }, { label: "30 menit", value: 30 },
];
const DATE_OPTS = [
  { label: "2 September 2026", value: "long" }, { label: "02-09-2026", value: "dmy" }, { label: "2026-09-02", value: "ymd" },
];
const BACKUP_FREQ = [{ label: "Harian", value: "harian" }, { label: "Mingguan", value: "mingguan" }, { label: "Bulanan", value: "bulanan" }];

export default function Pengaturan() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, scheme } = useTheme();
  const styles = useStyles();
  const confirm = useConfirm();
  const { user, logout, updateProfile } = useAuth();
  const prefs = usePrefs();

  const [name, setName] = useState(user?.name || "");
  const [children, setChildren] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ txCount: 0, income: 0, expense: 0, savings: 0, bills: 0, net: 0, billCount: 0, eduCount: 0, savCount: 0, since: "-", size: 0 });
  const [cats, setCats] = useState<CatStore>(DEFAULT_CATS);
  const [catTab, setCatTab] = useState<"expense" | "income">("expense");
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // modals
  const [sheet, setSheet] = useState<null | { title: string; options: { label: string; value: any }[]; value: any; onSelect: (v: any) => void }>(null);
  const [pinModal, setPinModal] = useState(false);
  const [catModal, setCatModal] = useState<null | { edit?: any }>(null);
  const [clearModal, setClearModal] = useState(false);
  const [userModal, setUserModal] = useState(false);
  const [infoModal, setInfoModal] = useState<null | { title: string; body: string }>(null);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  const loadAll = useCallback(async () => {
    try {
      const [txs, bills, savings, kids, eduItems] = await Promise.all([
        api<any[]>("/transactions").catch(() => []),
        api<any[]>("/bills").catch(() => []),
        api<any[]>("/savings").catch(() => []),
        api<any[]>("/education/children").catch(() => []),
        api<any[]>("/education/items").catch(() => []),
      ]);
      let eduSummary: any = { per_child: [] };
      try { eduSummary = await api<any>("/education/summary"); } catch {}
      const income = txs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const expense = txs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
      const savTotal = savings.reduce((s, g) => s + (g.saved || 0), 0);
      const billsUnpaid = bills.filter((b) => b.status !== "lunas").reduce((s, b) => s + (b.amount || 0), 0);
      const dates = txs.map((t) => String(t.date || t.created_at || "").slice(0, 10)).filter(Boolean).sort();
      const sizeBytes = JSON.stringify({ txs, bills, savings, kids, eduItems }).length;
      setChildren(eduSummary.per_child?.length ? eduSummary.per_child : kids.map((k: any) => ({ ...k, budget: 0, realized: 0 })));
      setStats({ txCount: txs.length, income, expense, savings: savTotal, bills: billsUnpaid, net: income - expense, billCount: bills.length, eduCount: eduItems.length, savCount: savings.length, since: dates[0] || "-", size: sizeBytes });
    } catch {}
  }, []);
  useEffect(() => { loadAll(); loadCats().then(setCats); storage.getItem<string>("shf_last_backup", "").then((v) => setLastBackup(v || null)); }, [loadAll]);
  useEffect(() => { setName(user?.name || ""); }, [user?.name]);

  // ---------- profile ----------
  const saveName = async () => { if (name.trim() && name.trim() !== user?.name) { try { await updateProfile({ name: name.trim() }); showToast("Profil diperbarui"); } catch {} } };
  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { showToast("Izin galeri ditolak"); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true });
    if (!res.canceled && res.assets?.[0]?.base64) {
      try { await updateProfile({ picture: `data:image/jpeg;base64,${res.assets[0].base64}` }); showToast("Foto diperbarui"); } catch {}
    }
  };
  const pickChildPhoto = async (child: any) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { showToast("Izin galeri ditolak"); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true });
    if (!res.canceled && res.assets?.[0]?.base64) {
      try { await api(`/education/children/${child.child_id}`, { method: "PUT", body: JSON.stringify({ name: child.name, school: child.school || "", grade: child.grade || "", photo_url: `data:image/jpeg;base64,${res.assets[0].base64}` }) }); showToast("Foto anak diperbarui"); loadAll(); } catch {}
    }
  };

  // ---------- security ----------
  const toggleBiometric = async (on: boolean) => {
    if (on) {
      const has = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!has || !enrolled) { showToast("Perangkat tidak mendukung/belum ada biometrik"); return; }
      if (!prefs.pin) { showToast("Atur PIN dulu untuk mengaktifkan"); setPinModal(true); return; }
    }
    prefs.set({ biometric: on });
  };

  // ---------- backup / restore ----------
  const doBackup = async () => {
    try {
      const [txs, bills, savings, kids, eduItems, shopping] = await Promise.all([
        api<any[]>("/transactions"), api<any[]>("/bills"), api<any[]>("/savings"), api<any[]>("/education/children"), api<any[]>("/education/items"), api<any[]>("/shopping").catch(() => []),
      ]);
      const payload = { app: "SmartHomeFinance", version: 1, exported_at: new Date().toISOString(), transactions: txs, bills, savings, children: kids, education_items: eduItems, shopping };
      const json = JSON.stringify(payload);
      const fname = `SmartHomeFinance-Backup-${new Date().toISOString().slice(0, 10)}.json`;
      if (Platform.OS === "web") {
        const blob = new Blob([json], { type: "application/json" }); const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 500);
      } else {
        const uri = FileSystem.cacheDirectory + fname; await FileSystem.writeAsStringAsync(uri, json);
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "application/json" });
      }
      const now = new Date().toISOString(); await storage.setItem("shf_last_backup", now); setLastBackup(now); showToast("Backup berhasil dibuat");
    } catch { showToast("Gagal membuat backup"); }
  };

  const doRestore = async () => {
    try {
      let text: string | null = null;
      if (Platform.OS === "web") {
        text = await new Promise<string | null>((resolve) => {
          const input = document.createElement("input"); input.type = "file"; input.accept = "application/json,.json";
          input.onchange = () => { const f = input.files?.[0]; if (!f) return resolve(null); const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsText(f); };
          input.click();
        });
      } else {
        const res = await DocumentPicker.getDocumentAsync({ type: "application/json", copyToCacheDirectory: true });
        if (res.canceled || !res.assets?.[0]) return;
        text = await FileSystem.readAsStringAsync(res.assets[0].uri);
      }
      if (!text) return;
      const data = JSON.parse(text);
      if (!data || data.app !== "SmartHomeFinance") { showToast("File backup tidak valid"); return; }
      const ok = await confirm({ title: "Pulihkan Data", message: "Data dari backup akan ditambahkan ke akun ini. Lanjutkan?" });
      if (!ok) return;
      const strip = (o: any, keys: string[]) => { const c = { ...o }; keys.forEach((k) => delete c[k]); return c; };
      for (const t of data.transactions || []) await api("/transactions", { method: "POST", body: JSON.stringify(strip(t, ["tx_id", "created_at"])) }).catch(() => {});
      for (const b of data.bills || []) await api("/bills", { method: "POST", body: JSON.stringify(strip(b, ["bill_id", "auto_paid", "paid_amount"])) }).catch(() => {});
      for (const s of data.savings || []) await api("/savings", { method: "POST", body: JSON.stringify(strip(s, ["goal_id", "auto_saved"])) }).catch(() => {});
      for (const c of data.children || []) await api("/education/children", { method: "POST", body: JSON.stringify(strip(c, ["child_id"])) }).catch(() => {});
      showToast("Data berhasil dipulihkan"); loadAll();
    } catch { showToast("Gagal memulihkan data"); }
  };

  // ---------- data management ----------
  const clearPeriod = async (start: string, end: string) => {
    try {
      const txs = await api<any[]>("/transactions");
      const target = txs.filter((t) => { const d = String(t.date || t.created_at || "").slice(0, 10); return d >= start && d <= end; });
      for (const t of target) await api(`/transactions/${t.tx_id}`, { method: "DELETE" }).catch(() => {});
      showToast(`${target.length} transaksi dihapus`); setClearModal(false); loadAll();
    } catch { showToast("Gagal menghapus"); }
  };
  const deleteAll = async () => {
    const ok = await confirm({ title: "Hapus Semua Data", message: "Seluruh transaksi, tagihan, tabungan, belanja, dan data pendidikan akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.", danger: true });
    if (!ok) return;
    try {
      const [txs, bills, savings, kids, eduItems, shopping] = await Promise.all([
        api<any[]>("/transactions"), api<any[]>("/bills"), api<any[]>("/savings"), api<any[]>("/education/children"), api<any[]>("/education/items"), api<any[]>("/shopping").catch(() => []),
      ]);
      for (const t of txs) await api(`/transactions/${t.tx_id}`, { method: "DELETE" }).catch(() => {});
      for (const b of bills) await api(`/bills/${b.bill_id}`, { method: "DELETE" }).catch(() => {});
      for (const s of savings) await api(`/savings/${s.goal_id}`, { method: "DELETE" }).catch(() => {});
      for (const i of eduItems) await api(`/education/items/${i.item_id}`, { method: "DELETE" }).catch(() => {});
      for (const k of kids) await api(`/education/children/${k.child_id}`, { method: "DELETE" }).catch(() => {});
      for (const sh of shopping) await api(`/shopping/${sh.item_id}`, { method: "DELETE" }).catch(() => {});
      showToast("Semua data dihapus"); loadAll();
    } catch { showToast("Gagal menghapus"); }
  };

  // ---------- categories ----------
  const saveCat = async (c: { name: string; icon: string; color: string }, edit?: any) => {
    const next = { ...cats };
    if (edit) next[catTab] = next[catTab].map((x) => (x.id === edit.id ? { ...x, ...c } : x));
    else next[catTab] = [...next[catTab], newCat(c.name, c.icon, c.color)];
    setCats(next); await saveCats(next); setCatModal(null);
  };
  const delCat = async (id: string) => {
    const next = { ...cats, [catTab]: cats[catTab].filter((x) => x.id !== id) };
    setCats(next); await saveCats(next);
  };

  const fmtDate = (ds: string) => {
    if (!ds || ds === "-") return "-";
    const d = new Date(ds + "T00:00:00");
    if (prefs.dateFormat === "dmy") return ds.split("-").reverse().join("-");
    if (prefs.dateFormat === "ymd") return ds;
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  };
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);

  const summaryStats = [
    { label: "Total Transaksi", value: String(stats.txCount), icon: "swap-horizontal", grad: ["#A77BFF", "#7C4DFF"] as const },
    { label: "Total Pengeluaran", value: idr(stats.expense), icon: "arrow-up", grad: ["#FF6B6B", "#E23B4E"] as const },
    { label: "Total Pemasukan", value: idr(stats.income), icon: "arrow-down", grad: ["#13E07A", "#0BA85A"] as const },
    { label: "Total Tabungan", value: idr(stats.savings), icon: "diamond-stone", grad: ["#4A8CFF", "#2A5FD6"] as const },
    { label: "Total Kewajiban", value: idr(stats.bills), icon: "wallet", grad: ["#FFB44A", "#F7742F"] as const },
    { label: "Saldo Bersih", value: idr(stats.net), icon: "cash-check", grad: ["#2BE085", "#0FA85C"] as const },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* HERO */}
        <LinearGradient colors={scheme === "dark" ? ["#2A1E63", "#15275A", "#0A0E1A"] : ["#E9E2FF", "#EEF3FF", "#FFFFFF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + 12 }]}>
          <View style={styles.heroGlow} pointerEvents="none" />
          <View style={styles.heroTop}>
            <Pressable testID="back-settings" onPress={() => router.back()} hitSlop={8} style={styles.circleBtn}><Icon name="chevron-left" size={24} color="#FFFFFF" /></Pressable>
            <Pressable testID="help-center" onPress={() => setInfoModal({ title: "Pusat Bantuan", body: "Butuh bantuan?\n\n• Panduan lengkap tersedia di bagian Tentang Aplikasi.\n• Email: support@smarthomefinance.app\n\nTim kami siap membantu Anda mengelola keuangan keluarga." })} style={styles.helpBtn}>
              <Icon name="help-circle" size={16} color="#FFFFFF" /><Text style={styles.helpText}>Pusat Bantuan</Text>
            </Pressable>
          </View>
          <View style={styles.heroBody}>
            <View style={{ flex: 1, paddingRight: 6 }}>
              <Text style={styles.heroTitle}>Pengaturan</Text>
              <Text style={styles.heroSub}>Kelola akun, keamanan, tampilan, data, dan preferensi aplikasi.</Text>
            </View>
            <SettingsHeroArt width={148} height={110} />
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg, marginTop: spacing.lg }}>
          {/* 1. PROFIL */}
          <Section n="1" title="Profil Pengguna">
            <View style={{ flexDirection: "row", gap: 14 }}>
              <Pressable testID="profile-photo" onPress={pickPhoto} style={styles.avatarWrap}>
                <LinearGradient colors={[colors.brandPrimary, colors.brandSecondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarRing}>
                  <Image source={user?.picture ? { uri: user.picture } : AVATAR} style={styles.avatarImg} contentFit="cover" />
                </LinearGradient>
                <View style={styles.avatarBadge}><Icon name="camera" size={12} color="#FFFFFF" /></View>
              </Pressable>
              <View style={{ flex: 1, justifyContent: "center" }}>
                <Text style={styles.photoHint}>Ubah Foto</Text>
                <Text style={styles.photoSub}>Format JPG/PNG. Foto tampil di dashboard & laporan.</Text>
              </View>
            </View>
            <Field label="Nama Lengkap"><TextInput testID="pf-name" style={styles.input} value={name} onChangeText={setName} onBlur={saveName} placeholder="Nama lengkap" placeholderTextColor={colors.muted} /></Field>
            <Field label="Nama Panggilan"><TextInput testID="pf-nick" style={styles.input} value={prefs.nickname} onChangeText={(v) => prefs.set({ nickname: v })} placeholder="Panggilan" placeholderTextColor={colors.muted} /></Field>
            <Field label="Username"><TextInput testID="pf-username" style={styles.input} value={prefs.username} onChangeText={(v) => prefs.set({ username: v.replace(/\s/g, "") })} placeholder="username" autoCapitalize="none" placeholderTextColor={colors.muted} /></Field>
            <Field label="Mata Uang"><Dropdown testID="pf-currency" value={CURRENCY_META[prefs.currency].name} onPress={() => setSheet({ title: "Mata Uang", value: prefs.currency, options: (Object.keys(CURRENCY_META) as Currency[]).map((c) => ({ label: `${CURRENCY_META[c].flag}  ${CURRENCY_META[c].name}`, value: c })), onSelect: (v) => prefs.setCurrency(v) })} /></Field>
            <Field label="Format Tanggal"><Dropdown testID="pf-dateformat" value={DATE_OPTS.find((o) => o.value === prefs.dateFormat)?.label || ""} onPress={() => setSheet({ title: "Format Tanggal", value: prefs.dateFormat, options: DATE_OPTS, onSelect: (v) => prefs.set({ dateFormat: v }) })} /></Field>
            <Field label="Bahasa"><Dropdown testID="pf-lang" value={prefs.lang === "id" ? "Bahasa Indonesia" : "English"} onPress={() => setSheet({ title: "Bahasa", value: prefs.lang, options: [{ label: "Bahasa Indonesia", value: "id" }, { label: "English", value: "en" }], onSelect: (v) => prefs.setLang(v) })} /></Field>
          </Section>

          {/* 2. KEAMANAN */}
          <Section n="2" title="Keamanan">
            <SecRow icon="account-circle" title="Username" value={prefs.username || "belum diatur"}><Pressable testID="sec-username" onPress={() => setUserModal(true)} style={styles.smallBtn}><Text style={styles.smallBtnText}>Ubah</Text></Pressable></SecRow>
            <SecRow icon="lock" title="PIN" value={prefs.pin ? "••••" : "Belum diatur"}><Pressable testID="sec-pin" onPress={() => setPinModal(true)} style={styles.smallBtn}><Text style={styles.smallBtnText}>Ubah</Text></Pressable></SecRow>
            <SecRow icon="lock-clock" title="Kunci Otomatis" sub="Kunci setelah tidak digunakan">
              <Dropdown compact testID="sec-autolock" value={LOCK_OPTS.find((o) => o.value === prefs.autoLockMin)?.label || ""} onPress={() => setSheet({ title: "Kunci Otomatis", value: prefs.autoLockMin, options: LOCK_OPTS, onSelect: (v) => prefs.set({ autoLockMin: v }) })} />
            </SecRow>
            <SecRow icon="fingerprint" title="Gunakan Biometrik" sub="Sidik jari / face unlock"><Switch testID="sec-biometric" value={prefs.biometric} onValueChange={toggleBiometric} trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} thumbColor="#FFFFFF" /></SecRow>
            <SecRow icon="eye-off" title="Kunci Saat Diminimalkan" sub="Kunci saat ke background"><Switch testID="sec-minimize" value={prefs.lockOnMinimize} onValueChange={(v) => prefs.set({ lockOnMinimize: v })} trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} thumbColor="#FFFFFF" /></SecRow>
            <Pressable testID="logout-btn" onPress={logout} style={styles.logoutRow}>
              <View style={styles.logoutIcon}><Icon name="logout" size={18} color={colors.error} /></View>
              <View style={{ flex: 1 }}><Text style={[styles.secTitle, { color: colors.error }]}>Logout</Text><Text style={styles.secSub}>Keluar dari akun di perangkat ini</Text></View>
              <Icon name="chevron-right" size={20} color={colors.error} />
            </Pressable>
          </Section>

          {/* 3. TAMPILAN */}
          <Section n="3" title="Tampilan">
            <Text style={styles.subHead}>Tema Aplikasi</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[{ k: "dark", l: "Gelap", i: "weather-night" }, { k: "light", l: "Terang", i: "white-balance-sunny" }, { k: "system", l: "Perangkat", i: "cellphone" }].map((o) => {
                const on = prefs.themeMode === o.k;
                return (
                  <Pressable key={o.k} testID={`theme-${o.k}`} onPress={() => prefs.setThemeMode(o.k as any)} style={[styles.themeCard, on && { borderColor: colors.brandPrimary, backgroundColor: `${colors.brandPrimary}1A` }]}>
                    <Icon name={o.i as any} size={22} color={on ? colors.brandPrimary : colors.muted} />
                    <Text style={[styles.themeLabel, on && { color: colors.onSurface }]}>{o.l}</Text>
                    {on ? <View style={styles.themeCheck}><Icon name="check" size={11} color={colors.onBrandPrimary} /></View> : null}
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.subHead, { marginTop: 14 }]}>Mode Dashboard</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[{ k: "ringkas", l: "Ringkas", s: "Informasi penting", i: "view-dashboard-outline" }, { k: "lengkap", l: "Lengkap", s: "Semua informasi", i: "view-grid" }].map((o) => {
                const on = prefs.dashboardMode === o.k;
                return (
                  <Pressable key={o.k} testID={`dash-${o.k}`} onPress={() => prefs.set({ dashboardMode: o.k as any })} style={[styles.modeCard, on && { borderColor: colors.brandPrimary, backgroundColor: `${colors.brandPrimary}1A` }]}>
                    <Icon name={o.i as any} size={18} color={on ? colors.brandPrimary : colors.muted} />
                    <View style={{ flex: 1 }}><Text style={[styles.themeLabel, on && { color: colors.onSurface }]}>{o.l}</Text><Text style={styles.secSub}>{o.s}</Text></View>
                    {on ? <Icon name="check-circle" size={16} color={colors.brandPrimary} /> : null}
                  </Pressable>
                );
              })}
            </View>
            <View style={[styles.toggleRow, { marginTop: 14 }]}>
              <View style={{ flex: 1 }}><Text style={styles.secTitle}>Efek Animasi</Text><Text style={styles.secSub}>Aktifkan animasi pada aplikasi</Text></View>
              <Switch testID="pref-anim" value={prefs.animations} onValueChange={(v) => prefs.set({ animations: v })} trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} thumbColor="#FFFFFF" />
            </View>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}><Text style={styles.secTitle}>Ukuran Teks</Text></View>
              <View style={styles.segment}>
                {[{ k: "small", l: "A-" }, { k: "medium", l: "Sedang" }, { k: "large", l: "A+" }].map((o) => (
                  <Pressable key={o.k} testID={`textsize-${o.k}`} onPress={() => prefs.set({ textSize: o.k as any })} style={[styles.segBtn, prefs.textSize === o.k && styles.segActive]}><Text style={[styles.segText, prefs.textSize === o.k && styles.segTextActive]}>{o.l}</Text></Pressable>
                ))}
              </View>
            </View>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}><Text style={styles.secTitle}>Kerapatan</Text></View>
              <View style={styles.segment}>
                {[{ k: "compact", l: "Rapat" }, { k: "normal", l: "Normal" }, { k: "comfortable", l: "Renggang" }].map((o) => (
                  <Pressable key={o.k} testID={`density-${o.k}`} onPress={() => prefs.set({ density: o.k as any })} style={[styles.segBtn, prefs.density === o.k && styles.segActive]}><Text style={[styles.segText, prefs.density === o.k && styles.segTextActive]}>{o.l}</Text></Pressable>
                ))}
              </View>
            </View>
          </Section>

          {/* 4. KATEGORI */}
          <Section n="4" title="Kategori">
            <View style={styles.catTabs}>
              <Pressable testID="cat-tab-expense" onPress={() => setCatTab("expense")} style={[styles.catTab, catTab === "expense" && styles.catTabActive]}><Text style={[styles.catTabText, catTab === "expense" && styles.catTabTextActive]}>Pengeluaran</Text></Pressable>
              <Pressable testID="cat-tab-income" onPress={() => setCatTab("income")} style={[styles.catTab, catTab === "income" && styles.catTabActive]}><Text style={[styles.catTabText, catTab === "income" && styles.catTabTextActive]}>Pemasukan</Text></Pressable>
            </View>
            <Pressable testID="add-category" onPress={() => setCatModal({})} style={styles.addCatBtn}><Icon name="plus" size={15} color={colors.brandPrimary} /><Text style={styles.addCatText}>Tambah Kategori</Text></Pressable>
            <View style={{ gap: 8, marginTop: 6 }}>
              {cats[catTab].map((c) => (
                <View key={c.id} style={styles.catRow} testID={`cat-${c.id}`}>
                  <View style={[styles.catIcon, { backgroundColor: `${c.color}22`, borderColor: `${c.color}55` }]}><Icon name={c.icon as any} size={16} color={c.color} /></View>
                  <Text style={styles.catName} numberOfLines={1}>{c.name}</Text>
                  <Pressable testID={`cat-edit-${c.id}`} onPress={() => setCatModal({ edit: c })} style={styles.catAction}><Icon name="pencil" size={14} color={colors.info} /></Pressable>
                  <Pressable testID={`cat-del-${c.id}`} onPress={() => delCat(c.id)} style={styles.catAction}><Icon name="trash-can-outline" size={14} color={colors.error} /></Pressable>
                </View>
              ))}
            </View>
          </Section>

          {/* PENDIDIKAN - DAFTAR ANAK */}
          <Section title="Pendidikan - Daftar Anak" right={<Pressable testID="add-child" onPress={() => router.push("/pendidikan")} style={styles.addCatBtn}><Icon name="plus" size={15} color={colors.brandPrimary} /><Text style={styles.addCatText}>Tambah Anak</Text></Pressable>}>
            {children.length === 0 ? <Text style={styles.secSub}>Belum ada data anak. Tambah di menu Pendidikan.</Text> : children.map((c) => {
              const pct = c.budget > 0 ? Math.min(100, (c.realized / c.budget) * 100) : 0;
              return (
                <View key={c.child_id} style={styles.childCard} testID={`child-${c.child_id}`}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Pressable onPress={() => pickChildPhoto(c)} style={styles.childAvatarWrap}>
                      {c.photo_url ? <Image source={{ uri: c.photo_url }} style={styles.childAvatar} contentFit="cover" /> : (
                        <LinearGradient colors={[colors.brandPrimary, colors.brandSecondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.childAvatar}><Text style={styles.childInitial}>{(c.name || "?").charAt(0).toUpperCase()}</Text></LinearGradient>
                      )}
                      <View style={styles.childCam}><Icon name="camera" size={10} color="#FFFFFF" /></View>
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.childName} numberOfLines={1}>{c.name}</Text>
                      <Text style={styles.secSub} numberOfLines={1}>{[c.school, c.grade].filter(Boolean).join(" · ") || "—"}</Text>
                    </View>
                    <Pressable testID={`child-more-${c.child_id}`} onPress={() => router.push("/pendidikan")} hitSlop={8} style={styles.catAction}><Icon name="dots-vertical" size={18} color={colors.muted} /></Pressable>
                  </View>
                  <View style={{ flexDirection: "row", gap: 16, marginTop: 10 }}>
                    <View><Text style={styles.secSub}>Realisasi</Text><Text style={styles.childVal}>{idr(c.realized)}</Text></View>
                    <View><Text style={styles.secSub}>Anggaran</Text><Text style={styles.childVal}>{idr(c.budget)}</Text></View>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <View style={styles.progTrack}><View style={[styles.progFill, { width: `${pct}%`, backgroundColor: colors.brandPrimary }]} /></View>
                    <Text style={styles.childPct}>{pct.toFixed(0)}%</Text>
                  </View>
                </View>
              );
            })}
            <Pressable testID="all-children" onPress={() => router.push("/pendidikan")} style={styles.detailBtn}><Text style={styles.detailText}>Lihat Semua Anak</Text><Icon name="arrow-right" size={16} color={colors.brandPrimary} /></Pressable>
          </Section>

          {/* 5. DATA & PENYIMPANAN */}
          <Section n="5" title="Data & Penyimpanan">
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={styles.dataBox}>
                <Text style={styles.dataTitle}>Backup Data</Text>
                <Text style={styles.secSub}>Simpan seluruh data ke file.</Text>
                <Text style={[styles.secSub, { marginTop: 2 }]}>Terakhir: {lastBackup ? fmtDate(lastBackup.slice(0, 10)) : "—"}</Text>
                <Pressable testID="backup-btn" onPress={doBackup} style={[styles.dataBtn, { backgroundColor: colors.success }]}><Icon name="cloud-upload" size={16} color="#FFFFFF" /><Text style={styles.dataBtnText}>Buat Backup</Text></Pressable>
              </View>
              <View style={styles.dataBox}>
                <Text style={styles.dataTitle}>Restore Data</Text>
                <Text style={styles.secSub}>Pulihkan data dari file backup.</Text>
                <Pressable testID="restore-btn" onPress={doRestore} style={[styles.dataBtn, { backgroundColor: colors.info, marginTop: 28 }]}><Icon name="cloud-download" size={16} color="#FFFFFF" /><Text style={styles.dataBtnText}>Import / Restore</Text></Pressable>
              </View>
            </View>
            <View style={[styles.toggleRow, { marginTop: 14 }]}>
              <View style={{ flex: 1 }}><Text style={styles.secTitle}>Auto Backup</Text><Text style={styles.secSub}>Buat backup otomatis secara berkala</Text></View>
              <Switch testID="auto-backup" value={prefs.autoBackup} onValueChange={(v) => prefs.set({ autoBackup: v })} trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} thumbColor="#FFFFFF" />
            </View>
            <Field label="Frekuensi Backup"><Dropdown testID="backup-freq" value={BACKUP_FREQ.find((o) => o.value === prefs.backupFrequency)?.label || ""} onPress={() => setSheet({ title: "Frekuensi Backup", value: prefs.backupFrequency, options: BACKUP_FREQ, onSelect: (v) => prefs.set({ backupFrequency: v }) })} /></Field>
            <View style={styles.infoCard}>
              <Text style={styles.subHead}>Informasi Penyimpanan</Text>
              <View style={styles.infoGrid}>
                {[
                  { l: "Total Transaksi", v: String(stats.txCount) }, { l: "Tagihan & Cicilan", v: String(stats.billCount) }, { l: "Item Pendidikan", v: String(stats.eduCount) },
                  { l: "Target Tabungan", v: String(stats.savCount) }, { l: "Data sejak", v: fmtDate(stats.since) }, { l: "Ukuran Data", v: `${sizeMB} MB` },
                ].map((s) => (<View key={s.l} style={styles.infoCell}><Text style={styles.secSub}>{s.l}</Text><Text style={styles.infoVal}>{s.v}</Text></View>))}
              </View>
            </View>
          </Section>

          {/* 6. MANAJEMEN DATA */}
          <Section n="6" title="Manajemen Data">
            <ManageRow icon="file-remove" color={colors.info} title="Hapus Transaksi Tertentu" sub="Hapus berdasarkan tanggal atau kategori" onPress={() => router.push("/transaksi")} testID="mg-specific" />
            <ManageRow icon="calendar-remove" color={colors.warning} title="Bersihkan Data Periode" sub="Hapus data dalam periode tertentu" onPress={() => setClearModal(true)} testID="mg-period" />
            <ManageRow icon="delete-alert" color={colors.error} title="Hapus Semua Data" sub="Hapus seluruh data secara permanen" onPress={deleteAll} testID="mg-all" danger />
            <ManageRow icon="backup-restore" color={colors.success} title="Pulihkan Data Terakhir" sub="Pulihkan dari file backup" onPress={doRestore} testID="mg-restore" />
          </Section>

          {/* 7. MATA UANG */}
          <Section n="7" title="Mata Uang">
            <Text style={styles.secSub}>Pilih mata uang utama yang digunakan.</Text>
            <View style={{ gap: 8, marginTop: 10 }}>
              {(Object.keys(CURRENCY_META) as Currency[]).map((c) => {
                const on = prefs.currency === c;
                return (
                  <Pressable key={c} testID={`cur-${c}`} onPress={() => prefs.setCurrency(c)} style={[styles.curRow, on && { borderColor: colors.brandPrimary }]}>
                    <Text style={{ fontSize: 22 }}>{CURRENCY_META[c].flag}</Text>
                    <Text style={styles.curName}>{CURRENCY_META[c].name}</Text>
                    <View style={[styles.radio, on && { borderColor: colors.brandPrimary }]}>{on ? <View style={styles.radioDot} /> : null}</View>
                  </Pressable>
                );
              })}
            </View>
          </Section>

          {/* 8. TENTANG */}
          <Section n="8" title="Tentang Aplikasi">
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.aboutName}>SMART HOME FINANCE</Text>
                <View style={styles.verPill}><Text style={styles.verText}>Version 1.0.0</Text></View>
                <Text style={[styles.secSub, { marginTop: 6 }]}>Aplikasi pengelola keuangan pribadi yang membantu Anda mengatur keuangan dengan lebih cerdas.</Text>
              </View>
              <AboutHouseArt width={92} height={74} />
            </View>
            {[
              { l: "Panduan Penggunaan", body: "PANDUAN SINGKAT\n\n1. Catat setiap pemasukan & pengeluaran di menu Transaksi.\n2. Buat target di Tabungan dan alokasikan transaksi.\n3. Pantau tagihan di menu Tagihan & Cicilan.\n4. Lihat ringkasan di Dashboard & Laporan." },
              { l: "Kebijakan Privasi", body: "KEBIJAKAN PRIVASI\n\nData keuangan Anda disimpan pada akun Anda dan tidak dibagikan ke pihak ketiga tanpa izin. Anda dapat melakukan backup dan menghapus data kapan saja." },
              { l: "Syarat & Ketentuan", body: "SYARAT & KETENTUAN\n\nAplikasi ini disediakan untuk membantu pencatatan keuangan pribadi. Keputusan finansial tetap menjadi tanggung jawab pengguna." },
            ].map((o) => (
              <Pressable key={o.l} testID={`about-${o.l}`} onPress={() => setInfoModal({ title: o.l, body: o.body })} style={styles.aboutRow}>
                <Icon name="file-document-outline" size={18} color={colors.muted} /><Text style={styles.aboutLink}>{o.l}</Text><Icon name="chevron-right" size={18} color={colors.muted} />
              </Pressable>
            ))}
            <Pressable testID="about-contact" onPress={() => Linking.openURL("mailto:support@smarthomefinance.app")} style={styles.aboutRow}>
              <Icon name="email-outline" size={18} color={colors.muted} /><Text style={styles.aboutLink}>Hubungi Kami</Text><Icon name="chevron-right" size={18} color={colors.muted} />
            </Pressable>
          </Section>

          {/* 9. RINGKASAN */}
          <Section n="9" title="Ringkasan Aplikasi">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
              {summaryStats.map((s) => (
                <View key={s.label} style={styles.sumCard} testID={`sum-${s.label}`}>
                  <LinearGradient colors={s.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sumIcon}><Icon name={s.icon as any} size={16} color="#FFFFFF" /></LinearGradient>
                  <Text style={styles.secSub} numberOfLines={1}>{s.label}</Text>
                  <Text style={styles.sumVal} numberOfLines={1}>{s.value}</Text>
                </View>
              ))}
            </ScrollView>
          </Section>
        </View>
      </ScrollView>

      {toast ? <View style={[styles.toast, { bottom: insets.bottom + 20 }]} testID="settings-toast"><Icon name="check-circle" size={16} color="#FFFFFF" /><Text style={styles.toastText}>{toast}</Text></View> : null}

      {/* OPTION SHEET */}
      <Modal visible={!!sheet} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.sheetBg} onPress={() => setSheet(null)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{sheet?.title}</Text>
            {sheet?.options.map((o) => {
              const on = sheet.value === o.value;
              return (
                <Pressable key={String(o.value)} testID={`opt-${o.value}`} onPress={() => { sheet.onSelect(o.value); setSheet(null); }} style={[styles.sheetRow, on && { backgroundColor: `${colors.brandPrimary}1A` }]}>
                  <Text style={[styles.sheetRowText, on && { color: colors.brandPrimary, fontWeight: "800" }]}>{o.label}</Text>
                  {on ? <Icon name="check" size={18} color={colors.brandPrimary} /> : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {/* PIN MODAL */}
      <PinModal visible={pinModal} hasPin={!!prefs.pin} currentPin={prefs.pin} onClose={() => setPinModal(false)} onSet={(pin) => { prefs.set({ pin }); setPinModal(false); showToast(pin ? "PIN disimpan" : "PIN dihapus"); }} />

      {/* CATEGORY MODAL */}
      <CatModal visible={!!catModal} edit={catModal?.edit} onClose={() => setCatModal(null)} onSave={saveCat} />

      {/* CLEAR PERIOD MODAL */}
      <ClearModal visible={clearModal} onClose={() => setClearModal(false)} onConfirm={clearPeriod} />

      {/* USERNAME MODAL */}
      <Modal visible={userModal} transparent animationType="slide" onRequestClose={() => setUserModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.sheetBg}>
          <Pressable style={{ flex: 1 }} onPress={() => setUserModal(false)} />
          <View style={styles.catSheet}>
            <Text style={styles.sheetTitle}>Ubah Username</Text>
            <TextInput testID="username-input" style={[styles.input, { marginTop: 12 }]} value={prefs.username} onChangeText={(v) => prefs.set({ username: v.replace(/\s/g, "") })} placeholder="username" autoCapitalize="none" placeholderTextColor={colors.muted} />
            <View style={{ marginTop: 16 }}><PrimaryButton label="Simpan" onPress={() => { setUserModal(false); showToast("Username disimpan"); }} testID="username-save" /></View>
          </View>
        </KeyboardAvoidingView>
      </Modal>


      {/* INFO MODAL */}
      <Modal visible={!!infoModal} transparent animationType="fade" onRequestClose={() => setInfoModal(null)}>
        <Pressable style={styles.sheetBg} onPress={() => setInfoModal(null)}>
          <Pressable style={styles.infoModal} onPress={() => {}}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <Text style={styles.sheetTitle}>{infoModal?.title}</Text>
              <Pressable testID="info-close" onPress={() => setInfoModal(null)} style={styles.catAction}><Icon name="close" size={18} color={colors.onSurface} /></Pressable>
            </View>
            <Text style={styles.infoBody}>{infoModal?.body}</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ---------- sub components ----------
function Section({ n, title, right, children }: { n?: string; title: string; right?: React.ReactNode; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <View style={styles.secHead}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
          {n ? <View style={styles.secNum}><Text style={styles.secNumText}>{n}</Text></View> : null}
          <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
        </View>
        {right}
      </View>
      <View style={{ gap: 10 }}>{children}</View>
    </View>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (<View style={{ gap: 5 }}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>);
}
function Dropdown({ value, onPress, compact, testID }: { value: string; onPress: () => void; compact?: boolean; testID?: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.input, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, compact && { height: 36, minWidth: 120 }]}>
      <Text style={{ color: colors.onSurface, fontSize: compact ? 12 : 14, fontWeight: "600" }} numberOfLines={1}>{value}</Text>
      <Icon name="chevron-down" size={18} color={colors.muted} />
    </Pressable>
  );
}
function SecRow({ icon, title, sub, value, children }: { icon: string; title: string; sub?: string; value?: string; children?: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.secRow}>
      <View style={styles.secIcon}><Icon name={icon as any} size={18} color={colors.brandPrimary} /></View>
      <View style={{ flex: 1 }}><Text style={styles.secTitle}>{title}</Text>{sub ? <Text style={styles.secSub}>{sub}</Text> : value ? <Text style={styles.secSub}>{value}</Text> : null}</View>
      {children}
    </View>
  );
}
function ManageRow({ icon, color, title, sub, onPress, testID, danger }: { icon: string; color: string; title: string; sub: string; onPress: () => void; testID?: string; danger?: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.secRow}>
      <View style={[styles.secIcon, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}><Icon name={icon as any} size={18} color={color} /></View>
      <View style={{ flex: 1 }}><Text style={[styles.secTitle, danger && { color: colors.error }]}>{title}</Text><Text style={styles.secSub}>{sub}</Text></View>
      <Icon name="chevron-right" size={20} color={colors.muted} />
    </Pressable>
  );
}

function PinModal({ visible, hasPin, currentPin, onClose, onSet }: { visible: boolean; hasPin: boolean; currentPin: string | null; onClose: () => void; onSet: (pin: string | null) => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [step, setStep] = useState<"verify" | "new" | "confirm">(hasPin ? "verify" : "new");
  const [val, setVal] = useState("");
  const [first, setFirst] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { if (visible) { setStep(hasPin ? "verify" : "new"); setVal(""); setFirst(""); setErr(""); } }, [visible, hasPin]);
  const press = (d: string) => {
    if (val.length >= 4) return;
    const next = val + d; setVal(next); setErr("");
    if (next.length === 4) setTimeout(() => {
      if (step === "verify") { if (next === currentPin) { setStep("new"); setVal(""); } else { setErr("PIN lama salah"); setVal(""); } }
      else if (step === "new") { setFirst(next); setStep("confirm"); setVal(""); }
      else { if (next === first) onSet(next); else { setErr("PIN tidak cocok"); setVal(""); setStep("new"); } }
    }, 100);
  };
  const title = step === "verify" ? "Masukkan PIN Lama" : step === "new" ? "Masukkan PIN Baru" : "Konfirmasi PIN Baru";
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBg} onPress={onClose}>
        <Pressable style={styles.pinSheet} onPress={() => {}}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
            <Text style={styles.sheetTitle}>{title}</Text>
            {hasPin ? <Pressable testID="pin-remove" onPress={() => onSet(null)}><Text style={{ color: colors.error, fontWeight: "700", fontSize: 12 }}>Hapus PIN</Text></Pressable> : null}
          </View>
          <View style={{ flexDirection: "row", gap: 14, marginTop: 20 }}>
            {[0, 1, 2, 3].map((i) => <View key={i} style={[styles.pinDot, { backgroundColor: i < val.length ? colors.brandPrimary : "transparent", borderColor: err ? colors.error : colors.border }]} />)}
          </View>
          {err ? <Text style={{ color: colors.error, fontSize: 12, marginTop: 8 }}>{err}</Text> : <View style={{ height: 18 }} />}
          <View style={styles.pinPad}>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => <Pressable key={d} testID={`pin-${d}`} onPress={() => press(d)} style={styles.pinKey}><Text style={styles.pinKeyText}>{d}</Text></Pressable>)}
            <View style={styles.pinKey} />
            <Pressable testID="pin-0" onPress={() => press("0")} style={styles.pinKey}><Text style={styles.pinKeyText}>0</Text></Pressable>
            <Pressable testID="pin-back" onPress={() => setVal((v) => v.slice(0, -1))} style={styles.pinKey}><Icon name="backspace-outline" size={22} color={colors.onSurface} /></Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function CatModal({ visible, edit, onClose, onSave }: { visible: boolean; edit?: any; onClose: () => void; onSave: (c: { name: string; icon: string; color: string }, edit?: any) => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [nm, setNm] = useState(""); const [ic, setIc] = useState("food"); const [cl, setCl] = useState(CAT_COLOR_CHOICES[0]);
  useEffect(() => { if (visible) { setNm(edit?.name || ""); setIc(edit?.icon || "food"); setCl(edit?.color || CAT_COLOR_CHOICES[0]); } }, [visible, edit]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.sheetBg}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[styles.catSheet]}>
          <Text style={styles.sheetTitle}>{edit ? "Edit Kategori" : "Tambah Kategori"}</Text>
          <TextInput testID="catname" style={[styles.input, { marginTop: 12 }]} value={nm} onChangeText={setNm} placeholder="Nama kategori" placeholderTextColor={colors.muted} />
          <Text style={styles.fieldLabel}>Ikon</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {CAT_ICON_CHOICES.map((i) => (<Pressable key={i} testID={`ic-${i}`} onPress={() => setIc(i)} style={[styles.iconChoice, ic === i && { borderColor: cl, backgroundColor: `${cl}22` }]}><Icon name={i as any} size={20} color={ic === i ? cl : colors.muted} /></Pressable>))}
          </ScrollView>
          <Text style={styles.fieldLabel}>Warna</Text>
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            {CAT_COLOR_CHOICES.map((c) => (<Pressable key={c} testID={`cl-${c}`} onPress={() => setCl(c)} style={[styles.colorChoice, { backgroundColor: c }, cl === c && styles.colorChoiceOn]} />))}
          </View>
          <View style={{ marginTop: 16, flexDirection: "row", gap: 10 }}>
            <Pressable onPress={onClose} style={styles.cancelBtn}><Text style={{ color: colors.onSurface, fontWeight: "700" }}>Batal</Text></Pressable>
            <View style={{ flex: 1 }}><PrimaryButton label={edit ? "Simpan" : "Tambah"} onPress={() => nm.trim() && onSave({ name: nm.trim(), icon: ic, color: cl }, edit)} testID="cat-save" /></View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ClearModal({ visible, onClose, onConfirm }: { visible: boolean; onClose: () => void; onConfirm: (s: string, e: string) => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const now = new Date();
  const [start, setStart] = useState(`${now.getFullYear()}-01-01`);
  const [end, setEnd] = useState(`${now.getFullYear()}-12-31`);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.sheetBg}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.catSheet}>
          <Text style={styles.sheetTitle}>Bersihkan Data Periode</Text>
          <Text style={[styles.secSub, { marginTop: 4 }]}>Hapus transaksi dalam rentang tanggal (format YYYY-MM-DD).</Text>
          <Text style={styles.fieldLabel}>Tanggal Mulai</Text>
          <TextInput testID="clear-start" style={styles.input} value={start} onChangeText={setStart} placeholder="2026-01-01" placeholderTextColor={colors.muted} />
          <Text style={styles.fieldLabel}>Tanggal Akhir</Text>
          <TextInput testID="clear-end" style={styles.input} value={end} onChangeText={setEnd} placeholder="2026-12-31" placeholderTextColor={colors.muted} />
          <View style={{ marginTop: 16, flexDirection: "row", gap: 10 }}>
            <Pressable onPress={onClose} style={styles.cancelBtn}><Text style={{ color: colors.onSurface, fontWeight: "700" }}>Batal</Text></Pressable>
            <View style={{ flex: 1 }}><PrimaryButton label="Hapus Periode" onPress={() => onConfirm(start, end)} testID="clear-confirm" /></View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: "hidden" },
  heroGlow: { position: "absolute", top: -60, right: -30, width: 220, height: 220, borderRadius: 110, backgroundColor: "#7C4DFF", opacity: 0.22 },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  circleBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  helpBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.14)", borderRadius: radius.pill, paddingHorizontal: 12, height: 36 },
  helpText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  heroBody: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  heroTitle: { color: "#FFFFFF", fontSize: 30, fontWeight: "800" },
  heroSub: { color: "rgba(255,255,255,0.78)", fontSize: 12, marginTop: 6, lineHeight: 17 },

  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  secHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 8 },
  secNum: { width: 24, height: 24, borderRadius: 8, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  secNumText: { color: colors.onBrandPrimary, fontSize: 12, fontWeight: "800" },
  cardTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
  subHead: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "700", marginBottom: 8 },

  avatarWrap: { width: 72, height: 72 },
  avatarRing: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", padding: 3 },
  avatarImg: { width: 66, height: 66, borderRadius: 33 },
  avatarBadge: { position: "absolute", right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.surfaceSecondary },
  photoHint: { color: colors.onSurface, fontSize: 14, fontWeight: "800" },
  photoSub: { color: colors.muted, fontSize: 11, marginTop: 3, lineHeight: 15 },
  fieldLabel: { color: colors.muted, fontSize: 11, fontWeight: "700", marginTop: 4 },
  input: { backgroundColor: colors.surfaceTertiary, color: colors.onSurface, borderRadius: radius.md, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: colors.border, fontSize: 14 },

  secRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  secIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: `${colors.brandPrimary}1A`, borderWidth: 1, borderColor: `${colors.brandPrimary}33`, alignItems: "center", justifyContent: "center" },
  secTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  secSub: { color: colors.muted, fontSize: 11, marginTop: 1, lineHeight: 15 },
  smallBtn: { backgroundColor: colors.brandPrimary, borderRadius: radius.md, paddingHorizontal: 16, height: 34, alignItems: "center", justifyContent: "center" },
  smallBtnText: { color: colors.onBrandPrimary, fontSize: 12, fontWeight: "800" },
  logoutRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, marginTop: 4, borderRadius: radius.md, borderWidth: 1, borderColor: `${colors.error}44`, backgroundColor: `${colors.error}12`, paddingHorizontal: 10 },
  logoutIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: `${colors.error}22`, alignItems: "center", justifyContent: "center" },

  themeCard: { flex: 1, height: 74, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", gap: 6 },
  themeLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  themeCheck: { position: "absolute", top: 6, right: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  modeCard: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surfaceTertiary, padding: 12 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  segment: { flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, padding: 3 },
  segBtn: { paddingHorizontal: 12, height: 30, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  segActive: { backgroundColor: colors.brandPrimary },
  segText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  segTextActive: { color: colors.onBrandPrimary },

  catTabs: { flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, padding: 4 },
  catTab: { flex: 1, height: 34, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  catTabActive: { backgroundColor: colors.brandPrimary },
  catTabText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  catTabTextActive: { color: colors.onBrandPrimary },
  addCatBtn: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: 12, height: 32, borderRadius: radius.pill, backgroundColor: `${colors.brandPrimary}1A`, borderWidth: 1, borderColor: `${colors.brandPrimary}44` },
  addCatText: { color: colors.brandPrimary, fontSize: 12, fontWeight: "700" },
  catRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: 12, height: 48 },
  catIcon: { width: 30, height: 30, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  catName: { color: colors.onSurface, fontSize: 13, fontWeight: "600", flex: 1 },
  catAction: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },

  childCard: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.border },
  childAvatarWrap: { width: 52, height: 52 },
  childAvatar: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  childInitial: { color: "#FFFFFF", fontSize: 22, fontWeight: "800" },
  childCam: { position: "absolute", right: -3, bottom: -3, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.surfaceSecondary },
  childName: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
  childVal: { color: colors.onSurface, fontSize: 14, fontWeight: "800", marginTop: 1 },
  progTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: "hidden" },
  progFill: { height: 8, borderRadius: 4 },
  childPct: { color: colors.onSurface, fontSize: 12, fontWeight: "800", minWidth: 36, textAlign: "right" },
  detailBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4, height: 40, borderRadius: radius.md, backgroundColor: `${colors.brandPrimary}1A`, borderWidth: 1, borderColor: `${colors.brandPrimary}44` },
  detailText: { color: colors.brandPrimary, fontSize: 13, fontWeight: "700" },

  dataBox: { flex: 1, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.border },
  dataTitle: { color: colors.onSurface, fontSize: 13, fontWeight: "800", marginBottom: 2 },
  dataBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 38, borderRadius: radius.md, marginTop: 10 },
  dataBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  infoCard: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: colors.border, marginTop: 4 },
  infoGrid: { flexDirection: "row", flexWrap: "wrap" },
  infoCell: { width: "33.3%", paddingVertical: 8 },
  infoVal: { color: colors.onSurface, fontSize: 14, fontWeight: "800", marginTop: 2 },

  curRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: 14, height: 52, borderWidth: 1.5, borderColor: colors.border },
  curName: { color: colors.onSurface, fontSize: 14, fontWeight: "600", flex: 1 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brandPrimary },

  aboutName: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
  verPill: { alignSelf: "flex-start", backgroundColor: `${colors.brandPrimary}22`, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, marginTop: 4 },
  verText: { color: colors.brandPrimary, fontSize: 10, fontWeight: "700" },
  aboutRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.divider },
  aboutLink: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "600", flex: 1 },

  sumCard: { width: 150, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.border, gap: 4 },
  sumIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  sumVal: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },

  toast: { position: "absolute", left: 20, right: 20, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.brandPrimary, borderRadius: radius.md, paddingHorizontal: 16, height: 46, justifyContent: "center" },
  toastText: { color: colors.onBrandPrimary, fontSize: 13, fontWeight: "700" },

  sheetBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  sheetTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "800" },
  sheetRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 12, borderRadius: radius.md, marginTop: 6 },
  sheetRowText: { color: colors.onSurface, fontSize: 14, fontWeight: "600" },
  infoModal: { backgroundColor: colors.surface, borderRadius: 20, padding: spacing.lg, margin: spacing.lg, marginTop: "auto", marginBottom: "auto", borderWidth: 1, borderColor: colors.border },
  infoBody: { color: colors.onSurfaceSecondary, fontSize: 13, lineHeight: 20 },

  pinSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  pinDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  pinPad: { flexDirection: "row", flexWrap: "wrap", width: 240, justifyContent: "space-between", marginTop: 16, rowGap: 14 },
  pinKey: { width: 68, height: 60, borderRadius: 16, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  pinKeyText: { color: colors.onSurface, fontSize: 24, fontWeight: "700" },

  catSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, gap: 8, borderWidth: 1, borderColor: colors.border },
  iconChoice: { width: 46, height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  colorChoice: { width: 34, height: 34, borderRadius: 17 },
  colorChoiceOn: { borderWidth: 3, borderColor: colors.onSurface },
  cancelBtn: { paddingHorizontal: 20, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
}));
