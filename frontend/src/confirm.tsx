import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { View, Text, Pressable, Modal } from "react-native";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Opts = {
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ConfirmFn = (opts?: Opts) => Promise<boolean>;

const ConfirmCtx = createContext<ConfirmFn>(async () => false);

export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [state, setState] = useState<{ open: boolean; opts: Opts }>({ open: false, opts: {} });
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts = {}) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setState({ open: true, opts });
    });
  }, []);

  const close = (value: boolean) => {
    setState((s) => ({ ...s, open: false }));
    resolver.current?.(value);
    resolver.current = null;
  };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal visible={state.open} transparent animationType="fade" onRequestClose={() => close(false)}>
        <Pressable style={styles.bg} onPress={() => close(false)}>
          <Pressable style={styles.card} testID="confirm-dialog" onPress={() => {}}>
            <View style={[styles.iconWrap, { backgroundColor: `${state.opts.danger ? colors.error : colors.brandPrimary}22` }]}>
              <Text style={{ fontSize: 22 }}>{state.opts.danger ? "🗑️" : "❓"}</Text>
            </View>
            <Text style={styles.title}>{state.opts.title ?? "Konfirmasi Hapus"}</Text>
            <Text style={styles.msg}>{state.opts.message ?? "Apakah Anda yakin ingin menghapus data ini? Tindakan ini tidak dapat dibatalkan."}</Text>
            <View style={styles.row}>
              <Pressable style={[styles.btn, styles.cancel]} onPress={() => close(false)} testID="confirm-cancel">
                <Text style={styles.cancelText}>{state.opts.cancelLabel ?? "Batal"}</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, { backgroundColor: state.opts.danger ? colors.error : colors.brandPrimary }]}
                onPress={() => close(true)}
                testID="confirm-ok"
              >
                <Text style={styles.okText}>{state.opts.confirmLabel ?? "Hapus"}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ConfirmCtx.Provider>
  );
}

const useStyles = makeStyles((colors) => ({
  bg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  card: { width: "100%", maxWidth: 360, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, alignItems: "center", gap: spacing.sm },
  iconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  title: { color: colors.onSurface, fontSize: 18, fontWeight: "800", textAlign: "center" },
  msg: { color: colors.muted, fontSize: 13, textAlign: "center", lineHeight: 19 },
  row: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, alignSelf: "stretch" },
  btn: { flex: 1, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  cancel: { backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  cancelText: { color: colors.onSurface, fontSize: 15, fontWeight: "700" },
  okText: { color: colors.onBrandPrimary, fontSize: 15, fontWeight: "800" },
}));
