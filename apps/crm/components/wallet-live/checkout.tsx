"use client";

// Wallet → Deposit → Crypto checkout (OxaPay).
//
// The third deposit path: the client names an amount in USD, we open an invoice with OxaPay, and they pay
// whichever coin they like on OxaPay's own page. Payment credits the wallet by itself — no hash to paste and
// no staff approval, unlike the other two paths beside this one.
//
// Leaving and coming back is the normal case here, because paying happens on another site. OxaPay sends the
// payer back to /wallet/deposit?checkout=<order_id>; this panel finds that checkout and polls it, which also
// credits it if the webhook has not arrived yet (the poll asks OxaPay directly).

import * as React from "react";
import { ArrowUpRight, Check, Clock, CircleAlert, Loader2, Wallet } from "lucide-react";
import { Button, Card, CardHeader, Field, Input, Skeleton, cn } from "@/components/kit";
import { useT } from "@ezymex/i18n/react";
import { WalletError, fmt, useWallet, walletApi } from "./api";
import { InlineError, WalletUnavailable, cleanAmount } from "./ui";

export interface Checkout {
  id: number;
  order_id: string;
  amount: string;
  currency: string;
  status: "new" | "waiting" | "paying" | "credited" | "expired" | "failed" | "cancelled";
  payment_url: string | null;
  credited: string | null;
  tx_hash: string | null;
  network: string | null;
  paid_currency: string | null;
  expires_at: string | null;
  credited_at: string | null;
  created_at: string;
}

export interface CheckoutList {
  items: Checkout[];
  total: number;
  enabled: boolean;
  min_amount: string;
  max_amount: string;
}

/** Still worth waiting on: the client can pay it, or has and we are waiting for the chain. */
export const isOpen = (c: Checkout) => c.status === "new" || c.status === "waiting" || c.status === "paying";

export function useCheckouts() {
  return useWallet<CheckoutList>("oxapay/invoices");
}

function Status({ c }: { c: Checkout }) {
  const t = useT();
  const map = {
    credited: { cls: "text-up border-up/30 bg-up/10", icon: <Check className="size-3.5" />, label: t("payments.checkout.statusCredited") },
    paying: { cls: "text-ember border-ember/30 bg-ember-soft", icon: <Loader2 className="size-3.5 animate-spin" />, label: t("payments.checkout.statusPaying") },
    waiting: { cls: "text-fg-2 border-line bg-surface-3", icon: <Clock className="size-3.5" />, label: t("payments.checkout.statusWaiting") },
    new: { cls: "text-fg-2 border-line bg-surface-3", icon: <Clock className="size-3.5" />, label: t("payments.checkout.statusWaiting") },
    expired: { cls: "text-fg-3 border-line bg-surface-3", icon: <CircleAlert className="size-3.5" />, label: t("payments.checkout.statusExpired") },
    failed: { cls: "text-down border-down/30 bg-down/10", icon: <CircleAlert className="size-3.5" />, label: t("payments.checkout.statusFailed") },
    cancelled: { cls: "text-fg-3 border-line bg-surface-3", icon: <CircleAlert className="size-3.5" />, label: t("payments.checkout.statusCancelled") },
  }[c.status];
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium", map.cls)}>{map.icon}{map.label}</span>;
}

