import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { api, clearToken, getToken, setMemToken, setToken } from "./api";

WebBrowser.maybeCompleteAuthSession();

type User = { user_id: string; email: string; name: string; picture?: string | null; whatsapp?: string | null };
type Ctx = {
  user: User | null;
  loading: boolean;
  loginEmail: (email: string, password: string) => Promise<void>;
  registerEmail: (name: string, email: string, password: string) => Promise<void>;
  loginGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  updateProfile: (patch: { name?: string; whatsapp?: string; picture?: string }) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, otp: string, newPassword: string) => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);
export const useAuth = () => {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};

const processedIds = new Set<string>();

async function exchangeSession(session_id: string) {
  if (processedIds.has(session_id)) return null;
  processedIds.add(session_id);
  const data = await api<{ token: string; user: User }>("/auth/session", {
    method: "POST",
    body: JSON.stringify({ session_id }),
  });
  return data;
}

function extractSessionId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const finalize = useCallback(async (token: string, u: User) => {
    await setToken(token);
    setMemToken(token);
    setUser(u);
  }, []);

  useEffect(() => {
    let mounted = true;
    let sub: any;
    (async () => {
      try {
        // web: check URL for session_id first
        if (Platform.OS === "web" && typeof window !== "undefined") {
          const url = window.location.href;
          const sid = extractSessionId(url);
          if (sid) {
            const r = await exchangeSession(sid);
            if (r && mounted) {
              await finalize(r.token, r.user);
              try {
                const u = new URL(window.location.href);
                u.hash = "";
                u.searchParams.delete("session_id");
                window.history.replaceState(window.history.state, "", u.toString());
              } catch {}
              setLoading(false);
              return;
            }
          }
        }
        // mobile: check initial URL
        if (Platform.OS !== "web") {
          const initial = await Linking.getInitialURL();
          const sid = extractSessionId(initial);
          if (sid) {
            const r = await exchangeSession(sid);
            if (r && mounted) {
              await finalize(r.token, r.user);
              setLoading(false);
              return;
            }
          }
        }
        // existing token
        const t = await getToken();
        if (t) {
          setMemToken(t);
          try {
            const me = await api<User>("/auth/me");
            if (mounted) setUser(me);
          } catch {
            await clearToken();
            setMemToken(null);
            if (mounted) setUser(null);
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    if (Platform.OS !== "web") {
      sub = Linking.addEventListener("url", async ({ url }) => {
        const sid = extractSessionId(url);
        if (sid) {
          try {
            const r = await exchangeSession(sid);
            if (r) await finalize(r.token, r.user);
          } catch {}
        }
      });
    }
    return () => { mounted = false; sub?.remove?.(); };
  }, [finalize]);

  const loginEmail = useCallback(async (email: string, password: string) => {
    const r = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST", body: JSON.stringify({ email, password }),
    });
    await finalize(r.token, r.user);
  }, [finalize]);

  const registerEmail = useCallback(async (name: string, email: string, password: string) => {
    const r = await api<{ token: string; user: User }>("/auth/register", {
      method: "POST", body: JSON.stringify({ name, email, password }),
    });
    await finalize(r.token, r.user);
  }, [finalize]);

  const loginGoogle = useCallback(async () => {
    const redirectUrl = Platform.OS === "web" && typeof window !== "undefined"
      ? window.location.origin + "/"
      : Linking.createURL("");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    if (Platform.OS === "web") {
      window.location.href = authUrl;
      return;
    }
    let captured: string | null = null;
    const listener = Linking.addEventListener("url", ({ url }) => { captured = url; });
    try {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      let cb = (result as any)?.url as string | undefined;
      if (!cb) cb = captured ?? undefined;
      if (!cb) cb = (await Linking.getInitialURL()) ?? undefined;
      const sid = extractSessionId(cb ?? null);
      if (sid) {
        const r = await exchangeSession(sid);
        if (r) await finalize(r.token, r.user);
      }
    } finally {
      listener.remove();
    }
  }, [finalize]);

  const logout = useCallback(async () => {
    try { await api("/auth/logout", { method: "POST" }); } catch {}
    await clearToken();
    setMemToken(null);
    setUser(null);
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const me = await api<User>("/auth/me");
      setUser(me);
    } catch {}
  }, []);

  const updateProfile = useCallback(async (patch: { name?: string; whatsapp?: string; picture?: string }) => {
    const me = await api<User>("/auth/me", { method: "PATCH", body: JSON.stringify(patch) });
    setUser(me);
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    await api("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
  }, []);

  const resetPassword = useCallback(async (email: string, otp: string, newPassword: string) => {
    const r = await api<{ token: string; user: User }>("/auth/reset-password", {
      method: "POST", body: JSON.stringify({ email, otp, new_password: newPassword }),
    });
    await finalize(r.token, r.user);
  }, [finalize]);

  return (
    <AuthCtx.Provider value={{ user, loading, loginEmail, registerEmail, loginGoogle, logout, refreshMe, updateProfile, forgotPassword, resetPassword }}>
      {children}
    </AuthCtx.Provider>
  );
}
