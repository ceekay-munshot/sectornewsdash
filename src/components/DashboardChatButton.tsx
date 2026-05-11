import { Sparkles } from "lucide-react";

interface Props {
  onClick: () => void;
  hidden?: boolean;
}

/**
 * Floating launcher for the dashboard-wide chat. Pinned to the bottom-right
 * so it's always reachable without crowding the header.
 */
export function DashboardChatButton({ onClick, hidden }: Props) {
  if (hidden) return null;
  return (
    <button
      onClick={onClick}
      aria-label="Talk to dashboard"
      className="focus-ring group fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-ink-900/85 px-3.5 py-2 text-[12px] font-medium text-white/90 backdrop-blur-md transition hover:bg-ink-900 hover:text-white sm:bottom-6 sm:right-6"
      style={{
        boxShadow:
          "0 0 0 1px rgba(255,255,255,0.06), 0 12px 32px -12px rgba(125,211,252,0.35)",
      }}
    >
      <Sparkles size={12} className="text-accent-sky" />
      <span>Talk to dashboard</span>
    </button>
  );
}
