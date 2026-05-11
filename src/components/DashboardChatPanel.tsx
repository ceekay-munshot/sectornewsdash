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
import { Markdown } from "../lib/markdown";
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
 * Full-screen-ish chat panel that talks to the dashboard as a whole.
 *
 * The user picks any number of sectors and asks questions. The Worker uses
 * tool calling (list_headlines, get_news_details, fetch_article, compare_news,
 * search_news) so the model only pulls what it needs into its context.
 *
 * Layout: occupies ~90vw / ~92vh centered. On md+ the sector picker is a
 * persistent left rail; on mobile it collapses to a chip row above the
 * transcript.
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
  const [mobilePicker, setMobilePicker] = useState(false);
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
    () =>
      selectedIds
        .map((id) => sectorById.get(id))
        .filter(Boolean) as SectorMeta[],
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

  const filteredSectors = (() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return sectors;
    return sectors.filter((s) =>
      [s.name, s.shortName, ...s.subsectors, ...s.companies].some((v) =>
        v.toLowerCase().includes(q),
      ),
    );
  })();

  const scopeLabel =
    selectedSectors.length === 0
      ? "Whole dashboard"
      : selectedSectors.length === 1
        ? selectedSectors[0].name
        : `${selectedSectors.length} sectors selected`;

  const scopeDetail =
    selectedSectors.length === 0
      ? "Pick sectors in the sidebar to scope the chat."
      : selectedSectors
          .slice(0, 6)
          .map((s) => s.shortName)
          .join(" · ") +
        (selectedSectors.length > 6
          ? ` +${selectedSectors.length - 6} more`
          : "");

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Talk to dashboard"
    >
      <div
        onClick={onClose}
        aria-hidden
        className="absolute inset-0 animate-backdropIn bg-ink-950/65 backdrop-blur-sm"
      />

      <div
        className="relative z-10 flex h-[94vh] w-[96vw] max-w-[1500px] animate-modalIn flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-900/95 shadow-2xl sm:h-[90vh]"
        style={{
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.04), 0 30px 80px -20px rgba(0,0,0,0.65)",
        }}
      >
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-accent-sky/80 to-transparent" />
        <div className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-accent-sky/[0.08] opacity-50 blur-3xl" />

        {/* Header */}
        <div className="relative flex items-start justify-between gap-3 border-b border-white/[0.05] px-4 pb-3 pt-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-2">
            <div className="mt-[2px] flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-sky/[0.16] text-accent-sky ring-1 ring-white/10">
              <MessageSquare size={14} />
            </div>
            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.16em] text-white/45">
                <Sparkles size={10} className="text-accent-sky" />
                Talk to dashboard · Muns agent
              </div>
              <div className="mt-0.5 truncate text-[14px] font-semibold text-white">
                {scopeLabel}
              </div>
              <div className="mt-0.5 truncate text-[10.5px] text-white/45">
                {scopeDetail}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {messages.length > 0 && (
              <button
                onClick={onClear}
                title="Clear conversation"
                aria-label="Clear conversation"
                className="focus-ring inline-flex h-7 items-center gap-1 rounded-md border border-white/[0.07] bg-white/[0.02] px-2 text-[11px] text-white/55 transition hover:border-white/[0.16] hover:text-white"
              >
                <Eraser size={11} />
                Clear
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

        {/* Mobile scope chip row (visible <md) */}
        <div className="border-b border-white/[0.05] bg-white/[0.012] px-4 py-2.5 md:hidden">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.18em] text-white/45">
              <Layers size={10} />
              Scope
            </div>
            <button
              onClick={() => setMobilePicker((p) => !p)}
              className="focus-ring inline-flex items-center gap-1 rounded-md border border-white/[0.07] bg-white/[0.02] px-2 py-0.5 text-[10.5px] text-white/65 transition hover:border-white/[0.16] hover:text-white"
            >
              {mobilePicker ? "Hide" : "Pick sectors"}
            </button>
          </div>
          {selectedSectors.length > 0 && (
            <SectorChips
              selected={selectedSectors}
              onToggle={toggleSector}
              onClearAll={() => setSelectedIds([])}
            />
          )}
          {mobilePicker && (
            <SectorPicker
              sectors={filteredSectors}
              selectedIds={selectedIds}
              onToggle={toggleSector}
              query={pickerQuery}
              onQueryChange={setPickerQuery}
              className="mt-2 max-h-[180px]"
            />
          )}
        </div>

        {/* Body — sidebar (md+) + chat */}
        <div className="flex min-h-0 flex-1 flex-row">
          {/* Sidebar */}
          <aside className="hidden w-[300px] shrink-0 border-r border-white/[0.05] md:flex md:flex-col">
            <div className="border-b border-white/[0.04] px-4 py-3">
              <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.18em] text-white/45">
                <Layers size={10} />
                Scope
              </div>
              <div className="mt-1 text-[11.5px] text-white/55">
                Select any number of sectors. The agent routes queries through
                only the sectors you pick.
              </div>
              {selectedSectors.length > 0 && (
                <div className="mt-2.5">
                  <SectorChips
                    selected={selectedSectors}
                    onToggle={toggleSector}
                    onClearAll={() => setSelectedIds([])}
                  />
                </div>
              )}
            </div>
            <SectorPicker
              sectors={filteredSectors}
              selectedIds={selectedIds}
              onToggle={toggleSector}
              query={pickerQuery}
              onQueryChange={setPickerQuery}
              className="flex-1 px-3 py-3"
            />
          </aside>

          {/* Chat column */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div
              ref={scrollRef}
              className="relative flex-1 overflow-y-auto px-4 py-5 sm:px-8"
            >
              <div className="mx-auto w-full max-w-[820px] space-y-3.5">
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
            </div>

            <div className="border-t border-white/[0.05] bg-white/[0.015] px-3 py-3 sm:px-6 sm:py-4">
              <div className="mx-auto w-full max-w-[820px]">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={textareaRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={
                      selectedSectors.length === 0
                        ? "Pick sectors first, then ask the Muns agent anything…"
                        : "Ask the Muns agent about the selected sectors…"
                    }
                    rows={2}
                    className="focus-ring max-h-40 min-h-[48px] flex-1 resize-y rounded-lg border border-white/[0.07] bg-ink-900/60 px-3 py-2 text-[13px] leading-relaxed text-white/90 placeholder:text-white/35"
                  />
                  <button
                    onClick={() => void onSend()}
                    disabled={!canSend}
                    className={classNames(
                      "btn-primary h-[44px] px-4",
                      !canSend &&
                        "cursor-not-allowed opacity-50 hover:from-white/[0.12]",
                    )}
                    aria-label="Send message"
                  >
                    <Send size={12} />
                    {isSending ? "Sending" : "Send"}
                  </button>
                </div>
                <div className="mt-2 px-1 text-[10.5px] text-white/35">
                  Muns agent routes through dashboard tools — headlines,
                  details, article fetch — only for what your question needs.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectorChips({
  selected,
  onToggle,
  onClearAll,
}: {
  selected: SectorMeta[];
  onToggle: (id: string) => void;
  onClearAll: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {selected.map((s) => {
        const Icon = SECTOR_ICONS[s.iconKey];
        return (
          <button
            key={s.id}
            onClick={() => onToggle(s.id)}
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
      {selected.length > 1 && (
        <button
          onClick={onClearAll}
          className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-[10.5px] text-white/55 transition hover:border-white/[0.14] hover:text-white"
        >
          clear all
        </button>
      )}
    </div>
  );
}

function SectorPicker({
  sectors,
  selectedIds,
  onToggle,
  query,
  onQueryChange,
  className,
}: {
  sectors: SectorMeta[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  query: string;
  onQueryChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={classNames("flex flex-col overflow-hidden", className)}>
      <label className="relative mb-2 flex items-center">
        <Search
          size={11}
          className="pointer-events-none absolute left-2 text-white/40"
        />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Filter sectors, companies…"
          className="focus-ring w-full rounded-md border border-white/[0.06] bg-white/[0.02] py-1.5 pl-6 pr-2 text-[11.5px] text-white/85 placeholder:text-white/35"
        />
      </label>
      <div className="flex-1 overflow-y-auto pr-0.5">
        <div className="flex flex-col gap-1">
          {sectors.map((s) => {
            const Icon = SECTOR_ICONS[s.iconKey];
            const checked = selectedIds.includes(s.id);
            return (
              <button
                key={s.id}
                onClick={() => onToggle(s.id)}
                className={classNames(
                  "focus-ring flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[11.5px] font-medium transition",
                  checked
                    ? "text-white"
                    : "border-white/[0.05] bg-white/[0.015] text-white/70 hover:border-white/[0.14] hover:text-white",
                )}
                style={
                  checked
                    ? {
                        borderColor: `${s.accent}55`,
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
                    size={12}
                    style={{ color: checked ? s.accent : undefined }}
                  />
                )}
                <span className="truncate">{s.shortName}</span>
              </button>
            );
          })}
        </div>
        {sectors.length === 0 && (
          <div className="px-1 py-3 text-center text-[11px] text-white/45">
            No matches.
          </div>
        )}
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
          "max-w-[92%] rounded-2xl border px-4 py-2.5 text-[13px] leading-relaxed",
          isUser
            ? "whitespace-pre-wrap rounded-br-sm border-accent-sky/30 bg-accent-sky/10 text-white"
            : "rounded-bl-sm border-white/[0.06] bg-white/[0.025] text-white/90",
        )}
      >
        {!isUser && (
          <div className="mb-1 flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.2em] text-accent-sky">
            <Sparkles size={9} />
            Muns agent
          </div>
        )}
        {isUser ? message.content : <Markdown>{message.content}</Markdown>}
        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <ToolTrail names={message.toolCalls} />
        )}
      </div>
    </div>
  );
}

function ToolTrail({ names }: { names: string[] }) {
  const counted = new Map<string, number>();
  for (const n of names) counted.set(n, (counted.get(n) ?? 0) + 1);
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1 border-t border-white/[0.05] pt-2">
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
    const names = sectors
      .map((s) => s.shortName)
      .slice(0, 3)
      .join(", ");
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
        Start a thread with the Muns agent
      </div>
      <p className="text-[13px] leading-relaxed text-white/65">
        Talk to the whole dashboard. Pick any number of sectors on the left;
        the agent will route through the headlines, details, and article
        bodies it needs to answer.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2.5 py-1 text-left text-[11.5px] font-medium text-white/75 transition hover:border-white/[0.16] hover:bg-white/[0.05] hover:text-white"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
