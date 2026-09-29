// Design tokens for Smart Home Finance. Dark-first neon aesthetic.
import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

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

export const defaultScheme: ColorScheme = "dark";

export const themes: { light?: ThemeColors; dark: ThemeColors } = { dark };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && (themes as any)[system] ? system : defaultScheme;
  return { scheme, colors: (themes as any)[scheme] ?? themes.dark };
}

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
