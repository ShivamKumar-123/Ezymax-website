"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@kalks/ui";

/** Custom checkbox: ember gradient when on, dash when partially on. */
export function PermCheckbox({
  checked,
  partial,
  onChange,
  disabled,
  label,
  size = 22,
  tone = "ember",
}: {
  checked: boolean;
  partial?: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
  size?: number;
  tone?: "ember" | "gold";
}) {
  const on = checked || partial;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={partial ? "mixed" : checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-grid shrink-0 place-items-center rounded-[7px] border transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ember/50",
        on
          ? tone === "gold"
            ? "border-gold/60 bg-gradient-to-br from-[#f3cf6b] to-[#c9971f] shadow-[0_4px_14px_-4px_rgba(233,185,73,0.6)]"
            : "border-ember/70 bg-gradient-to-br from-[#ff7a2f] to-[#e8431a] shadow-[0_4px_14px_-4px_rgba(255,90,31,0.7)]"
          : "border-line bg-surface-2 shadow-[inset_0_1px_0_var(--k-border-top)] hover:border-fg-3/60 hover:bg-surface-3",
        partial && !checked && "opacity-70",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      )}
      style={{ width: size, height: size }}
    >
      {checked ? (
        <motion.svg viewBox="0 0 12 12" className="size-[62%] fill-none stroke-white" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" initial={false}>
          <motion.path d="M2.5 6.3l2.2 2.2 4.8-4.9" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.22 }} />
        </motion.svg>
      ) : partial ? (
        <span className="h-[2px] w-[45%] rounded-full bg-white" />
      ) : null}
    </button>
  );
}
