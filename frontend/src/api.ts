import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { getPrefs, RATES, CURRENCY_META } from "./store";

const KEY = "shf_token";

export async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    try { return typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null; } catch { return null; }
  }
  return (await SecureStore.getItemAsync(KEY)) ?? null;
}

export async function setToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    try { window.localStorage.setItem(KEY, token); } catch {}
    return;
  }
  await SecureStore.setItemAsync(KEY, token);
}

export async function clearToken(): Promise<void> {
  if (Platform.OS === "web") {
    try { window.localStorage.removeItem(KEY); } catch {}
    return;
  }
  await SecureStore.deleteItemAsync(KEY);
}

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

let memToken: string | null = null;
export function setMemToken(t: string | null) { memToken = t; }
export function getMemToken() { return memToken; }

export async function api<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = memToken ?? (await getToken());
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, { ...opts, headers });
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || `HTTP ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : "Request failed");
  }
  return data as T;
}

export const idr = (n: number) => {
  const cur = getPrefs().currency;
  const meta = CURRENCY_META[cur] || CURRENCY_META.IDR;
  const v = (n || 0) / (RATES[cur] || 1);
  if (cur === "IDR") return `Rp${Math.round(v).toLocaleString("id-ID")}`;
  return `${meta.symbol}${v.toLocaleString(meta.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
