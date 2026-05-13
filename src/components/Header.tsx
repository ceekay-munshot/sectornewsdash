import { useEffect, useState } from "react";
import {
  Activity,
  BookOpen,
  Briefcase,
  LayoutDashboard,
  Moon,
  Radar,
  Sparkles,
} from "lucide-react";
import { SyncAllButton } from "./SyncAllButton";
import { classNames } from "../lib/utils";
import type { Theme } from "../App";

export type TopTab = "dashboard" | "logic" | "portfolio";

interface Props {
  syncRunning: boolean;
  syncDone: number;
  syncTotal: number;
  syncCompleted: boolean;
  syncStartedAt: Date | null;
  lastSyncAt: Date | null;
  onSync: () => void;
  activeTab: TopTab;
  onChangeTab: (tab: TopTab) => void;
  theme: Theme;
  onToggleTheme: () => void;
}

export function Header({
  syncRunning,
  syncDone,
  syncTotal,
  syncCompleted,
  syncStartedAt,
  lastSyncAt,
  onSync,
  activeTab,
  onChangeTab,
  theme,
  onToggleTheme,
}: Props) {
  const [now, setNow] = useState<string>(() => fmt(new Date()));
  useEffect(() => {
    const t = setInterval(() => setNow(fmt(new Date())), 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.05] bg-ink-950/75 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1760px] items-center justify-between px-4 py-2 2xl:px-6">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-accent-sky/30 via-accent-violet/20 to-accent-mint/20 ring-1 ring-white/10">
            <Radar size={16} className="text-white" />
            <span className="pointer-events-none absolute inset-0 animate-pulseSoft rounded-lg bg-accent-sky/10" />
          </div>
          <div className="flex flex-col leading-tight">
            <div className="font-display text-[14px] font-semibold tracking-tight text-white">
              Sector News Radar
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">
              Markets · Sentiment · Impact
            </div>
          </div>

          <nav
            role="tablist"
            aria-label="Primary view"
            className="ml-2 flex items-center gap-0.5 rounded-lg border border-white/[0.07] bg-white/[0.02] p-0.5"
          >
            <TabButton
              active={activeTab === "dashboard"}
              onClick={() => onChangeTab("dashboard")}
              icon={<LayoutDashboard size={12} />}
              label="Dashboard"
            />
            <TabButton
              active={activeTab === "logic"}
              onClick={() => onChangeTab("logic")}
              icon={<BookOpen size={12} />}
              label="Logic"
            />
            <TabButton
              active={activeTab === "portfolio"}
              onClick={() => onChangeTab("portfolio")}
              icon={<Briefcase size={12} />}
              label="My portfolio"
            />
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <SyncAllButton
            running={syncRunning}
            done={syncDone}
            total={syncTotal}
            completed={syncCompleted}
            startedAt={syncStartedAt}
            lastSyncAt={lastSyncAt}
            onSync={onSync}
          />
          <div className="chip">
            <Activity size={12} className="text-emerald-400" />
            <span className="hidden sm:inline">Live · {now}</span>
            <span className="sm:hidden">Live</span>
          </div>
        </div>
      </div>
    </header>
  );
}

function fmt(d: Date) {
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={classNames(
        "focus-ring inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-medium transition",
        active
          ? "bg-white/[0.09] text-white shadow-glow"
          : "text-white/55 hover:bg-white/[0.04] hover:text-white/90"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: Theme;
  onToggle: () => void;
}) {
  const isAurora = theme === "aurora";
  const next = isAurora ? "dark" : "aurora";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={classNames(
        "focus-ring relative inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg border transition",
        isAurora
          ? "border-fuchsia-300/40 bg-gradient-to-br from-fuchsia-400/25 via-violet-400/20 to-cyan-300/20 text-white shadow-[0_0_16px_-2px_rgba(217,70,239,0.55)]"
          : "border-white/[0.08] bg-white/[0.025] text-white/70 hover:border-white/[0.18] hover:text-white"
      )}
    >
      {isAurora ? <Sparkles size={13} /> : <Moon size={13} />}
    </button>
  );
}
