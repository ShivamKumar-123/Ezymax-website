"use client";

import * as React from "react";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Eye, EyeOff, Fuel, KeyRound, Lock, Server, Vault, Zap } from "lucide-react";
import { Avatar, Button, Card, CardHeader, Chip, CoinIcon, Dialog, Money, Progress, Segmented, cn } from "@ezymex/ui";
import { PEOPLE } from "@ezymex/mock";
import { FIN_COLD_WALLETS, FIN_HD, FIN_HOT_WALLET, FIN_SWEEP_QUEUE, finAgo } from "@ezymex/mock/admin-finance";
import { Addr, MiniField, MiniStat, NumInput, auditToast, useReason } from "@/components/config/kit";
import { Line, num, usd } from "./shared";

export interface HotState {
  usdt: number;
  trx: number;
  energy: number;
}

/* ------------------------------------------------------------------ */
/* Hot wallet                                                           */
/* ------------------------------------------------------------------ */

export function HotWalletCard({ hot, onTopUp }: { hot: HotState; onTopUp: () => void }) {
  const low = hot.trx < FIN_HOT_WALLET.trxMin;
  const capPct = (hot.usdt / FIN_HOT_WALLET.usdtCap) * 100;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Hot wallet"
        subtitle="Signs withdrawal batches · TRON mainnet"
        icon={<Zap />}
        action={<Chip tone="up" dot>Online</Chip>}
      />
      <div className="flex-1 px-6 pb-6 pt-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="k-label">USDT balance</div>
            <div className="mt-2 flex items-baseline gap-2">
              <Money value={hot.usdt} currency="" className="text-[34px] font-semibold tracking-tight" />
              <span className="text-[13px] text-fg-3">USDT</span>
            </div>
          </div>
          <CoinIcon coin="usdt" size={44} />
        </div>
        <div className="mt-3">
          <div className="mb-1.5 flex justify-between text-[11.5px] text-fg-3">
            <span>Exposure cap {usd(FIN_HOT_WALLET.usdtCap, 0)}</span>
            <span className="k-num">{capPct.toFixed(1)}%</span>
          </div>
          <Progress value={capPct} tone={capPct > 85 ? "warn" : "ember"} />
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <Addr value={FIN_HOT_WALLET.address} head={8} tail={6} />
          <a href={`https://tronscan.org/#/address/${FIN_HOT_WALLET.address}`} target="_blank" rel="noreferrer" className="text-[11.5px] text-fg-3 hover:text-ember">
            tronscan ↗
          </a>
        </div>

        <div className={cn("mt-5 rounded-[16px] border p-4", low ? "border-warn/30 bg-warn-soft" : "border-line bg-surface-2")}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CoinIcon coin="trx" size={32} />
              <div>
                <div className="text-[11px] uppercase tracking-wider text-fg-3">TRX gas</div>
                <div className="k-num text-[18px] font-semibold">
                  {num(hot.trx, 1)} <span className="text-[12px] font-normal text-fg-3">TRX</span>
                </div>
              </div>
            </div>
            <Button size="sm" variant={low ? "ember" : "surface"} onClick={onTopUp}>
              <Fuel /> Top up gas
            </Button>
          </div>
          <Progress value={(hot.trx / FIN_HOT_WALLET.trxTarget) * 100} tone={low ? "warn" : "up"} className="mt-3" />
          <div className="mt-1.5 flex justify-between text-[11px] text-fg-3">
            <span>Floor {num(FIN_HOT_WALLET.trxMin, 0)}</span>
            <span>Target {num(FIN_HOT_WALLET.trxTarget, 0)}</span>
          </div>
          {low && (
            <div className="mt-3 flex items-start gap-2 text-[12.5px] text-warn">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              Gas below the 5,000 TRX floor — covers ~{Math.floor(hot.trx / 13.4)} more USDT transfers. Next batch at 18:00.
            </div>
          )}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <MiniStat label="Energy" value={num(hot.energy, 0)} sub={`${Math.floor(hot.energy / 65000)} free tx`} />
          <MiniStat label="Bandwidth" value={num(FIN_HOT_WALLET.bandwidth, 0)} sub="daily 5,000" />
          <MiniStat label="TRX price" value={`$${FIN_HOT_WALLET.trxPrice}`} sub={`gas ≈ ${usd(hot.trx * FIN_HOT_WALLET.trxPrice)}`} />
        </div>
      </div>
    </Card>
  );
}

