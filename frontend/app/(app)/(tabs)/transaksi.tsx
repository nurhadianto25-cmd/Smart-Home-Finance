import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, FlatList, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { useRouter } from "expo-router";
import { api, idr } from "@/src/api";
import { usePrefs } from "@/src/prefs";
import { localeTag } from "@/src/i18n";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { PillButton, EmptyState } from "@/src/components/ui";
import { useConfirm } from "@/src/confirm";

const CAT_ICONS: Record<string, string> = {
  Gaji: "briefcase-check",
  Bonus: "gift",
  Belanja: "cart",
  Makanan: "silverware-fork-knife",
  Tagihan: "receipt-text",
  Transportasi: "car",
  Pendidikan: "school",
  Tabungan: "piggy-bank",
  Lainnya: "dots-horizontal",
};

function iconFor(t: any) {
  return CAT_ICONS[t.category] || (t.type === "income" ? "arrow-down-bold-circle" : "arrow-up-bold-circle");
}

export default function Transaksi() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [type, setType] = useState<"all" | "income" | "expense">("all");
  const [month, setMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { colors } = useTheme();
  const { t } = usePrefs();
  const styles = useStyles();
  const confirm = useConfirm();

  const load = useCallback(async () => {
    try {
      const qs = `?month=${month}${type === "all" ? "" : `&type=${type}`}`;
      const list = await api<any[]>(`/transactions${qs}`);
      setItems(list);
    } catch {}
  }, [type, month]);

  useEffect(() => { load(); }, [load]);

  const shiftMonth = (delta: number) => {
    const y = Number(month.slice(0, 4));
    const m = Number(month.slice(5, 7));
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const monthLabel = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1)
    .toLocaleDateString(localeTag(), { month: "long", year: "numeric" });

  const onDelete = async (id: string) => {
    const ok = await confirm({ title: "Hapus Transaksi", message: "Transaksi ini akan dihapus permanen. Lanjutkan?", danger: true });
    if (!ok) return;
    try { await api(`/transactions/${id}`, { method: "DELETE" }); load(); } catch {}
  };

  const grouped: Record<string, any[]> = {};
  for (const t of items) {
    const d = (t.date || "").slice(0, 10);
    (grouped[d] ||= []).push(t);
  }
  const sections = Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]));

  const totalIn = items.filter(i => i.type === "income").reduce((s, i) => s + i.amount, 0);
  const totalOut = items.filter(i => i.type === "expense").reduce((s, i) => s + i.amount, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md, backgroundColor: colors.surface }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text style={styles.title}>{t("transactions")}</Text>
            <Text style={styles.sub}>{t("txSub")}</Text>
          </View>
          <Pressable testID="add-tx" onPress={() => router.push("/(app)/add-transaction")} style={styles.fabInline}>
            <Icon name="plus" size={22} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <View style={styles.mini}><Text style={styles.miniLabel}>{t("income").toUpperCase()}</Text><Text style={[styles.miniVal, { color: colors.success }]}>{idr(totalIn)}</Text></View>
          <View style={styles.mini}><Text style={styles.miniLabel}>{t("expense").toUpperCase()}</Text><Text style={[styles.miniVal, { color: colors.error }]}>{idr(totalOut)}</Text></View>
        </View>
        <View style={styles.monthNav}>
          <Pressable testID="tx-month-prev" onPress={() => shiftMonth(-1)} style={styles.monthBtn}><Icon name="chevron-left" size={20} color={colors.onSurface} /></Pressable>
          <Text style={styles.monthLabel} testID="tx-month-label">{monthLabel}</Text>
          <Pressable testID="tx-month-next" onPress={() => shiftMonth(1)} style={styles.monthBtn}><Icon name="chevron-right" size={20} color={colors.onSurface} /></Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 12 }}>
          <PillButton testID="filter-all" label={t("all")} active={type === "all"} onPress={() => setType("all")} />
          <PillButton testID="filter-income" label={t("income")} active={type === "income"} onPress={() => setType("income")} />
          <PillButton testID="filter-expense" label={t("expense")} active={type === "expense"} onPress={() => setType("expense")} />
        </ScrollView>
      </View>

      <FlatList
        data={sections}
        keyExtractor={([d]) => d}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 24, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brandPrimary} />}
        ListEmptyComponent={<EmptyState icon="receipt-text-outline" title={t("noTx")} hint={t("noTxHint")} />}
        renderItem={({ item: [date, arr] }) => {
          const daySum = (arr as any[]).reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
          const dateLabel = new Date(date + "T00:00:00").toLocaleDateString(localeTag(), { day: "numeric", month: "long", year: "numeric" });
          return (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={styles.dateHeader}>{dateLabel.toUpperCase()}</Text>
                <Text style={[styles.dateHeader, { color: daySum >= 0 ? colors.success : colors.error }]}>
                  {daySum >= 0 ? "+" : ""}{idr(daySum)}
                </Text>
              </View>
              {(arr as any[]).map((t) => (
                <View key={t.tx_id} style={styles.row} testID={`tx-${t.tx_id}`}>
                  <View style={[styles.rowIcon, { backgroundColor: `${t.type === "income" ? colors.success : colors.error}22`, borderColor: `${t.type === "income" ? colors.success : colors.error}55` }]}>
                    <Icon name={iconFor(t) as any} size={20} color={t.type === "income" ? colors.success : colors.error} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{t.title}</Text>
                    <Text style={styles.rowSub}>{t.category}</Text>
                  </View>
                  <Text style={[styles.rowAmount, { color: t.type === "income" ? colors.success : colors.error }]}>
                    {t.type === "income" ? "+" : "-"}{idr(t.amount)}
                  </Text>
                  <Pressable
                    onPress={() => router.push({
                      pathname: "/(app)/add-transaction",
                      params: {
                        tx_id: t.tx_id, type: t.type, amount: String(t.amount),
                        category: t.category, title: t.title, note: t.note || "",
                        date: t.date, child_id: t.child_id || "",
                        link_type: t.link_type || "", link_id: t.link_id || "",
                      },
                    })}
                    style={styles.del}
                    testID={`edit-${t.tx_id}`}
                  >
                    <Icon name="pencil" size={16} color={colors.info} />
                  </Pressable>
                  <Pressable onPress={() => onDelete(t.tx_id)} style={styles.del} testID={`del-${t.tx_id}`}>
                    <Icon name="close" size={16} color={colors.error} />
                  </Pressable>
                </View>
              ))}
            </View>
          );
        }}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  title: { color: colors.onSurface, fontSize: 26, fontWeight: "800" },
  sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  fabInline: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  mini: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.border, gap: 4 },
  miniLabel: { color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  miniVal: { fontSize: 16, fontWeight: "800" },
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 8, height: 44 },
  monthBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  monthLabel: { color: colors.onSurface, fontSize: 14, fontWeight: "800" },
  dateHeader: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  rowIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  rowTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  rowSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  rowAmount: { fontSize: 14, fontWeight: "800" },
  del: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", marginLeft: 6 },
}));
