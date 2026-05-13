import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, FileText, Layers, X } from "lucide-react";
import { SECTORS } from "../data/sectors";
import { SECTOR_ICONS } from "../lib/icons";
import { classNames } from "../lib/utils";
import {
  findSectorForCompany,
  parsePortfolioCSV,
  type PortfolioHolding,
} from "../lib/portfolio";

interface Props {
  open: boolean;
  initial: PortfolioHolding[];
  onClose: () => void;
  onSave: (holdings: PortfolioHolding[]) => void;
}

type Tab = "csv" | "picks";

const CSV_PLACEHOLDER = `Maruti Suzuki, 50, 9450
L&T, 20, 3650
Infosys, 100, 1480
HDFC Bank, 80, 1620
Tata Steel, 200, 165`;

export function PortfolioEditModal({ open, initial, onClose, onSave }: Props) {
  const [tab, setTab] = useState<Tab>(initial.length > 0 ? "csv" : "picks");
  const [csvText, setCsvText] = useState("");
  const [picks, setPicks] = useState<PortfolioHolding[]>([]);

  // Rehydrate when the modal opens.
  useEffect(() => {
    if (!open) return;
    setCsvText(holdingsToCSV(initial));
    setPicks(initial.filter((h) => h.sectorId !== undefined || findSectorForCompany(h.company)));
  }, [open, initial]);

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

  // Live preview of what will be saved.
  const previewHoldings = useMemo<PortfolioHolding[]>(() => {
    if (tab === "csv") {
      return parsePortfolioCSV(csvText);
    }
    return picks;
  }, [tab, csvText, picks]);

  const handleSave = () => {
    const final = previewHoldings.map((h) => ({
      ...h,
      sectorId: h.sectorId ?? findSectorForCompany(h.company),
    }));
    onSave(final);
    onClose();
  };

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Set portfolio"
      className="fixed inset-0 z-50 flex items-center justify-center px-3 py-6"
    >
      <div
        onClick={onClose}
        className="absolute inset-0 animate-backdropIn bg-black/70 backdrop-blur-md"
      />
      <div className="relative z-10 flex max-h-full w-full max-w-[640px] animate-modalIn flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-950/95 shadow-2xl">
        <div
          aria-hidden
          className="h-[2px] w-full"
          style={{
            background:
              "linear-gradient(90deg, #5EEAD4, #7DD3FC, #A78BFA, #F472B6)",
          }}
        />

        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-mint/25 via-accent-sky/20 to-accent-violet/20 ring-1 ring-white/10">
            <Layers size={16} className="text-white" />
          </div>
          <div className="flex-1 pr-9">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">
              Your portfolio
            </div>
            <div className="mt-0.5 font-display text-[18px] font-semibold leading-tight text-white">
              Set up holdings
            </div>
            <div className="mt-1 text-[12.5px] leading-snug text-white/65">
              Stored locally in your browser — nothing is uploaded.
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

        {/* Tab strip */}
        <div className="mx-5 mt-3 inline-flex w-fit items-center gap-0.5 self-start rounded-lg border border-white/[0.07] bg-white/[0.02] p-0.5">
          <TabButton
            active={tab === "csv"}
            onClick={() => setTab("csv")}
            icon={<FileText size={11} />}
            label="Paste CSV"
          />
          <TabButton
            active={tab === "picks"}
            onClick={() => setTab("picks")}
            icon={<Layers size={11} />}
            label="Quick picks"
          />
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {tab === "csv" ? (
            <CsvTab value={csvText} onChange={setCsvText} />
          ) : (
            <QuickPicksTab value={picks} onChange={setPicks} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-5 py-3">
          <div className="text-[11.5px] text-white/55">
            {previewHoldings.length === 0
              ? "No holdings yet."
              : `${previewHoldings.length} holding${previewHoldings.length === 1 ? "" : "s"} will be saved`}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={previewHoldings.length === 0}
              className={classNames(
                "btn-primary",
                previewHoldings.length === 0 && "cursor-not-allowed opacity-40"
              )}
            >
              <Check size={11} />
              Save
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
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

// ---- CSV tab -------------------------------------------------------------

function CsvTab({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[11.5px] leading-snug text-white/60">
        One holding per line. CSV columns:{" "}
        <span className="font-mono text-white/85">Company, Quantity, AvgPrice</span>{" "}
        — quantity &amp; price are optional but enable position weighting.
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={CSV_PLACEHOLDER}
        className="focus-ring h-[240px] w-full resize-none rounded-lg border border-white/[0.07] bg-black/30 p-3 font-mono text-[12px] leading-relaxed text-white/90 placeholder:text-white/30"
        spellCheck={false}
      />
    </div>
  );
}

// ---- Quick picks tab -----------------------------------------------------

function QuickPicksTab({
  value,
  onChange,
}: {
  value: PortfolioHolding[];
  onChange: (next: PortfolioHolding[]) => void;
}) {
  const selectedKey = useMemo(
    () => new Set(value.map((h) => keyFor(h.company))),
    [value]
  );

  const [openSector, setOpenSector] = useState<string | null>(SECTORS[0]?.id ?? null);

  const toggle = (sectorId: string, company: string) => {
    const k = keyFor(company);
    if (selectedKey.has(k)) {
      onChange(value.filter((h) => keyFor(h.company) !== k));
    } else {
      onChange([...value, { company, sectorId }]);
    }
  };

  const addAll = (sectorId: string, companies: string[]) => {
    const additions: PortfolioHolding[] = [];
    for (const c of companies) {
      if (!selectedKey.has(keyFor(c))) {
        additions.push({ company: c, sectorId });
      }
    }
    if (additions.length) onChange([...value, ...additions]);
  };

  return (
    <div className="space-y-1.5">
      <div className="text-[11.5px] leading-snug text-white/60">
        Tap a sector to expand and pick the names you hold. Click a chip again to
        remove it.
      </div>
      {SECTORS.map((s) => {
        const Icon = SECTOR_ICONS[s.iconKey];
        const isOpen = openSector === s.id;
        const picked = s.companies.filter((c) => selectedKey.has(keyFor(c))).length;
        return (
          <div
            key={s.id}
            className="overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.018]"
          >
            <button
              type="button"
              onClick={() => setOpenSector(isOpen ? null : s.id)}
              className="focus-ring flex w-full items-center gap-2 px-2.5 py-2 text-left"
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded ring-1 ring-white/10"
                style={{
                  background: `linear-gradient(135deg, rgba(${s.accentRgb},0.30), rgba(${s.accentRgb},0.05))`,
                  color: s.accent,
                }}
              >
                <Icon size={10} />
              </span>
              <span className="flex-1 text-[12.5px] font-semibold text-white/85">
                {s.shortName}
              </span>
              {picked > 0 ? (
                <span
                  className="font-mono text-[10.5px]"
                  style={{ color: s.accent }}
                >
                  {picked} / {s.companies.length}
                </span>
              ) : (
                <span className="font-mono text-[10.5px] text-white/35">
                  {s.companies.length}
                </span>
              )}
              <ChevronDown
                size={12}
                className={classNames(
                  "shrink-0 text-white/45 transition",
                  isOpen && "rotate-180"
                )}
              />
            </button>
            {isOpen ? (
              <div className="flex flex-wrap items-center gap-1.5 border-t border-white/[0.05] bg-black/10 p-2.5">
                {s.companies.map((c) => {
                  const isPicked = selectedKey.has(keyFor(c));
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggle(s.id, c)}
                      className={classNames(
                        "focus-ring inline-flex items-center gap-1 rounded-md border px-2 py-[3px] text-[11px] font-medium transition",
                        isPicked
                          ? "border-white/35 bg-white/[0.10] text-white"
                          : "border-white/[0.08] bg-white/[0.02] text-white/65 hover:border-white/[0.20] hover:text-white"
                      )}
                      style={
                        isPicked
                          ? { borderColor: `${s.accent}66`, color: s.accent }
                          : undefined
                      }
                    >
                      {isPicked ? <Check size={9} /> : null}
                      {c}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => addAll(s.id, s.companies)}
                  className="ml-auto text-[10.5px] font-medium uppercase tracking-wider text-white/45 hover:text-white/85"
                >
                  + Add all
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function keyFor(company: string): string {
  return company.toLowerCase().replace(/[^a-z0-9&]+/g, "");
}

function holdingsToCSV(holdings: PortfolioHolding[]): string {
  if (holdings.length === 0) return "";
  return holdings
    .map((h) => {
      const parts = [h.company];
      if (h.quantity !== undefined) parts.push(String(h.quantity));
      if (h.avgPrice !== undefined) parts.push(String(h.avgPrice));
      return parts.join(", ");
    })
    .join("\n");
}
