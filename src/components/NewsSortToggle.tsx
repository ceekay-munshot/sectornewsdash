import { classNames } from "../lib/utils";

export type NewsSortMode = "impact" | "latest";

interface Props {
  value: NewsSortMode;
  onChange: (mode: NewsSortMode) => void;
  className?: string;
}

export function NewsSortToggle({ value, onChange, className }: Props) {
  const options: { mode: NewsSortMode; label: string }[] = [
    { mode: "impact", label: "Impact" },
    { mode: "latest", label: "Latest" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Sort news"
      className={classNames(
        "inline-flex rounded-md border border-white/[0.06] bg-white/[0.02] p-0.5 text-[10.5px] normal-case tracking-normal",
        className
      )}
    >
      {options.map((o) => (
        <button
          key={o.mode}
          type="button"
          role="radio"
          aria-checked={value === o.mode}
          onClick={() => onChange(o.mode)}
          className={classNames(
            "rounded px-2 py-0.5 transition",
            value === o.mode
              ? "bg-white/[0.08] text-white"
              : "text-white/55 hover:text-white/80"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
