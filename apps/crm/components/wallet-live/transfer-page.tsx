"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowLeftRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, EmptyState, Field, Input, PageHeader, Segmented, Skeleton, cn, formatDateTime } from "@kalks/ui";
import { toUsd, useAccounts, type EngineAccount } from "@/components/trading/api";
import { fmt, requestId, usdtAvailable, useWallet, walletApi, type Overview, type Page, type TradingTransfer } from "./api";
import { InlineError, StatusTag, WalletUnavailable } from "./ui";

type Dir = "to" | "from";

function AccountPicker({ accounts, value, onChange }: { accounts: EngineAccount[]; value: number | null; onChange: (l: number) => void }) {
  return (
    <div className="space-y-2">
      {accounts.map((a) => (
        <button
          key={a.login}
          type="button"
          onClick={() => onChange(a.login)}
          className={cn("k-row flex w-full items-center gap-3 px-4 py-3 text-left", a.login === value ? "border-ember/60 bg-ember-soft" : "hover:border-[var(--k-border-top)]")}
          data-testid={`account-${a.login}`}
        >
          <Chip size="sm" tone="ember" className="font-semibold tracking-wider">
            LIVE
          </Chip>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-medium">
              {a.groupName} <span className="font-mono text-[12px] text-fg-3">#{a.login}</span>
            </div>
            <div className="k-num text-[11.5px] text-fg-3">
              Balance {a.cent ? "USC " : "$"}
              {fmt(a.balance)} · withdrawable ≈ ${fmt(toUsd(a, a.withdrawable))}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function Inner() {
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
        toast.success("Transfer completed", { description: dir === "to" ? `${fmt(amt)} USDT moved to #${account.login}.` : `${fmt(amt)} USD moved to your wallet.` });
      } else {
        toast("Transfer is processing", { description: "It completes automatically in a moment." });
      }
      setAmount("");
      setKey(requestId());
      o.reload();
      list.reload();
      acc.reload();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "The transfer failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pb-16">
      <PageHeader
        title="Transfer"
        subtitle="Move money between your wallet and your own live trading accounts. Instant and free."
        actions={
          <Link href="/wallet">
            <Button variant="surface">
              <ArrowLeft /> Wallet
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
              title="New transfer"
              action={
                <Segmented
                  size="xs"
                  value={dir}
                  onChange={(v) => {
                    setDir(v);
                    setErr(null);
                  }}
                  options={[
                    { value: "to", label: "Wallet → account" },
                    { value: "from", label: "Account → wallet" },
                  ]}
                />
              }
            />
            <form onSubmit={submit} className="space-y-5 px-4 pb-6 pt-4 sm:px-6">
              <div className="k-row flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-fg-3">{dir === "to" ? "From" : "To"}</div>
                  <div className="text-[14px] font-medium">Wallet · USDT</div>
                </div>
                <div className="k-num text-right text-[14px] font-semibold">{o.data ? `${fmt(walletAvail)} USDT` : "—"}</div>
              </div>
              <div className="flex justify-center text-fg-3">
                <ArrowDown className={cn("size-4 transition-transform", dir === "from" && "rotate-180")} />
              </div>
              <div>
                <div className="mb-2 text-[11px] uppercase tracking-wider text-fg-3">{dir === "to" ? "To" : "From"} trading account</div>
                {acc.loading && <Skeleton className="h-16 w-full rounded-[14px]" />}
                {acc.data && live.length === 0 && (
                  <EmptyState illustration="rocket" title="No live accounts" text="Open a live account to fund it from your wallet." action={<Link href="/accounts/new?type=live"><Button variant="ember">Open live account</Button></Link>} />
                )}
                <AccountPicker accounts={live} value={login} onChange={setLogin} />
              </div>
              <Field label="Amount" hint={account ? `Up to ${fmt(max)} ${dir === "to" ? "USDT" : "USD"}${account.cent ? " · a cent account receives USC (×100)" : ""}` : "USDT is credited 1:1 in USD"}>
                <Input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(",", "."))}
                  placeholder="0.00"
                  aria-label="Transfer amount"
                  trailing={
                    <button type="button" className="text-[12px] font-medium text-ember" onClick={() => setAmount(String(Math.floor(max * 100) / 100))}>
                      Max
                    </button>
                  }
                />
              </Field>
              <InlineError>{err}</InlineError>
              <Button type="submit" variant="ember" size="lg" disabled={!valid || busy}>
                {busy ? <Loader2 className="animate-spin" /> : <ArrowLeftRight />} Transfer
              </Button>
            </form>
          </Card>
          <Card className="xl:col-span-5">
            <CardHeader title="Recent transfers" />
            <div className="mt-3 space-y-2 px-4 pb-5 sm:px-6">
              {!list.data && <Skeleton className="h-16 w-full rounded-[14px]" />}
              {list.data?.items.length === 0 && <div className="px-1 py-4 text-[13px] text-fg-3">No transfers yet.</div>}
              {list.data?.items.map((t) => (
                <div key={t.id} className="k-row flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium">
                      {t.direction === "to_trading" ? `To #${t.login}` : `From #${t.login}`}
                      {t.status !== "completed" && <StatusTag tone={t.status === "failed" ? "down" : "warn"} label={t.status === "failed" ? "Failed" : "Processing"} />}
                    </div>
                    <div className="truncate text-[11.5px] text-fg-3">
                      {formatDateTime(t.created_at)}
                      {t.status === "failed" && t.error_message ? ` · ${t.error_message}` : ""}
                    </div>
                  </div>
                  <span className={cn("k-num text-[14px] font-semibold", t.status === "failed" && "text-fg-3 line-through", t.direction === "from_trading" && t.status !== "failed" && "text-up")}>
                    {t.direction === "to_trading" ? "−" : "+"}
                    {fmt(t.amount)}
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
