import { useMemo, useState } from "react";
import { BookOpen, Sigma, Cog, Eye, Link2 } from "lucide-react";
import {
  LOGIC_EXPLAINERS,
  LOGIC_BY_ID,
  LOGIC_CATEGORIES,
  type LogicExplainer,
  type LogicCategory,
  type InterpretationBand,
} from "../lib/logicExplainers";
import { classNames } from "../lib/utils";

const TONE_CLASS: Record<NonNullable<InterpretationBand["tone"]>, string> = {
  good: "text-emerald-300 border-emerald-300/30 bg-emerald-300/[0.06]",
  warn: "text-amber-300 border-amber-300/30 bg-amber-300/[0.06]",
  bad: "text-rose-300 border-rose-300/30 bg-rose-300/[0.06]",
  info: "text-white/65 border-white/[0.10] bg-white/[0.03]",
};

export function LogicTab() {
  const [activeId, setActiveId] = useState<string>(LOGIC_EXPLAINERS[0].id);
  const active = LOGIC_BY_ID[activeId];

  const grouped = useMemo(() => {
    const map = new Map<LogicCategory, LogicExplainer[]>();
    for (const cat of LOGIC_CATEGORIES) map.set(cat, []);
    for (const e of LOGIC_EXPLAINERS) map.get(e.category)!.push(e);
    return map;
  }, []);

  return (
    <div className="animate-floatIn space-y-3">
      {/* Intro */}
      <div className="glass p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent-violet/30 via-accent-sky/20 to-accent-mint/20 ring-1 ring-white/10">
            <BookOpen size={16} className="text-white" />
          </div>
          <div>
            <div className="font-display text-[16px] font-semibold text-white">
              How everything on this dashboard is calculated
            </div>
            <div className="mt-1 text-[12px] leading-snug text-white/55">
              Pick a metric below to see what it measures, the exact formula
              behind it, what goes into it, and how to read the number.
              No magic — every score is deterministic and reproducible from
              the inputs.
            </div>
          </div>
        </div>
      </div>

      {/* Metric picker — grouped pills */}
      <div className="glass p-3">
        <div className="space-y-2.5">
          {LOGIC_CATEGORIES.map((cat) => {
            const items = grouped.get(cat) ?? [];
            if (items.length === 0) return null;
            return (
              <div key={cat}>
                <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">
                  {cat}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((e) => {
                    const Icon = e.icon;
                    const isActive = e.id === activeId;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => setActiveId(e.id)}
                        className={classNames(
                          "focus-ring inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition",
                          isActive
                            ? "border-white/25 bg-white/[0.08] text-white shadow-glow"
                            : "border-white/[0.07] bg-white/[0.02] text-white/70 hover:border-white/[0.16] hover:bg-white/[0.05] hover:text-white"
                        )}
                        style={
                          isActive
                            ? {
                                borderColor: `${e.accent}55`,
                                boxShadow: `0 0 0 1px ${e.accent}22, 0 8px 20px -10px ${e.accent}66`,
                              }
                            : undefined
                        }
                      >
                        <span
                          className="flex h-4 w-4 items-center justify-center rounded"
                          style={{
                            background: `${e.accent}1F`,
                            color: e.accent,
                          }}
                        >
                          <Icon size={10} />
                        </span>
                        {e.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail panel */}
      <DetailPanel key={active.id} item={active} onJump={setActiveId} />
    </div>
  );
}

function DetailPanel({
  item,
  onJump,
}: {
  item: LogicExplainer;
  onJump: (id: string) => void;
}) {
  const Icon = item.icon;
  return (
    <div className="animate-floatIn grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
      {/* LEFT: identity + interpretation */}
      <div className="glass p-4">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-white/10"
            style={{ background: `${item.accent}22`, color: item.accent }}
          >
            <Icon size={18} />
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">
              {item.category} · {item.range}
            </div>
            <div className="mt-0.5 font-display text-[18px] font-semibold leading-tight text-white">
              {item.title}
            </div>
            <div className="mt-1 text-[12.5px] leading-snug text-white/65">
              {item.oneLiner}
            </div>
          </div>
        </div>

        <div className="mt-3.5">
          <SectionLabel icon={<BookOpen size={11} />}>What it is</SectionLabel>
          <p className="mt-1 text-[12.5px] leading-relaxed text-white/75">
            {item.whatIs}
          </p>
        </div>

        <div className="mt-3.5">
          <SectionLabel icon={<Eye size={11} />}>How to read it</SectionLabel>
          <div className="mt-1.5 space-y-1.5">
            {item.interpretation.map((row, i) => (
              <div
                key={i}
                className={classNames(
                  "rounded-lg border px-2.5 py-1.5",
                  TONE_CLASS[row.tone ?? "info"]
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-mono text-[11px] tracking-tight">
                    {row.band}
                  </div>
                  <div className="text-[11.5px] font-semibold">
                    {row.label}
                  </div>
                </div>
                <div className="mt-0.5 text-[11.5px] leading-snug text-white/70">
                  {row.meaning}
                </div>
              </div>
            ))}
          </div>
        </div>

        {item.whereSeen && item.whereSeen.length > 0 ? (
          <div className="mt-3.5">
            <SectionLabel icon={<Eye size={11} />}>Where you see it</SectionLabel>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {item.whereSeen.map((w) => (
                <span
                  key={w}
                  className="inline-flex items-center rounded-full border border-white/[0.07] bg-white/[0.02] px-2 py-[3px] text-[11px] text-white/65"
                >
                  {w}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* RIGHT: formula + inputs + example + related */}
      <div className="glass p-4">
        <div>
          <SectionLabel icon={<Sigma size={11} />}>Formula</SectionLabel>
          <pre className="mt-1.5 max-h-[420px] overflow-auto whitespace-pre rounded-lg border border-white/[0.06] bg-black/40 p-3 font-mono text-[11.5px] leading-relaxed text-white/85">
            {item.howCalculated}
          </pre>
        </div>

        <div className="mt-3.5">
          <SectionLabel icon={<Cog size={11} />}>Inputs</SectionLabel>
          <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {item.inputs.map((inp) => (
              <div
                key={inp.name}
                className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-[12px] font-semibold text-white/85">
                    {inp.name}
                  </div>
                  <div className="font-mono text-[10.5px] text-white/55">
                    {inp.range}
                  </div>
                </div>
                {inp.note ? (
                  <div className="mt-0.5 text-[11px] leading-snug text-white/55">
                    {inp.note}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {item.example ? (
          <div className="mt-3.5">
            <SectionLabel icon={<BookOpen size={11} />}>
              Worked example
            </SectionLabel>
            <div className="mt-1.5 rounded-lg border border-accent-sky/20 bg-accent-sky/[0.05] px-3 py-2 text-[12px] leading-relaxed text-white/80">
              {item.example}
            </div>
          </div>
        ) : null}

        {item.related && item.related.length > 0 ? (
          <div className="mt-3.5">
            <SectionLabel icon={<Link2 size={11} />}>Related</SectionLabel>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {item.related.map((rid) => {
                const r = LOGIC_BY_ID[rid];
                if (!r) return null;
                const RIcon = r.icon;
                return (
                  <button
                    key={rid}
                    type="button"
                    onClick={() => onJump(rid)}
                    className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-2 py-[3px] text-[11px] text-white/70 transition hover:border-white/20 hover:text-white"
                  >
                    <span
                      className="flex h-3.5 w-3.5 items-center justify-center rounded"
                      style={{ background: `${r.accent}1F`, color: r.accent }}
                    >
                      <RIcon size={9} />
                    </span>
                    {r.title}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SectionLabel({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">
      <span className="text-white/55">{icon}</span>
      {children}
    </div>
  );
}
