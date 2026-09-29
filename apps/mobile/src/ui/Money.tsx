// Money: tabular digits, optional +/− sign and P&L colour (green / red are for money only).
import * as React from "react";
import { fmtMoney } from "@/lib/format";
import { Mono, type Tone } from "./Text";

export function Money({ value, currency, signed, colored, size = 15, weight = "medium", decimals, tone }: { value: number | null | undefined; currency?: string; signed?: boolean; colored?: boolean; size?: number; weight?: "regular" | "medium" | "bold"; decimals?: number; tone?: Tone }) {
  const t: Tone = tone ?? (colored && value ? (value > 0 ? "up" : value < 0 ? "down" : "primary") : "primary");
  return (
    <Mono size={size} weight={weight} tone={t}>
      {fmtMoney(value, { currency, signed, decimals })}
    </Mono>
  );
}
