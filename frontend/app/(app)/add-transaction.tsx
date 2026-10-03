import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { api } from "@/src/api";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { PrimaryButton } from "@/src/components/ui";
import { formatDateInput, isoToDisplay } from "@/src/utils/date";
import { INCOME_CATS, EXPENSE_CATS } from "@/src/categories";

type LinkTarget = { link_type: string; link_id: string; label: string; group: string };

export default function AddTransaction() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ tx_id?: string; type?: string; amount?: string; category?: string; title?: string; note?: string; date?: string; child_id?: string; link_type?: string; link_id?: string }>();
  const editing = !!params.tx_id;
  const { colors } = useTheme();
  const styles = useStyles();

  const [type, setType] = useState<"income" | "expense">((params.type as any) || "expense");
  const [amount, setAmount] = useState<string>(params.amount ? String(params.amount) : "");
  const [category, setCategory] = useState<string>(params.category || "Belanja");
  const [title, setTitle] = useState<string>(params.title || "");
  const [note, setNote] = useState<string>(params.note || "");
  const [dateInput, setDateInput] = useState<string>("");
  const [dateIso, setDateIso] = useState<string | null>(null);
  const [childId, setChildId] = useState<string | null>((params.child_id as string) || null);
  const [, setChildren] = useState<any[]>([]);
  const [linkType, setLinkType] = useState<string | null>((params.link_type as string) || null);
  const [linkId, setLinkId] = useState<string | null>((params.link_id as string) || null);
  const [targets, setTargets] = useState<LinkTarget[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    // seed date
    if (params.date) {
      const disp = isoToDisplay(String(params.date));
      const { iso } = formatDateInput(disp.replace(/-/g, ""));
      setDateInput(disp);
      setDateIso(iso);
    } else {
      const d = new Date();
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yy = String(d.getFullYear());
      setDateInput(`${dd}-${mm}-${yy}`);
      setDateIso(`${yy}-${mm}-${dd}`);
    }
    (async () => {
      const mk = new Date();
      const mKey = `${mk.getFullYear()}-${String(mk.getMonth() + 1).padStart(2, "0")}`;
      try {
        const [bills, shopping, eduItems, savings, kids] = await Promise.all([
          api<any[]>("/bills").catch(() => []),
          api<any[]>(`/shopping?month=${mKey}`).catch(() => []),
          api<any[]>(`/education/items?month=${mKey}`).catch(() => []),
          api<any[]>("/savings").catch(() => []),
          api<any[]>("/education/children").catch(() => []),
        ]);
        setChildren(kids);
        const kidName = (id: string) => (kids as any[]).find((k) => k.child_id === id)?.name || "";
        const tg: LinkTarget[] = [
          ...(bills as any[]).map((b) => ({ link_type: "bill", link_id: b.bill_id, label: b.name, group: "Tagihan" })),
          ...(shopping as any[]).map((s) => ({ link_type: "shopping", link_id: s.item_id, label: s.name, group: "Belanja" })),
          ...(eduItems as any[]).map((e) => ({ link_type: "education", link_id: e.item_id, label: `${e.name}${kidName(e.child_id) ? " · " + kidName(e.child_id) : ""}`, group: "Pendidikan" })),
          ...(savings as any[]).map((g) => ({ link_type: "savings", link_id: g.goal_id, label: g.name, group: "Tabungan" })),
        ];
        setTargets(tg);
      } catch {}
    })();
  }, []);

  const onDateChange = (t: string) => {
    const { display, iso } = formatDateInput(t);
    setDateInput(display);
    setDateIso(iso);
  };

  const cats = type === "income" ? INCOME_CATS : EXPENSE_CATS;

  const submit = async () => {
    setErr(null);
    const n = parseFloat(amount);
    if (!title.trim() || !n || n <= 0) { setErr("Isi judul dan nominal yang valid"); return; }
    if (!dateIso) { setErr("Tanggal tidak valid — gunakan format DD-MM-YYYY"); return; }
    setBusy(true);
    try {
      const body = {
        type, amount: n, category, title: title.trim(), note,
        date: `${dateIso}T${new Date().toTimeString().slice(0, 8)}`,
        child_id: null,
        link_type: type === "expense" ? linkType : null,
        link_id: type === "expense" ? linkId : null,
      };
      if (editing) {
        await api(`/transactions/${params.tx_id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await api("/transactions", { method: "POST", body: JSON.stringify(body) });
      }
      if (router.canGoBack()) router.back(); else router.replace("/(app)/(tabs)/transaksi");
    } catch (e: any) { setErr(e.message || "Gagal simpan"); }
    finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="close-add-tx">
          <Icon name="close" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>{editing ? "Edit Transaksi" : "Tambah Transaksi"}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        <View style={styles.toggle}>
          <Pressable
            testID="tx-type-income"
            onPress={() => { setType("income"); setLinkType(null); setLinkId(null); if (!INCOME_CATS.includes(category)) setCategory("Gaji"); }}
            style={[styles.toggleBtn, type === "income" && { backgroundColor: `${colors.success}22`, borderColor: colors.success }]}
          >
            <Icon name="arrow-down-bold-circle" size={18} color={colors.success} />
            <Text style={[styles.toggleText, type === "income" && { color: colors.success }]}>Pemasukan</Text>
          </Pressable>
          <Pressable
            testID="tx-type-expense"
            onPress={() => { setType("expense"); if (!EXPENSE_CATS.includes(category)) setCategory("Belanja"); }}
            style={[styles.toggleBtn, type === "expense" && { backgroundColor: `${colors.error}22`, borderColor: colors.error }]}
          >
            <Icon name="arrow-up-bold-circle" size={18} color={colors.error} />
            <Text style={[styles.toggleText, type === "expense" && { color: colors.error }]}>Pengeluaran</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Judul</Text>
        <TextInput testID="tx-title" style={styles.input} value={title} onChangeText={setTitle} placeholder="cth. Gaji September" placeholderTextColor={colors.muted} />

        <Text style={styles.label}>Nominal (Rp)</Text>
        <TextInput testID="tx-amount" style={[styles.input, { fontSize: 20, fontWeight: "800" }]} value={amount} onChangeText={t => setAmount(t.replace(/[^0-9]/g, ""))} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.muted} />

        <Text style={styles.label}>Tanggal (ketik angka saja, otomatis jadi format DD-MM-YYYY)</Text>
        <TextInput
          testID="tx-date"
          style={styles.input}
          value={dateInput}
          onChangeText={onDateChange}
          keyboardType="numeric"
          placeholder="DD-MM-YYYY"
          placeholderTextColor={colors.muted}
          maxLength={10}
        />

        <Text style={styles.label}>Kategori</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {cats.map(c => (
            <Pressable
              key={c}
              testID={`tx-cat-${c}`}
              onPress={() => setCategory(c)}
              style={[styles.cat, category === c && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}
            >
              <Text style={[styles.catText, category === c && { color: colors.onBrandPrimary, fontWeight: "700" }]}>{c}</Text>
            </Pressable>
          ))}
        </View>

        {type === "expense" && targets.length > 0 ? (
          <>
            <Text style={styles.label}>Alokasikan ke Anggaran (opsional)</Text>
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: -4 }}>Hubungkan pengeluaran ini agar realisasi di menu Tagihan / Belanja / Pendidikan / Tabungan ikut terupdate otomatis.</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Pressable
                onPress={() => { setLinkType(null); setLinkId(null); }}
                style={[styles.cat, !linkId && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}
                testID="alloc-none"
              >
                <Text style={[styles.catText, !linkId && { color: colors.onBrandPrimary, fontWeight: "700" }]}>Tidak dialokasikan</Text>
              </Pressable>
            </View>
            {["Tagihan", "Belanja", "Pendidikan", "Tabungan"].map((group) => {
              const gt = targets.filter((x) => x.group === group);
              if (!gt.length) return null;
              return (
                <View key={group} style={{ gap: 6 }}>
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase" }}>{group}</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {gt.map((x) => {
                      const on = linkId === x.link_id && linkType === x.link_type;
                      return (
                        <Pressable
                          key={x.link_type + x.link_id}
                          onPress={() => { setLinkType(x.link_type); setLinkId(x.link_id); }}
                          style={[styles.cat, on && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}
                          testID={`alloc-${x.link_id}`}
                        >
                          <Text style={[styles.catText, on && { color: colors.onBrandPrimary, fontWeight: "700" }]} numberOfLines={1}>{x.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </>
        ) : null}

        <Text style={styles.label}>Catatan (opsional)</Text>
        <TextInput style={[styles.input, { height: 80, textAlignVertical: "top", paddingTop: 12 }]} multiline value={note} onChangeText={setNote} placeholder="Tambahkan catatan..." placeholderTextColor={colors.muted} />

        {err ? <Text style={{ color: colors.error, fontSize: 13 }}>{err}</Text> : null}
        <PrimaryButton label={busy ? "Menyimpan..." : editing ? "Simpan Perubahan" : "Simpan Transaksi"} onPress={submit} disabled={busy} testID="tx-submit" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((colors) => ({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md },
  title: { color: colors.onSurface, fontSize: 18, fontWeight: "800", flex: 1, textAlign: "center" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  toggle: { flexDirection: "row", gap: 8 },
  toggleBtn: { flex: 1, height: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  toggleText: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  label: { color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  input: { backgroundColor: colors.surfaceTertiary, color: colors.onSurface, borderRadius: radius.md, paddingHorizontal: 14, height: 48, borderWidth: 1, borderColor: colors.border, fontSize: 15 },
  cat: { paddingHorizontal: 14, height: 36, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, justifyContent: "center" },
  catText: { color: colors.muted, fontSize: 13 },
}));
