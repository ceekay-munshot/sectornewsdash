import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X } from "lucide-react";
import type { WhyExplanation } from "../lib/whyExplainers";
import { relativeTime } from "../lib/utils";

interface Props {
  open: boolean;
  why: WhyExplanation | null;
  onClose: () => void;
}

export function WhyPanel({ open, why, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !why) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={why.title}
      className="fixed inset-0 z-50 flex items-center justify-center px-3"
    >
      <div
        onClick={onClose}
        className="absolute inset-0 animate-backdropIn bg-black/65 backdrop-blur-sm"
      />

      <div className="relative z-10 w-full max-w-[640px] animate-modalIn">
        <div
          className="overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-950/95 shadow-2xl backdrop-blur-xl"
          style={{
            boxShadow: `0 30px 80px -20px ${why.accent}55, 0 0 0 1px rgba(255,255,255,0.04)`,
          }}
        >
          {/* Halo top edge */}
          <div
            aria-hidden
            className="h-[2px] w-full"
            style={{
              background: `linear-gradient(90deg, transparent, ${why.accent}, transparent)`,
            }}
          />

          {/* Header */}
          <div className="relative flex items-start gap-3 px-5 pt-4">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-white/10"
              style={{
                background: `linear-gradient(135deg, ${why.accent}33, ${why.accent}10)`,
                color: why.accent,
              }}
            >
              <Sparkles size={16} />
            </div>
            <div className="flex-1 pr-9">
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">
                Why this pick
              </div>
              <div className="mt-0.5 font-display text-[18px] font-semibold leading-tight text-white">
                {why.title}
              </div>
              <div className="mt-1 text-[12.5px] leading-snug text-white/65">
                {why.subject}
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="focus-ring absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-white/65 hover:border-white/20 hover:text-white"
            >
              <X size={13} />
            </button>
          </div>

          {/* Hero metric */}
          <div className="mx-5 mt-4 overflow-hidden rounded-xl border border-white/[0.06]">
            <div
              className="flex items-baseline justify-between px-3.5 py-2.5"
              style={{
                background: `linear-gradient(135deg, ${why.accent}26, ${why.accent}08)`,
              }}
            >
              <div
                className="font-display text-[28px] font-semibold leading-none tabular-nums"
                style={{ color: why.accent }}
              >
                {why.metric}
              </div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/55">
                {why.metricLabel}
              </div>
            </div>
          </div>

          {/* Reasons */}
          <div className="px-5 py-4">
            <div className="space-y-2.5">
              {why.reasons.map((r, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-white/[0.05] bg-white/[0.018] px-3 py-2"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
                    {r.heading}
                  </div>
                  <div className="mt-1 text-[12.5px] leading-relaxed text-white/85">
                    {r.body}
                  </div>
                </div>
              ))}
            </div>

            {why.topNews.length > 0 ? (
              <div className="mt-4">
                <div className="mb-1.5 text-[10.5px] font-medium uppercase tracking-[0.18em] text-white/45">
                  Headlines driving this
                </div>
                <div className="space-y-1">
                  {why.topNews.map((n) => (
                    <a
                      key={n.id}
                      href={n.newsUrl || "#"}
                      target={n.newsUrl ? "_blank" : undefined}
                      rel="noreferrer"
                      className="flex items-start gap-2 rounded-md border border-white/[0.04] bg-white/[0.01] px-2.5 py-1.5 text-left transition hover:border-white/[0.14] hover:bg-white/[0.03]"
                    >
                      <span
                        className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: why.accent }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-[12px] leading-snug text-white/90">
                          {n.headline}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-white/45">
                          <span className="font-mono">imp {n.impactScore}/10</span>
                          <span>·</span>
                          <span className="truncate">{n.source}</span>
                          <span>·</span>
                          <span>{relativeTime(n.publishedAt)}</span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            {why.caveat ? (
              <div className="mt-3 rounded-md border border-amber-300/25 bg-amber-300/[0.05] px-2.5 py-1.5 text-[11.5px] text-amber-200/85">
                ⚠ {why.caveat}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
