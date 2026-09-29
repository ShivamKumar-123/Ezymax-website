"use client";

import * as React from "react";
import { cn } from "@kalks/ui";

/** Six single-digit boxes with paste support (shared by staff sign-in and invite acceptance). */
export function OtpInput({ length = 6, onComplete }: { length?: number; onComplete?: (code: string) => void }) {
  const [vals, setVals] = React.useState<string[]>(Array(length).fill(""));
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);
  React.useEffect(() => refs.current[0]?.focus(), []);
  function set(i: number, v: string) {
    const digits = v.replace(/\D/g, "");
    const next = [...vals];
    if (digits.length > 1) {
      digits.split("").slice(0, length - i).forEach((d, k) => (next[i + k] = d));
      refs.current[Math.min(length - 1, i + digits.length)]?.focus();
    } else {
      next[i] = digits;
      if (digits && i < length - 1) refs.current[i + 1]?.focus();
    }
    setVals(next);
    if (next.every(Boolean)) onComplete?.(next.join(""));
  }
  return (
    <div className="flex justify-between gap-2" dir="ltr">
      {vals.map((v, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={v}
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => set(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !vals[i] && i > 0) refs.current[i - 1]?.focus();
          }}
          className={cn(
            "k-num h-14 w-full rounded-[14px] border bg-surface-2 text-center font-mono text-xl font-semibold outline-none transition-all focus:border-ember/60 focus:ring-4 focus:ring-ember/10",
            v ? "border-[var(--k-border-top)]" : "border-line",
          )}
        />
      ))}
    </div>
  );
}
