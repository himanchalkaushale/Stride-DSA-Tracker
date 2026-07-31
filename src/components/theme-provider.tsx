"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";

export type ThemePreference = "system" | "dark" | "light";
export type ResolvedTheme = Exclude<ThemePreference, "system">;

type ThemeContextValue = {
  preference: ThemePreference;
  theme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
};

const STORAGE_KEY = "stride.theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);
const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "dark" || value === "light";
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [theme, setTheme] = useState<ResolvedTheme>("dark");

  useBrowserLayoutEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const nextPreference = isThemePreference(saved) ? saved : "system";
    const nextTheme = nextPreference === "system" ? systemTheme() : nextPreference;
    setPreferenceState(nextPreference);
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (preference !== "system") return;
      const nextTheme = media.matches ? "dark" : "light";
      setTheme(nextTheme);
      applyTheme(nextTheme);
    };
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [preference]);

  const setPreference = (nextPreference: ThemePreference) => {
    const nextTheme = nextPreference === "system" ? systemTheme() : nextPreference;
    localStorage.setItem(STORAGE_KEY, nextPreference);
    setPreferenceState(nextPreference);
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  const value = useMemo(
    () => ({ preference, theme, setPreference }),
    [preference, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}

export const themeBootstrapScript = `
(() => {
  try {
    const saved = localStorage.getItem("${STORAGE_KEY}");
    const preference = saved === "dark" || saved === "light" || saved === "system" ? saved : "system";
    const theme = preference === "system"
      ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : preference;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch {
    const theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }
})();
`;
