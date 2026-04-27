import { useMemo } from "react";
import { SECTORS } from "./data/sectors";
import { calculateSectorHeatScore, calculateSectorSentiment } from "./lib/logic";

/**
 * Scaffolding placeholder — Part 1 of the Sector News Radar.
 * The full Overview / Sector Detail / News Insight UI lands in Part 2.
 *
 * This screen confirms the dark-luxury theme, Tailwind setup, and that the
 * 29-sector metadata + investor-logic helpers compile and run end-to-end.
 */
export default function App() {
  const previews = useMemo(
    () =>
      SECTORS.map((s) => {
        // Empty news arrays for now — generator arrives in Part 2.
        const heat = calculateSectorHeatScore([]);
        const sentiment = calculateSectorSentiment([]);
        return { sector: s, heat, sentiment };
      }),
    []
  );

  return (
    <div className="grain min-h-screen bg-radial-faint">
      <header className="sticky top-0 z-20 border-b border-white/[0.05] bg-ink-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent-sky/30 to-accent-violet/20 ring-1 ring-white/10">
              <span className="font-display text-[14px] font-bold tracking-tight text-white">
                S
              </span>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-white">
                Sector News Radar
              </div>
              <div className="text-[10.5px] uppercase tracking-[0.18em] text-white/40">
                Investor Intelligence
              </div>
            </div>
          </div>
          <div className="chip">
            <span className="h-1.5 w-1.5 animate-pulseSoft rounded-full bg-emerald-400" />
            Scaffolding ready · Part 1
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-5 py-8">
        <div className="glass mb-6 px-5 py-4">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-white/40">
            Status
          </div>
          <div className="mt-1 text-sm text-white/80">
            29 sectors registered. Investor-logic helpers compiled. Mock news
            generator and full UI ship in Part 2.
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {previews.map(({ sector, heat, sentiment }) => (
            <div
              key={sector.id}
              className="glass group relative overflow-hidden p-4 transition hover:border-white/[0.12]"
            >
              <div
                className="pointer-events-none absolute inset-x-0 -top-px h-px"
                style={{
                  background: `linear-gradient(90deg, transparent, rgba(${sector.accentRgb},0.6), transparent)`,
                }}
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: sector.accent }}
                  />
                  <div className="text-sm font-semibold text-white">
                    {sector.shortName}
                  </div>
                </div>
                <div className="font-mono text-[11px] text-white/40">
                  {sector.id}
                </div>
              </div>
              <div className="mt-1 line-clamp-1 text-[11.5px] text-white/50">
                {sector.name}
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-white/55">
                <span>Heat: {heat}</span>
                <span>{sentiment.label}</span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
