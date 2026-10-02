// Design tokens for Smart Home Finance. Supports dark + light.
import { useMemo, useSyncExternalStore } from "react";
import { StyleSheet } from "react-native";
import { getPrefs, getVersion, subscribePrefs } from "./store";

export type ColorScheme = "light" | "dark";

const dark = {
  surface: "#0A0E1A",
  onSurface: "#FFFFFF",
  surfaceSecondary: "#12182B",
  onSurfaceSecondary: "#FFFFFF",
  surfaceTertiary: "#1C243B",
  onSurfaceTertiary: "#FFFFFF",
  surfaceInverse: "#FFFFFF",
  onSurfaceInverse: "#0A0E1A",
  muted: "#8B9DA5",

  brand: "#9B6BFF",
  onBrand: "#FFFFFF",
  brandPrimary: "#9B6BFF",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#3D7EFF",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#FF9D3D",
  onBrandTertiary: "#0A0E1A",

  success: "#10D96A",
  onSuccess: "#0A0E1A",
  warning: "#FF9D3D",
  onWarning: "#0A0E1A",
  error: "#FF4757",
  onError: "#FFFFFF",
  info: "#3D7EFF",
  onInfo: "#FFFFFF",

  border: "#2A3441",
  borderStrong: "#3D7EFF",
  divider: "#1C243B",
};

export type ThemeColors = typeof dark;

const light: ThemeColors = {
  surface: "#F4F6FB",
  onSurface: "#0B1220",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#0B1220",
  surfaceTertiary: "#EAEEF6",
  onSurfaceTertiary: "#0B1220",
  surfaceInverse: "#0A0E1A",
  onSurfaceInverse: "#FFFFFF",
  muted: "#64748B",

  brand: "#7C4DFF",
  onBrand: "#FFFFFF",
  brandPrimary: "#7C4DFF",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#2563EB",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#F97316",
  onBrandTertiary: "#FFFFFF",

  success: "#059669",
  onSuccess: "#FFFFFF",
  warning: "#D97706",
  onWarning: "#FFFFFF",
  error: "#DC2626",
  onError: "#FFFFFF",
  info: "#2563EB",
  onInfo: "#FFFFFF",

  border: "#D8DEEA",
  borderStrong: "#2563EB",
  divider: "#E6EAF2",
};

export const defaultScheme: ColorScheme = "dark";

export const themes: { light: ThemeColors; dark: ThemeColors } = { dark, light };

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  useSyncExternalStore(subscribePrefs, getVersion, getVersion);
  const scheme: ColorScheme = getPrefs().scheme === "light" ? "light" : "dark";
  return { scheme, colors: themes[scheme] };
}

// Static default (dark) — used only for module-level accent constants, never for
// reactive surfaces/text. Reactive styling goes through useTheme()/makeStyles().
export const colors = themes.dark;

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };

