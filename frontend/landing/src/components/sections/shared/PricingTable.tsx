import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/cn";
import type { PricingRow, PricingTier } from "@/content/schema";
import { Badge } from "@/components/ui/Badge";
import { CtaButton } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";

function Fee({ value }: { value: string }) {
  const numeric = /^[$€£\d]/.test(value);
  return (
    <span className={numeric ? "font-pixel text-lg text-ink" : "font-display text-sm font-semibold text-ink"}>{value}</span>
  );
}

function Cell({ value }: { value: string | boolean }) {
  if (value === true)
    return (
      <span className="inline-flex size-6 items-center justify-center rounded-full bg-orange-500/15 text-orange-400">
        <Check className="size-3.5" />
      </span>
    );
  if (value === false)
    return (
      <span className="inline-flex size-6 items-center justify-center rounded-full bg-white/5 text-dim">
        <Minus className="size-3.5" />
      </span>
    );
  return <span className="text-sm text-ink">{value}</span>;
}

export function PricingTable({ tiers, rows }: { tiers: PricingTier[]; rows: PricingRow[] }) {
  return (
    <div>
      {/* Desktop table */}
      <Reveal>
        <div className="hidden overflow-hidden rounded-panel border border-line glass lg:block">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                <th className="w-[28%] p-6 align-bottom">
                  <span className="bracket-muted">Compare packages</span>
                </th>
                {tiers.map((t) => (
                  <th
                    key={t.name}
                    className={cn("p-6 align-top", t.highlighted && "bg-orange-500/[0.07]")}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-display text-2xl font-semibold text-ink">{t.name}</span>
                      {t.highlighted ? <Badge variant="solid">Popular</Badge> : null}
                    </div>
                    <p className="mt-1.5 text-sm text-muted">{t.bestFor}</p>
                    <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="block text-[11px] tracking-wide text-dim uppercase">Setup fee</span>
                        <Fee value={t.setupFee} />
                      </div>
                      <div>
                        <span className="block text-[11px] tracking-wide text-dim uppercase">Monthly</span>
                        <Fee value={t.monthlyFee} />
                      </div>
                    </div>
                    <div className="mt-5">
                      <CtaButton cta={{ ...t.cta, variant: t.highlighted ? "primary" : "outline" }} size="md" className="w-full" />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-line last:border-0">
                  <th scope="row" className="p-5 text-sm font-medium text-muted">
                    {row.label}
                  </th>
                  {row.values.map((v, i) => (
                    <td key={i} className={cn("p-5", tiers[i]?.highlighted && "bg-orange-500/[0.07]")}>
                      <Cell value={v} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>

      {/* Mobile stacked cards */}
      <div className="grid gap-4 lg:hidden">
        {tiers.map((t, ti) => (
          <Reveal key={t.name} delay={ti * 0.08}>
            <div className={cn("rounded-panel border border-line glass p-6", t.highlighted && "border-orange-500/50")}>
              <div className="flex items-center gap-3">
                <span className="font-display text-2xl font-semibold text-ink">{t.name}</span>
                {t.highlighted ? <Badge variant="solid">Popular</Badge> : null}
              </div>
              <p className="mt-1 text-sm text-muted">{t.bestFor}</p>
              <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="block text-[11px] tracking-wide text-dim uppercase">Setup fee</span>
                  <Fee value={t.setupFee} />
                </div>
                <div>
                  <span className="block text-[11px] tracking-wide text-dim uppercase">Monthly</span>
                  <Fee value={t.monthlyFee} />
                </div>
              </div>
              <ul className="mt-6 divide-y divide-line border-y border-line">
                {rows.map((row) => (
                  <li key={row.label} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <span className="text-muted">{row.label}</span>
                    <Cell value={row.values[ti]} />
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <CtaButton cta={{ ...t.cta, variant: t.highlighted ? "primary" : "outline" }} size="md" className="w-full" />
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
