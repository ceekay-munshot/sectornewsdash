import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Eraser,
  Layers,
  MessageSquare,
  Search,
  Send,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import type { SectorMeta } from "../types";
import { SECTOR_ICONS } from "../lib/icons";
import { classNames } from "../lib/utils";
import {
  clearDashboardChat,
  loadDashboardChat,
  saveDashboardChat,
  sendDashboardChat,
  type DashboardChatMessage,
} from "../lib/dashboardChat";

interface Props {
  open: boolean;
  onClose: () => void;
  sectors: SectorMeta[];
  initialSectorIds?: string[];
}

const TOOL_LABELS: Record<string, string> = {
  list_sectors: "list sectors",
  list_headlines: "list headlines",
  search_news: "search",
  get_news_details: "details",
  fetch_article: "fetch article",
  compare_news: "compare",
};

/**
 * Hovering chat panel that talks to the dashboard as a whole.
 *
 * The user picks any number of sectors and asks questions. The Worker uses
 * tool calling (list_headlines, get_news_details, fetch_article, compare_news,
 * search_news) so GPT only pulls what it needs into its context.
 */
export function DashboardChatPanel({
  open,
  onClose,
  sectors,
  initialSectorIds,
}: Props) {
  const persisted = useRef<{
    messages: DashboardChatMessage[];
    sectorIds: string[];
  } | null>(null);
  if (persisted.current === null) {
    persisted.current = loadDashboardChat();
  }

  const [messages, setMessages] = useState<DashboardChatMessage[]>(
    () => persisted.current?.messages ?? [],
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    // Stored selection wins if present so the user's scope is sticky across
    // reloads. We only fall back to the prop when nothing is stored — that's
    // the first-time-open case.
    const fromStore = persisted.current?.sectorIds ?? [];
    const fromInit =
      initialSectorIds && initialSectorIds.length > 0 ? initialSectorIds : [];
    const chosen = fromStore.length > 0 ? fromStore : fromInit;
    return chosen.filter((id) => sectors.some((s) => s.id === id));
  });
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Persist whenever messages or selection change.
  useEffect(() => {
    saveDashboardChat({ messages, sectorIds: selectedIds });
  }, [messages, selectedIds]);

  // Pin scroll to the latest message as the transcript grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isSending]);

  // Close on Escape, focus input on open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    textareaRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Cancel any in-flight request when the panel closes.
  useEffect(() => {
    if (!open && abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setIsSending(false);
    }
  }, [open]);

  const sectorById = useMemo(() => {
    const m = new Map<string, SectorMeta>();
    for (const s of sectors) m.set(s.id, s);
    return m;
  }, [sectors]);

  const selectedSectors = useMemo(
    () => selectedIds.map((id) => sectorById.get(id)).filter(Boolean) as SectorMeta[],
    [selectedIds, sectorById],
  );

  const trimmed = draft.trim();
  const canSend = trimmed.length > 0 && !isSending;

  const toggleSector = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const onSend = useCallback(async () => {
    if (!canSend) return;
    const userMsg: DashboardChatMessage = {
      role: "user",
      content: trimmed,
      ts: Date.now(),
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setDraft("");
    setError(null);
    setIsSending(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await sendDashboardChat({
        sectorIds: selectedIds,
        sectors,
        history: next,
        signal: ctrl.signal,
      });
      setMessages((prev) => [...prev, res.message]);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message || "Dashboard chat request failed");
      setMessages((prev) => prev.slice(0, -1));
      setDraft(trimmed);
    } finally {
      abortRef.current = null;
      setIsSending(false);
    }
  }, [canSend, trimmed, messages, selectedIds, sectors]);

  const onClear = useCallback(() => {
    if (messages.length === 0) return;
    const ok = window.confirm("Clear this dashboard chat?");
    if (!ok) return;
    clearDashboardChat();
    setMessages([]);
    setError(null);
  }, [messages.length]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void onSend();
    }
  };

  if (!open) return null;

  const pickerSectors = (() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return sectors;
    return sectors.filter((s) =>
      [
        s.name,
        s.shortName,
        ...s.subsectors,
        ...s.companies,
      ]
        .some((v) => v.toLowerCase().includes(q)),
    );
  })();

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-end p-3 sm:items-center sm:justify-end sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Talk to dashboard"
    >
      <div
        onClick={onClose}
        aria-hidden
        className="absolute inset-0 animate-backdropIn bg-ink-950/55 backdrop-blur-sm"
      />

      <div
        className="relative z-10 flex h-[88vh] w-full max-w-[460px] animate-modalIn flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-900/95 shadow-2xl sm:h-[84vh] sm:max-h-[820px]"
        style={{
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.04), 0 30px 80px -20px rgba(0,0,0,0.65)",
        }}
      >
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-accent-sky/80 to-transparent" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent-sky/[0.08] opacity-50 blur-3xl" />

        {/* Header */}
        <div className="relative flex items-start justify-between gap-3 border-b border-white/[0.05] px-4 pb-3 pt-4 sm:px-5">
          <div className="flex min-w-0 items-start gap-2">
            <div className="mt-[2px] flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-sky/[0.16] text-accent-sky ring-1 ring-white/10">
              <MessageSquare size={13} />
            </div>
            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.16em] text-white/45">
                <Sparkles size={10} className="text-accent-sky" />
                Talk to dashboard
              </div>
              <div className="mt-0.5 text-[13px] font-semibold text-white">
                {selectedSectors.length === 0
                  ? "Whole dashboard"
                  : selectedSectors.length === 1
                    ? selectedSectors[0].name
                    : `${selectedSectors.length} sectors selected`}
              </div>
              <div className="mt-0.5 truncate text-[10.5px] text-white/45">
                {selectedSectors.length === 0
                  ? "Pick sectors below to scope the chat."
                  : selectedSectors
                      .slice(0, 4)
                      .map((s) => s.shortName)
                      .join(" · ") +
                    (selectedSectors.length > 4
                      ? ` +${selectedSectors.length - 4} more`
                      : "")}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {messages.length > 0 && (
              <button
                onClick={onClear}
                title="Clear conversation"
                aria-label="Clear conversation"
                className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.07] bg-white/[0.02] text-white/55 transition hover:border-white/[0.16] hover:text-white"
              >
                <Eraser size={12} />
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close chat"
              className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.07] bg-white/[0.02] text-white/55 transition hover:border-white/[0.16] hover:text-white"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Sector picker — collapsible row of chips. */}
        <div className="border-b border-white/[0.04] bg-white/[0.012] px-4 py-2.5 sm:px-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.18em] text-white/45">
              <Layers size={10} />
              Scope
            </div>
            <button
              onClick={() => setPicker((p) => !p)}
              className="focus-ring inline-flex items-center gap-1 rounded-md border border-white/[0.07] bg-white/[0.02] px-2 py-0.5 text-[10.5px] text-white/65 transition hover:border-white/[0.16] hover:text-white"
            >
              {picker ? "Hide" : "Pick sectors"}
            </button>
          </div>
          {selectedSectors.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {selectedSectors.map((s) => {
                const Icon = SECTOR_ICONS[s.iconKey];
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleSector(s.id)}
                    title={`Remove ${s.name}`}
                    className="group inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium text-white/85 transition hover:text-white"
                    style={{
                      borderColor: `${s.accent}40`,
                      background: `${s.accent}12`,
                    }}
                  >
                    {Icon && <Icon size={9} style={{ color: s.accent }} />}
                    {s.shortName}
                    <X size={9} className="opacity-50 group-hover:opacity-100" />
                  </button>
                );
              })}
              {selectedSectors.length > 1 && (
                <button
                  onClick={() => setSelectedIds([])}
                  className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-[10.5px] text-white/55 transition hover:border-white/[0.14] hover:text-white"
                >
                  clear
                </button>
              )}
            </div>
          )}
          {picker && (
            <div className="mt-2 rounded-lg border border-white/[0.06] bg-ink-950/40 p-2">
              <label className="relative mb-1.5 flex items-center">
                <Search size={11} className="pointer-events-none absolute left-2 text-white/40" />
                <input
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  placeholder="Filter sectors, companies, subsectors…"
                  className="focus-ring w-full rounded-md border border-white/[0.06] bg-white/[0.02] py-1 pl-6 pr-2 text-[11.5px] text-white/85 placeholder:text-white/35"
                />
              </label>
              <div className="max-h-[180px] overflow-y-auto pr-0.5">
                <div className="grid grid-cols-2 gap-1">
                  {pickerSectors.map((s) => {
                    const Icon = SECTOR_ICONS[s.iconKey];
                    const checked = selectedIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => toggleSector(s.id)}
                        className={classNames(
                          "focus-ring flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-[11px] font-medium transition",
                          checked
                            ? "text-white"
                            : "border-white/[0.05] bg-white/[0.015] text-white/65 hover:border-white/[0.14] hover:text-white",
                        )}
                        style={
                          checked
                            ? {
                                borderColor: `${s.accent}50`,
                                background: `${s.accent}15`,
                              }
                            : undefined
                        }
                      >
                        <span
                          className={classNames(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border",
                            checked
                              ? "border-transparent"
                              : "border-white/[0.12] bg-white/[0.02]",
                          )}
                          style={
                            checked
                              ? { background: s.accent, color: "#0a0e1a" }
                              : undefined
                          }
                        >
                          {checked && <Check size={9} strokeWidth={3} />}
                        </span>
                        {Icon && (
                          <Icon
                            size={11}
                            style={{ color: checked ? s.accent : undefined }}
                          />
                        )}
                        <span className="truncate">{s.shortName}</span>
                      </button>
                    );
                  })}
                </div>
                {pickerSectors.length === 0 && (
                  <div className="px-1 py-2 text-center text-[11px] text-white/45">
                    No matches.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Transcript */}
        <div
          ref={scrollRef}
          className="relative flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5"
        >
          {messages.length === 0 && !isSending && (
            <EmptyState
              sectors={selectedSectors}
              onPick={(q) => {
                setDraft(q);
                textareaRef.current?.focus();
              }}
            />
          )}
          {messages.map((m, i) => (
            <Bubble key={i} message={m} />
          ))}
          {isSending && <TypingBubble />}
          {error && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11.5px] leading-relaxed text-rose-200">
              {error}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-white/[0.05] bg-white/[0.015] px-3 py-3 sm:px-4">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={
                selectedSectors.length === 0
                  ? "Pick sectors above, then ask GPT anything…"
                  : "Ask anything about the selected sectors…"
              }
              rows={2}
              className="focus-ring max-h-40 min-h-[44px] flex-1 resize-y rounded-lg border border-white/[0.07] bg-ink-900/60 px-3 py-2 text-[12.5px] leading-relaxed text-white/90 placeholder:text-white/35"
            />
            <button
              onClick={() => void onSend()}
              disabled={!canSend}
              className={classNames(
                "btn-primary h-[40px]",
                !canSend && "cursor-not-allowed opacity-50 hover:from-white/[0.12]",
              )}
              aria-label="Send message"
            >
              <Send size={12} />
              {isSending ? "Sending" : "Send"}
            </button>
          </div>
          <div className="mt-1.5 px-1 text-[10.5px] text-white/35">
            GPT routes through dashboard tools — headlines, details, article fetch — only
            for what your question needs.
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({ message }: { message: DashboardChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div
      className={classNames(
        "flex w-full",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={classNames(
          "max-w-[88%] whitespace-pre-wrap rounded-2xl border px-3.5 py-2 text-[12.5px] leading-relaxed",
          isUser
            ? "rounded-br-sm border-accent-sky/30 bg-accent-sky/10 text-white"
            : "rounded-bl-sm border-white/[0.06] bg-white/[0.025] text-white/85",
        )}
      >
        {!isUser && (
          <div className="mb-1 flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.2em] text-accent-sky">
            <Sparkles size={9} />
            GPT
          </div>
        )}
        {message.content}
        {!isUser &&
          message.toolCalls &&
          message.toolCalls.length > 0 && <ToolTrail names={message.toolCalls} />}
      </div>
    </div>
  );
}

function ToolTrail({ names }: { names: string[] }) {
  // Compact summary of which tools the model called, deduped + counted.
  const counted = new Map<string, number>();
  for (const n of names) counted.set(n, (counted.get(n) ?? 0) + 1);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-white/[0.05] pt-1.5">
      <Wrench size={9} className="text-white/35" />
      <span className="text-[9.5px] uppercase tracking-[0.18em] text-white/35">
        routed via
      </span>
      {Array.from(counted.entries()).map(([name, count]) => (
        <span
          key={name}
          className="rounded-full border border-white/[0.06] bg-white/[0.02] px-1.5 py-[1px] text-[9.5px] text-white/55"
        >
          {TOOL_LABELS[name] ?? name}
          {count > 1 ? ` ×${count}` : ""}
        </span>
      ))}
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex w-full justify-start">
      <div className="flex max-w-[85%] items-center gap-1 rounded-2xl rounded-bl-sm border border-white/[0.06] bg-white/[0.025] px-3.5 py-2.5">
        <Dot delay={0} />
        <Dot delay={120} />
        <Dot delay={240} />
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-pulseSoft rounded-full bg-white/55"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

function EmptyState({
  sectors,
  onPick,
}: {
  sectors: SectorMeta[];
  onPick: (q: string) => void;
}) {
  const suggestions = useMemo(() => {
    if (sectors.length === 0) {
      return [
        "What are the biggest market-moving stories across the whole dashboard right now?",
        "Show me the top 3 sectors by news heat and explain why.",
        "Find any news that mentions tariffs in the last week.",
      ];
    }
    if (sectors.length === 1) {
      const s = sectors[0];
      return [
        `Summarize the top 5 headlines in ${s.name} right now.`,
        `What's the most bearish story for ${s.shortName} this week and why?`,
        `Which ${s.shortName} companies are getting the most positive coverage?`,
        `What second-order effects in ${s.name} should we watch?`,
      ];
    }
    const names = sectors.map((s) => s.shortName).slice(0, 3).join(", ");
    return [
      `Compare the most impactful story in each of ${names}.`,
      `What's the common thread across ${names} this week?`,
      `Which selected sector has the worst sentiment right now and why?`,
      `Find news that affects more than one of my selected sectors.`,
    ];
  }, [sectors]);

  return (
    <div className="flex flex-col items-start gap-3 py-2">
      <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 text-[10.5px] uppercase tracking-[0.16em] text-accent-sky">
        <Sparkles size={10} />
        Start a thread
      </div>
      <p className="text-[12.5px] leading-relaxed text-white/65">
        Talk to the whole dashboard. Pick any number of sectors above; GPT
        will route through the headlines, details, and article bodies it
        needs to answer.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2.5 py-1 text-left text-[11px] font-medium text-white/75 transition hover:border-white/[0.16] hover:bg-white/[0.05] hover:text-white"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
