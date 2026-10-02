"use client";

// "Market-maker rules": the public disclosure of how the Kalks market maker quotes on the options order book
// (docs/OPTIONS-EXCHANGE.md §4): the same rules as every client (no priority, no early view, no last look, firm
// quotes, never takes liquidity), what it does near the cut (the disclosed liquidity-provider exemption: it may keep
// quoting until one minute before the cut, while clients can only close in the last 15 minutes), when it withdraws,
// and the fee schedule. Linked from the Book tab, the chain's Book badge and the ticket.
import * as React from "react";
import { Scale, ShieldCheck } from "lucide-react";
import { cn } from "@kalks/ui";
import { useT } from "@kalks/i18n/react";
import { TDialog } from "@/components/ui/primitives";

const SAME_RULES = ["trader.opt.mm.rule1", "trader.opt.mm.rule2", "trader.opt.mm.rule3", "trader.opt.mm.rule4", "trader.opt.mm.rule5"] as const;
const QUOTING = ["trader.opt.mm.quote1", "trader.opt.mm.quote2", "trader.opt.mm.quote3"] as const;

export function MmRulesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <TDialog open={open} onClose={onClose} title={t("trader.opt.mm.title")} icon={<Scale />} width={560}>
      <div className="space-y-3.5 p-4 text-[12.5px] leading-relaxed text-fg-2">
        <p>{t("trader.opt.mm.intro")}</p>
        <section>
          <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-3">
            <ShieldCheck className="size-3.5 text-up" /> {t("trader.opt.mm.sameTitle")}
          </h3>
          <ol className="space-y-1">
            {SAME_RULES.map((k, i) => (
              <li key={k} className="flex gap-2">
                <span className="mt-px grid size-[18px] shrink-0 place-items-center rounded-full bg-up-soft font-mono text-[10px] font-semibold text-up">{i + 1}</span>
                <span>{t(k)}</span>
              </li>
            ))}
          </ol>
        </section>
        <section>
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-3">{t("trader.opt.mm.quoteTitle")}</h3>
          <ul className="space-y-1">
            {QUOTING.map((k) => (
              <li key={k} className="flex gap-2">
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-ember" />
                <span>{t(k)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-[8px] border border-warn/30 bg-warn-soft/50 px-3 py-2.5">
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-warn">{t("trader.opt.mm.lpTitle")}</h3>
          <p className="text-fg-2">{t("trader.opt.mm.lpText")}</p>
        </section>
        <section>
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-3">{t("trader.opt.mm.feesTitle")}</h3>
          <p>{t("trader.opt.mm.feesText")}</p>
        </section>
        <p className="border-t border-line pt-2.5 text-[11.5px] text-fg-3">{t("trader.opt.mm.latency")}</p>
      </div>
    </TDialog>
  );
}

/** "Market-maker rules" as a small link that opens the disclosure. */
export function MmRulesLink({ className, label }: { className?: string; label?: string }) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn("inline-flex items-center gap-1 whitespace-nowrap text-[11px] text-fg-3 underline-offset-2 hover:text-fg hover:underline", className)}>
        <Scale className="size-3 shrink-0" /> {label ?? t("trader.opt.mm.link")}
      </button>
      <MmRulesDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
