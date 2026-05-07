import { useEffect, useState } from "react";
import { Radar } from "lucide-react";
import { SyncAllButton } from "./SyncAllButton";

interface Props {
  syncRunning: boolean;
  syncDone: number;
  syncTotal: number;
  syncCompleted: boolean;
  onSync: () => void;
}

export function Header({
  syncRunning,
  syncDone,
  syncTotal,
  syncCompleted,
  onSync,
}: Props) {
  const [now, setNow] = useState<string>(() => fmt(new Date()));
  useEffect(() => {
    const t = setInterval(() => setNow(fmt(new Date())), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.05] bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-accent-sky/25 via-accent-violet/15 to-accent-mint/20 ring-1 ring-white/10">
            <Radar size={15} className="text-white/95" strokeWidth={1.75} />
          </div>
          <div className="leading-tight">
            <div className="font-display text-[14px] font-semibold tracking-tightish text-white">
              Sector News Radar
            </div>
            <div className="text-[9.5px] font-medium uppercase tracking-[0.22em] text-white/40">
              Investor Intelligence
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <SyncAllButton
            running={syncRunning}
            done={syncDone}
            total={syncTotal}
            completed={syncCompleted}
            onSync={onSync}
          />
          <div className="flex h-[28px] items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 text-[11px] text-white/70">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 animate-pulseSoft rounded-full bg-emerald-400/60" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            <span className="hidden font-mono num text-white/80 sm:inline">
              {now}
            </span>
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
    second: "2-digit",
    hour12: false,
  });
}
