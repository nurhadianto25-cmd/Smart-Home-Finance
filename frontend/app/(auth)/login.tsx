import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { colors, radius, spacing } from "@/src/theme";
import { PrimaryButton } from "@/src/components/ui";

export default function Login() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { loginEmail, loginGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onLogin = async () => {
    setErr(null); setBusy(true);
    try { await loginEmail(email.trim(), password); }
    catch (e: any) { setErr(e.message || "Gagal login"); }
    finally { setBusy(false); }
  };
  const onGoogle = async () => {
    setErr(null); setBusy(true);
    try { await loginGoogle(); }
    catch (e: any) { setErr(e.message || "Gagal login Google"); }
    finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.surface }}>
      <LinearGradient colors={["#1B1246", "#0A0E1A"]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.brandBox}>
          <View style={styles.brandIcon}>
            <Icon name="home-heart" size={32} color={colors.onBrandPrimary} />
          </View>
          <Text style={styles.brandTitle}>Smart Home Finance</Text>
          <Text style={styles.brandSub}>Kelola keuangan keluarga dengan cerdas</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Masuk</Text>
          <Text style={styles.hint}>Selamat datang kembali</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            testID="login-email-input"
            value={email}
            onChangeText={setEmail}
            placeholder="nama@email.com"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />

          <Text style={styles.label}>Kata Sandi</Text>
          <TextInput
            testID="login-password-input"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.muted}
            secureTextEntry
            style={styles.input}
          />

          {err ? <Text style={styles.err} testID="login-error">{err}</Text> : null}

          <PrimaryButton label={busy ? "Memproses..." : "Masuk"} onPress={onLogin} disabled={busy} testID="login-submit-button" />

          <View style={styles.divider}>
            <View style={styles.line} /><Text style={styles.orText}>atau</Text><View style={styles.line} />
          </View>

          <Pressable testID="login-google-button" onPress={onGoogle} disabled={busy} style={({ pressed }) => [styles.googleBtn, pressed && { opacity: 0.85 }]}>
            <Icon name="google" size={18} color={colors.onSurface} />
            <Text style={styles.googleText}>Masuk dengan Google</Text>
          </Pressable>

          <Pressable testID="go-register" onPress={() => router.push("/(auth)/register")} style={styles.linkWrap}>
            <Text style={styles.link}>Belum punya akun? <Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>Daftar</Text></Text>
          </Pressable>
        </View>
        {busy ? <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 12 }} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, gap: spacing.xl },
  brandBox: { alignItems: "center", gap: spacing.md },
  brandIcon: {
    width: 68, height: 68, borderRadius: 20, backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
    shadowColor: colors.brandPrimary, shadowOpacity: 0.6, shadowRadius: 20, shadowOffset: { width: 0, height: 0 },
  },
  brandTitle: { color: colors.onSurface, fontSize: 24, fontWeight: "800" },
  brandSub: { color: colors.muted, fontSize: 13 },
  card: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl,
    borderWidth: 1, borderColor: colors.border, gap: spacing.md,
  },
  title: { color: colors.onSurface, fontSize: 22, fontWeight: "800" },
  hint: { color: colors.muted, fontSize: 13, marginBottom: spacing.sm },
  label: { color: colors.muted, fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  input: {
    backgroundColor: colors.surfaceTertiary, color: colors.onSurface,
    borderRadius: radius.md, paddingHorizontal: 14, height: 48,
    borderWidth: 1, borderColor: colors.border, fontSize: 15,
  },
  err: { color: colors.error, fontSize: 13 },
  divider: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: spacing.sm },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  orText: { color: colors.muted, fontSize: 12 },
  googleBtn: {
    height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 10,
  },
  googleText: { color: colors.onSurface, fontSize: 14, fontWeight: "600" },
  linkWrap: { alignItems: "center", marginTop: spacing.sm },
  link: { color: colors.muted, fontSize: 13 },
});
