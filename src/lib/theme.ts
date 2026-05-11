import { useEffect, useState } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "snr-theme";

function readStored(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark") return raw;
  } catch {
    // storage may be disabled — fall through
  }
  return "dark";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("light", theme === "light");
}

// Apply on module load to avoid a flash of dark mode on subsequent paints.
// (The inline script in index.html handles the very first paint.)
if (typeof window !== "undefined") {
  applyTheme(readStored());
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(() => readStored());

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const toggle = () =>
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  return { theme, toggle };
}
