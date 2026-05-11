import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Eraser,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import type { NewsItem } from "../types";
import { sectorMetaFor } from "../lib/logic";
import { SECTOR_ICONS } from "../lib/icons";
import { classNames, relativeTime } from "../lib/utils";
import { Markdown } from "../lib/markdown";
import {
  clearChat,
  loadChat,
  saveChat,
  sendChatMessage,
  type ChatMessage,
} from "../lib/newsChat";

interface Props {
  item: NewsItem | null;
  onClose: () => void;
}

/**
 * Per-news GPT chat. State is keyed by NewsItem.id and persisted in
 * localStorage so each headline keeps its own thread across reloads.
 */
export function NewsChatPanel({ item, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reload thread whenever the news item changes.
  useEffect(() => {
    if (!item) {
      setMessages([]);
      setDraft("");
      setError(null);
      return;
    }
    setMessages(loadChat(item.id));
    setDraft("");
    setError(null);
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist whenever the thread mutates (and an item is open).
  useEffect(() => {
    if (!item) return;
    saveChat(item.id, messages);
  }, [item, messages]);

  // Close on Escape.
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  // Autoscroll to the latest message when the list grows or while streaming
  // a response. The transcript lives in a flex-col scroll container so we
  // just pin to scrollHeight on each update.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isSending]);

  // Focus the input on open.
  useEffect(() => {
    if (item) textareaRef.current?.focus();
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const sector = useMemo(
    () => (item ? sectorMetaFor(item.sector) : null),
    [item],
  );
  const Icon = sector ? SECTOR_ICONS[sector.iconKey] : null;
  const accent = sector?.accent ?? "#7DD3FC";
  const accentRgb = sector?.accentRgb ?? "125,211,252";

  if (!item) return null;

  const trimmed = draft.trim();
  const canSend = trimmed.length > 0 && !isSending;

  const onSend = async () => {
    if (!canSend || !item) return;
    const userMsg: ChatMessage = {
      role: "user",
      content: trimmed,
      ts: Date.now(),
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setDraft("");
    setError(null);
    setIsSending(true);
    try {
      const res = await sendChatMessage(item, next);
      setMessages((prev) => [...prev, res.message]);
    } catch (e) {
      setError((e as Error).message || "Chat request failed");
      // Roll back the optimistic user message so they can edit + retry.
      setMessages((prev) => prev.slice(0, -1));
      setDraft(trimmed);
    } finally {
      setIsSending(false);
    }
  };

  const onClear = () => {
    if (!item) return;
    if (messages.length === 0) return;
    const ok = window.confirm("Clear the chat for this news item?");
    if (!ok) return;
    clearChat(item.id);
    setMessages([]);
    setError(null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void onSend();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Chat about this news"
    >
      <div
        onClick={onClose}
        aria-hidden
        className="absolute inset-0 animate-backdropIn bg-ink-950/70 backdrop-blur-sm"
      />

      <div
        className="relative z-10 flex max-h-[88vh] w-full max-w-[760px] animate-modalIn flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-900/95 shadow-2xl"
        style={{
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.04), 0 30px 80px -20px rgba(0,0,0,0.65)",
        }}
      >
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

        {/* Header */}
        <div className="relative flex items-start justify-between gap-3 border-b border-white/[0.05] px-5 pb-3 pt-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-2">
            {Icon && (
              <div
                className="mt-[2px] flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1 ring-white/10"
                style={{
                  background: `rgba(${accentRgb},0.16)`,
                  color: accent,
                }}
              >
                <Icon size={13} />
              </div>
            )}
            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.16em] text-white/45">
                <Sparkles size={10} style={{ color: accent }} />
                Chat about this news · Muns agent
              </div>
              <div className="mt-0.5 truncate text-[13px] font-semibold text-white">
                {item.headline}
              </div>
              <div className="mt-0.5 truncate text-[10.5px] text-white/45">
                {sector?.name ?? item.sector} · {item.source} ·{" "}
                {relativeTime(item.publishedAt)}
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
            {item.newsUrl && (
              <a
                href={item.newsUrl}
                target="_blank"
                rel="noreferrer"
                title="Open source"
                aria-label="Open source"
                className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.07] bg-white/[0.02] text-white/55 transition hover:border-white/[0.16] hover:text-white"
              >
                <ArrowUpRight size={12} />
              </a>
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

        {/* Transcript */}
        <div
          ref={scrollRef}
          className="relative flex-1 space-y-3 overflow-y-auto px-5 py-4 sm:px-6"
        >
          {messages.length === 0 && !isSending && (
            <EmptyChat item={item} accent={accent} onPick={setDraft} />
          )}
          {messages.map((m, i) => (
            <Bubble key={i} message={m} accent={accent} accentRgb={accentRgb} />
          ))}
          {isSending && <TypingBubble accentRgb={accentRgb} />}
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
              placeholder="Ask GPT about this news… (Enter to send, Shift+Enter for newline)"
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
            History is kept per news item in this browser. GPT receives the
            article context and the chat above.
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({
  message,
  accent,
  accentRgb,
}: {
  message: ChatMessage;
  accent: string;
  accentRgb: string;
}) {
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
          "max-w-[85%] rounded-2xl border px-3.5 py-2 text-[12.5px] leading-relaxed",
          isUser
            ? "whitespace-pre-wrap rounded-br-sm border-white/[0.08] text-white"
            : "rounded-bl-sm border-white/[0.06] text-white/85",
        )}
        style={{
          background: isUser
            ? `linear-gradient(180deg, rgba(${accentRgb},0.18), rgba(${accentRgb},0.08))`
            : "rgba(255,255,255,0.025)",
          borderColor: isUser ? `rgba(${accentRgb},0.28)` : undefined,
        }}
      >
        {!isUser && (
          <div
            className="mb-1 flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: accent }}
          >
            <Sparkles size={9} />
            Muns agent
          </div>
        )}
        {isUser ? message.content : <Markdown>{message.content}</Markdown>}
      </div>
    </div>
  );
}

function TypingBubble({ accentRgb }: { accentRgb: string }) {
  return (
    <div className="flex w-full justify-start">
      <div
        className="flex max-w-[85%] items-center gap-1 rounded-2xl rounded-bl-sm border border-white/[0.06] px-3.5 py-2.5"
        style={{ background: `rgba(${accentRgb},0.05)` }}
      >
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

function EmptyChat({
  item,
  accent,
  onPick,
}: {
  item: NewsItem;
  accent: string;
  onPick: (q: string) => void;
}) {
  const suggestions = useMemo(() => {
    const sectorLabel = sectorMetaFor(item.sector)?.name ?? item.sector;
    return [
      "Summarize the article in 5 bullet points.",
      `What does this mean for ${sectorLabel} stocks over the next 6–12 months?`,
      `Steel-man the bull case and the bear case beyond what's listed.`,
      "What second-order effects or adjacent companies are worth watching?",
    ];
  }, [item]);

  return (
    <div className="flex flex-col items-start gap-3 py-2">
      <div
        className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 text-[10.5px] uppercase tracking-[0.16em] text-white/55"
        style={{ color: accent }}
      >
        <Sparkles size={10} />
        Start a thread
      </div>
      <p className="text-[12.5px] leading-relaxed text-white/65">
        Ask anything about this article — GPT will read the source page and
        keep context across the whole conversation.
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
