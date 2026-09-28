"use client";

import * as React from "react";
import { AlertTriangle, Flame, KeyRound, Loader2, Send, ShieldCheck } from "lucide-react";
import { Avatar, Button, Dialog, Progress, cn } from "@kalks/ui";
import { FIN_HOT_WALLET, type FinWithdrawal } from "@kalks/mock/admin-finance";
import { Addr } from "@/components/config/kit";
import { Line, num, usd } from "./shared";

/** TRC20 USDT transfer ≈ 65k energy; with staked energy exhausted each tx burns ~13.4 TRX. */
export const TRX_PER_TX = 13.4;
const STAKED_ENERGY_TXS = Math.floor(FIN_HOT_WALLET.energy / 65_000);

export function BatchSendDialog({ rows, open, onOpenChange, onSent, hot = { usdt: FIN_HOT_WALLET.usdt, trx: FIN_HOT_WALLET.trx } }: { rows: FinWithdrawal[]; open: boolean; onOpenChange: (o: boolean) => void; onSent: (ids: string[], trxFee: number) => void; hot?: { usdt: number; trx: number } }) {
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (open) {
      setCode("");
      setBusy(false);
    }
  }, [open]);

  const total = rows.reduce((s, r) => s + r.amount - r.fee, 0);
  const burnTxs = Math.max(0, rows.length - STAKED_ENERGY_TXS);
  const trxFee = burnTxs * TRX_PER_TX + rows.length * 0.345; // + bandwidth
  const usdtAfter = hot.usdt - total;
  const trxAfter = hot.trx - trxFee;
  const insufficient = usdtAfter < 0;
  const lowGas = trxAfter < FIN_HOT_WALLET.trxMin;
  const ready = code.length === 6 && !insufficient && rows.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      width={600}
      title="Send batch from hot wallet"
      description="Signed in the HSM and broadcast to TRON as individual TRC20 transfers."
      footer={
        <>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="ember"
            size="sm"
            disabled={!ready || busy}
            onClick={() => {
              setBusy(true);
              setTimeout(() => {
                onSent(rows.map((r) => r.id), trxFee);
                onOpenChange(false);
              }, 1400);
            }}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Send />}
            {busy ? "Broadcasting…" : `Sign & send ${rows.length} tx`}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-2">
          <div className="k-row px-4 py-3">
            <div className="text-[11px] uppercase tracking-wider text-fg-3">Transfers</div>
            <div className="k-num mt-1 text-[20px] font-semibold">{rows.length}</div>
          </div>
          <div className="k-row px-4 py-3">
            <div className="text-[11px] uppercase tracking-wider text-fg-3">Total USDT</div>
            <div className="k-num mt-1 truncate text-[20px] font-semibold">{num(total)}</div>
          </div>
          <div className="k-row px-4 py-3">
            <div className="text-[11px] uppercase tracking-wider text-fg-3">Est. TRX fee</div>
            <div className="k-num mt-1 text-[20px] font-semibold text-gold">{num(trxFee, 1)}</div>
          </div>
        </div>

        <div className="max-h-44 space-y-1 overflow-y-auto rounded-[14px] border border-line bg-surface-2 p-1.5">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-[12.5px] hover:bg-surface-3">
              <Avatar src={r.client.person.photo} name={r.client.person.name} size={22} />
              <span className="min-w-0 flex-1 truncate">{r.client.person.name}</span>
              <Addr value={r.address} copy={false} className="hidden text-[11.5px] sm:inline-flex" />
              <span className="k-num w-24 text-right font-medium">{num(r.amount - r.fee)}</span>
            </div>
          ))}
        </div>

        <div className="k-row px-4 py-1">
          <div className="divide-y divide-line">
            <Line k="Hot wallet" v={<Addr value={FIN_HOT_WALLET.address} head={8} tail={6} />} />
            <Line k="USDT balance after" v={`${num(usdtAfter)} USDT`} tone={insufficient ? "down" : undefined} />
            <Line
              k={
                <span className="inline-flex items-center gap-1.5">
                  <Flame className="size-3.5 text-gold" /> Energy
                </span>
              }
              v={`${Math.min(rows.length, STAKED_ENERGY_TXS)} tx from staked energy · ${burnTxs} burn ~${TRX_PER_TX} TRX`}
            />
            <Line k="TRX gas after" v={`${num(trxAfter, 1)} TRX`} tone={lowGas ? "warn" : undefined} />
          </div>
          <Progress value={(Math.max(0, trxAfter) / FIN_HOT_WALLET.trxTarget) * 100} tone={lowGas ? "warn" : "up"} className="mb-3 mt-1" />
        </div>

        {(insufficient || lowGas) && (
          <div className={cn("flex items-start gap-2 rounded-[12px] border px-3 py-2.5 text-[12.5px]", insufficient ? "border-down/25 bg-down-soft text-down" : "border-warn/25 bg-warn-soft text-warn")}>
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {insufficient ? "Hot wallet balance is insufficient. Move funds from cold vault A (2-of-3 approval) before sending." : "TRX gas will drop below the 5,000 TRX safety floor. Top up gas after this batch."}
          </div>
        )}

        <div>
          <div className="mb-1.5 flex items-center justify-between text-[12px] font-medium text-fg-2">
            <span className="inline-flex items-center gap-1.5">
              <KeyRound className="size-3.5" /> Authenticator code
            </span>
            <span className="font-normal text-fg-3">Required for every hot-wallet send</span>
          </div>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="••••••"
            aria-label="2FA code"
            className="h-12 w-full rounded-[14px] border border-line bg-surface-2 text-center font-mono text-[22px] tracking-[0.6em] text-fg outline-none placeholder:text-fg-3 focus:border-ember/50 focus:ring-4 focus:ring-ember/10"
          />
        </div>
        <div className="flex items-center gap-2 text-[12px] text-fg-3">
          <ShieldCheck className="size-4 text-ember" /> Keys never leave the HSM. The batch and your approval are written to the audit trail.
        </div>
      </div>
    </Dialog>
  );
}
