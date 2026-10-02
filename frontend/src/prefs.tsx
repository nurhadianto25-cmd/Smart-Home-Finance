import React, { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { storage } from "@/src/utils/storage";
import {
  Currency,
  Lang,
  Scheme,
  getPrefs,
  getVersion,
  setPrefs,
  subscribePrefs,
} from "@/src/store";
import { t as translate } from "@/src/i18n";
import { idr } from "@/src/api";

const KEY = "shf_prefs";

type Ctx = {
  scheme: Scheme;
  lang: Lang;
  currency: Currency;
  setScheme: (s: Scheme) => void;
  setLang: (l: Lang) => void;
  setCurrency: (c: Currency) => void;
  t: (key: string) => string;
  fmt: (n: number) => string;
};

const PrefsCtx = createContext<Ctx | null>(null);

export function usePrefs(): Ctx {
  const ctx = useContext(PrefsCtx);
  if (!ctx) throw new Error("usePrefs must be used inside PrefsProvider");
  return ctx;
}

function persist() {
  const p = getPrefs();
  storage.setItem(KEY, { scheme: p.scheme, lang: p.lang, currency: p.currency });
}

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  // subscribe so provider (and all consumers) re-render on any pref change
  useSyncExternalStore(subscribePrefs, getVersion, getVersion);

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<any>(KEY, null);
      if (saved && typeof saved === "object") {
        setPrefs({
          scheme: saved.scheme === "light" ? "light" : "dark",
          lang: saved.lang === "en" ? "en" : "id",
          currency: saved.currency === "USD" ? "USD" : "IDR",
        });
      }
    })();
  }, []);

  const p = getPrefs();

  const value: Ctx = {
    scheme: p.scheme,
    lang: p.lang,
    currency: p.currency,
    setScheme: (s) => { setPrefs({ scheme: s }); persist(); },
    setLang: (l) => { setPrefs({ lang: l }); persist(); },
    setCurrency: (c) => { setPrefs({ currency: c }); persist(); },
    t: translate,
    fmt: idr,
  };

  return <PrefsCtx.Provider value={value}>{children}</PrefsCtx.Provider>;
}
