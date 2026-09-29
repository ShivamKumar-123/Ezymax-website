"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowLeftRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, EmptyState, Field, Input, PageHeader, Segmented, Skeleton, cn, formatDateTime } from "@kalks/ui";
import { useT } from "@kalks/i18n/react";
import { toUsd, useAccounts, type EngineAccount } from "@/components/trading/api";
import { fmt, requestId, usdtAvailable, useWallet, walletApi, type Overview, type Page, type TradingTransfer } from "./api";
import { InlineError, StatusTag, WalletUnavailable } from "./ui";

type Dir = "to" | "from";

function AccountPicker({ accounts, value, onChange }: { accounts: EngineAccount[]; value: number | null; onChange: (l: number) => void }) {
  const t = useT();
  return (
    <div className="space-y-2">
      {accounts.map((a) => (
        <button
          key={a.login}
          type="button"
          onClick={() => onChange(a.login)}
          className={cn("k-row flex w-full items-center gap-3 px-4 py-3 text-start", a.login === value ? "border-ember/60 bg-ember-soft" : "hover:border-[var(--k-border-top)]")}
          data-testid={`account-${a.login}`}
        >
          <Chip size="sm" tone="ember" className="font-semibold tracking-wider">
            {t("wallet.liveBadge")}
          </Chip>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-medium">
              {a.groupName} <span className="font-mono text-[12px] text-fg-3">#{a.login}</span>
            </div>
            <div className="k-num text-[11.5px] text-fg-3">
              {t("common.balance")} {a.cent ? "USC " : "$"}
              {fmt(a.balance)} · {t("wallet.transfer.withdrawable", { amount: fmt(toUsd(a, a.withdrawable)) })}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function Inner() {
  const t = useT();
  const sp = useSearchParams();
  const pre = Number(sp.get("to") ?? sp.get("from") ?? 0) || null;
  const [dir, setDir] = React.useState<Dir>(sp.get("from") ? "from" : "to");
  const [login, setLogin] = React.useState<number | null>(pre);
  const [amount, setAmount] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [key, setKey] = React.useState(requestId);
  const o = useWallet<Overview>("overview", 10000);
  const list = useWallet<Page<TradingTransfer>>("transfers?limit=15", 10000);
  const acc = useAccounts(10000);
  const live = (acc.data?.accounts ?? []).filter((a) => a.type === "live" && a.status !== "disabled" && a.status !== "expired");
  const account = live.find((a) => a.login === login) ?? null;
  React.useEffect(() => {
    if (!login && live.length === 1) setLogin(live[0]!.login);
  }, [login, live]);

  const walletAvail = Number(usdtAvailable(o.data).available);
  const accountAvail = account ? toUsd(account, account.withdrawable) : 0;
  const max = dir === "to" ? walletAvail : accountAvail;
  const amt = amount.trim();
  const valid = !!account && /^\d{1,12}(\.\d{1,2})?$/.test(amt) && Number(amt) > 0 && Number(amt) <= max + 1e-9;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy || !account) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await walletApi<{ transfer: TradingTransfer }>(dir === "to" ? "transfers/to-trading" : "transfers/from-trading", { body: { login: account.login, amount: amt, idempotency_key: key } });
      if (r.transfer.status === "completed") {
        toast.success(t("wallet.transferCompleted"), { description: dir === "to" ? t("wallet.transfer.movedToAccount", { amount: fmt(amt), login: account.login }) : t("wallet.transfer.movedToWallet", { amount: fmt(amt) }) });
      } else {
        toast(t("wallet.transfer.processing"), { description: t("wallet.transfer.processingText") });
      }
      setAmount("");
      setKey(requestId());
      o.reload();
      list.reload();
      acc.reload();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : t("wallet.transfer.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pb-16">
      <PageHeader
        title={t("common.transfer")}
        subtitle={t("wallet.transfer.subtitle")}
        actions={
          <Link href="/wallet">
            <Button variant="surface">
              <ArrowLeft className="rtl:-scale-x-100" /> {t("wallet.wallet")}
            </Button>
          </Link>
        }
      />
      {o.error && !o.data ? (
        <WalletUnavailable onRetry={o.reload} />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Card className="xl:col-span-7">
            <CardHeader
              title={t("wallet.newTransfer")}
              action={
                <Segmented
                  size="xs"
                  value={dir}
                  onChange={(v) => {
                    setDir(v);
                    setErr(null);
                  }}
                  options={[
                    { value: "to", label: t("wallet.transfer.walletToAccount") },
                    { value: "from", label: t("wallet.transfer.accountToWallet") },
                  ]}
                />
              }
            />
            <form onSubmit={submit} className="space-y-5 px-4 pb-6 pt-4 sm:px-6">
              <div className="k-row flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-fg-3">{dir === "to" ? t("wallet.from") : t("wallet.to")}</div>
                  <div className="text-[14px] font-medium">{t("wallet.transfer.walletUsdt")}</div>
                </div>
                <div dir="ltr" className="k-num text-end text-[14px] font-semibold">{o.data ? `${fmt(walletAvail)} USDT` : "—"}</div>
              </div>
              <div className="flex justify-center text-fg-3">
                <ArrowDown className={cn("size-4 transition-transform", dir === "from" && "rotate-180")} />
              </div>
              <div>
                <div className="mb-2 text-[11px] uppercase tracking-wider text-fg-3">{dir === "to" ? t("wallet.transfer.toTradingAccount") : t("wallet.transfer.fromTradingAccount")}</div>
                {acc.loading && <Skeleton className="h-16 w-full rounded-[14px]" />}
                {acc.data && live.length === 0 && (
                  <EmptyState illustration="rocket" title={t("wallet.transfer.noLiveTitle")} text={t("wallet.transfer.noLiveText")} action={<Link href="/accounts/new?type=live"><Button variant="ember">{t("wallet.transfer.openLive")}</Button></Link>} />
                )}
                <AccountPicker accounts={live} value={login} onChange={setLogin} />
              </div>
              <Field label={t("common.amount")} hint={account ? `${t("wallet.transfer.upTo", { amount: fmt(max), currency: dir === "to" ? "USDT" : "USD" })}${account.cent ? t("wallet.transfer.centNote") : ""}` : t("wallet.transfer.creditedNote")}>
                <Input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(",", "."))}
                  placeholder="0.00"
                  aria-label={t("wallet.transfer.amountAria")}
                  trailing={
                    <button type="button" className="text-[12px] font-medium text-ember" onClick={() => setAmount(String(Math.floor(max * 100) / 100))}>
                      {t("wallet.max")}
                    </button>
                  }
                />
              </Field>
              <InlineError>{err}</InlineError>
              <Button type="submit" variant="ember" size="lg" disabled={!valid || busy}>
                {busy ? <Loader2 className="animate-spin" /> : <ArrowLeftRight />} {t("common.transfer")}
              </Button>
            </form>
          </Card>
          <Card className="xl:col-span-5">
            <CardHeader title={t("wallet.recentTransfers")} />
            <div className="mt-3 space-y-2 px-4 pb-5 sm:px-6">
              {!list.data && <Skeleton className="h-16 w-full rounded-[14px]" />}
              {list.data?.items.length === 0 && <div className="px-1 py-4 text-[13px] text-fg-3">{t("wallet.transfer.none")}</div>}
              {list.data?.items.map((x) => (
                <div key={x.id} className="k-row flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium">
                      {x.direction === "to_trading" ? t("wallet.transfer.toLogin", { login: x.login }) : t("wallet.transfer.fromLogin", { login: x.login })}
                      {x.status !== "completed" && <StatusTag tone={x.status === "failed" ? "down" : "warn"} label={x.status === "failed" ? "common.failed" : "common.processing"} />}
                    </div>
                    <div className="truncate text-[11.5px] text-fg-3">
                      {formatDateTime(x.created_at)}
                      {x.status === "failed" && x.error_message ? ` · ${x.error_message}` : ""}
                    </div>
                  </div>
                  <span dir="ltr" className={cn("k-num text-[14px] font-semibold", x.status === "failed" && "text-fg-3 line-through", x.direction === "from_trading" && x.status !== "failed" && "text-up")}>
                    {x.direction === "to_trading" ? "−" : "+"}
                    {fmt(x.amount)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export function LiveTransferPage() {
  return (
    <React.Suspense fallback={null}>
      <Inner />
    </React.Suspense>
  );
}
