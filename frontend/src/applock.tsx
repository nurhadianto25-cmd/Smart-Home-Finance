import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, AppState, AppStateStatus } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as LocalAuthentication from "expo-local-authentication";
import Icon from "@react-native-vector-icons/material-design-icons";
import { makeStyles, useTheme } from "@/src/theme";
import { getPrefs, getVersion, subscribePrefs } from "@/src/store";
import { useSyncExternalStore } from "react";

export function AppLockGate() {
  useSyncExternalStore(subscribePrefs, getVersion, getVersion);
  const p = getPrefs();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const [locked, setLocked] = useState(false);
  const [entry, setEntry] = useState("");
  const [err, setErr] = useState(false);
  const bgAt = useRef<number | null>(null);

  const enabled = !!p.pin;

  // cold start: lock if a pin is configured
  useEffect(() => {
    if (p.pin && (p.autoLockMin > 0 || p.lockOnMinimize)) setLocked(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onChange = (s: AppStateStatus) => {
      const cur = getPrefs();
      if (!cur.pin) return;
      if (s === "background" || s === "inactive") {
        bgAt.current = Date.now();
        if (cur.lockOnMinimize) setLocked(true);
      } else if (s === "active") {
        if (cur.autoLockMin > 0 && bgAt.current && Date.now() - bgAt.current >= cur.autoLockMin * 60000) setLocked(true);
        bgAt.current = null;
      }
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, []);

  const tryBiometric = useCallback(async () => {
    try {
      const has = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!has || !enrolled) return;
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: "Buka Smart Home Finance", fallbackLabel: "Gunakan PIN" });
      if (r.success) { setLocked(false); setEntry(""); }
    } catch {}
  }, []);

  useEffect(() => { if (locked && p.biometric) tryBiometric(); }, [locked, p.biometric, tryBiometric]);

  const press = (d: string) => {
    if (entry.length >= 4) return;
    const next = entry + d;
    setEntry(next); setErr(false);
    if (next.length === 4) {
      setTimeout(() => {
        if (next === getPrefs().pin) { setLocked(false); setEntry(""); }
        else { setErr(true); setEntry(""); }
      }, 120);
    }
  };

  if (!enabled || !locked) return null;

  return (
    <View style={[styles.overlay, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]} testID="app-lock-overlay">
      <View style={styles.lockIcon}><Icon name="lock" size={34} color={colors.onBrandPrimary} /></View>
      <Text style={styles.title}>Aplikasi Terkunci</Text>
      <Text style={styles.sub}>Masukkan PIN untuk membuka</Text>
      <View style={styles.dots}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i < entry.length ? colors.brandPrimary : "transparent", borderColor: err ? colors.error : colors.border }]} />
        ))}
      </View>
      {err ? <Text style={styles.err}>PIN salah, coba lagi</Text> : <View style={{ height: 18 }} />}
      <View style={styles.pad}>
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Pressable key={d} testID={`lock-key-${d}`} onPress={() => press(d)} style={styles.key}><Text style={styles.keyText}>{d}</Text></Pressable>
        ))}
        <Pressable onPress={tryBiometric} style={styles.key} testID="lock-biometric"><Icon name="fingerprint" size={26} color={p.biometric ? colors.brandPrimary : colors.muted} /></Pressable>
        <Pressable onPress={() => press("0")} testID="lock-key-0" style={styles.key}><Text style={styles.keyText}>0</Text></Pressable>
        <Pressable onPress={() => setEntry((e) => e.slice(0, -1))} testID="lock-backspace" style={styles.key}><Icon name="backspace-outline" size={24} color={colors.onSurface} /></Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, alignItems: "center", zIndex: 9999 },
  lockIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  title: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
  sub: { color: colors.muted, fontSize: 13, marginTop: 4 },
  dots: { flexDirection: "row", gap: 16, marginTop: 28 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  err: { color: colors.error, fontSize: 12, marginTop: 10, height: 18 },
  pad: { flexDirection: "row", flexWrap: "wrap", width: 260, justifyContent: "space-between", marginTop: 20, rowGap: 16 },
  key: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  keyText: { color: colors.onSurface, fontSize: 26, fontWeight: "700" },
}));
