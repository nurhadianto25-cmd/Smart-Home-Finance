import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { PrimaryButton } from "@/src/components/ui";

export default function Register() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { registerEmail } = useAuth();
  const { colors, scheme } = useTheme();
  const styles = useStyles();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onRegister = async () => {
    setErr(null);
    if (!name.trim() || !email.trim() || password.length < 6) {
      setErr("Isi nama, email, dan kata sandi minimal 6 karakter"); return;
    }
    setBusy(true);
    try { await registerEmail(name.trim(), email.trim(), password); }
    catch (e: any) { setErr(e.message || "Gagal mendaftar"); }
    finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.surface }}>
      <LinearGradient colors={scheme === "dark" ? ["#1B1246", "#0A0E1A"] : ["#E7ECFA", "#F4F6FB"]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.back} testID="register-back">
          <Icon name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ gap: 6, marginTop: spacing.md }}>
          <Text style={styles.title}>Buat Akun</Text>
          <Text style={styles.hint}>Mulai kelola keuangan keluarga Anda</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Nama Lengkap</Text>
          <TextInput testID="register-name-input" value={name} onChangeText={setName} placeholder="Nama Anda" placeholderTextColor={colors.muted} style={styles.input} />
          <Text style={styles.label}>Email</Text>
          <TextInput testID="register-email-input" value={email} onChangeText={setEmail} placeholder="nama@email.com" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
          <Text style={styles.label}>Kata Sandi</Text>
          <TextInput testID="register-password-input" value={password} onChangeText={setPassword} placeholder="Minimal 6 karakter" placeholderTextColor={colors.muted} secureTextEntry style={styles.input} />
          {err ? <Text style={styles.err} testID="register-error">{err}</Text> : null}
          <PrimaryButton label={busy ? "Memproses..." : "Daftar"} onPress={onRegister} disabled={busy} testID="register-submit-button" />
          <Pressable onPress={() => router.replace("/(auth)/login")} style={{ alignItems: "center", marginTop: 8 }} testID="go-login">
            <Text style={{ color: colors.muted, fontSize: 13 }}>Sudah punya akun? <Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>Masuk</Text></Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  title: { color: colors.onSurface, fontSize: 26, fontWeight: "800" },
  hint: { color: colors.muted, fontSize: 13 },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  label: { color: colors.muted, fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  input: { backgroundColor: colors.surfaceTertiary, color: colors.onSurface, borderRadius: radius.md, paddingHorizontal: 14, height: 48, borderWidth: 1, borderColor: colors.border, fontSize: 15 },
  err: { color: colors.error, fontSize: 13 },
}));
