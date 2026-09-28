"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Ban, CalendarDays, Check, Clock, Gauge as GaugeIcon, Layers, Loader2, Minus, Percent, ShieldCheck, Target, TrendingDown, Trophy, Wallet, Zap } from "lucide-react";
import { Button, Card, CardHeader, Chip, Dialog, EmptyState, PageHeader, Reveal, Segmented, Skeleton, cn } from "@kalks/ui";
import {
  PAYOUT_FREQ,
  TYPE_LABEL,
  bannedLabel,
  propApi,
  sizeLabel,
  usd,
  usePropPoll,
  type Challenge,
  type Plan,
  type PlanSize,
  type PlanType,
  type PurchaseResult,
} from "./api";
import { CredentialField, ErrorNote, LoadError, PropTradeButton } from "./ui";

const TYPE_ORDER: PlanType[] = ["1-step", "2-step", "instant"];
const TYPE_ICON: Record<PlanType, React.ReactNode> = {
  "1-step": <Target className="size-3.5" />,
  "2-step": <Layers className="size-3.5" />,
  instant: <Zap className="size-3.5" />,
};
const TYPE_TEXT: Record<PlanType, string> = {
  "1-step": "One evaluation phase. Hit the target, respect the limits, get funded.",
  "2-step": "Two evaluation phases with lower targets and wider limits.",
  instant: "No evaluation. Start on a funded account straight away with tighter limits.",
};

/* ------------------------------------------------------------------ */
/* Rule text                                                           */
/* ------------------------------------------------------------------ */

const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

export function targetsText(p: Plan) {
  return p.phases.length ? p.phases.map((x) => `${x.target}%`).join(" / ") : "None";
}

export function ddText(p: Plan) {
  return `${p.maxDD}% ${p.ddType}${p.ddType === "trailing" && p.trailingLock ? ", locks at start" : ""}`;
}

/** Every rule of a plan at one size, as label / value rows. */
export function planRules(p: Plan, s: PlanSize): [string, React.ReactNode][] {
  const rows: [string, React.ReactNode][] = [];
  for (const ph of p.phases) {
    rows.push([`${ph.name} target`, `${ph.target}% · ${usd((s.size * ph.target) / 100, 0)}`]);
    rows.push([`${ph.name} minimum days`, days(ph.minDays)]);
    rows.push([`${ph.name} time limit`, ph.timeLimit ? days(ph.timeLimit) : "No time limit"]);
  }
  if (!p.phases.length) rows.push(["Evaluation", "None, funded from day one"]);
  rows.push(["Daily loss limit", `${p.dailyLoss}% · ${usd((s.size * p.dailyLoss) / 100, 0)} · from ${p.dailyBasis === "equity" ? "higher of balance and equity" : "balance"} at 17:00 New York`]);
  rows.push(["Max drawdown", `${ddText(p)} · ${usd((s.size * p.maxDD) / 100, 0)}`]);
  rows.push(["Consistency", p.consistency > 0 ? `Best day ≤ ${p.consistency}% of total profit` : "No consistency rule"]);
  rows.push(["News trading", p.newsTrading ? "Allowed" : `Not within ±${p.newsWindow} min of high-impact news${p.newsBreachFails ? " (fails the account)" : ""}`]);
  rows.push(["Weekend holding", p.weekendHolding ? "Allowed" : "Positions closed Friday 16:45 New York"]);
  rows.push(["Expert Advisors", p.eaAllowed ? "Allowed" : "Not allowed"]);
  rows.push(["Banned strategies", p.banned.length ? p.banned.map(bannedLabel).join(", ") : "None"]);
  rows.push(["Profit split", p.splitMax > p.split ? `${p.split}%, scaling to ${p.splitMax}%` : `${p.split}%`]);
  rows.push(["First payout", `After ${days(p.firstPayoutDays)}, then ${(PAYOUT_FREQ[p.payoutFreq] ?? p.payoutFreq).toLowerCase()} · min ${usd(p.minPayout, 0)}`]);
  rows.push(["Fee refund", p.refundFee ? "Refunded with the first payout" : "Non-refundable"]);
  rows.push(["Leverage", `1:${s.leverage}`]);
  return rows;
}

/* ------------------------------------------------------------------ */
/* Phase track                                                         */
/* ------------------------------------------------------------------ */

