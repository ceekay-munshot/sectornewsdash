import { MessageSquare, Sparkles } from "lucide-react";

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
      className="focus-ring group fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-white/[0.1] bg-gradient-to-br from-accent-sky/40 via-accent-violet/30 to-accent-mint/30 px-4 py-2.5 text-[12.5px] font-semibold text-white shadow-glow backdrop-blur-md transition hover:from-accent-sky/55 hover:via-accent-violet/40 hover:to-accent-mint/40 sm:bottom-6 sm:right-6"
      style={{
        boxShadow:
          "0 10px 30px -10px rgba(125,211,252,0.45), 0 0 0 1px rgba(255,255,255,0.06)",
      }}
    >
      <span className="relative flex h-5 w-5 items-center justify-center">
        <MessageSquare size={13} className="text-white" />
        <Sparkles
          size={9}
          className="absolute -right-1 -top-1 text-white/90 transition group-hover:scale-110"
        />
      </span>
      <span>Talk to dashboard</span>
    </button>
  );
}
