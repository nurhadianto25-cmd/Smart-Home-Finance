import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";
import { PrimaryButton } from "@/src/components/ui";

const INCOME_CATS = ["Gaji", "Bonus", "Investasi", "Lainnya"];
const EXPENSE_CATS = ["Belanja", "Makanan", "Tagihan", "Transportasi", "Pendidikan", "Kesehatan", "Hiburan", "Lainnya"];

export default function AddTransaction() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Belanja");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cats = type === "income" ? INCOME_CATS : EXPENSE_CATS;

  const submit = async () => {
    setErr(null);
    const n = parseFloat(amount);
    if (!title.trim() || !n || n <= 0) { setErr("Isi judul dan nominal yang valid"); return; }
    setBusy(true);
    try {
      await api("/transactions", { method: "POST", body: JSON.stringify({
        type, amount: n, category, title: title.trim(), note, date: new Date().toISOString(),
      }) });
      router.back();
    } catch (e: any) { setErr(e.message || "Gagal simpan"); }
    finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="close-add-tx">
          <Icon name="close" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Tambah Transaksi</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        <View style={styles.toggle}>
          <Pressable
            testID="tx-type-income"
            onPress={() => { setType("income"); setCategory("Gaji"); }}
            style={[styles.toggleBtn, type === "income" && { backgroundColor: `${colors.success}22`, borderColor: colors.success }]}
          >
            <Icon name="arrow-down-bold-circle" size={18} color={colors.success} />
            <Text style={[styles.toggleText, type === "income" && { color: colors.success }]}>Pemasukan</Text>
          </Pressable>
          <Pressable
            testID="tx-type-expense"
            onPress={() => { setType("expense"); setCategory("Belanja"); }}
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

        <Text style={styles.label}>Catatan (opsional)</Text>
        <TextInput style={[styles.input, { height: 80, textAlignVertical: "top", paddingTop: 12 }]} multiline value={note} onChangeText={setNote} placeholder="Tambahkan catatan..." placeholderTextColor={colors.muted} />

        {err ? <Text style={{ color: colors.error, fontSize: 13 }}>{err}</Text> : null}
        <PrimaryButton label={busy ? "Menyimpan..." : "Simpan Transaksi"} onPress={submit} disabled={busy} testID="tx-submit" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
});
