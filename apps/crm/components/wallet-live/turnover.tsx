"use client";

// Deposit turnover: what a client still has to trade before a deposit can be withdrawn.
//
// Two faces of one fact. On the wallet and the dashboard it is a quiet panel showing how far along they are.
// On Withdraw it is the gate itself: pressing Withdraw while volume is owed opens this instead of the payout
// form, with the deposit that is holding things up, the volume done, the volume left, and the way on - back to
// the terminal to trade, or back out.
//
// It shows the broker's own figures and never computes the restriction itself. The service decides, in
// `services/wallet/src/ops/turnover.rs`, on the same path a direct API call takes; this only explains the
// answer. When the broker has not switched the policy on, every client is eligible and nothing here renders.

import * as React from "react";
import Link from "next/link";
import { BadgeCheck, ChevronDown, Target, TrendingUp, X } from "lucide-react";
import { useT } from "@ezymex/i18n/react";
import { Button, Card, Dialog, cn } from "@/components/kit";
import { TERMINAL_URL } from "@/lib/live";
import { useWallet } from "./api";

export type TurnoverDeposit = {
  id: number;
  deposit_amount: string;
  required_volume: string;
  completed_volume: string;
  remaining_volume: string;
  completion_percentage: number;
  status: "pending" | "completed" | "waived";
  created_at: string;
};

export type Turnover = {
  total_deposits: string;
  required_volume: string;
  completed_volume: string;
  remaining_volume: string;
  completion_percentage: number;
  open_requirements: number;
  eligible: boolean;
  deposits: TurnoverDeposit[];
  policy: { enabled: boolean; multiplier: string; min_deposit: string };
};

/** Polled rather than read once: a client who leaves this open while trading should watch the bar move. */
export function useTurnover(ms = 30_000) {
  return useWallet<Turnover>("turnover", ms);
}

/** A requirement only matters while something is owed; a client with none should never see any of this. */
export function owesVolume(t: Turnover | null | undefined): boolean {
  return !!t && !t.eligible && Number(t.remaining_volume) > 0;
}

const usd = (v: string) => `$${Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

function Bar({ pct, className }: { pct: number; className?: string }) {
  return (
    <span className={cn("block h-2 w-full overflow-hidden rounded-full bg-surface-3", className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <span className="block h-full rounded-full bg-ember transition-[width] duration-500 ease-out" style={{ width: `${Math.max(pct, 2)}%` }} />
    </span>
  );
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[11.5px] text-fg-3">{label}</div>
      <div className={cn("k-num mt-0.5 truncate text-[15px]", strong ? "font-semibold text-ember" : "text-fg")}>{value}</div>
    </div>
  );
}

/** Deposit by deposit, for a client who has funded more than once and wants to know which one is holding up. */
function Breakdown({ rows }: { rows: TurnoverDeposit[] }) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const shown = rows.filter((r) => r.status === "pending");
  if (shown.length < 2) return null;
  return (
    <div className="border-t border-line pt-3">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 text-[12.5px] text-fg-2 hover:text-fg">
        {t("wallet.turnover.perDeposit", { count: shown.length })}
        <ChevronDown className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="mt-3 space-y-3">
          {shown.map((r) => (
            <li key={r.id}>
              <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
                <span className="text-fg-2">{t("wallet.turnover.depositOf", { amount: usd(r.deposit_amount) })}</span>
                <span className="k-num shrink-0 text-fg-3">
                  {usd(r.completed_volume)} / {usd(r.required_volume)}
                </span>
              </div>
              <Bar pct={r.completion_percentage} className="mt-1.5 h-1.5" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The figures, shared by the panel and the gate. */
function Body({ d }: { d: Turnover }) {
  const t = useT();
  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure label={t("wallet.turnover.deposited")} value={usd(d.total_deposits)} />
        <Figure label={t("wallet.turnover.required")} value={usd(d.required_volume)} />
        <Figure label={t("wallet.turnover.completed")} value={usd(d.completed_volume)} />
        <Figure label={t("wallet.turnover.remaining")} value={usd(d.remaining_volume)} strong />
      </div>
      <div>
        <Bar pct={d.completion_percentage} />
        <div className="mt-1.5 flex items-center justify-between text-[11.5px] text-fg-3">
          <span>{t("wallet.turnover.percentDone", { pct: d.completion_percentage })}</span>
          <span className="k-num font-medium text-ember">{t("wallet.turnover.left", { amount: usd(d.remaining_volume) })}</span>
        </div>
      </div>
      <p className="text-[12.5px] leading-relaxed text-fg-2">
        {t("wallet.turnover.explain", { deposited: usd(d.total_deposits), completed: usd(d.completed_volume), remaining: usd(d.remaining_volume) })}
      </p>
      <Breakdown rows={d.deposits ?? []} />
    </div>
  );
}

/**
 * The panel: on the wallet and the dashboard, so the requirement is known long before anyone presses Withdraw.
 *
 * A client who first learns about a trading target at the moment they are trying to take their money out has
 * been dealt with badly, whatever the terms said.
 */
export function TurnoverPanel({ className }: { className?: string }) {
  const t = useT();
  const { data } = useTurnover();
  if (!owesVolume(data) || !data) return null;
  return (
    <Card className={cn("border-ember/30", className)}>
      <div className="space-y-3.5 px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ember-soft text-ember">
            <Target className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="k-display text-[15px] font-semibold leading-tight">{t("wallet.turnover.panelTitle")}</h3>
            <p className="mt-0.5 text-[12.5px] text-fg-3">{t("wallet.turnover.panelSub")}</p>
          </div>
        </div>
        <Body d={data} />
      </div>
    </Card>
  );
}

/**
 * The gate on Withdraw. `open` is decided by the page, which also keeps the payout form off screen while this
 * is up - the restriction is enforced in the service, and this only explains it.
 */
export function TurnoverGate({ open, d, onClose }: { open: boolean; d: Turnover; onClose: () => void }) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} width={520} title={t("wallet.turnover.gateTitle")} description={t("wallet.turnover.gateSub")}>
      <div className="space-y-4">
        <Body d={d} />
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="size-4" /> {t("common.close")}
          </Button>
          <Link href={TERMINAL_URL} target="_blank" rel="noopener">
            <Button variant="ember">
              <TrendingUp className="size-4" /> {t("wallet.turnover.continueTrading")}
            </Button>
          </Link>
        </div>
      </div>
    </Dialog>
  );
}

/** Shown on Withdraw once the volume is there, so the client knows why the form opened this time. */
export function TurnoverCleared() {
  const t = useT();
  const { data } = useTurnover(0);
  if (!data || !data.policy?.enabled || Number(data.required_volume) <= 0 || !data.eligible) return null;
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-[14px] border border-up/30 bg-up/5 px-4 py-3 text-[12.5px] text-fg-2">
      <BadgeCheck className="mt-0.5 size-4 shrink-0 text-up" />
      <p>{t("wallet.turnover.cleared")}</p>
    </div>
  );
}
