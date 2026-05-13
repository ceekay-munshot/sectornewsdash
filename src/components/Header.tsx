import { useEffect, useState } from "react";
import { Activity, BookOpen, LayoutDashboard, Radar } from "lucide-react";
import { SyncAllButton } from "./SyncAllButton";
import { classNames } from "../lib/utils";

export type TopTab = "dashboard" | "logic";

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
          </nav>
        </div>

        <div className="flex items-center gap-2">
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
