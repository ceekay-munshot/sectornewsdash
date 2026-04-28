import { useEffect, useState } from "react";
import { Activity, Radar } from "lucide-react";

interface Props {
  totalNews: number;
  sectorsTracked: number;
}

export function Header({ totalNews, sectorsTracked }: Props) {
  const [now, setNow] = useState<string>(() => fmt(new Date()));
  useEffect(() => {
    const t = setInterval(() => setNow(fmt(new Date())), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.05] bg-ink-950/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-accent-sky/30 via-accent-violet/20 to-accent-mint/20 ring-1 ring-white/10">
            <Radar size={18} className="text-white" />
            <span className="pointer-events-none absolute inset-0 animate-pulseSoft rounded-lg bg-accent-sky/10" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-[14.5px] font-semibold tracking-tight text-white">
              Sector News Radar
            </div>
            <div className="text-[10.5px] uppercase tracking-[0.2em] text-white/40">
              Investor Intelligence
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-3 rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[11px] text-white/60 sm:flex">
            <span className="font-mono">{totalNews}</span>
            <span className="text-white/30">items</span>
            <span className="h-3 w-px bg-white/10" />
            <span className="font-mono">{sectorsTracked}</span>
            <span className="text-white/30">sectors</span>
          </div>
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
    second: "2-digit",
    hour12: false,
  });
}