/** The checkout the client is in the middle of: pay it, or give it up. */
function OpenCheckout({ c, onChanged }: { c: Checkout; onChanged: () => void }) {
  const t = useT();
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  // while it is open, keep asking: the webhook usually wins, but a poll credits it even if that never lands
  const live = useWallet<{ checkout: Checkout }>(`oxapay/invoices/${c.id}?poll=1`, 6000);
  const now = live.data?.checkout ?? c;

  React.useEffect(() => {
    if (!isOpen(now)) onChanged();
  }, [now.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancel = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await walletApi(`oxapay/invoices/${c.id}/cancel`, { body: {} });
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("payments.checkout.cancelFailed"));
    } finally {
      setBusy(false);
    }
  };

  if (now.status === "credited") {
    return (
      <Card>
        <CardHeader title={t("payments.checkout.creditedTitle")} subtitle={t("payments.checkout.creditedText", { amount: fmt(now.credited) })} />
        <div className="px-4 pb-6 pt-2 sm:px-6">
          <Button variant="ember" onClick={onChanged}>
            <Wallet /> {t("payments.checkout.another")}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title={t("payments.checkout.openTitle")} subtitle={t("payments.checkout.openText")} action={<Status c={now} />} />
      <div className="space-y-4 px-4 pb-6 pt-4 sm:px-6">
        <div className="k-row flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="text-[12px] text-fg-3">{t("common.amount")}</div>
            <div className="k-num text-[20px] font-semibold">{fmt(now.amount)} USD</div>
          </div>
          <div className="text-end">
            <div className="text-[12px] text-fg-3">{t("payments.checkout.reference")}</div>
            <div className="font-mono text-[12.5px]">{now.order_id}</div>
          </div>
        </div>
        {now.status === "paying" && <div className="text-[12.5px] text-fg-2">{t("payments.checkout.payingNote")}</div>}
        <InlineError>{err}</InlineError>
        <div className="flex flex-wrap gap-2">
          {now.payment_url && (
            <a href={now.payment_url} target="_blank" rel="noopener noreferrer">
              <Button variant="ember" size="lg">
                <ArrowUpRight /> {t("payments.checkout.continue")}
              </Button>
            </a>
          )}
          {now.status !== "paying" && (
            <Button variant="surface" size="lg" onClick={cancel} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : null} {t("common.cancel")}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function StartCheckout({ list, onCreated }: { list: CheckoutList; onCreated: () => void }) {
  const t = useT();
  const [amount, setAmount] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const min = Number(list.min_amount);
  const max = Number(list.max_amount);
  const n = Number(amount);
  const valid = /^\d{1,9}(\.\d{1,2})?$/.test(amount.trim()) && n >= min && n <= max;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await walletApi<{ checkout: Checkout }>("oxapay/invoices", { body: { amount: amount.trim() } });
      if (r.checkout.payment_url) {
        // OxaPay's page, with their own choice of coins; they send the payer back to ?checkout=<order_id>
        window.location.assign(r.checkout.payment_url);
        return;
      }
      onCreated();
    } catch (e) {
      setErr(e instanceof WalletError ? e.message : t("payments.checkout.startFailed"));
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader title={t("payments.checkout.title")} subtitle={t("payments.checkout.subtitle")} />
      <form onSubmit={submit} className="space-y-5 px-4 pb-6 pt-4 sm:px-6">
        <Field label={t("common.amount")} hint={t("payments.checkout.amountHint", { min: fmt(list.min_amount), max: fmt(list.max_amount) })}>
          <Input
            inputMode="decimal"
            placeholder="100.00"
            value={amount}
            onChange={(e) => setAmount(cleanAmount(e.target.value))}
            trailing={<span className="text-[12.5px] font-medium text-fg-2">USD</span>}
            aria-label={t("payments.checkout.amountAria")}
          />
        </Field>
        <InlineError>{err}</InlineError>
        <Button type="submit" variant="ember" size="lg" className="w-full sm:w-auto" disabled={!valid || busy}>
          {busy ? <Loader2 className="animate-spin" /> : <ArrowUpRight />} {t("payments.checkout.go")}
        </Button>
        <p className="text-[12px] leading-relaxed text-fg-3">{t("payments.checkout.note")}</p>
      </form>
    </Card>
  );
}

function Recent({ items }: { items: Checkout[] }) {
  const t = useT();
  const past = items.filter((c) => !isOpen(c)).slice(0, 6);
  if (!past.length) return null;
  return (
    <Card className="mt-4">
      <CardHeader title={t("payments.checkout.recent")} />
      <div className="px-4 pb-5 sm:px-6">
        {past.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-0">
            <div className="min-w-0">
              <div className="k-num text-[14px] font-medium">{fmt(c.status === "credited" ? c.credited : c.amount)} {c.status === "credited" ? "USDT" : "USD"}</div>
              <div className="truncate font-mono text-[11.5px] text-fg-3">{c.order_id}</div>
            </div>
            <Status c={c} />
          </div>
        ))}
      </div>
    </Card>
  );
}

/** The whole Crypto-checkout tab of the deposit page. */
export function CheckoutPanel({ list, returning }: { list: ReturnType<typeof useCheckouts>; returning: string | null }) {
  const t = useT();
  if (list.error && !list.data) return <WalletUnavailable onRetry={list.reload} />;
  if (!list.data) return <Skeleton className="h-[420px] w-full rounded-[20px]" />;
  if (!list.data.enabled) {
    return (
      <Card>
        <div className="p-6 text-[13.5px] text-fg-2">{t("payments.checkout.off")}</div>
      </Card>
    );
  }
  // the one the payer was sent back to wins, so the page they land on is the one they just paid
  const back = returning ? list.data.items.find((c) => c.order_id === returning) : undefined;
  const open = back ?? list.data.items.find(isOpen);
  return (
    <>
      {open ? <OpenCheckout c={open} onChanged={list.reload} /> : <StartCheckout list={list.data} onCreated={list.reload} />}
      <Recent items={list.data.items} />
    </>
  );
}
