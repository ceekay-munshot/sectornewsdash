import { Fragment, useMemo, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// Tiny markdown renderer for chat bubbles.
//
// Pure React (no innerHTML, no extra deps). Supports the subset the model
// reliably emits in chat:
//   • paragraphs with hard \n breaks
//   • #..###### headings
//   • - / * / + unordered lists, indent-nested
//   • 1. 2. 3. ordered lists, indent-nested
//   • > blockquotes
//   • --- horizontal rules
//   • ```fenced``` code blocks (incl. lang hint, ignored)
//   • inline: **bold**, __bold__, *italic*, _italic_, `code`, [text](url)
// ---------------------------------------------------------------------------

interface ListItem {
  text: string;
  children: Block[];
}

type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; level: number; text: string }
  | { kind: "code"; lang: string; code: string }
  | { kind: "ul"; items: ListItem[] }
  | { kind: "ol"; items: ListItem[]; start: number }
  | { kind: "hr" }
  | { kind: "blockquote"; text: string };

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const UL_RE = /^(\s*)([-*+])\s+(.*)$/;
const OL_RE = /^(\s*)(\d+)\.\s+(.*)$/;
const FENCE_RE = /^```(\w*)\s*$/;
const HR_RE = /^(?:-{3,}|_{3,}|\*{3,})\s*$/;
const BLOCKQUOTE_RE = /^>\s?(.*)$/;

function indentOf(line: string): number {
  const m = /^(\s*)/.exec(line);
  return m ? m[1].length : 0;
}

function parseBlocks(
  lines: string[],
  cur: { i: number },
  minIndent: number,
): Block[] {
  const out: Block[] = [];
  while (cur.i < lines.length) {
    const raw = lines[cur.i];
    if (raw.trim() === "") {
      cur.i++;
      continue;
    }
    const indent = indentOf(raw);
    if (indent < minIndent) break;

    const trimmed = raw.trim();

    const fence = FENCE_RE.exec(trimmed);
    if (fence) {
      const lang = fence[1] || "";
      const buf: string[] = [];
      cur.i++;
      while (cur.i < lines.length && !FENCE_RE.test(lines[cur.i].trim())) {
        buf.push(lines[cur.i]);
        cur.i++;
      }
      if (cur.i < lines.length) cur.i++; // close fence
      out.push({ kind: "code", lang, code: buf.join("\n") });
      continue;
    }

    if (HR_RE.test(trimmed)) {
      out.push({ kind: "hr" });
      cur.i++;
      continue;
    }

    const h = HEADING_RE.exec(trimmed);
    if (h) {
      out.push({ kind: "h", level: h[1].length, text: h[2] });
      cur.i++;
      continue;
    }

    if (BLOCKQUOTE_RE.test(trimmed)) {
      const parts: string[] = [];
      while (cur.i < lines.length) {
        const m = BLOCKQUOTE_RE.exec(lines[cur.i].trim());
        if (!m) break;
        parts.push(m[1]);
        cur.i++;
      }
      out.push({ kind: "blockquote", text: parts.join("\n") });
      continue;
    }

    const ulm = UL_RE.exec(raw);
    if (ulm && ulm[1].length === indent) {
      const items: ListItem[] = [];
      while (cur.i < lines.length) {
        const m = UL_RE.exec(lines[cur.i]);
        if (!m) break;
        if (m[1].length !== indent) break;
        const text = m[3];
        cur.i++;
        const children = parseBlocks(lines, cur, indent + 1);
        items.push({ text, children });
      }
      out.push({ kind: "ul", items });
      continue;
    }

    const olm = OL_RE.exec(raw);
    if (olm && olm[1].length === indent) {
      const start = parseInt(olm[2], 10);
      const items: ListItem[] = [];
      while (cur.i < lines.length) {
        const m = OL_RE.exec(lines[cur.i]);
        if (!m) break;
        if (m[1].length !== indent) break;
        const text = m[3];
        cur.i++;
        const children = parseBlocks(lines, cur, indent + 1);
        items.push({ text, children });
      }
      out.push({ kind: "ol", items, start });
      continue;
    }

    // Paragraph: hoover up subsequent non-block lines.
    const paraLines: string[] = [raw.slice(indent)];
    cur.i++;
    while (cur.i < lines.length) {
      const next = lines[cur.i];
      if (next.trim() === "") break;
      if (indentOf(next) < minIndent) break;
      const nt = next.trim();
      if (
        HEADING_RE.test(nt) ||
        UL_RE.test(next) ||
        OL_RE.test(next) ||
        FENCE_RE.test(nt) ||
        HR_RE.test(nt) ||
        BLOCKQUOTE_RE.test(nt)
      )
        break;
      paraLines.push(next.slice(indent));
      cur.i++;
    }
    out.push({ kind: "p", text: paraLines.join("\n") });
  }
  return out;
}

// Inline parse with a combined regex. No /g flag — we slice and re-exec
// instead of using lastIndex, because renderInline recurses for bold/italic
// content and a shared global regex would clobber the outer iterator's
// cursor (causing an infinite loop on the first emphasis match).
// Order in the alternation matters: code first so we don't process bold/
// italic inside backticks; links before * so [t](*x*) doesn't tangle.
const INLINE_RE =
  /(`[^`\n]+`)|(\[[^\]\n]+\]\([^)\n]+\))|(\*\*[^*\n][\s\S]*?\*\*)|(__[^_\n][\s\S]*?__)|(\*[^*\n][\s\S]*?\*)|(_[^_\n][\s\S]*?_)/;

