"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, ArrowLeftRight, Check, CircleAlert, Clock, Loader2, Smartphone, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, CoinIcon, CopyButton, Field, Input, PageHeader, Skeleton, cn } from "@kalks/ui";
import { CHAIN_LABEL, WalletError, fmt, useWallet, walletApi, type Chain, type Deposit, type Intent, type WalletConfig } from "./api";
import { PayError, hasMetaMask, hasTronLink, isMobile, metamaskDeepLink, payWithMetaMask, payWithTronLink } from "./pay";
import { Confirmations, DEPOSIT_STATUS, HashLink, InlineError, StatusTag, Tile, WalletUnavailable } from "./ui";

type IntentView = { intent: Intent; deposit: Deposit | null };

function NetworkPicker({ cfg, value, onChange }: { cfg: WalletConfig; value: Chain; onChange: (c: Chain) => void }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {cfg.chains.map((c) => {
        const on = c.chain === value;
        const off = !c.deposits_enabled;
        return (
          <button
            key={c.chain}
            type="button"
            disabled={off}
            onClick={() => onChange(c.chain)}
            className={cn("k-row flex items-center gap-3 px-4 py-3 text-left transition-colors disabled:opacity-50", on ? "border-ember/60 bg-ember-soft" : "hover:border-[var(--k-border-top)]")}
          >
            <span className="relative">
              <CoinIcon coin="usdt" size={32} />
              <CoinIcon coin={c.chain === "bsc" ? "bnb" : "trx"} size={15} className="absolute -bottom-0.5 -right-1 ring-2 ring-surface-2" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium">
                USDT <span className="rounded-md bg-surface-3 px-1.5 py-px text-[10.5px] font-medium text-fg-2">{CHAIN_LABEL[c.chain].short}</span>
              </div>
              <div className="truncate text-[12px] text-fg-3">
                {CHAIN_LABEL[c.chain].name} · pay with {CHAIN_LABEL[c.chain].wallet}
              </div>
            </div>
            {on && (
              <span className="grid size-6 place-items-center rounded-full bg-ember text-white">
                <Check className="size-3.5" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Countdown({ until }: { until: string }) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.floor((Date.parse(until) - now) / 1000));
  if (left === 0) return <span className="text-warn">expired</span>;
  return (
    <span className="k-num">
      {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
    </span>
  );
}

/** Step 1: network + amount → deposit request. */
function StartForm({ cfg, onCreated }: { cfg: WalletConfig; onCreated: (i: Intent) => void }) {
  const enabled = cfg.chains.filter((c) => c.deposits_enabled);
  const [chain, setChain] = React.useState<Chain>(enabled.find((c) => c.chain === "bsc")?.chain ?? enabled[0]?.chain ?? "tron");
  const [amount, setAmount] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const c = cfg.chains.find((x) => x.chain === chain);
  const min = Number(c?.min_deposit ?? 0);
  const valid = /^\d{1,12}(\.\d{1,6})?$/.test(amount.trim()) && Number(amount) >= min && Number(amount) > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await walletApi<{ intent: Intent }>("deposits/intents", { body: { chain, amount: amount.trim() } });
      onCreated(r.intent);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't start the deposit.");
    } finally {
      setBusy(false);
    }
  };

  if (!enabled.length) {
    return (
      <Card>
        <div className="p-6 text-[13.5px] text-fg-2">Deposits are paused at the moment. Please try again later or contact support.</div>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader title="New deposit" subtitle="Choose the network you are sending from and the amount." />
      <form onSubmit={submit} className="space-y-5 px-4 pb-6 pt-4 sm:px-6">
        <NetworkPicker cfg={cfg} value={chain} onChange={setChain} />
        <Field label="Amount" hint={`Minimum ${fmt(c?.min_deposit)} USDT · credited 1:1 in USD`}>
          <Input
            inputMode="decimal"
            placeholder="100.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(",", "."))}
            trailing={<span className="text-[12.5px] font-medium text-fg-2">USDT</span>}
            aria-label="Deposit amount"
          />
        </Field>
        <InlineError>{err}</InlineError>
        <Button type="submit" variant="ember" size="lg" className="w-full sm:w-auto" disabled={!valid || busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Wallet />} Continue
        </Button>
      </form>
    </Card>
  );
}

/** Step 2: pay with the wallet app, or send manually and paste the hash. */
function PayPanel({ view, onSubmitted }: { view: IntentView; onSubmitted: () => void }) {
  const it = view.intent;
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [hash, setHash] = React.useState("");
  const [provider, setProvider] = React.useState<{ mm: boolean; tl: boolean; mobile: boolean }>({ mm: false, tl: false, mobile: false });
  React.useEffect(() => {
    // wallets inject their providers after load
    const check = () => setProvider({ mm: hasMetaMask(), tl: hasTronLink(), mobile: isMobile() });
    check();
    const t = setTimeout(check, 800);
    return () => clearTimeout(t);
  }, []);
  const expired = Date.parse(it.expires_at) < Date.now();

  const submitHash = async (h: string) => {
    await walletApi("deposits/submit", { body: { intent_id: it.id, tx_hash: h } });
    onSubmitted();
  };

  const pay = async () => {
    setBusy(true);
    setErr(null);
    try {
      const pay = it.chain === "bsc" ? payWithMetaMask : payWithTronLink;
      const r = await pay({ token: it.token_contract, to: it.address, amount: it.amount, decimals: it.decimals });
      try {
        await submitHash(r.hash);
        toast.success("Payment sent", { description: "We are waiting for the network confirmations." });
      } catch (e) {
        // the transfer went out: keep the hash visible so it can be submitted again
        setHash(r.hash);
        setErr(`Your payment was sent (${r.hash.slice(0, 10)}…) but we couldn't register it: ${e instanceof Error ? e.message : "try again"}. Submit the hash below.`);
      }
    } catch (e) {
      setErr(e instanceof PayError || e instanceof WalletError ? e.message : "The payment could not be sent.");
    } finally {
      setBusy(false);
    }
  };

  const manual = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await submitHash(hash.trim());
      toast.success("Transaction submitted", { description: "We are checking it on the network." });
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Couldn't submit the transaction.");
    } finally {
      setBusy(false);
    }
  };

  const wallet = CHAIN_LABEL[it.chain].wallet;
  const injected = it.chain === "bsc" ? provider.mm : provider.tl;

  return (
    <Card>
      <CardHeader
        title={`Send ${fmt(it.amount)} USDT`}
        subtitle={`${CHAIN_LABEL[it.chain].name} (${CHAIN_LABEL[it.chain].short}) · request ${it.id.slice(4, 12)}`}
        action={
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-fg-3">
            <Clock className="size-3.5" /> {expired ? "Request expired" : <>Expires in <Countdown until={it.expires_at} /></>}
          </span>
        }
      />
      <div className="space-y-5 px-4 pb-6 pt-4 sm:px-6">
        <div className="rounded-[16px] border border-line bg-surface-2 p-4">
          <div className="text-[13.5px] font-medium">Pay with {wallet}</div>
          <p className="mt-1 text-[12.5px] text-fg-3">
            {it.chain === "bsc"
              ? "MetaMask opens with the USDT transfer ready on BNB Smart Chain. Approve it and we pick it up straight away."
              : "TronLink opens with the USDT transfer ready on TRON. Approve it and we pick it up straight away."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {injected || !provider.mobile || it.chain === "tron" ? (
              <Button variant="ember" onClick={pay} disabled={busy || expired || !injected} data-testid="pay-wallet">
                {busy ? <Loader2 className="animate-spin" /> : <Wallet />} Pay with {wallet}
              </Button>
            ) : (
              <a href={metamaskDeepLink(it.id)}>
                <Button variant="ember">
                  <Smartphone /> Open in MetaMask
                </Button>
              </a>
            )}
          </div>
          {!injected && (
            <p className="mt-2 text-[12px] text-fg-3">
              {it.chain === "bsc"
                ? provider.mobile
                  ? "This opens the deposit inside the MetaMask app."
                  : "MetaMask isn't installed in this browser. Install the MetaMask extension, or send manually below."
                : "TronLink isn't available in this browser. Open this page in the TronLink app or extension, or send manually below."}
            </p>
          )}
        </div>

        <div>
          <div className="k-label mb-3">Or send manually</div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-[auto_1fr]">
            <div className="flex flex-col items-center">
              <div className="rounded-[16px] bg-white p-3">
                <QRCodeSVG value={it.address} size={148} level="M" bgColor="#ffffff" fgColor="#0e0e12" />
              </div>
              <div className="mt-2 text-[11.5px] text-fg-3">Company address · {CHAIN_LABEL[it.chain].short}</div>
            </div>
            <div className="min-w-0 space-y-3">
              <div>
                <div className="mb-1 text-[11.5px] uppercase tracking-wider text-fg-3">Send to</div>
                <div className="k-row flex items-center gap-2 px-3 py-2.5">
                  <span className="min-w-0 flex-1 break-all font-mono text-[12.5px]" data-testid="deposit-address">
                    {it.address}
                  </span>
                  <CopyButton value={it.address} label="Address" className="size-8" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Tile label="Amount" value={<span className="inline-flex items-center gap-1">{fmt(it.amount)} USDT <CopyButton value={it.amount} label="Amount" className="size-6" /></span>} />
                <Tile label="Network" value={`${CHAIN_LABEL[it.chain].name}`} />
              </div>
              <div className="flex items-start gap-2 rounded-[12px] border border-warn/30 bg-warn-soft px-3 py-2 text-[12px] text-fg-2">
                <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-warn" />
                <span>
                  Send only USDT on {CHAIN_LABEL[it.chain].name} ({CHAIN_LABEL[it.chain].short}), exactly {fmt(it.amount)} USDT. Other tokens or networks can&apos;t be recovered. If your exchange deducts a fee, our team checks the deposit before it is credited.
                </span>
              </div>
              <form onSubmit={manual} className="space-y-2">
                <Field label="Transaction hash" hint="Paste it from your wallet or exchange after sending.">
                  <Input value={hash} onChange={(e) => setHash(e.target.value)} placeholder={it.chain === "bsc" ? "0x…" : "64 characters"} inputClassName="font-mono text-[12.5px]" aria-label="Transaction hash" />
                </Field>
                <Button type="submit" variant="surface" disabled={busy || !/^(0x)?[0-9a-fA-F]{64}$/.test(hash.trim())}>
                  I have sent it
                </Button>
              </form>
            </div>
          </div>
        </div>
        <InlineError>{err}</InlineError>
      </div>
    </Card>
  );
}

/** Step 3: waiting → confirmations → credited. */
function Tracker({ view, onNew }: { view: IntentView; onNew: () => void }) {
  const d = view.deposit!;
  const st = DEPOSIT_STATUS[d.status];
  const credited = d.status === "credited";
  const bad = d.status === "failed" || d.status === "rejected";
  return (
    <Card>
      <CardHeader title={credited ? "Deposit credited" : bad ? "Deposit not credited" : "Deposit on its way"} subtitle={`${CHAIN_LABEL[d.chain].name} · USDT ${CHAIN_LABEL[d.chain].short}`} action={<StatusTag {...st} />} />
      <div className="space-y-5 px-4 pb-6 pt-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="k-num text-[30px] font-semibold leading-none" data-testid="deposit-amount">
              +{fmt(d.amount ?? d.expected_amount)} <span className="text-[15px] text-fg-3">USDT</span>
            </div>
            <div className="mt-2 text-[12.5px] text-fg-3">
              Transaction <HashLink hash={d.tx_hash} url={d.explorer_url} />
            </div>
          </div>
        </div>
        {!bad && d.status !== "review" && <Confirmations d={d} />}
        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            ["Sent", true],
            ["Found on the network", d.status !== "pending"],
            ["Credited to your wallet", credited],
          ].map(([label, done], i) => (
            <li key={i} className={cn("k-row flex items-center gap-2 px-3 py-2.5 text-[12.5px]", done ? "text-fg" : "text-fg-3")}>
              <span className={cn("grid size-5 place-items-center rounded-full border", done ? "border-up/40 bg-up-soft text-up" : "border-line")}>{done ? <Check className="size-3" /> : <span className="text-[10px]">{i + 1}</span>}</span>
              {label}
            </li>
          ))}
        </ol>
        {d.status === "review" && (
          <div className="rounded-[12px] border border-warn/30 bg-warn-soft px-3 py-2.5 text-[12.5px] text-fg-2">
            Our team is checking this deposit before crediting it{d.review_reason ? `: ${d.review_reason}` : ""}. This usually takes a few hours on business days.
          </div>
        )}
        {bad && <InlineError>{d.failure_reason ?? "This transaction could not be credited."}</InlineError>}
        <div className="flex flex-wrap gap-2">
          {credited && (
            <Link href="/wallet/transfer">
              <Button variant="ember">
                <ArrowLeftRight /> Fund a trading account
              </Button>
            </Link>
          )}
          <Button variant="surface" onClick={onNew}>
            New deposit
          </Button>
          <Link href="/wallet">
            <Button variant="ghost">Back to wallet</Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

function HowItWorks({ cfg }: { cfg: WalletConfig }) {
  const conf = (c: Chain) => cfg.chains.find((x) => x.chain === c)?.confirmations;
  return (
    <Card>
      <CardHeader title="How deposits work" />
      <ol className="space-y-4 px-6 pb-6 pt-4 text-[13px]">
        {[
          ["Choose the network and amount", "BNB Smart Chain (BEP20) or TRON (TRC20). No verification needed to deposit."],
          ["Pay from your wallet", "MetaMask or TronLink opens with the transfer ready. From an exchange, send manually and paste the hash."],
          ["We verify it on the network", `Credited after ${conf("bsc") ?? 15} confirmations on BNB Chain or ${conf("tron") ?? 20} on TRON, usually within a minute.`],
          ["Fund your trading account", "USDT is credited 1:1 in USD. Move it to any of your live accounts instantly."],
        ].map(([t, d], i) => (
          <li key={t} className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full border border-line text-[11px] text-fg-2">{i + 1}</span>
            <div>
              <div className="font-medium">{t}</div>
              <div className="text-[12.5px] text-fg-3">{d}</div>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function Inner() {
  const sp = useSearchParams();
  // the request id lives in state and is mirrored into the URL (?intent=…) so a reload or the MetaMask app
  // deep link resumes the same deposit
  const [intentId, setIntentId] = React.useState<string | null>(() => sp.get("intent"));
  const cfg = useWallet<WalletConfig>("config");
  const valid = !!intentId && /^dep_[0-9a-f]{24}$/.test(intentId);
  const view = useWallet<IntentView>(valid ? `deposits/intents/${intentId}` : null, 5000);
  const setIntent = (id: string | null) => {
    setIntentId(id);
    window.history.replaceState(window.history.state, "", id ? `/wallet/deposit?intent=${id}` : "/wallet/deposit");
  };

  let main: React.ReactNode;
  if (cfg.error && !cfg.data) main = <WalletUnavailable onRetry={cfg.reload} />;
  else if (!cfg.data || (valid && !view.data && !view.error)) main = <Skeleton className="h-[420px] w-full rounded-[20px]" />;
  else if (valid && view.error) main = <WalletUnavailable onRetry={view.reload} message={view.error.status === 404 ? "This deposit request wasn't found. Start a new deposit." : undefined} />;
  else if (valid && view.data?.deposit) main = <Tracker view={view.data} onNew={() => setIntent(null)} />;
  else if (valid && view.data) main = <PayPanel view={view.data} onSubmitted={view.reload} />;
  else main = <StartForm cfg={cfg.data} onCreated={(i) => setIntent(i.id)} />;

  return (
    <div className="pb-16">
      <PageHeader
        title="Deposit USDT"
        subtitle="Pay from MetaMask or TronLink, or send from any wallet or exchange. Credited automatically."
        actions={
          <Link href="/wallet">
            <Button variant="surface">
              <ArrowLeft /> Wallet
            </Button>
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">{main}</div>
        <div className="xl:col-span-4">{cfg.data && <HowItWorks cfg={cfg.data} />}</div>
      </div>
    </div>
  );
}

export function LiveDepositPage() {
  return (
    <React.Suspense fallback={null}>
      <Inner />
    </React.Suspense>
  );
}
