import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Image, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/src/auth";
import { colors, radius, spacing } from "@/src/theme";
import { Card, PrimaryButton, SectionHeader } from "@/src/components/ui";

export default function Pengaturan() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [waRaw, setWaRaw] = useState((user?.whatsapp || "").replace(/\D/g, ""));
  const [picture, setPicture] = useState<string | null>(user?.picture || null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setErr("Izin akses foto ditolak. Buka Pengaturan HP untuk mengizinkan.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true,
    });
    if (!res.canceled && res.assets?.[0]?.base64) {
      const uri = `data:image/jpeg;base64,${res.assets[0].base64}`;
      setPicture(uri);
    }
  };

  const save = async () => {
    setErr(null); setOkMsg(null); setBusy(true);
    try {
      await updateProfile({ name: name.trim() || undefined, whatsapp: waRaw, picture: picture || undefined });
      setEditing(false);
      setOkMsg("Profil diperbarui");
    } catch (e: any) { setErr(e.message || "Gagal simpan"); }
    finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="back-settings"><Icon name="arrow-left" size={22} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Pengaturan</Text>
          <Text style={styles.sub}>Profil dan preferensi</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 24, gap: spacing.md }} keyboardShouldPersistTaps="handled">
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm }}>
            <SectionHeader title="Profil" />
            {!editing ? (
              <Pressable testID="edit-profile-btn" onPress={() => setEditing(true)} style={styles.editBtn}>
                <Icon name="pencil" size={14} color={colors.brandPrimary} />
                <Text style={styles.editText}>Edit</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
            <Pressable onPress={editing ? pickPhoto : undefined} testID="profile-photo" style={styles.avatarWrap}>
              {picture ? <Image source={{ uri: picture }} style={styles.avatarImg} /> : (
                <View style={styles.avatar}><Icon name="account" size={32} color={colors.onBrandPrimary} /></View>
              )}
              {editing ? (
                <View style={styles.avatarBadge}><Icon name="camera" size={12} color={colors.onBrandPrimary} /></View>
              ) : null}
            </Pressable>
            <View style={{ flex: 1 }}>
              {editing ? (
                <TextInput
                  testID="settings-name-input"
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Nama pengguna"
                  placeholderTextColor={colors.muted}
                />
              ) : (
                <>
                  <Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: "800" }}>{user?.name || "-"}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{user?.email}</Text>
                </>
              )}
            </View>
          </View>
        </Card>

        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm }}>
            <SectionHeader title="Kontak" />
            {!editing ? (
              <Pressable testID="edit-contact-btn" onPress={() => setEditing(true)} style={styles.editBtn}>
                <Icon name="pencil" size={14} color={colors.brandPrimary} />
                <Text style={styles.editText}>Edit</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={{ gap: 6 }}>
            <Text style={styles.lbl}>Nomor WhatsApp</Text>
            {editing ? (
              <TextInput
                testID="settings-whatsapp-input"
                style={styles.input}
                value={waRaw}
                onChangeText={t => setWaRaw(t.replace(/\D/g, ""))}
                placeholder="cth. 6281234567890"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
              />
            ) : (
              <Text style={styles.valLarge}>{user?.whatsapp ? formatWa(user.whatsapp) : "Belum diatur"}</Text>
            )}
            <Text style={styles.hint}>Digunakan untuk mengirim laporan keuangan langsung ke WhatsApp Anda.</Text>
          </View>
        </Card>

        {editing ? (
          <View style={{ gap: spacing.sm }}>
            {err ? <Text style={{ color: colors.error, fontSize: 13 }}>{err}</Text> : null}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={() => { setEditing(false); setName(user?.name || ""); setWaRaw((user?.whatsapp || "").replace(/\D/g, "")); setPicture(user?.picture || null); }} style={styles.cancelBtn} testID="cancel-edit">
                <Text style={{ color: colors.onSurface, fontWeight: "700" }}>Batal</Text>
              </Pressable>
              <View style={{ flex: 1 }}>
                <PrimaryButton label={busy ? "Menyimpan..." : "Simpan"} onPress={save} disabled={busy} testID="save-profile" />
              </View>
            </View>
          </View>
        ) : null}

        {okMsg ? <Text style={{ color: colors.success, fontSize: 13 }}>{okMsg}</Text> : null}

        <Card>
          <SectionHeader title="Aplikasi" />
          <View style={{ gap: 8 }}>
            <View style={styles.row}><Icon name="theme-light-dark" size={20} color={colors.brandPrimary} /><Text style={styles.rowText}>Tema</Text><Text style={styles.rowVal}>Gelap</Text></View>
            <View style={styles.row}><Icon name="translate" size={20} color={colors.info} /><Text style={styles.rowText}>Bahasa</Text><Text style={styles.rowVal}>Indonesia</Text></View>
            <View style={styles.row}><Icon name="currency-usd" size={20} color={colors.success} /><Text style={styles.rowText}>Mata Uang</Text><Text style={styles.rowVal}>IDR</Text></View>
          </View>
        </Card>

        <PrimaryButton label="Keluar" onPress={logout} icon="logout" testID="settings-logout" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function formatWa(w: string) {
  const d = (w || "").replace(/\D/g, "");
  if (!d) return "";
  return "+" + d.replace(/(\d{2})(\d{3,4})(\d{3,4})(\d+)?/, (_, a, b, c, e) => `${a} ${b} ${c}${e ? " " + e : ""}`).trim();
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  title: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
  sub: { color: colors.muted, fontSize: 12 },
  avatarWrap: { width: 64, height: 64 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  avatarImg: { width: 64, height: 64, borderRadius: 32 },
  avatarBadge: { position: "absolute", right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.surface },
  input: { backgroundColor: colors.surfaceTertiary, color: colors.onSurface, borderRadius: radius.md, paddingHorizontal: 14, height: 44, borderWidth: 1, borderColor: colors.border, fontSize: 15 },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, height: 30, borderRadius: radius.pill, backgroundColor: `${colors.brandPrimary}22`, borderWidth: 1, borderColor: `${colors.brandPrimary}55` },
  editText: { color: colors.brandPrimary, fontSize: 12, fontWeight: "700" },
  cancelBtn: { paddingHorizontal: 20, height: 46, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  lbl: { color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  valLarge: { color: colors.onSurface, fontSize: 15, fontWeight: "700" },
  hint: { color: colors.muted, fontSize: 11, marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowText: { color: colors.onSurface, fontSize: 14, fontWeight: "600", flex: 1 },
  rowVal: { color: colors.muted, fontSize: 13 },
});