function renderTextWithBreaks(text: string, baseKey: string): ReactNode[] {
  const out: ReactNode[] = [];
  const parts = text.split("\n");
  parts.forEach((p, i) => {
    if (i > 0) out.push(<br key={`${baseKey}-br-${i}`} />);
    if (p) out.push(<Fragment key={`${baseKey}-t-${i}`}>{p}</Fragment>);
  });
  return out;
}

function renderInline(text: string, baseKey: string): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let k = 0;
  while (rest.length > 0) {
    const m = INLINE_RE.exec(rest);
    if (!m) {
      out.push(...renderTextWithBreaks(rest, `${baseKey}-${k++}`));
      break;
    }
    if (m.index > 0) {
      out.push(
        ...renderTextWithBreaks(rest.slice(0, m.index), `${baseKey}-${k++}`),
      );
    }
    const t = m[0];
    if (t.startsWith("`")) {
      out.push(
        <code
          key={`${baseKey}-c-${k++}`}
          className="rounded bg-white/[0.09] px-1 py-0.5 font-mono text-[11.5px] text-white/90"
        >
          {t.slice(1, -1)}
        </code>,
      );
    } else if (t.startsWith("[")) {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(t);
      if (link) {
        out.push(
          <a
            key={`${baseKey}-a-${k++}`}
            href={link[2]}
            target="_blank"
            rel="noreferrer"
            className="text-accent-sky underline-offset-2 hover:underline"
          >
            {link[1]}
          </a>,
        );
      } else {
        out.push(t);
      }
    } else if (t.startsWith("**")) {
      out.push(
        <strong key={`${baseKey}-b-${k++}`} className="font-semibold text-white">
          {renderInline(t.slice(2, -2), `${baseKey}-bi-${k}`)}
        </strong>,
      );
    } else if (t.startsWith("__")) {
      out.push(
        <strong key={`${baseKey}-b2-${k++}`} className="font-semibold text-white">
          {renderInline(t.slice(2, -2), `${baseKey}-b2i-${k}`)}
        </strong>,
      );
    } else if (t.startsWith("*")) {
      out.push(
        <em key={`${baseKey}-i-${k++}`} className="italic">
          {renderInline(t.slice(1, -1), `${baseKey}-ii-${k}`)}
        </em>,
      );
    } else if (t.startsWith("_")) {
      out.push(
        <em key={`${baseKey}-i2-${k++}`} className="italic">
          {renderInline(t.slice(1, -1), `${baseKey}-i2i-${k}`)}
        </em>,
      );
    }
    rest = rest.slice(m.index + t.length);
  }
  return out;
}

function renderBlock(b: Block, key: number, startCounter = 1): ReactNode {
  switch (b.kind) {
    case "p":
      return (
        <p
          key={key}
          className="my-1.5 leading-relaxed first:mt-0 last:mb-0"
        >
          {renderInline(b.text, `p${key}`)}
        </p>
      );
    case "h": {
      const sizeClass =
        b.level <= 1
          ? "mt-3 mb-1.5 text-[14.5px] font-semibold text-white"
          : b.level === 2
            ? "mt-3 mb-1.5 text-[13.5px] font-semibold text-white"
            : "mt-2.5 mb-1 text-[12.5px] font-semibold text-white";
      // Render as semantic h3..h6 inside chat bubbles — keep page hierarchy intact.
      const Tag = `h${Math.min(6, Math.max(3, b.level + 2))}` as
        | "h3"
        | "h4"
        | "h5"
        | "h6";
      return (
        <Tag key={key} className={sizeClass}>
          {renderInline(b.text, `h${key}`)}
        </Tag>
      );
    }
    case "code":
      return (
        <pre
          key={key}
          className="my-2 overflow-x-auto rounded-md border border-white/[0.06] bg-ink-950/60 p-2.5 font-mono text-[11.5px] leading-relaxed text-white/85"
        >
          <code>{b.code}</code>
        </pre>
      );
    case "hr":
      return <hr key={key} className="my-3 border-white/[0.08]" />;
    case "blockquote":
      return (
        <blockquote
          key={key}
          className="my-2 border-l-2 border-white/[0.18] pl-3 italic text-white/75"
        >
          {renderInline(b.text, `bq${key}`)}
        </blockquote>
      );
    case "ul":
      return (
        <ul key={key} className="my-1.5 space-y-1">
          {b.items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-[8px] block h-1 w-1 shrink-0 rounded-full bg-white/45" />
              <div className="min-w-0 flex-1">
                <div>{renderInline(it.text, `ul${key}-${i}`)}</div>
                {it.children.length > 0 && (
                  <div className="mt-0.5 pl-1">
                    {it.children.map((c, j) => renderBlock(c, j))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={key} className="my-1.5 space-y-1">
          {b.items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span className="shrink-0 pt-[1px] font-mono text-[11.5px] text-white/45">
                {b.start + i}.
              </span>
              <div className="min-w-0 flex-1">
                <div>{renderInline(it.text, `ol${key}-${i}`)}</div>
                {it.children.length > 0 && (
                  <div className="mt-0.5 pl-1">
                    {it.children.map((c, j) => renderBlock(c, j))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      );
  }
  // exhaustive
  void startCounter;
  return null;
}

export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const blocks = useMemo(() => {
    const lines = (children ?? "").replace(/\r\n/g, "\n").split("\n");
    return parseBlocks(lines, { i: 0 }, 0);
  }, [children]);
  return (
    <div className={className}>
      {blocks.map((b, i) => renderBlock(b, i))}
    </div>
  );
}
