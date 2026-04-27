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
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03]">
        <Icon size={16} className="text-white/55" />
      </div>
      <div className="text-[12.5px] font-medium text-white/65">{title}</div>
      {hint && (
        <div className="mt-0.5 max-w-[28ch] text-[11px] text-white/40">
          {hint}
        </div>
      )}
    </div>
  );
}
