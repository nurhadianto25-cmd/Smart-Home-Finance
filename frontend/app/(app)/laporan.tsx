import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { useRouter } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { api, idr, getMemToken, getToken } from "@/src/api";
import { useAuth } from "@/src/auth";
import { colors, radius, spacing } from "@/src/theme";
import { Card, EmptyState, SectionHeader } from "@/src/components/ui";
import { DonutChart, LineDualChart } from "@/src/components/charts";

const CAT_COLORS = ["#3D7EFF", "#10D96A", "#FF9D3D", "#9B6BFF", "#FF4757", "#F7C948"];
const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function Laporan() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => { try { setData(await api<any>("/dashboard/summary")); } catch {} }, []);
  useEffect(() => { load(); }, [load]);

  const cats = (data?.expense_by_category || []).slice(0, 6);
  const cf = data?.cashflow || [];

  const share = async (kind: "whatsapp" | "pdf" | "excel") => {
    setMsg(null);
    setBusy(kind);
    try {
      if (kind === "whatsapp") {
        if (!user?.whatsapp) {
          setMsg("Tambahkan nomor WhatsApp di Pengaturan dulu.");
          return;
        }
        const r = await api<{ text: string }>("/report/text");
        const url = `https://wa.me/${user.whatsapp}?text=${encodeURIComponent(r.text)}`;
        if (Platform.OS === "web") {
          if (typeof window !== "undefined") window.open(url, "_blank");
        } else {
          const supported = await Linking.canOpenURL(url);
          if (supported) await Linking.openURL(url);
          else setMsg("WhatsApp tidak terpasang di perangkat.");
        }
        return;
      }

      const path = kind === "pdf" ? "/api/report/pdf" : "/api/report/excel";
      const ext = kind === "pdf" ? "pdf" : "xlsx";
      const token = getMemToken() ?? (await getToken());
      const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

      if (Platform.OS === "web") {
        const res = await fetch(`${BASE}${path}`, { headers: authHeader as any });
        if (!res.ok) throw new Error("Gagal unduh");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `Laporan-${data?.month || "bulan"}.${ext}`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 500);
        return;
      }

      const fileUri = FileSystem.cacheDirectory + `Laporan-${data?.month || "bulan"}.${ext}`;
      const dl = await FileSystem.downloadAsync(`${BASE}${path}`, fileUri, { headers: authHeader as any });
      if (dl.status !== 200) throw new Error("Gagal unduh");
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(dl.uri, { mimeType: kind === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      } else {
        setMsg(`Tersimpan ke ${dl.uri}`);
      }
    } catch (e: any) {
      setMsg(e.message || "Gagal");
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="back-report"><Icon name="arrow-left" size={22} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Laporan Keuangan</Text>
          <Text style={styles.sub}>Ringkasan bulan {data?.month || "-"}</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 24, gap: spacing.md }}>
        <Card>
          <SectionHeader title="Ringkasan Bulanan" />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View><Text style={styles.miniLabel}>Pemasukan</Text><Text style={[styles.miniVal, { color: colors.success }]}>{idr(data?.income ?? 0)}</Text></View>
            <View><Text style={styles.miniLabel}>Pengeluaran</Text><Text style={[styles.miniVal, { color: colors.error }]}>{idr(data?.expense ?? 0)}</Text></View>
            <View><Text style={styles.miniLabel}>Selisih</Text><Text style={[styles.miniVal, { color: (data?.balance ?? 0) >= 0 ? colors.success : colors.error }]}>{idr(data?.balance ?? 0)}</Text></View>
          </View>
        </Card>

        <Card>
          <SectionHeader title="Kirim / Unduh Laporan" />
          <View style={{ gap: 8 }}>
            <Pressable
              onPress={() => share("whatsapp")}
              disabled={busy === "whatsapp"}
              style={({ pressed }) => [styles.actionRow, { borderColor: "#25D36655" }, pressed && { opacity: 0.7 }]}
              testID="report-whatsapp"
            >
              <View style={[styles.actionIcon, { backgroundColor: "#25D36622" }]}><Icon name="whatsapp" size={22} color="#25D366" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>Kirim ke WhatsApp Saya</Text>
                <Text style={styles.actionSub}>{user?.whatsapp ? `+${user.whatsapp}` : "Atur nomor WhatsApp dulu di Pengaturan"}</Text>
              </View>
              <Icon name="chevron-right" size={22} color={colors.muted} />
            </Pressable>

            <Pressable
              onPress={() => share("pdf")}
              disabled={busy === "pdf"}
              style={({ pressed }) => [styles.actionRow, { borderColor: `${colors.error}55` }, pressed && { opacity: 0.7 }]}
              testID="report-pdf"
            >
              <View style={[styles.actionIcon, { backgroundColor: `${colors.error}22` }]}><Icon name="file-pdf-box" size={22} color={colors.error} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>Unduh sebagai PDF</Text>
                <Text style={styles.actionSub}>Ringkasan + detail transaksi bulan ini</Text>
              </View>
              <Icon name={busy === "pdf" ? "loading" : "download"} size={20} color={colors.muted} />
            </Pressable>

            <Pressable
              onPress={() => share("excel")}
              disabled={busy === "excel"}
              style={({ pressed }) => [styles.actionRow, { borderColor: `${colors.success}55` }, pressed && { opacity: 0.7 }]}
              testID="report-excel"
            >
              <View style={[styles.actionIcon, { backgroundColor: `${colors.success}22` }]}><Icon name="microsoft-excel" size={22} color={colors.success} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>Unduh sebagai Excel</Text>
                <Text style={styles.actionSub}>Data mentah dalam format .xlsx</Text>
              </View>
              <Icon name={busy === "excel" ? "loading" : "download"} size={20} color={colors.muted} />
            </Pressable>

            {msg ? <Text style={{ color: colors.warning, fontSize: 12, marginTop: 4 }}>{msg}</Text> : null}
          </View>
        </Card>

        <Card>
          <SectionHeader title="Cash Flow 6 Bulan" />
          <View style={{ alignItems: "center" }}>
            <LineDualChart income={cf.map((c: any) => c.income)} expense={cf.map((c: any) => c.expense)} labels={cf.map((c: any) => c.month.slice(5))} width={300} />
          </View>
        </Card>
        <Card>
          <SectionHeader title="Kategori Pengeluaran" />
          {cats.length === 0 ? <EmptyState icon="chart-donut" title="Belum ada data" /> : (
            <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
              <DonutChart data={cats.map((c: any, i: number) => ({ value: c.amount, color: CAT_COLORS[i % CAT_COLORS.length] }))} size={140} />
              <View style={{ flex: 1, gap: 6 }}>
                {cats.map((c: any, i: number) => (
                  <View key={c.category} style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }} />
                    <Text style={{ color: colors.onSurface, fontSize: 12, flex: 1 }} numberOfLines={1}>{c.category}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{idr(c.amount)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  title: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
  sub: { color: colors.muted, fontSize: 12 },
  miniLabel: { color: colors.muted, fontSize: 11 },
  miniVal: { fontSize: 15, fontWeight: "800", marginTop: 4 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1 },
  actionIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  actionTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "800" },
  actionSub: { color: colors.muted, fontSize: 11, marginTop: 2 },
});
