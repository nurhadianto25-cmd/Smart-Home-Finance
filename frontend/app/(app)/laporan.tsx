import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Linking, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { useRouter } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { api, idr, getMemToken, getToken } from "@/src/api";
import { useAuth } from "@/src/auth";
import { usePrefs } from "@/src/prefs";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Card, EmptyState, SectionHeader } from "@/src/components/ui";
import { DonutChart, LineDualChart } from "@/src/components/charts";
import { formatDateInput } from "@/src/utils/date";

const CAT_COLORS = ["#3D7EFF", "#10D96A", "#FF9D3D", "#9B6BFF", "#FF4757", "#F7C948"];
const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function Laporan() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const { t } = usePrefs();
  const styles = useStyles();
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<"month" | "custom">("month");
  const [startF, setStartF] = useState<{ display: string; iso: string | null }>({ display: "", iso: null });
  const [endF, setEndF] = useState<{ display: string; iso: string | null }>({ display: "", iso: null });

  const load = useCallback(async () => { try { setData(await api<any>("/dashboard/summary")); } catch {} }, []);
  useEffect(() => { load(); }, [load]);

  const cats = (data?.expense_by_category || []).slice(0, 6);
  const cf = data?.cashflow || [];

  const share = async (kind: "whatsapp" | "pdf" | "excel") => {
    setMsg(null);
    const custom = mode === "custom" && startF.iso && endF.iso;
    if (mode === "custom" && (!startF.iso || !endF.iso)) {
      setMsg(t("invalidRange"));
      return;
    }
    const rq = custom ? `?start=${startF.iso}&end=${endF.iso}` : "";
    const labelName = custom ? `${startF.iso}_${endF.iso}` : (data?.month || "bulan");
    setBusy(kind);
    try {
      if (kind === "whatsapp") {
        if (!user?.whatsapp) {
          setMsg(t("setWhatsappFirst"));
          return;
        }
        const r = await api<{ text: string }>("/report/text" + rq);
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

      const path = (kind === "pdf" ? "/api/report/pdf" : "/api/report/excel") + rq;
      const ext = kind === "pdf" ? "pdf" : "xlsx";
      const token = getMemToken() ?? (await getToken());
      const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

      if (Platform.OS === "web") {
        const res = await fetch(`${BASE}${path}`, { headers: authHeader as any });
        if (!res.ok) throw new Error("Gagal unduh");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `Laporan-${labelName}.${ext}`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 500);
        return;
      }

      const fileUri = FileSystem.cacheDirectory + `Laporan-${labelName}.${ext}`;
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
          <Text style={styles.title}>{t("reportTitle")}</Text>
          <Text style={styles.sub}>{t("reportSub")} {data?.month || "-"}</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 24, gap: spacing.md }}>
        <Card>
          <SectionHeader title={t("monthlySummary")} />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View><Text style={styles.miniLabel}>{t("openingShort")}</Text><Text style={[styles.miniVal, { color: colors.onSurface }]}>{idr(data?.opening_balance ?? 0)}</Text></View>
            <View><Text style={styles.miniLabel}>{t("income")}</Text><Text style={[styles.miniVal, { color: colors.success }]}>{idr(data?.income ?? 0)}</Text></View>
            <View><Text style={styles.miniLabel}>{t("expense")}</Text><Text style={[styles.miniVal, { color: colors.error }]}>{idr(data?.expense ?? 0)}</Text></View>
          </View>
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 12 }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View><Text style={styles.miniLabel}>{t("difference")}</Text><Text style={[styles.miniVal, { color: (data?.balance ?? 0) >= 0 ? colors.success : colors.error }]}>{idr(data?.balance ?? 0)}</Text></View>
            <View><Text style={styles.miniLabel}>{t("endingBalance")}</Text><Text style={[styles.miniVal, { color: (data?.cumulative_balance ?? 0) >= 0 ? colors.success : colors.error }]}>{idr(data?.cumulative_balance ?? 0)}</Text></View>
          </View>
        </Card>

        <Card>
          <SectionHeader title={t("customReport")} />
          <Text style={styles.cardHint}>{t("customReportHint")}</Text>
          <View style={styles.modeRow}>
            <Pressable testID="period-month" onPress={() => setMode("month")} style={[styles.modeBtn, mode === "month" && styles.modeBtnActive]}>
              <Text style={[styles.modeText, mode === "month" && styles.modeTextActive]}>{t("thisMonth")}</Text>
            </Pressable>
            <Pressable testID="period-custom" onPress={() => setMode("custom")} style={[styles.modeBtn, mode === "custom" && styles.modeBtnActive]}>
              <Text style={[styles.modeText, mode === "custom" && styles.modeTextActive]}>{t("customRange")}</Text>
            </Pressable>
          </View>
          {mode === "custom" ? (
            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.miniLabel}>{t("startDate")}</Text>
                <TextInput testID="report-start" style={styles.input} value={startF.display} onChangeText={(x) => setStartF(formatDateInput(x))} keyboardType="numeric" maxLength={10} placeholder="DD-MM-YYYY" placeholderTextColor={colors.muted} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.miniLabel}>{t("endDate")}</Text>
                <TextInput testID="report-end" style={styles.input} value={endF.display} onChangeText={(x) => setEndF(formatDateInput(x))} keyboardType="numeric" maxLength={10} placeholder="DD-MM-YYYY" placeholderTextColor={colors.muted} />
              </View>
            </View>
          ) : null}
        </Card>

        <Card>
          <SectionHeader title={t("sendDownload")} />
          <View style={{ gap: 8 }}>
            <Pressable
              onPress={() => share("whatsapp")}
              disabled={busy === "whatsapp"}
              style={({ pressed }) => [styles.actionRow, { borderColor: "#25D36655" }, pressed && { opacity: 0.7 }]}
              testID="report-whatsapp"
            >
              <View style={[styles.actionIcon, { backgroundColor: "#25D36622" }]}><Icon name="whatsapp" size={22} color="#25D366" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>{t("sendWhatsapp")}</Text>
                <Text style={styles.actionSub}>{user?.whatsapp ? `+${user.whatsapp}` : t("setWhatsappFirst")}</Text>
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
                <Text style={styles.actionTitle}>{t("downloadPdf")}</Text>
                <Text style={styles.actionSub}>{t("pdfSub")}</Text>
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
                <Text style={styles.actionTitle}>{t("downloadExcel")}</Text>
                <Text style={styles.actionSub}>{t("excelSub")}</Text>
              </View>
              <Icon name={busy === "excel" ? "loading" : "download"} size={20} color={colors.muted} />
            </Pressable>

            {msg ? <Text style={{ color: colors.warning, fontSize: 12, marginTop: 4 }}>{msg}</Text> : null}
          </View>
        </Card>

        <Card>
          <SectionHeader title={t("cashflow6")} />
          <View style={{ alignItems: "center" }}>
            <LineDualChart income={cf.map((c: any) => c.income)} expense={cf.map((c: any) => c.expense)} labels={cf.map((c: any) => c.month.slice(5))} width={300} />
          </View>
        </Card>
        <Card>
          <SectionHeader title={t("expenseCategory")} />
          {cats.length === 0 ? <EmptyState icon="chart-donut" title={t("noData")} /> : (
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

const useStyles = makeStyles((colors) => ({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  title: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
  sub: { color: colors.muted, fontSize: 12 },
  miniLabel: { color: colors.muted, fontSize: 11 },
  miniVal: { fontSize: 15, fontWeight: "800", marginTop: 4 },
  cardHint: { color: colors.muted, fontSize: 12, marginBottom: 12 },
  modeRow: { flexDirection: "row", gap: 8 },
  modeBtn: { flex: 1, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  modeBtnActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  modeText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  modeTextActive: { color: colors.onBrandPrimary },
  input: { backgroundColor: colors.surfaceTertiary, color: colors.onSurface, borderRadius: radius.md, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: colors.border, fontSize: 14 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1 },
  actionIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  actionTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "800" },
  actionSub: { color: colors.muted, fontSize: 11, marginTop: 2 },
}));
