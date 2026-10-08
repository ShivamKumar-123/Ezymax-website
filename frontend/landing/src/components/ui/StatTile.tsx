import { cn } from "@/lib/cn";

type StatTileProps = {
  value: string;
  label: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: "text-3xl md:text-4xl",
  md: "text-5xl md:text-6xl",
  lg: "text-6xl md:text-7xl lg:text-8xl",
};

/** Pixel-font number with orange dot label and thin orange underline, like the reference stats. */
export function StatTile({ value, label, size = "md", className }: StatTileProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className={cn("font-pixel leading-none tracking-tight text-ink", sizes[size])}>{value}</div>
      <div className="flex items-center gap-2 border-b border-orange-500/70 pb-3 text-sm text-muted">
        <span className="size-1.5 rounded-full bg-orange-500 shadow-glow-sm" aria-hidden />
        {label}
      </div>
    </div>
  );
}

/** Compact glass variant used for floating hero cards. */
export function FloatingStat({ value, label, className }: StatTileProps) {
  return (
    <div className={cn("glass-strong rounded-card px-5 py-4", className)}>
      <div className="font-pixel text-3xl leading-none text-ink">{value}</div>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted">
        <span className="size-1.5 rounded-full bg-orange-500" aria-hidden />
        {label}
      </div>
    </div>
  );
}
