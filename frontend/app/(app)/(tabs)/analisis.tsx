import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { useRouter } from "expo-router";
import { api, idr } from "@/src/api";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Card, PrimaryButton, ProgressBar, SectionHeader } from "@/src/components/ui";

export default function Analisis() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const [summary, setSummary] = useState<any>(null);
  const [insight, setInsight] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setSummary(await api<any>("/dashboard/summary")); } catch {}
    setBusy(true);
    try { const r = await api<{ insight: string }>("/insights/generate"); setInsight(r.insight); } catch {}
    finally { setBusy(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const rate = summary?.saving_rate ?? 0;
  const score = summary?.health_score ?? 0;
  const cats = summary?.expense_by_category || [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}><Icon name="arrow-left" size={22} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Analisis</Text>
          <Text style={styles.sub}>Insight & rekomendasi berbasis AI</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 24, gap: spacing.md }}>
        <Card style={{ borderColor: `${colors.brandPrimary}55` }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <View style={styles.iconWrap}><Icon name="lightbulb-on" size={20} color={colors.brandPrimary} /></View>
            <Text style={{ color: colors.onSurface, fontWeight: "800", fontSize: 16 }}>AI Financial Insight</Text>
          </View>
          {busy ? <ActivityIndicator color={colors.brandPrimary} /> : (
            <Text style={{ color: colors.onSurface, lineHeight: 20 }} testID="analisis-insight">{insight ?? "Belum ada insight."}</Text>
          )}
          <View style={{ marginTop: 12 }}>
            <PrimaryButton label="Regenerasi Insight" onPress={load} icon="refresh" testID="regen-insight" />
          </View>
        </Card>

        <Card>
          <SectionHeader title="Skor Keuangan" />
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Health Score</Text>
            <Text style={{ color: score >= 60 ? colors.success : colors.warning, fontWeight: "800" }}>{score}/100</Text>
          </View>
          <ProgressBar value={score} color={score >= 60 ? colors.success : colors.warning} height={8} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 16, marginBottom: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Saving Rate</Text>
            <Text style={{ color: colors.info, fontWeight: "800" }}>{rate}%</Text>
          </View>
          <ProgressBar value={Math.max(0, rate)} color={colors.info} height={8} />
        </Card>

        <Card>
          <SectionHeader title="Top Kategori Pengeluaran" />
          {cats.length === 0 ? <Text style={{ color: colors.muted }}>Belum ada data.</Text> : cats.slice(0, 5).map((c: any) => (
            <View key={c.category} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={{ color: colors.onSurface, fontWeight: "700" }}>{c.category}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{idr(c.amount)} • {c.percent}%</Text>
              </View>
              <ProgressBar value={c.percent} color={colors.brandPrimary} />
            </View>
          ))}
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
  iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: `${colors.brandPrimary}22`, borderWidth: 1, borderColor: `${colors.brandPrimary}55`, alignItems: "center", justifyContent: "center" },
}));
