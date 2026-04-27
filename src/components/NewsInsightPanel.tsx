import { useEffect } from "react";
import {
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import type { NewsItem } from "../types";
import { sectorMetaFor } from "../lib/logic";
import { SECTOR_ICONS } from "../lib/icons";
import { ImpactPill, SentimentBadge, ThemeChip, UrgencyBadge } from "./Badges";
import { classNames, relativeTime } from "../lib/utils";

interface Props {
  item: NewsItem | null;
  onClose: () => void;
}

/**
 * Centered modal — premium, dense, scannable. All 16 spec fields surface
 * but the chrome stays minimal so the headline + thesis lead the eye.
 */
export function NewsInsightPanel({ item, onClose }: Props) {
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  if (!item) return null;

  const sector = sectorMetaFor(item.sector);
  const Icon = sector ? SECTOR_ICONS[sector.iconKey] : null;
  const accent = sector?.accent ?? "#7DD3FC";
  const accentRgb = sector?.accentRgb ?? "125,211,252";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="News insight"
    >
      <div
        onClick={onClose}
        aria-hidden
        className="absolute inset-0 animate-backdropIn bg-ink-950/65 backdrop-blur-sm"
      />

      <div
        className="relative z-10 flex max-h-[88vh] w-full max-w-[760px] animate-modalIn flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-900/95 shadow-2xl"
        style={{
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.04), 0 30px 80px -20px rgba(0,0,0,0.65)",
        }}
      >
        {/* Sector accent stripe */}
        <div
          className="h-[2px] w-full"
          style={{
            background: `linear-gradient(90deg, transparent, rgba(${accentRgb},0.95), transparent)`,
          }}
        />
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-50 blur-3xl"
          style={{ background: `rgba(${accentRgb},0.12)` }}
        />

        {/* Sector + close */}
        <div className="relative flex items-center justify-between gap-3 px-5 pt-4 sm:px-6">
          <div className="flex items-center gap-2">
            {Icon && (
              <div
                className="flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-white/10"
                style={{
                  background: `rgba(${accentRgb},0.16)`,
                  color: accent,
                }}
              >
                <Icon size={13} />
              </div>
            )}
            <div className="leading-tight">
              <div className="text-[12px] font-semibold text-white">
                {sector?.name ?? item.sector}
              </div>
              <div className="text-[10.5px] text-white/40">
                {item.subsector} · {relativeTime(item.publishedAt)}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close insight"
            className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.07] bg-white/[0.02] text-white/55 transition hover:border-white/[0.16] hover:text-white"
          >
            <X size={13} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="relative flex-1 overflow-y-auto px-5 pb-5 pt-3 sm:px-6">
          {/* Headline */}
          <h2 className="font-display text-[19px] font-semibold leading-snug text-white sm:text-[20px]">
            {item.headline}
          </h2>

          {/* Meta strip */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <SentimentBadge sentiment={item.sentiment} size="sm" />
            <UrgencyBadge urgency={item.urgency} size="sm" />
            <ImpactPill score={item.impactScore} />
            <ThemeChip>{item.theme}</ThemeChip>
            <span className="chip">{item.timeHorizon}</span>
          </div>

          {/* Summary — capped at 2 lines */}
          <p className="mt-3 line-clamp-2 text-[12.5px] leading-relaxed text-white/75">
            {item.summary}
          </p>

          {/* Source row */}
          <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-white/55">
            <span className="font-medium text-white/80">{item.source}</span>
            <Sep />
            <span>{item.sourceType}</span>
            <Sep />
            <span>
              Confidence{" "}
              <span className="font-mono text-white/75">
                {item.sourceConfidence}/100
              </span>
            </span>
            <span className="ml-auto" />
            <a
              href={item.newsUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-primary"
            >
              Read more
              <ArrowUpRight size={11} />
            </a>
          </div>

          <Divider />

          {/* Companies + KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Group label="Affected companies">
              <Chips items={item.affectedCompanies} accent={accent} />
            </Group>
            <Group label="KPIs affected">
              <Chips items={item.kpiAffected} accent={accent} />
            </Group>
          </div>

          <Divider />

          {/* Why it matters — lightweight callout, accent left rule */}
          <Group label="Why it matters">
            <div
              className="rounded-md border-l-2 bg-white/[0.018] py-1.5 pl-3 pr-1 text-[12.5px] leading-relaxed text-white/85"
              style={{ borderLeftColor: accent }}
            >
              {item.whyItMatters}
            </div>
          </Group>

          {/* Bull / Bear */}
          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <CaseCard
              tone="bull"
              icon={<TrendingUp size={11} />}
              title="Bull case"
              body={item.bullCase}
            />
            <CaseCard
              tone="bear"
              icon={<TrendingDown size={11} />}
              title="Bear case"
              body={item.bearCase}
            />
          </div>

          {/* Related catalyst */}
          <div className="mt-4 flex items-start gap-2 rounded-md border border-white/[0.05] bg-white/[0.018] px-3 py-2 text-[12px] text-white/75">
            <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-white/30" />
            <div>
              <span className="mr-1.5 text-[10.5px] uppercase tracking-[0.16em] text-white/40">
                Catalyst
              </span>
              {item.relatedCatalyst}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Sep() {
  return <span className="text-white/15">·</span>;
}

function Divider() {
  return (
    <div className="my-4 h-px w-full bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">
        {label}
      </div>
      {children}
    </section>
  );
}

function Chips({ items, accent }: { items: string[]; accent: string }) {
  if (!items.length)
    return <div className="text-[11.5px] text-white/40">—</div>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((c) => (
        <span
          key={c}
          className="inline-flex items-center rounded-full border px-2 py-[3px] text-[11px] font-medium text-white/90"
          style={{
            borderColor: `${accent}30`,
            background: `${accent}10`,
          }}
        >
          {c}
        </span>
      ))}
    </div>
  );
}

function CaseCard({
  tone,
  icon,
  title,
  body,
}: {
  tone: "bull" | "bear";
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  const styles =
    tone === "bull"
      ? "border-emerald-400/15 bg-emerald-400/[0.035]"
      : "border-rose-400/15 bg-rose-400/[0.035]";
  const labelStyles =
    tone === "bull" ? "text-emerald-300" : "text-rose-300";
  return (
    <div className={classNames("rounded-md border px-3 py-2.5", styles)}>
      <div
        className={classNames(
          "mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]",
          labelStyles
        )}
      >
        {icon}
        {title}
      </div>
      <div className="text-[12px] leading-relaxed text-white/80">{body}</div>
    </div>
  );
}
