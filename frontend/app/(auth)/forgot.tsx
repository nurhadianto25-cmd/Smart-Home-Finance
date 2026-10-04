import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { PrimaryButton } from "@/src/components/ui";

export default function Forgot() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { forgotPassword, resetPassword } = useAuth();
  const { colors, scheme } = useTheme();
  const styles = useStyles();

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const sendCode = async () => {
    setErr(null); setInfo(null);
    if (!email.trim()) { setErr("Masukkan email Anda"); return; }
    setBusy(true);
    try {
      await forgotPassword(email.trim());
      setStep(2);
      setInfo("Kode verifikasi 6 digit telah dikirim ke email Anda.");
    } catch (e: any) { setErr(e.message || "Gagal mengirim kode"); }
    finally { setBusy(false); }
  };

  const doReset = async () => {
    setErr(null); setInfo(null);
    if (otp.length !== 6) { setErr("Masukkan kode 6 digit"); return; }
    if (password.length < 6) { setErr("Kata sandi baru minimal 6 karakter"); return; }
    setBusy(true);
    try {
      await resetPassword(email.trim(), otp.trim(), password);
      // resetPassword logs the user in; AuthGate will redirect to the app.
    } catch (e: any) { setErr(e.message || "Gagal mengatur ulang sandi"); }
    finally { setBusy(false); }
  };

  const resend = async () => {
    setErr(null); setInfo(null); setBusy(true);
    try { await forgotPassword(email.trim()); setInfo("Kode baru telah dikirim."); }
    catch (e: any) { setErr(e.message || "Gagal mengirim ulang"); }
    finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.surface }}>
      <LinearGradient colors={scheme === "dark" ? ["#1B1246", "#0A0E1A"] : ["#E7ECFA", "#F4F6FB"]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => (step === 2 ? setStep(1) : router.back())} style={styles.back} testID="forgot-back">
          <Icon name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>

        <View style={styles.brandBox}>
          <View style={styles.brandIcon}>
            <Icon name={step === 1 ? "email-lock" : "shield-key"} size={30} color={colors.onBrandPrimary} />
          </View>
          <Text style={styles.title}>{step === 1 ? "Lupa Kata Sandi" : "Verifikasi & Sandi Baru"}</Text>
          <Text style={styles.sub}>
            {step === 1
              ? "Masukkan email akun Anda. Kami akan mengirim kode verifikasi."
              : `Masukkan kode yang dikirim ke ${email} dan buat kata sandi baru.`}
          </Text>
        </View>

        <View style={styles.card}>
          {step === 1 ? (
            <>
              <Text style={styles.label}>Email</Text>
              <TextInput
                testID="forgot-email-input"
                value={email}
                onChangeText={setEmail}
                placeholder="nama@email.com"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
              />
              {err ? <Text style={styles.err} testID="forgot-error">{err}</Text> : null}
              <PrimaryButton label={busy ? "Mengirim..." : "Kirim Kode"} onPress={sendCode} disabled={busy} testID="forgot-send-button" />
            </>
          ) : (
            <>
              {info ? <Text style={styles.info} testID="forgot-info">{info}</Text> : null}
              <Text style={styles.label}>Kode Verifikasi (6 digit)</Text>
              <TextInput
                testID="forgot-otp-input"
                value={otp}
                onChangeText={(t) => setOtp(t.replace(/[^0-9]/g, "").slice(0, 6))}
                placeholder="______"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                maxLength={6}
                style={[styles.input, styles.otpInput]}
              />
              <Text style={styles.label}>Kata Sandi Baru</Text>
              <TextInput
                testID="forgot-password-input"
                value={password}
                onChangeText={setPassword}
                placeholder="Minimal 6 karakter"
                placeholderTextColor={colors.muted}
                secureTextEntry
                style={styles.input}
              />
              {err ? <Text style={styles.err} testID="forgot-error">{err}</Text> : null}
              <PrimaryButton label={busy ? "Memproses..." : "Atur Ulang Sandi"} onPress={doReset} disabled={busy} testID="forgot-reset-button" />
              <Pressable onPress={resend} disabled={busy} style={styles.resendWrap} testID="forgot-resend">
                <Text style={styles.resend}>Tidak menerima kode? <Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>Kirim ulang</Text></Text>
              </Pressable>
            </>
          )}
        </View>

        <Pressable onPress={() => router.replace("/(auth)/login")} style={{ alignItems: "center", marginTop: 4 }} testID="forgot-go-login">
          <Text style={{ color: colors.muted, fontSize: 13 }}>Ingat kata sandi? <Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>Masuk</Text></Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  brandBox: { alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  brandIcon: {
    width: 64, height: 64, borderRadius: 20, backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
    shadowColor: colors.brandPrimary, shadowOpacity: 0.6, shadowRadius: 18, shadowOffset: { width: 0, height: 0 },
  },
  title: { color: colors.onSurface, fontSize: 22, fontWeight: "800", textAlign: "center" },
  sub: { color: colors.muted, fontSize: 13, textAlign: "center", paddingHorizontal: spacing.md },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  label: { color: colors.muted, fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  input: { backgroundColor: colors.surfaceTertiary, color: colors.onSurface, borderRadius: radius.md, paddingHorizontal: 14, height: 48, borderWidth: 1, borderColor: colors.border, fontSize: 15 },
  otpInput: { textAlign: "center", letterSpacing: 10, fontSize: 22, fontWeight: "800" },
  err: { color: colors.error, fontSize: 13 },
  info: { color: colors.success, fontSize: 13 },
  resendWrap: { alignItems: "center", marginTop: 4 },
  resend: { color: colors.muted, fontSize: 13 },
}));
