import type { ReactNode } from "react";

export interface EyebrowProps {
  children: ReactNode;
  /** `light` is for use on the ink surfaces. */
  tone?: "dark" | "light";
  className?: string;
}

/** System-status-style label: tracked-out mono caps behind a lime dot. */
export const Eyebrow = ({
  children,
  tone = "dark",
  className,
}: EyebrowProps) => (
  <span
    className={`inline-flex items-center gap-2 font-mono text-xs tracking-label uppercase ${
      "text-foreground/70"
    } ${className ?? ""}`}
  >
    <span
      className={`size-1.5 rounded-pill ${
        "bg-accent"
      }`}
    />
    {children}
  </span>
);
