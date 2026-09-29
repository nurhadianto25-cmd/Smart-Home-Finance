import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { useRouter } from "expo-router";
import { api, idr } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";
import { Card, EmptyState, SectionHeader } from "@/src/components/ui";
import { DonutChart, LineDualChart } from "@/src/components/charts";

const CAT_COLORS = ["#3D7EFF", "#10D96A", "#FF9D3D", "#9B6BFF", "#FF4757", "#F7C948"];

export default function Laporan() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const load = useCallback(async () => { try { setData(await api<any>("/dashboard/summary")); } catch {} }, []);
  useEffect(() => { load(); }, [load]);

  const cats = (data?.expense_by_category || []).slice(0, 6);
  const cf = data?.cashflow || [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}><Icon name="arrow-left" size={22} color={colors.onSurface} /></Pressable>
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
});
