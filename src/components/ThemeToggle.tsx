import { Moon, Sun } from "lucide-react";
import { useTheme } from "../lib/theme";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.07] bg-white/[0.025] text-white/75 transition hover:border-white/[0.14] hover:text-white"
    >
      {isDark ? <Sun size={13} /> : <Moon size={13} />}
    </button>
  );
}
