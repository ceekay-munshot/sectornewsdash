import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Briefcase,
  Edit3,
  Layers,
  Newspaper,
  Plus,
  TrendingUp,
  Trash2,
} from "lucide-react";
import type { NewsItem, SectorAggregate } from "../types";
import { rankNewsByImpact } from "../lib/logic";
import {
  buildPortfolioSummary,
  loadPortfolio,
  savePortfolio,
  type PortfolioBreakdownRow,
  type PortfolioHolding,
  type PortfolioSummary,
} from "../lib/portfolio";
import { SECTOR_ICONS } from "../lib/icons";
import { classNames, heatToColor } from "../lib/utils";
import { NewsFeed } from "./NewsFeed";
import { PortfolioEditModal } from "./PortfolioEditModal";

interface Props {
  livePool: NewsItem[];
  aggregates: SectorAggregate[];
  onSelectNews: (n: NewsItem) => void;
}

export function PortfolioTab({ livePool, aggregates, onSelectNews }: Props) {
  const [holdings, setHoldings] = useState<PortfolioHolding[]>(loadPortfolio);
  const [editOpen, setEditOpen] = useState(false);

  const handleSave = (next: PortfolioHolding[]) => {
    setHoldings(next);
    savePortfolio(next);
  };

  const sectorHeatById = useMemo(() => {
    const m = new Map<string, { heat: number; newsCount: number }>();
    for (const a of aggregates) {
      m.set(a.sector.id, { heat: a.heatScore, newsCount: a.newsCount });
    }
    return m;
  }, [aggregates]);

  const summary = useMemo<PortfolioSummary>(
    () => buildPortfolioSummary(holdings, livePool, sectorHeatById),
    [holdings, livePool, sectorHeatById]
  );

  const rankedMatchedNews = useMemo(
    () => rankNewsByImpact(summary.matchedNews),
    [summary.matchedNews]
  );

  if (holdings.length === 0) {
    return (
      <>
        <EmptyState onSetup={() => setEditOpen(true)} />
        <PortfolioEditModal
          open={editOpen}
          initial={holdings}
          onClose={() => setEditOpen(false)}
          onSave={handleSave}
        />
      </>
    );
  }

  return (
    <div className="animate-floatIn space-y-3">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
          <Briefcase size={12} className="text-white/60" />
          <span>
            My portfolio{" "}
            <span className="ml-1 text-white/70">{holdings.length}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="btn-ghost"
          >
            <Edit3 size={11} />
            Edit holdings
          </button>
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm("Clear your saved portfolio? This can't be undone.")
              ) {
                handleSave([]);
              }
            }}
            className="btn-ghost"
            title="Clear portfolio"
          >
            <Trash2 size={11} />
            Clear
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <KPIStrip summary={summary} />

      {/* Middle row — donut + concentration */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <SectorDonut summary={summary} />
        <ConcentrationCard summary={summary} aggregates={aggregates} />
      </div>

      {/* Filtered news feed */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 px-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
          <Newspaper size={12} className="text-white/60" />
          <span>
            Headlines touching your portfolio{" "}
            <span className="ml-1 text-white/70">
              {summary.headlineCount}
            </span>
          </span>
        </div>
        <NewsFeed
          items={rankedMatchedNews}
          limit={30}
          onSelect={onSelectNews}
          emptyTitle="Nothing on your portfolio today"
          emptyHint="No headlines under the current scope name any of your holdings."
        />
      </div>

      <PortfolioEditModal
        open={editOpen}
        initial={holdings}
        onClose={() => setEditOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}

// ---- empty state ---------------------------------------------------------

function EmptyState({ onSetup }: { onSetup: () => void }) {
  return (
    <div className="animate-floatIn glass mx-auto max-w-[640px] p-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-mint/25 via-accent-sky/20 to-accent-violet/20 ring-1 ring-white/10">
        <Briefcase size={22} className="text-white" />
      </div>
      <div className="mt-4 font-display text-[18px] font-semibold text-white">
        Set up your portfolio
      </div>
      <div className="mx-auto mt-1.5 max-w-[460px] text-[12.5px] leading-relaxed text-white/65">
        Paste a CSV of your holdings or pick from each sector's top names.
        We'll surface only the news that touches your stocks, compute the
        weighted heat of your book, and flag concentration risks. Stored
        locally in your browser — nothing leaves your machine.
      </div>
      <button
        type="button"
        onClick={onSetup}
        className="btn-primary mt-4 inline-flex"
      >
        <Plus size={11} />
        Set up portfolio
      </button>
    </div>
  );
}

// ---- KPI strip -----------------------------------------------------------

function KPIStrip({ summary }: { summary: PortfolioSummary }) {
  const { hex: heatHex } = heatToColor(summary.weightedHeat);
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
      <KpiTile
        label="Portfolio heat"
        value={summary.weightedHeat}
        accent={heatHex}
        valueColor={heatHex}
        icon={<TrendingUp size={12} />}
        sublabel={
          summary.hasValueData
            ? "position-weighted"
            : summary.holdings.some((h) => h.quantity && h.avgPrice)
              ? "partly weighted"
              : "equal-weighted"
        }
      />
      <KpiTile
        label="Holdings"
        value={summary.holdings.length}
        accent="#5EEAD4"
        icon={<Layers size={12} />}
        sublabel={`across ${summary.rows.length} sector${summary.rows.length === 1 ? "" : "s"}${summary.unmapped.length > 0 ? ` · ${summary.unmapped.length} unmapped` : ""}`}
      />
      <KpiTile
        label="Headlines today"
        value={summary.headlineCount}
        accent="#FB7185"
        icon={<Newspaper size={12} />}
        sublabel={
          summary.headlineCount > 0
            ? "currently touching your stocks"
            : "no items touched your holdings"
        }
      />
    </div>
  );
}

function KpiTile({
  label,
  value,
  sublabel,
  accent,
  valueColor,
  icon,
}: {
  label: string;
  value: number | string;
  sublabel?: string;
  accent: string;
  valueColor?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="glass p-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">
          {label}
        </div>
        {icon ? (
          <div
            className="flex h-6 w-6 items-center justify-center rounded-md"
            style={{ background: `${accent}1A`, color: accent }}
          >
            {icon}
          </div>
        ) : null}
      </div>
      <div
        className="mt-1.5 font-display text-[22px] font-semibold leading-none"
        style={{ color: valueColor ?? "#fff" }}
      >
        {value}
      </div>
      {sublabel ? (
        <div className="mt-1 text-[11px] leading-snug text-white/45">
          {sublabel}
        </div>
      ) : null}
    </div>
  );
}

// ---- Sector donut (SVG, no external lib) ---------------------------------

const DONUT_SIZE = 180;
const DONUT_STROKE = 22;
const DONUT_RADIUS = (DONUT_SIZE - DONUT_STROKE) / 2;
const DONUT_CIRC = 2 * Math.PI * DONUT_RADIUS;

function SectorDonut({ summary }: { summary: PortfolioSummary }) {
  const rows = summary.rows;

  if (rows.length === 0) {
    return (
      <div className="glass p-4 text-[12px] text-white/55">
        Couldn't map any holding to a sector — try Quick picks or include sector
        names recognised in the dashboard.
      </div>
    );
  }

  let offset = 0;
  const segments = rows.map((r) => {
    const length = r.positionWeight * DONUT_CIRC;
    const seg = {
      row: r,
      length,
      offset,
    };
    offset += length;
    return seg;
  });

  return (
    <div className="glass p-4">
      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">
        Sector breakdown
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 md:flex-nowrap">
        <div className="relative shrink-0">
          <svg
            width={DONUT_SIZE}
            height={DONUT_SIZE}
            viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
          >
            {/* Track */}
            <circle
              cx={DONUT_SIZE / 2}
              cy={DONUT_SIZE / 2}
              r={DONUT_RADIUS}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={DONUT_STROKE}
            />
            {/* Segments */}
            {segments.map((s) => (
              <circle
                key={s.row.sectorId}
                cx={DONUT_SIZE / 2}
                cy={DONUT_SIZE / 2}
                r={DONUT_RADIUS}
                fill="none"
                stroke={s.row.sector.accent}
                strokeWidth={DONUT_STROKE}
                strokeDasharray={`${s.length} ${DONUT_CIRC - s.length}`}
                strokeDashoffset={-s.offset}
                transform={`rotate(-90 ${DONUT_SIZE / 2} ${DONUT_SIZE / 2})`}
              />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="font-display text-[20px] font-semibold leading-none text-white">
              {summary.holdings.length}
            </div>
            <div className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-white/45">
              Holdings
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          {rows.map((r) => (
            <LegendRow key={r.sectorId} row={r} hasValueData={summary.hasValueData} />
          ))}
          {summary.unmapped.length > 0 ? (
            <div className="mt-2 rounded-md border border-white/[0.05] bg-white/[0.012] px-2 py-1 text-[11px] text-white/55">
              {summary.unmapped.length} unmapped:{" "}
              <span className="text-white/75">
                {summary.unmapped.map((h) => h.company).join(", ")}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LegendRow({
  row,
  hasValueData,
}: {
  row: PortfolioBreakdownRow;
  hasValueData: boolean;
}) {
  const Icon = SECTOR_ICONS[row.sector.iconKey];
  const pct = Math.round(row.positionWeight * 100);
  return (
    <div className="flex items-center gap-2 rounded-md px-1 py-0.5">
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded ring-1 ring-white/10"
        style={{
          background: `linear-gradient(135deg, rgba(${row.sector.accentRgb},0.30), rgba(${row.sector.accentRgb},0.05))`,
          color: row.sector.accent,
        }}
      >
        <Icon size={10} />
      </span>
      <span className="flex-1 truncate text-[12px] font-medium text-white/85">
        {row.sector.shortName}
      </span>
      <span className="font-mono text-[10.5px] text-white/45">
        {row.count} {row.count === 1 ? "stock" : "stocks"}
      </span>
      <span
        className="w-9 text-right font-mono text-[11px] font-semibold tabular-nums"
        style={{ color: row.sector.accent }}
        title={hasValueData ? "Value-weighted share" : "Count-weighted share"}
      >
        {pct}%
      </span>
    </div>
  );
}

// ---- Concentration card --------------------------------------------------

interface CallCue {
  tone: "warn" | "good" | "info";
  text: string;
}

function ConcentrationCard({
  summary,
  aggregates,
}: {
  summary: PortfolioSummary;
  aggregates: SectorAggregate[];
}) {
  const callouts = useMemo<CallCue[]>(() => {
    const out: CallCue[] = [];

    if (summary.rows.length === 1) {
      out.push({
        tone: "warn",
        text: `100% concentrated in ${summary.rows[0].sector.shortName} — every move in that sector is the entire move in your book.`,
      });
    } else if (summary.rows[0] && summary.rows[0].positionWeight >= 0.4) {
      const top = summary.rows[0];
      out.push({
        tone: "warn",
        text: `${Math.round(top.positionWeight * 100)}% in ${top.sector.shortName} — that's a heavy single-sector bet. Stories breaking there will dominate your portfolio's swing.`,
      });
    }

    if (summary.unmapped.length > 0) {
      out.push({
        tone: "info",
        text: `${summary.unmapped.length} holding${summary.unmapped.length === 1 ? "" : "s"} couldn't be mapped to a tracked sector — news matching will still work on names, but they won't show up in the donut.`,
      });
    }

    // Diversification: bullish sectors that the user has no exposure to.
    const inSectorIds = new Set(summary.rows.map((r) => r.sectorId));
    const bullishMissing = aggregates
      .filter(
        (a) =>
          !inSectorIds.has(a.sector.id) &&
          a.bullishMomentum >= 15 &&
          a.bullishCount >= 4
      )
      .sort((a, b) => b.bullishMomentum - a.bullishMomentum)
      .slice(0, 2);
    if (bullishMissing.length > 0) {
      out.push({
        tone: "good",
        text: `Bullish sectors you have no exposure to today: ${bullishMissing
          .map((a) => a.sector.shortName)
          .join(", ")}. Worth a look if you want to add fresh directional bets.`,
      });
    }

    if (out.length === 0) {
      out.push({
        tone: "info",
        text: `Balanced book across ${summary.rows.length} sectors. No single sector dominates and no obvious gap to flag.`,
      });
    }

    return out;
  }, [summary, aggregates]);

  const topHoldings = useMemo(() => {
    const list = summary.holdings.slice();
    if (summary.hasValueData) {
      list.sort(
        (a, b) =>
          (b.quantity ?? 0) * (b.avgPrice ?? 0) -
          (a.quantity ?? 0) * (a.avgPrice ?? 0)
      );
    }
    return list.slice(0, 6);
  }, [summary]);

  return (
    <div className="glass flex flex-col gap-3 p-4">
      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">
        Concentration &amp; gaps
      </div>

      <div className="space-y-1.5">
        {callouts.map((c, i) => (
          <div
            key={i}
            className={classNames(
              "rounded-lg border px-2.5 py-1.5 text-[12px] leading-snug",
              c.tone === "warn" &&
                "border-amber-300/25 bg-amber-300/[0.05] text-amber-100/90",
              c.tone === "good" &&
                "border-emerald-300/25 bg-emerald-300/[0.05] text-emerald-100/90",
              c.tone === "info" &&
                "border-white/[0.08] bg-white/[0.02] text-white/80"
            )}
          >
            <span className="mr-1.5 inline-flex h-3 w-3 -translate-y-px items-center justify-center align-middle">
              {c.tone === "warn" ? (
                <AlertTriangle size={11} className="text-amber-300" />
              ) : c.tone === "good" ? (
                <TrendingUp size={11} className="text-emerald-300" />
              ) : (
                <Layers size={11} className="text-white/60" />
              )}
            </span>
            {c.text}
          </div>
        ))}
      </div>

      {topHoldings.length > 0 ? (
        <div>
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">
            {summary.hasValueData ? "Top positions by size" : "Holdings sample"}
          </div>
          <div className="flex flex-wrap gap-1">
            {topHoldings.map((h) => (
              <span
                key={h.company}
                className="inline-flex items-center rounded-md border border-white/[0.07] bg-white/[0.02] px-1.5 py-[2px] font-mono text-[10.5px] tracking-tight text-white/75"
                title={
                  h.quantity && h.avgPrice
                    ? `₹${(h.quantity * h.avgPrice).toLocaleString("en-IN")} position`
                    : h.company
                }
              >
                {h.company}
              </span>
            ))}
            {summary.holdings.length > topHoldings.length ? (
              <span className="font-mono text-[10.5px] text-white/35">
                +{summary.holdings.length - topHoldings.length} more
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
