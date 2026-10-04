import React, { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { Appearance } from "react-native";
import { storage } from "@/src/utils/storage";
import {
  Currency,
  Lang,
  PrefsState,
  Scheme,
  ThemeMode,
  getPrefs,
  getVersion,
  setPrefs,
  subscribePrefs,
} from "@/src/store";
import { t as translate } from "@/src/i18n";
import { idr } from "@/src/api";

const KEY = "shf_prefs";

const PERSIST_KEYS: (keyof PrefsState)[] = [
  "themeMode", "lang", "currency", "nickname", "username", "dateFormat",
  "dashboardMode", "animations", "textSize", "density", "autoLockMin",
  "biometric", "lockOnMinimize", "pin", "autoBackup", "backupFrequency",
];

type Ctx = PrefsState & {
  setScheme: (s: Scheme) => void;
  setThemeMode: (m: ThemeMode) => void;
  setLang: (l: Lang) => void;
  setCurrency: (c: Currency) => void;
  set: (patch: Partial<PrefsState>) => void;
  t: (key: string) => string;
  fmt: (n: number) => string;
};

const PrefsCtx = createContext<Ctx | null>(null);

export function usePrefs(): Ctx {
  const ctx = useContext(PrefsCtx);
  if (!ctx) throw new Error("usePrefs must be used inside PrefsProvider");
  return ctx;
}

function resolveScheme(mode: ThemeMode): Scheme {
  if (mode === "system") return Appearance.getColorScheme() === "light" ? "light" : "dark";
  return mode;
}

function persist() {
  const p = getPrefs();
  const out: any = {};
  for (const k of PERSIST_KEYS) out[k] = (p as any)[k];
  storage.setItem(KEY, out);
}

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  useSyncExternalStore(subscribePrefs, getVersion, getVersion);

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<any>(KEY, null);
      if (saved && typeof saved === "object") {
        const mode: ThemeMode = saved.themeMode === "light" || saved.themeMode === "system" ? saved.themeMode : "dark";
        setPrefs({
          themeMode: mode,
          scheme: resolveScheme(mode),
          lang: saved.lang === "en" ? "en" : "id",
          currency: ["IDR", "USD", "SGD", "EUR", "MYR"].includes(saved.currency) ? saved.currency : "IDR",
          nickname: saved.nickname ?? "",
          username: saved.username ?? "",
          dateFormat: saved.dateFormat ?? "long",
          dashboardMode: saved.dashboardMode === "lengkap" ? "lengkap" : "ringkas",
          animations: saved.animations !== false,
          textSize: saved.textSize ?? "medium",
          density: saved.density ?? "normal",
          autoLockMin: typeof saved.autoLockMin === "number" ? saved.autoLockMin : 0,
          biometric: !!saved.biometric,
          lockOnMinimize: !!saved.lockOnMinimize,
          pin: saved.pin ?? null,
          autoBackup: !!saved.autoBackup,
          backupFrequency: saved.backupFrequency ?? "mingguan",
        });
      }
    })();
    const sub = Appearance.addChangeListener(() => {
      if (getPrefs().themeMode === "system") setPrefs({ scheme: resolveScheme("system") });
    });
    return () => sub.remove();
  }, []);

  const p = getPrefs();

  const value: Ctx = {
    ...p,
    setScheme: (s) => { setPrefs({ scheme: s, themeMode: s }); persist(); },
    setThemeMode: (m) => { setPrefs({ themeMode: m, scheme: resolveScheme(m) }); persist(); },
    setLang: (l) => { setPrefs({ lang: l }); persist(); },
    setCurrency: (c) => { setPrefs({ currency: c }); persist(); },
    set: (patch) => { setPrefs(patch); persist(); },
    t: translate,
    fmt: idr,
  };

  return <PrefsCtx.Provider value={value}>{children}</PrefsCtx.Provider>;
}