export function TopUpGasDialog({ open, onOpenChange, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; onConfirm: (trx: number, mode: "transfer" | "stake") => void }) {
  const [amount, setAmount] = React.useState(20_000);
  const [mode, setMode] = React.useState<"transfer" | "stake">("transfer");
  const reason = useReason();
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        width={500}
        title="Top up TRX gas"
        description="Fund the hot wallet with TRX, or stake TRX for energy so USDT transfers stop burning TRX."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="ember"
              size="sm"
              onClick={() =>
                reason.ask({
                  title: "Confirm gas top-up",
                  description: `${num(amount, 0)} TRX · ${mode === "transfer" ? "transfer from treasury" : "stake 2.0 for energy"}`,
                  reasons: ["Gas below safety floor", "Scheduled weekly top-up", "Large batch expected", "Energy optimisation"],
                  confirmLabel: "Top up",
                  onConfirm: (r) => {
                    onConfirm(amount, mode);
                    onOpenChange(false);
                    auditToast(`${num(amount, 0)} TRX ${mode === "transfer" ? "sent to hot wallet" : "staked for energy"}`, r);
                  },
                })
              }
            >
              <Fuel /> Continue
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Segmented value={mode} onChange={setMode} className="w-full [&>button]:flex-1" options={[{ value: "transfer", label: "Transfer TRX" }, { value: "stake", label: "Stake for energy" }]} />
          <MiniField label="Amount" hint={`≈ ${usd(amount * FIN_HOT_WALLET.trxPrice)}`}>
            <NumInput value={amount} onChange={setAmount} min={100} step={1000} suffix="TRX" />
          </MiniField>
          <div className="flex flex-wrap gap-1.5">
            {[5_000, 10_000, 20_000, 50_000].map((v) => (
              <button key={v} type="button" onClick={() => setAmount(v)} className={cn("k-num h-7 rounded-full border px-3 text-[12px]", amount === v ? "border-ember/40 bg-ember-soft text-ember" : "border-line bg-surface-2 text-fg-2 hover:text-fg")}>
                {num(v, 0)}
              </button>
            ))}
          </div>
          <div className="k-row divide-y divide-line px-4 py-1">
            <Line k="Source" v="Treasury TRX · Cold vault A" />
            <Line k={mode === "transfer" ? "Covers" : "Energy gained"} v={mode === "transfer" ? `~${Math.floor(amount / 13.4).toLocaleString()} USDT transfers` : `~${num(amount * 11.2, 0)} energy / day`} />
            <Line k="Approval" v="2-of-3 signers (you + 1)" />
          </div>
        </div>
      </Dialog>
      {reason.node}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Cold wallets                                                         */
/* ------------------------------------------------------------------ */

export function ColdWalletsCard() {
  const reason = useReason();
  const signer = (name: string) => PEOPLE.find((p) => p.name === name);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Cold storage" subtitle="Offline multisig vaults · HSM-backed signers" icon={<Vault />} action={<Chip tone="gold">{FIN_COLD_WALLETS.length} vaults</Chip>} />
      <div className="mt-4 flex-1 space-y-3 px-4 pb-5 sm:px-6">
        {FIN_COLD_WALLETS.map((w) => {
          const isBtc = w.asset === "BTC";
          return (
            <div key={w.id} className="k-row p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="relative">
                    <CoinIcon coin={isBtc ? "btc" : "usdt"} size={38} />
                    <span className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full bg-surface-3 ring-2 ring-surface">
                      <Lock className="size-2.5 text-gold" />
                    </span>
                  </span>
                  <div>
                    <div className="text-[14px] font-medium">{w.label}</div>
                    <Addr value={w.address} head={8} tail={6} className="text-[11.5px]" />
                  </div>
                </div>
                <div className="text-right">
                  <div className="k-num text-[20px] font-semibold">
                    {isBtc ? num(w.balance, 4) : num(w.balance)} <span className="text-[12px] font-normal text-fg-3">{w.asset}</span>
                  </div>
                  <div className="k-num text-[11.5px] text-fg-3">{isBtc ? `≈ ${usd(w.balance * 63_412, 0)}` : "1:1 USD"}</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 border-t border-line pt-3 sm:grid-cols-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-fg-3">Scheme</div>
                  <div className="mt-1 flex items-center gap-2">
                    <Chip size="sm" tone="gold">
                      <KeyRound className="size-3" /> {w.scheme}
                    </Chip>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-fg-3">Signers</div>
                  <div className="mt-1 flex items-center -space-x-1.5">
                    {w.signers.map((s) =>
                      signer(s) ? (
                        <Avatar key={s} src={signer(s)!.photo} name={s} size={24} className="ring-2 ring-surface-2 rounded-full" />
                      ) : (
                        <span key={s} title={s} className="grid size-6 place-items-center rounded-full bg-surface-3 ring-2 ring-surface-2">
                          <Server className="size-3 text-fg-2" />
                        </span>
                      ),
                    )}
                    <span className="pl-3 text-[11.5px] text-fg-3">{w.location.split(" · ")[0]}</span>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-fg-3">Last movement</div>
                  <div className={cn("k-num mt-1 flex items-center gap-1 text-[12.5px] font-medium", w.lastMove < 0 ? "text-down" : "text-up")}>
                    {w.lastMove < 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownLeft className="size-3.5" />}
                    {w.lastMove < 0 ? "-" : "+"}
                    {isBtc ? `${Math.abs(w.lastMove)} BTC` : usd(Math.abs(w.lastMove), 0)}
                    <span className="font-normal text-fg-3">· {finAgo(w.lastMoveMinutesAgo)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <Button
                  size="xs"
                  variant="surface"
                  onClick={() =>
                    reason.ask({
                      title: `Request movement · ${w.label}`,
                      description: `Creates a ${w.scheme} signing request. Co-signers are notified by push and email.`,
                      reasons: ["Refill hot wallet above floor", "Rebalance to cold (hot above cap)", "Quarterly proof-of-reserves", "Tenant treasury instruction"],
                      confirmLabel: "Create signing request",
                      onConfirm: (r) => auditToast(`Signing request created for ${w.label}`, `${r} · awaiting 1 more signer`),
                    })
                  }
                >
                  Request movement
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      {reason.node}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* HD derivation                                                        */
/* ------------------------------------------------------------------ */

export function HdCard() {
  const [shown, setShown] = React.useState(false);
  const reason = useReason();
  React.useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown(false), 30_000);
    return () => clearTimeout(t);
  }, [shown]);
  const masked = `${FIN_HD.xpub.slice(0, 8)}${"•".repeat(22)}${FIN_HD.xpub.slice(-6)}`;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="HD wallet" subtitle="BIP-44 derivation · one deposit address per client" icon={<KeyRound />} />
      <div className="flex-1 space-y-4 px-6 pb-6 pt-4">
        <div className="rounded-[14px] border border-line bg-surface-2 p-3.5">
          <div className="text-[11px] uppercase tracking-wider text-fg-3">Derivation path</div>
          <div className="mt-1 font-mono text-[15px] text-fg">
            m/44&apos;/<span className="text-ember">195</span>&apos;/0&apos;/0/<span className="text-gold">n</span>
          </div>
          <div className="mt-1 text-[11.5px] text-fg-3">coin type 195 = TRON · n = client address index</div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="Derived" value={num(FIN_HD.addresses, 0)} />
          <MiniStat label="Funded" value={num(FIN_HD.activeAddresses, 0)} />
          <MiniStat label="Next n" value={num(FIN_HD.nextIndex, 0)} />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[12px] font-medium text-fg-2">
            Extended public key (xpub)
            {shown && <span className="font-normal text-warn">auto-hides in 30s</span>}
          </div>
          <div className="flex items-center gap-2 rounded-[12px] border border-line bg-surface-2 px-3 py-2.5">
            <span className={cn("min-w-0 flex-1 font-mono text-[11.5px]", shown ? "break-all text-fg" : "truncate text-fg-3")}>{shown ? FIN_HD.xpub : masked}</span>
            <Button
              size="xs"
              variant={shown ? "ghost" : "surface"}
              onClick={() =>
                shown
                  ? setShown(false)
                  : reason.ask({
                      title: "Reveal xpub",
                      description: "The xpub exposes every deposit address and balance for this tenant. Access is logged.",
                      reasons: ["External audit / proof of reserves", "Blockchain analytics onboarding", "Incident investigation", "Watch-only wallet setup"],
                      confirmLabel: "Reveal for 30s",
                      onConfirm: (r) => {
                        setShown(true);
                        auditToast("xpub revealed for 30 seconds", r);
                      },
                    })
              }
            >
              {shown ? <EyeOff /> : <Eye />}
              {shown ? "Hide" : "Reveal"}
            </Button>
          </div>
        </div>
        <div className="divide-y divide-line">
          <Line k="Key storage" v={FIN_HD.hsm} />
          <Line k="Key ceremony" v={FIN_HD.keyCeremony} />
          <Line k="Tenant" v={<span>{FIN_HD.tenant} <span className="font-mono text-fg-3">{FIN_HD.tenantId}</span></span>} />
        </div>
        <div>
          <div className="mb-2 text-[11px] uppercase tracking-wider text-fg-3">Recently derived</div>
          <div className="space-y-1.5">
            {FIN_SWEEP_QUEUE.slice(0, 4).map((q, i) => (
              <div key={q.id} className="flex items-center justify-between gap-2 rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-[12px]">
                <span className="font-mono text-fg-3">/0/{FIN_HD.addresses - i * 3}</span>
                <Addr value={q.address} head={6} tail={4} copy={false} />
                <span className="truncate text-fg-2">{q.client.person.name.split(" ")[0]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {reason.node}
    </Card>
  );
}


