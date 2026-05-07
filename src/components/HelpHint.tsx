import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HelpCircle } from "lucide-react";
import { classNames } from "../lib/utils";

const POPOVER_WIDTH = 260;

interface Props {
  title: string;
  description?: string;
  formula?: string;
  inputs?: string[];
  className?: string;
}

/**
 * Tiny `?` button that pops a small explainer (formula + inputs) when
 * hovered or focused. Inline-friendly — drop it next to the metric it
 * describes (KPI label, section header, etc.).
 */
export function HelpHint(props: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const show = () => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const left = Math.max(
      8,
      Math.min(window.innerWidth - POPOVER_WIDTH - 8, r.right - POPOVER_WIDTH)
    );
    setPos({ top: r.bottom + 6, left });
  };
  const hide = () => setPos(null);

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        aria-label={`How is ${props.title} computed?`}
        className={classNames(
          "inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.02] text-white/45 transition hover:border-white/20 hover:text-white/80",
          props.className
        )}
      >
        <HelpCircle size={9} />
      </button>
      {pos
        ? createPortal(
            <Popover top={pos.top} left={pos.left} {...props} />,
            document.body
          )
        : null}
    </>
  );
}

function Popover({
  top,
  left,
  title,
  description,
  formula,
  inputs,
}: Props & { top: number; left: number }) {
  return (
    <div
      role="tooltip"
      style={{
        position: "fixed",
        top,
        left,
        width: POPOVER_WIDTH,
        zIndex: 60,
      }}
      className="pointer-events-none animate-floatIn rounded-lg border border-white/[0.08] bg-ink-950/95 p-2.5 shadow-2xl backdrop-blur-xl"
    >
      <div className="text-[11.5px] font-semibold text-white">{title}</div>
      {description ? (
        <div className="mt-1 text-[10.5px] leading-snug text-white/55">
          {description}
        </div>
      ) : null}
      {formula ? (
        <div className="mt-2 break-words rounded-md border border-white/[0.05] bg-white/[0.02] px-2 py-1.5 font-mono text-[10.5px] text-white/75">
          {formula}
        </div>
      ) : null}
      {inputs && inputs.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {inputs.map((i) => (
            <span
              key={i}
              className="inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.02] px-1.5 py-[2px] text-[10px] text-white/60"
            >
              {i}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