function PhaseTrack({ p }: { p: Plan }) {
  const steps = [...p.phases.map((x) => ({ name: x.name, title: `${x.target}% target`, sub: `Min ${days(x.minDays)}${x.timeLimit ? ` · ${days(x.timeLimit)} max` : ""}`, funded: false })), { name: "Funded", title: `${p.split}% split`, sub: `First payout after ${days(p.firstPayoutDays)}`, funded: true }];
  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row">
      {steps.map((s, i) => (
        <React.Fragment key={s.name}>
          <div className={cn("k-row flex-1 px-3.5 py-3", s.funded && "border-gold/30 bg-gold-soft")}>
            <div className="flex items-center gap-2 text-[11px] text-fg-3">
              <span className={cn("grid size-5 place-items-center rounded-full text-[10px] font-semibold", s.funded ? "bg-gold text-[#1a1204]" : "bg-surface-3 text-fg-2")}>{i + 1}</span>
              {s.name}
            </div>
            <div className="k-num mt-1.5 text-[15px] font-semibold">{s.title}</div>
            <div className="mt-0.5 text-[11px] text-fg-3">{s.sub}</div>
          </div>
          {i < steps.length - 1 && (
            <div className="hidden items-center sm:flex">
              <ArrowRight className="size-4 text-fg-3" />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Configurator + plan card                                            */
/* ------------------------------------------------------------------ */

function Configurator({ plans, plan, setPlan, size, setSize }: { plans: Plan[]; plan: Plan; setPlan: (id: string) => void; size: PlanSize; setSize: (n: number) => void }) {
  const types = TYPE_ORDER.filter((t) => plans.some((p) => p.type === t));
  const sameType = plans.filter((p) => p.type === plan.type);
  return (
    <Card className="h-full">
      <CardHeader title="Choose your challenge" subtitle="Pick a model and an account size" icon={<Trophy />} />
      <div className="space-y-5 px-4 pb-6 pt-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            size="md"
            value={plan.type}
            onChange={(t) => setPlan(plans.find((p) => p.type === t)!.id)}
            options={types.map((t) => ({ value: t, label: <>{TYPE_ICON[t]}{TYPE_LABEL[t]}</> }))}
          />
          {sameType.length > 1 && <Segmented size="xs" value={plan.id} onChange={setPlan} options={sameType.map((p) => ({ value: p.id, label: p.name }))} />}
        </div>
        <p className="text-[13.5px] text-fg-2">{TYPE_TEXT[plan.type]}</p>

        <div>
          <div className="k-label mb-2.5">Account size</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {plan.sizes.map((s) => {
              const on = s.size === size.size;
              return (
                <button
                  key={s.size}
                  type="button"
                  onClick={() => setSize(s.size)}
                  aria-pressed={on}
                  className={cn("rounded-[14px] border px-3 py-3 text-left transition-colors", on ? "border-ember/50 bg-ember-soft" : "border-line bg-surface-2 hover:border-fg-3/40 hover:bg-surface-3")}
                >
                  <div className="k-num text-[17px] font-semibold tracking-tight">{sizeLabel(s.size)}</div>
                  <div className={cn("k-num mt-0.5 text-[11.5px]", on ? "text-ember" : "text-fg-3")}>{usd(s.fee, s.fee % 1 ? 2 : 0)}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="k-label mb-2.5">Your path</div>
          <PhaseTrack p={plan} />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { i: <TrendingDown />, l: "Daily loss", v: `${plan.dailyLoss}%`, s: `${usd((size.size * plan.dailyLoss) / 100, 0)} · ${plan.dailyBasis}` },
            { i: <GaugeIcon />, l: "Max drawdown", v: `${plan.maxDD}%`, s: `${plan.ddType} · ${usd((size.size * plan.maxDD) / 100, 0)}` },
            { i: <CalendarDays />, l: "Min days", v: plan.phases.length ? String(Math.max(...plan.phases.map((p) => p.minDays))) : "—", s: plan.phases.some((p) => p.timeLimit) ? "Time limit applies" : "No time limit" },
            { i: <Percent />, l: "Profit split", v: `${plan.split}%`, s: plan.splitMax > plan.split ? `Scales to ${plan.splitMax}%` : "Fixed" },
          ].map((x) => (
            <div key={x.l} className="k-row px-3.5 py-3">
              <div className="flex items-center gap-1.5 text-[11px] text-fg-3 [&_svg]:size-3.5">
                {x.i}
                {x.l}
              </div>
              <div className="k-num mt-1 text-[18px] font-semibold">{x.v}</div>
              <div className="truncate text-[11px] text-fg-3">{x.s}</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function PlanCard({ plan, size, onBuy }: { plan: Plan; size: PlanSize; onBuy: () => void }) {
  const rows: [string, React.ReactNode][] = [
    ...plan.phases.map((p): [string, React.ReactNode] => [`${p.name} target`, `${p.target}% · ${usd((size.size * p.target) / 100, 0)}`]),
    ["Daily loss limit", `${plan.dailyLoss}% · ${plan.dailyBasis}`],
    ["Max drawdown", `${plan.maxDD}% ${plan.ddType}`],
    ["Leverage", `1:${size.leverage}`],
    ["Profit split", plan.splitMax > plan.split ? `${plan.split}% → ${plan.splitMax}%` : `${plan.split}%`],
    ["Fee refund", plan.refundFee ? <span className="text-up">With 1st payout</span> : <span className="text-fg-3">Non-refundable</span>],
  ];
  return (
    <Card className="flex h-full flex-col">
      <div className="flex flex-1 flex-col p-6">
        <div className="k-label">{plan.name}</div>
        <div className="mt-1 text-[13px] text-fg-2">{sizeLabel(size.size)} simulated account</div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="k-num text-[44px] font-semibold leading-none tracking-[-0.03em]">{usd(size.fee, size.fee % 1 ? 2 : 0)}</span>
          <span className="text-[13px] text-fg-3">one-time · USDT</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {plan.refundFee && (
            <Chip size="sm" tone="gold">
              Refundable
            </Chip>
          )}
          <Chip size="sm">1:{size.leverage} leverage</Chip>
          <Chip size="sm">{plan.phases.some((p) => p.timeLimit) ? "Time limit" : "No time limit"}</Chip>
        </div>
        <dl className="mt-5 divide-y divide-line text-[13px]">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-fg-2">{k}</dt>
              <dd className="k-num text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-auto pt-5">
          <Button variant="ember" size="xl" className="w-full" onClick={onBuy}>
            Buy challenge · {usd(size.fee, size.fee % 1 ? 2 : 0)} <ArrowRight />
          </Button>
          <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[11.5px] text-fg-3">
            <Wallet className="size-3.5" /> Paid from your USDT wallet
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Compare table                                                       */
/* ------------------------------------------------------------------ */

function Yes({ children }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-fg">
      <Check className="size-3.5 text-up" />
      {children}
    </span>
  );
}

function No({ children }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-fg-3">
      <Minus className="size-3.5" />
      {children}
    </span>
  );
}

function CompareTable({ plans, current, size, onPick }: { plans: Plan[]; current: string; size: number; onPick: (id: string) => void }) {
  const feeAt = (p: Plan) => p.sizes.find((s) => s.size === size) ?? null;
  const rows: { label: string; icon: React.ReactNode; cell: (p: Plan) => React.ReactNode }[] = [
    { label: `Fee (${sizeLabel(size)})`, icon: <Wallet />, cell: (p) => (feeAt(p) ? <span className="k-num font-semibold">{usd(feeAt(p)!.fee, 0)}</span> : <span className="text-fg-3">Not offered</span>) },
    { label: "Profit target", icon: <Target />, cell: (p) => targetsText(p) },
    { label: "Daily loss limit", icon: <TrendingDown />, cell: (p) => <span>{p.dailyLoss}% <span className="text-fg-3">· {p.dailyBasis}</span></span> },
    { label: "Max drawdown", icon: <GaugeIcon />, cell: (p) => <span>{p.maxDD}% <span className="text-fg-3">· {p.ddType}</span></span> },
    { label: "Min trading days", icon: <CalendarDays />, cell: (p) => (p.phases.length ? p.phases.map((x) => x.minDays).join(" / ") : "—") },
    { label: "Time limit", icon: <Clock />, cell: (p) => (p.phases.some((x) => x.timeLimit) ? p.phases.map((x) => (x.timeLimit ? days(x.timeLimit) : "none")).join(" / ") : "None") },
    { label: "Leverage", icon: <Layers />, cell: (p) => (feeAt(p) ? `1:${feeAt(p)!.leverage}` : `1:${p.sizes[0]?.leverage ?? "—"}`) },
    { label: "Profit split", icon: <Percent />, cell: (p) => (p.splitMax > p.split ? `${p.split}% → ${p.splitMax}%` : `${p.split}%`) },
    { label: "Fee refund", icon: <Check />, cell: (p) => (p.refundFee ? <Yes>1st payout</Yes> : <No>No</No>) },
    { label: "Consistency rule", icon: <ShieldCheck />, cell: (p) => (p.consistency > 0 ? `Best day ≤ ${p.consistency}%` : <No>None</No>) },
    { label: "News trading", icon: <Zap />, cell: (p) => (p.newsTrading ? <Yes>Allowed</Yes> : <No>±{p.newsWindow} min blocked</No>) },
    { label: "Weekend holding", icon: <CalendarDays />, cell: (p) => (p.weekendHolding ? <Yes>Allowed</Yes> : <No>Closed Friday</No>) },
    { label: "Expert Advisors", icon: <Layers />, cell: (p) => (p.eaAllowed ? <Yes>Allowed</Yes> : <No>Not allowed</No>) },
    { label: "Banned strategies", icon: <Ban />, cell: (p) => <span className="text-[12px] text-fg-2">{p.banned.length ? p.banned.map(bannedLabel).join(" · ") : "None"}</span> },
    { label: "First payout", icon: <Clock />, cell: (p) => `After ${days(p.firstPayoutDays)} · ${(PAYOUT_FREQ[p.payoutFreq] ?? p.payoutFreq).toLowerCase()}` },
  ];
  return (
    <Card>
      <CardHeader title="Compare the rules" subtitle="Every plan side by side. Rules are checked on the server around the clock." icon={<Layers />} />
      <div className="overflow-x-auto px-4 pb-6 pt-4 sm:px-6">
        <table className="w-full border-separate border-spacing-0 text-[13px]" style={{ minWidth: 220 + plans.length * 220 }}>
          <thead>
            <tr>
              <th className="w-[22%] pb-3 text-left text-[11.5px] font-medium uppercase tracking-wider text-fg-3">Rule</th>
              {plans.map((p) => {
                const on = p.id === current;
                const from = Math.min(...p.sizes.map((s) => s.fee));
                return (
                  <th key={p.id} className="px-1.5 pb-3 align-bottom">
                    <button
                      type="button"
                      onClick={() => onPick(p.id)}
                      className={cn("flex w-full items-center justify-between gap-2 rounded-t-[16px] border border-b-0 px-4 py-3 text-left transition-colors", on ? "border-ember/40 bg-ember-soft" : "border-line bg-surface-2 hover:bg-surface-3")}
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-[14px] font-medium text-fg">
                          {TYPE_ICON[p.type]} <span className="truncate">{p.name}</span>
                        </span>
                        <span className="mt-0.5 block text-[11px] font-normal text-fg-3">from {usd(from, 0)}</span>
                      </span>
                      {on && (
                        <Chip size="sm" tone="ember">
                          Selected
                        </Chip>
                      )}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={r.label}>
                <td className="border-t border-line py-3 pr-3 text-fg-2">
                  <span className="flex items-center gap-2 [&_svg]:size-3.5 [&_svg]:text-fg-3">
                    {r.icon}
                    {r.label}
                  </span>
                </td>
                {plans.map((p) => {
                  const on = p.id === current;
                  return (
                    <td key={p.id} className="px-1.5 py-0">
                      <div
                        className={cn(
                          "h-full border-x border-t px-4 py-3",
                          on ? "border-x-ember/40 border-t-ember/15 bg-ember-soft/60" : "border-x-line border-t-line",
                          ri === rows.length - 1 && "rounded-b-[16px] border-b",
                          ri === rows.length - 1 && (on ? "border-b-ember/40" : "border-b-line"),
                        )}
                      >
                        {r.cell(p)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Checkout                                                            */
/* ------------------------------------------------------------------ */

function newKey() {
  const c = globalThis.crypto;
  return c && "randomUUID" in c ? c.randomUUID() : `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

export function CheckoutDialog({ plan, size, open, onOpenChange, onBought }: { plan: Plan; size: PlanSize; open: boolean; onOpenChange: (o: boolean) => void; onBought?: () => void }) {
  const [agree, setAgree] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<unknown>(null);
  const [done, setDone] = React.useState<PurchaseResult | null>(null);
  // one key per dialog session: a retry after a network error or a pending payment reuses it, so the fee is
  // never charged twice
  const key = React.useRef<string>("");

  React.useEffect(() => {
    if (open) {
      key.current = newKey();
      setAgree(false);
      setErr(null);
      setDone(null);
      setBusy(false);
    }
  }, [open, plan.id, size.size]);

  const pay = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await propApi<PurchaseResult>("challenges", { body: { planId: plan.id, size: size.size, idempotencyKey: key.current } });
      setDone(r);
      onBought?.();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  const fee = usd(size.fee, size.fee % 1 ? 2 : 0);
  const creds = done?.credentials ?? null;
  const login = creds?.login ?? done?.challenge.current?.login ?? null;

  if (done) {
    return (
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title="Your challenge is ready"
        description={`${plan.name} · ${sizeLabel(size.size)} · ${done.challenge.current?.phase ?? (plan.phases[0]?.name ?? "Funded")}`}
        width={560}
        footer={
          <>
            <Link href="/prop/mine">
              <Button variant="surface">
                My challenges <ArrowRight />
              </Button>
            </Link>
            <PropTradeButton login={login} size="md" label="Trade now" />
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-[14px] border border-up/25 bg-up-soft px-4 py-3">
            <Check className="mt-0.5 size-4 shrink-0 text-up" />
            <p className="text-[13px] text-fg">
              {fee} was paid from your USDT wallet and your {sizeLabel(size.size)} account is open. The rules are live from now on.
            </p>
          </div>
          {creds ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <CredentialField label="Login" value={String(creds.login)} />
                <CredentialField label="Server" value="Kalks-Live" mono={false} />
                <CredentialField label="Trading password" value={creds.password} secret />
                <CredentialField label="Investor password (read-only)" value={creds.investorPassword} secret />
              </div>
              <p className="text-[12.5px] text-fg-3">
                Save these passwords now: they are shown only once and we don&apos;t store them. The Trade button signs you in to Kalks Trader without a password, so you can always trade from here.
              </p>
            </>
          ) : (
            <p className="text-[13px] text-fg-2">
              The trading passwords were shown when this purchase was first confirmed. Use the Trade button to open Kalks Trader: it signs you in without a password.
            </p>
          )}
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title={`Buy ${plan.name}`}
      description={`${sizeLabel(size.size)} simulated account · ${fee} one-time fee`}
      width={600}
      footer={
        <>
          <Button variant="surface" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="ember" disabled={!agree || busy} onClick={pay}>
            {busy ? <Loader2 className="animate-spin" /> : <Wallet />} {err ? `Retry · ${fee}` : `Pay ${fee}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-[14px] border border-line bg-surface-2 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full border border-line bg-surface-3 text-fg-2">
              <Wallet className="size-4" />
            </span>
            <div>
              <div className="text-[13.5px] font-medium">Paid from your USDT wallet</div>
              <div className="text-[12px] text-fg-3">Charged once. {plan.refundFee ? "Refunded with your first payout." : "Non-refundable."}</div>
            </div>
          </div>
          <span className="k-num text-[18px] font-semibold">{fee}</span>
        </div>

        <div>
          <div className="k-label mb-2">Rules of this challenge</div>
          <dl className="divide-y divide-line rounded-[14px] border border-line px-4">
            {planRules(plan, size).map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-4 py-2.5 text-[12.5px]">
                <dt className="shrink-0 text-fg-3">{k}</dt>
                <dd className="text-right font-medium text-fg">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-[11.5px] text-fg-3">Limits are a percentage of the starting balance. Breaching the daily loss or max drawdown fails the account and closes all positions at market. The trading day resets at 17:00 New York.</p>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 text-[12.5px] leading-snug text-fg-2">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--k-ember)]" />
          <span>I have read the rules above and understand that the account is simulated and fails automatically when a loss limit is breached.</span>
        </label>

        <ErrorNote error={err} />
        {err !== null && (err as { code?: string }).code === "provisioning" && (
          <Link href="/prop/mine" className="inline-flex items-center gap-1 text-[12.5px] text-ember hover:underline">
            Go to My challenges <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function LivePropStore() {
  const { data, error, loading, reload } = usePropPoll<{ plans: Plan[] }>("plans", 0);
  const mine = usePropPoll<{ challenges: Challenge[] }>("challenges", 0);
  const plans = React.useMemo(() => {
    const list = (data?.plans ?? []).map((p) => ({ ...p, sizes: p.sizes.filter((s) => s.enabled !== false).sort((a, b) => a.size - b.size) })).filter((p) => p.sizes.length > 0);
    return list.sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));
  }, [data]);
  const [planId, setPlanId] = React.useState<string | null>(null);
  const [sizeN, setSizeN] = React.useState<number | null>(null);
  const [buying, setBuying] = React.useState(false);

  const plan = plans.find((p) => p.id === planId) ?? plans.find((p) => p.type === "2-step") ?? plans[0] ?? null;
  const size = plan ? plan.sizes.find((s) => s.size === sizeN) ?? plan.sizes.find((s) => s.size === 50000) ?? plan.sizes[Math.floor((plan.sizes.length - 1) / 2)]! : null;
  const count = mine.data?.challenges.filter((c) => c.status === "active" || c.status === "funded").length ?? 0;

  return (
    <div className="pb-24">
      <PageHeader
        title="Prop challenges"
        subtitle="Trade simulated capital under clear rules and get paid a share of the profit."
        actions={
          <Link href="/prop/mine">
            <Button variant="surface" size="lg">
              <Trophy /> My challenges
              {count > 0 && (
                <Chip size="sm" tone="ember">
                  {count}
                </Chip>
              )}
            </Button>
          </Link>
        }
      />

      {error && !data ? (
        <LoadError error={error} onRetry={reload} />
      ) : loading ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Skeleton className="h-[520px] rounded-[20px] xl:col-span-8" />
          <Skeleton className="h-[520px] rounded-[20px] xl:col-span-4" />
        </div>
      ) : !plan || !size ? (
        <Card>
          <EmptyState illustration="trophy" title="No challenges on offer right now" text="New challenge plans are being prepared. Please check back soon." />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Reveal className="xl:col-span-8">
              <Configurator
                plans={plans}
                plan={plan}
                setPlan={setPlanId}
                size={size}
                setSize={setSizeN}
              />
            </Reveal>
            <Reveal delay={0.05} className="xl:col-span-4">
              <PlanCard plan={plan} size={size} onBuy={() => setBuying(true)} />
            </Reveal>
          </div>

          <Reveal delay={0.05} className="mt-4 block">
            <CompareTable plans={plans} current={plan.id} size={size.size} onPick={setPlanId} />
          </Reveal>

          <Reveal delay={0.05} className="mt-4 block">
            <Card>
              <CardHeader title="How the rules are enforced" subtitle="Checked on the server every second, 24/5" icon={<ShieldCheck />} />
              <div className="grid grid-cols-1 gap-2 px-4 pb-6 pt-4 sm:grid-cols-2 sm:px-6 xl:grid-cols-4">
                {[
                  { t: "Live monitoring", d: "Daily loss and drawdown are measured on equity, including floating profit and loss.", c: "bg-info" },
                  { t: "Early warnings", d: "You are notified at 50%, 75% and 90% of today's loss limit.", c: "bg-warn" },
                  { t: "Breach", d: "All positions close at market, pending orders are cancelled and the account is disabled.", c: "bg-down" },
                  { t: "Pass", d: "Target, minimum days and consistency met: the next phase or your funded account opens automatically.", c: "bg-up" },
                ].map((x) => (
                  <div key={x.t} className="k-row relative overflow-hidden py-3 pl-5 pr-4">
                    <span className={cn("absolute inset-y-2 left-0 w-[3px] rounded-r-full", x.c)} />
                    <div className="text-[13.5px] font-medium">{x.t}</div>
                    <div className="mt-0.5 text-[12.5px] text-fg-3">{x.d}</div>
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>

          <CheckoutDialog plan={plan} size={size} open={buying} onOpenChange={setBuying} onBought={mine.reload} />
        </>
      )}
    </div>
  );
}
