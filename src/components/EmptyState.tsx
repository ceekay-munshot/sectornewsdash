import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

interface Props {
  title: string;
  hint?: string;
  icon?: LucideIcon;
  compact?: boolean;
}

export function EmptyState({ title, hint, icon: Icon = Inbox, compact }: Props) {
  return (
    <div
      className={
        "flex flex-col items-center justify-center text-center text-white/45 " +
        (compact ? "px-4 py-6" : "px-6 py-12")
      }
    >
      <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.025] ring-1 ring-inset ring-white/[0.03]">
        <Icon size={16} className="text-white/55" strokeWidth={1.85} />
      </div>
      <div className="text-[12.5px] font-medium tracking-tightish text-white/70">
        {title}
      </div>
      {hint && (
        <div className="mt-1 max-w-[34ch] text-[11px] leading-relaxed text-white/40">
          {hint}
        </div>
      )}
    </div>
  );
}
