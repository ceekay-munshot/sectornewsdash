import {
  Filter,
  Flame,
  Gauge,
  ListOrdered,
  Palette,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

/**
 * Compact transparency panel — explains the investor-logic helpers
 * powering the dashboard. Lives at the bottom so it doesn't compete
 * with the news; treat it as a signed methodology footnote.
 */
export function MethodologyPanel() {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-baseline justify-between px-1">
        <div>
          <div className="text-[10.5px] font-medium uppercase tracking-[0.2em] text-white/45">
            Methodology
          </div>
          <div className="mt-0.5 text-[12px] text-white/55">
            How the radar quantifies the market — every score is computed
            client-side from the news feed.
          </div>
        </div>
        <span className="hidden font-mono text-[10.5px] text-white/30 sm:block">
          src/lib/logic.ts
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Card
          icon={Flame}
          accent="#FB7185"
          title="Sector heat score"
          subtitle="0–100, capped"
          formula="weighted-avg(item-score) × 0.92 + log volume boost"
          inputs={[
            "Impact ×8",
            "Recency ×10",
            "Urgency ×6",
            "Confidence ×4",
            "Sentiment magnitude ×2",
          ]}
        />
        <Card
          icon={TrendingUp}
          accent="#5EEAD4"
          title="Sector sentiment"
          subtitle="Bullish · Neutral · Bearish"
          formula="Σ(sign × impact × (0.5 + 0.5·recency) × confidence)"
          inputs={[
            "Bullish = +1, Bearish = −1",
            "Mapped to label at ±12",
            "Range −100 to +100",
          ]}
        />
        <Card
          icon={ListOrdered}
          accent="#A78BFA"
          title="News ranking"
          subtitle="Highest material impact first"
          formula="impact×10 + urgency×6 + recency×5 + confidence×3 + |sentiment|×1.5"
          inputs={[
            "Recency decays in steps (1h → 7d)",
            "Critical urgency = ×1.0 weight",
            "Confidence in 0–100 scale",
          ]}
        />
        <Card
          icon={Gauge}
          accent="#FCD34D"
          title="Recency decay"
          subtitle="Time-weighted relevance"
          formula="step-function over published age"
          inputs={[
            "≤1h → 1.00",
            "≤6h → 0.92",
            "≤24h → 0.78",
            "≤72h → 0.55",
            "≤7d → 0.30",
            "older → 0.10",
          ]}
        />
        <Card
          icon={Filter}
          accent="#7DD3FC"
          title="Filter pipeline"
          subtitle="Composable, case-insensitive"
          formula="filterNews → rankNewsByImpact → buildSectorAggregates"
          inputs={[
            "Search across 7 fields",
            "Sector / sentiment / urgency",
            "Min impact threshold",
            "Source type · time horizon · theme",
          ]}
        />
        <Card
          icon={Palette}
          accent="#F0ABFC"
          title="Sector theming"
          subtitle="Identity per sector"
          formula="getSectorThemeColor(sectorId) → {hex, rgb}"
          inputs={[
            "29 unique accent palettes",
            "Drives icons, glows, heat-bar fills",
            "RGB tuple for runtime alpha math",
          ]}
        />
      </div>
    </section>
  );
}

function Card({
  icon: Icon,
  accent,
  title,
  subtitle,
  formula,
  inputs,
}: {
  icon: LucideIcon;
  accent: string;
  title: string;
  subtitle: string;
  formula: string;
  inputs: string[];
}) {
  return (
    <div className="glass relative overflow-hidden p-3.5">
      <div
        className="pointer-events-none absolute inset-x-0 -top-px h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}99, transparent)`,
        }}
      />
      <div className="flex items-center gap-2">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-white/10"
          style={{ background: `${accent}1A`, color: accent }}
        >
          <Icon size={13} />
        </div>
        <div className="leading-tight">
          <div className="text-[12.5px] font-semibold text-white">{title}</div>
          <div className="text-[10.5px] text-white/40">{subtitle}</div>
        </div>
      </div>

      <div
        className="mt-2.5 rounded-md border border-white/[0.05] bg-white/[0.018] px-2.5 py-1.5 font-mono text-[10.5px] leading-relaxed text-white/70"
        title={formula}
      >
        {formula}
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {inputs.map((i) => (
          <span
            key={i}
            className="inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.02] px-1.5 py-[2px] text-[10px] text-white/65"
          >
            {i}
          </span>
        ))}
      </div>
    </div>
  );
}
