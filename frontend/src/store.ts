// Global preferences store (no React deps) so plain helpers like t() / idr()
// can read current values, and useTheme() can subscribe for reactive re-render.
export type Scheme = "light" | "dark";
export type Lang = "id" | "en";
export type Currency = "IDR" | "USD";

export type PrefsState = { scheme: Scheme; lang: Lang; currency: Currency };

let state: PrefsState = { scheme: "dark", lang: "id", currency: "IDR" };
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
