// Global preferences store (no React deps) so plain helpers like t() / idr()
// can read current values, and useTheme() can subscribe for reactive re-render.
export type Scheme = "light" | "dark";
export type Lang = "id" | "en";
export type Currency = "IDR" | "USD" | "SGD" | "EUR" | "MYR";
export type ThemeMode = "light" | "dark" | "system";
export type TextSize = "small" | "medium" | "large";
export type Density = "compact" | "normal" | "comfortable";
export type DashboardMode = "ringkas" | "lengkap";
export type BackupFreq = "harian" | "mingguan" | "bulanan";

export type PrefsState = {
  scheme: Scheme;
  themeMode: ThemeMode;
  lang: Lang;
  currency: Currency;
  nickname: string;
  username: string;
  dateFormat: "long" | "dmy" | "ymd";
  dashboardMode: DashboardMode;
  animations: boolean;
  textSize: TextSize;
  density: Density;
  autoLockMin: number; // 0 = off
  biometric: boolean;
  lockOnMinimize: boolean;
  pin: string | null;
  autoBackup: boolean;
  backupFrequency: BackupFreq;
};

let state: PrefsState = {
  scheme: "dark",
  themeMode: "dark",
  lang: "id",
  currency: "IDR",
  nickname: "",
  username: "",
  dateFormat: "long",
  dashboardMode: "ringkas",
  animations: true,
  textSize: "medium",
  density: "normal",
  autoLockMin: 0,
  biometric: false,
  lockOnMinimize: false,
  pin: null,
  autoBackup: false,
  backupFrequency: "mingguan",
};
let version = 0;
const listeners = new Set<() => void>();

export function getPrefs(): PrefsState {
  return state;
}

export function getVersion(): number {
  return version;
}

export function setPrefs(patch: Partial<PrefsState>) {
  state = { ...state, ...patch };
  version += 1;
  listeners.forEach((l) => l());
}

export function subscribePrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const USD_RATE = 16000; // 1 USD = Rp16.000

// IDR per 1 unit of currency (no live FX; fixed display rates)
export const RATES: Record<Currency, number> = { IDR: 1, USD: 16000, SGD: 12000, EUR: 17500, MYR: 3500 };
export const CURRENCY_META: Record<Currency, { symbol: string; locale: string; name: string; flag: string; decimals: number }> = {
  IDR: { symbol: "Rp", locale: "id-ID", name: "Rupiah (IDR)", flag: "🇮🇩", decimals: 0 },
  USD: { symbol: "$", locale: "en-US", name: "US Dollar (USD)", flag: "🇺🇸", decimals: 2 },
  SGD: { symbol: "S$", locale: "en-SG", name: "Singapore Dollar (SGD)", flag: "🇸🇬", decimals: 2 },
  EUR: { symbol: "€", locale: "de-DE", name: "Euro (EUR)", flag: "🇪🇺", decimals: 2 },
  MYR: { symbol: "RM", locale: "ms-MY", name: "Ringgit Malaysia (MYR)", flag: "🇲🇾", decimals: 2 },
};
