"use client";

// Wallet → Deposit → Bank / UPI or Crypto: pick one of the broker's methods, pay it, send the request, follow it.
// Used by the live deposit page and by the demo showcase (the data layer in ./api switches on IS_DEMO).

import * as React from "react";
import { ArrowUpRight, Check, Landmark, Wallet, Zap } from "lucide-react";
import { Card, CardHeader, CoinIcon, EmptyState, cn } from "@/components/kit";
import { useT } from "@ezymex/i18n/react";
import type { ManualDeposit, ManualKind, PaymentMethod } from "./api";
import { MethodDetails, MethodPicker } from "./details";
import { RequestForm, RequestSent } from "./form";
import { RequestsList } from "./requests";

/** usdt: our own addresses, watched on chain · bank / crypto: paid outside and approved by staff ·
 *  checkout: OxaPay's hosted page, credited on payment. */
export type Via = "usdt" | ManualKind | "checkout";

/** USDT (automatic, on-chain) · Bank / UPI · Crypto · Crypto checkout. Only what the broker offers. */
export function DepositChooser({ value, onChange, usdt, bank, crypto, checkout = false }: { value: Via; onChange: (v: Via) => void; usdt: boolean; bank: boolean; crypto: boolean; checkout?: boolean }) {
  const t = useT();
  const options = [
    usdt && { v: "usdt" as const, title: t("payments.chooser.usdt"), text: t("payments.chooser.usdtText"), icon: <span className="relative"><CoinIcon coin="usdt" size={30} /><Zap className="absolute -bottom-1 -end-1 size-3.5 rounded-full bg-ember p-0.5 text-white" /></span> },
    bank && { v: "bank" as const, title: t("payments.chooser.bank"), text: t("payments.chooser.bankText"), icon: <span className="grid size-[30px] place-items-center rounded-full border border-line bg-surface-3 text-fg-2"><Landmark className="size-4" /></span> },
    crypto && { v: "crypto" as const, title: t("payments.chooser.crypto"), text: t("payments.chooser.cryptoText"), icon: <span className="grid size-[30px] place-items-center rounded-full border border-line bg-surface-3 text-fg-2"><Wallet className="size-4" /></span> },
    checkout && { v: "checkout" as const, title: t("payments.chooser.checkout"), text: t("payments.chooser.checkoutText"), icon: <span className="grid size-[30px] place-items-center rounded-full border border-ember/30 bg-ember-soft text-ember"><ArrowUpRight className="size-4" /></span> },
  ].filter(Boolean) as { v: Via; title: string; text: string; icon: React.ReactNode }[];
  if (options.length < 2) return null;
  return (
    <div className="mb-4">
      <div className="k-label mb-2">{t("payments.chooser.title")}</div>
      <div className={cn("grid grid-cols-1 gap-2", options.length >= 4 ? "sm:grid-cols-2 xl:grid-cols-4" : options.length === 3 ? "md:grid-cols-3" : "sm:grid-cols-2")} role="radiogroup" aria-label={t("payments.chooser.title")}>
        {options.map((o) => {
          const on = o.v === value;
          return (
            <button
              key={o.v}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.v)}
              className={cn("k-row flex items-center gap-3 px-4 py-3 text-start transition-colors", on ? "border-ember/60 bg-ember-soft" : "hover:border-[var(--k-border-top)]")}
              data-testid={`deposit-via-${o.v}`}
            >
              {o.icon}
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium">{o.title}</div>
                <div className="line-clamp-2 text-[12px] leading-snug text-fg-3">{o.text}</div>
              </div>
              {on && (
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ember text-white">
                  <Check className="size-3.5" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ManualHowItWorks() {
  const t = useT();
  return (
    <Card>
      <CardHeader title={t("payments.how.title")} />
      <ol className="space-y-4 px-6 pb-6 pt-4 text-[13px]">
        {(
          [
            ["payments.how.step1.title", "payments.how.step1.text"],
            ["payments.how.step2.title", "payments.how.step2.text"],
            ["payments.how.step3.title", "payments.how.step3.text"],
            ["payments.how.step4.title", "payments.how.step4.text"],
          ] as const
        ).map(([title, text], i) => (
          <li key={title} className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full border border-line text-[11px] text-fg-2">{i + 1}</span>
            <div>
              <div className="font-medium">{t(title)}</div>
              <div className="text-[12.5px] text-fg-3">{t(text)}</div>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/** Pick a method of `kind`, see its details, send the request; the client's requests underneath. */
export function ManualDepositPanel({ kind, methods, maxPending, initialMethod }: { kind: ManualKind; methods: PaymentMethod[]; maxPending: number; initialMethod?: number | null }) {
  const t = useT();
  const list = React.useMemo(() => methods.filter((m) => m.kind === kind), [methods, kind]);
  const [id, setId] = React.useState<number | null>(() => list.find((m) => m.id === initialMethod)?.id ?? list[0]?.id ?? null);
  const [sent, setSent] = React.useState<ManualDeposit | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  React.useEffect(() => {
    if (!list.some((m) => m.id === id)) setId(list[0]?.id ?? null);
  }, [list, id]);
  React.useEffect(() => setSent(null), [kind, id]);
  const m = list.find((x) => x.id === id) ?? null;
  if (!m) {
    return (
      <Card>
        <EmptyState illustration="package" title={t("payments.empty.title")} text={t("payments.empty.text")} />
      </Card>
    );
  }
  const toList = () => document.getElementById("manual-requests")?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <div className="space-y-4">
      <MethodPicker methods={list} value={m.id} onChange={setId} />
      <MethodDetails m={m} />
      {sent ? (
        <RequestSent d={sent} onAnother={() => setSent(null)} onList={toList} />
      ) : (
        <RequestForm
          m={m}
          maxPending={maxPending}
          onSent={(d) => {
            setSent(d);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
      <RequestsList id="manual-requests" reloadKey={reloadKey} />
    </div>
  );
}
