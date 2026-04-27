import { useEffect } from "react";
import {
  ArrowUpRight,
  Building2,
  ClipboardList,
  ExternalLink,
  Gauge,
  Sparkles,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  X,
  type LucideIcon,
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
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-ink-950/60 backdrop-blur-sm animate-floatIn"
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="News insight"
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[560px] animate-slideIn flex-col overflow-hidden border-l border-white/[0.08] bg-ink-950/95 shadow-2xl backdrop-blur-2xl"
      >
        {/* Sector accent stripe */}
        <div
          className="h-[3px] w-full"
          style={{
            background: `linear-gradient(90deg, transparent, rgba(${accentRgb},1), transparent)`,
          }}
        />

        {/* Header */}
        <div className="relative px-5 pb-3 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {Icon && (
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-white/10"
                  style={{
                    background: `rgba(${accentRgb},0.15)`,
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
                  {item.subsector}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close insight panel"
              className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.07] bg-white/[0.02] text-white/60 transition hover:border-white/[0.14] hover:text-white"
            >
              <X size={13} />
            </button>
          </div>

          <h2 className="mt-3 font-display text-[18px] font-semibold leading-snug text-white">
            {item.headline}
          </h2>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <SentimentBadge sentiment={item.sentiment} />
            <UrgencyBadge urgency={item.urgency} />
            <ImpactPill score={item.impactScore} />
            <ThemeChip>{item.theme}</ThemeChip>
            <span className="chip">
              <Gauge size={10} />
              {item.timeHorizon}
            </span>
          </div>

          <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-white/75">
            {item.summary}
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {/* Source row */}
          <Section title="Source" icon={ExternalLink}>
            <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
              <span className="chip">{item.source}</span>
              <span className="chip">{item.sourceType}</span>
              <span className="chip">
                Confidence {item.sourceConfidence}/100
              </span>
              <span className="chip">{relativeTime(item.publishedAt)}</span>
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
          </Section>

          {/* Companies + KPIs */}
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <Section title="Affected companies" icon={Building2} compact>
              <Chips items={item.affectedCompanies} accent={accent} />
            </Section>
            <Section title="KPI affected" icon={ClipboardList} compact>
              <Chips items={item.kpiAffected} accent={accent} />
            </Section>
          </div>

          {/* Why it matters */}
          <Section title="Why it matters" icon={Sparkles}>
            <Highlight color={accentRgb}>{item.whyItMatters}</Highlight>
          </Section>

          {/* Bull / Bear */}
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <CaseCard
              tone="bull"
              icon={<TrendingUp size={12} />}
              title="Bull case"
              body={item.bullCase}
            />
            <CaseCard
              tone="bear"
              icon={<TrendingDown size={12} />}
              title="Bear case"
              body={item.bearCase}
            />
          </div>

          {/* Catalyst */}
          <Section title="Related catalyst" icon={ShieldAlert}>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-[12.5px] text-white/80">
              {item.relatedCatalyst}
            </div>
          </Section>
        </div>
      </aside>
    </>
  );
}

function Section({
  title,
  icon: Icon,
  children,
  compact,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <section className={classNames("mt-3", compact && "md:mt-0")}>
      <div className="mb-1.5 flex items-center gap-1.5">
        <Icon size={11} className="text-white/45" />
        <div className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-white/45">
          {title}
        </div>
      </div>
      <div>{children}</div>
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
          className="inline-flex items-center rounded-full border px-2.5 py-[3px] text-[11px] font-medium"
          style={{
            borderColor: `${accent}33`,
            background: `${accent}10`,
            color: "#fff",
          }}
        >
          {c}
        </span>
      ))}
    </div>
  );
}

function Highlight({
  children,
  color,
}: {
  children: React.ReactNode;
  color: string;
}) {
  return (
    <div
      className="relative rounded-lg border border-white/[0.06] px-3 py-2.5 text-[12.5px] leading-relaxed text-white/85"
      style={{
        background: `linear-gradient(180deg, rgba(${color},0.08), rgba(${color},0.02))`,
      }}
    >
      {children}
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
      ? "border-emerald-400/20 bg-emerald-400/[0.04] text-emerald-100"
      : "border-rose-400/20 bg-rose-400/[0.04] text-rose-100";
  const labelStyles =
    tone === "bull" ? "text-emerald-300" : "text-rose-300";
  return (
    <div className={classNames("rounded-lg border px-3 py-2.5", styles)}>
      <div
        className={classNames(
          "mb-1 flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.16em]",
          labelStyles
        )}
      >
        {icon}
        {title}
      </div>
      <div className="text-[12.5px] leading-relaxed text-white/85">{body}</div>
    </div>
  );
}
