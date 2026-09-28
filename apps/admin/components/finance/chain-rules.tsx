"use client";

import * as React from "react";
import { Settings2 } from "lucide-react";
import { Button, Card, CardHeader, Chip, CoinIcon, Dialog, Toggle, cn } from "@kalks/ui";
import { FIN_CHAINS, type FinChainConfig } from "@kalks/mock/admin-finance";
import { NumInput, auditToast, useReason } from "@/components/config/kit";
import { fmtDuration } from "./shared";

const NET_COIN: Record<string, string> = { TRC20: "trx", ERC20: "eth", BEP20: "bnb", BTC: "btc", SOL: "sol" };

export function ChainRulesDialog({ open, onOpenChange, chains, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; chains: FinChainConfig[]; onSave: (c: FinChainConfig[]) => void }) {
  const [draft, setDraft] = React.useState(chains);
  const reason = useReason();
  React.useEffect(() => {
    if (open) setDraft(chains);
  }, [open, chains]);
  const set = (i: number, patch: Partial<FinChainConfig>) => setDraft((d) => d.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        width={640}
        title="Auto-credit rules"
        description="Deposits credit the client wallet automatically once the chain reaches the required confirmations."
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
                  title: "Save auto-credit rules",
                  description: "Confirmation thresholds apply to every new deposit immediately.",
                  reasons: ["Chain reorg risk reassessed", "Exchange listing / delisting", "Treasury policy update", "Incident follow-up"],
                  confirmLabel: "Save rules",
                  onConfirm: (r) => {
                    onSave(draft);
                    onOpenChange(false);
                    auditToast("Auto-credit rules updated", r);
                  },
                })
              }
            >
              Save rules
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <div className="hidden grid-cols-[1fr_120px_120px_56px] gap-3 px-3 text-[11px] uppercase tracking-wider text-fg-3 sm:grid">
            <span>Network</span>
            <span>Confirmations</span>
            <span>Min deposit</span>
            <span className="text-right">On</span>
          </div>
          {draft.map((c, i) => (
            <div key={c.network} className="k-row grid grid-cols-2 items-center gap-3 px-3 py-2.5 sm:grid-cols-[1fr_120px_120px_56px]">
              <div className="col-span-2 flex items-center gap-2.5 sm:col-span-1">
                <CoinIcon coin={NET_COIN[c.network]!} size={26} />
                <div>
                  <div className="text-[13.5px] font-medium">{c.network}</div>
                  <div className="text-[11.5px] text-fg-3">
                    {c.label} · ~{fmtDuration(c.required * c.blockTime)} to final
                  </div>
                </div>
              </div>
              <NumInput size="sm" value={c.required} onChange={(v) => set(i, { required: Math.round(v) })} min={1} max={200} suffix="conf" />
              <NumInput size="sm" value={c.minDeposit} onChange={(v) => set(i, { minDeposit: v })} min={0} suffix={c.network === "BTC" ? "BTC" : "USDT"} />
              <div className="flex justify-end">
                <Toggle checked={c.enabled} onChange={(v) => set(i, { enabled: v })} label={`Enable ${c.network}`} />
              </div>
            </div>
          ))}
        </div>
      </Dialog>
      {reason.node}
    </>
  );
}

export function ChainRulesCard({ chains, onEdit }: { chains: FinChainConfig[]; onEdit: () => void }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Auto-credit rules"
        subtitle="Confirmations required per chain"
        action={
          <Button size="sm" variant="surface" onClick={onEdit}>
            <Settings2 /> Edit
          </Button>
        }
      />
      <div className="mt-4 flex-1 space-y-2 px-4 pb-5 sm:px-6">
        {chains.map((c) => (
          <div key={c.network} className={cn("k-row flex items-center gap-3 px-3.5 py-2.5", !c.enabled && "opacity-55")}>
            <CoinIcon coin={NET_COIN[c.network]!} size={24} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[13px] font-medium">
                {c.network}
                {!c.enabled && <Chip size="sm">Disabled</Chip>}
              </div>
              <div className="truncate text-[11.5px] text-fg-3">
                avg credit {fmtDuration(c.avgCreditSec)} · min {c.minDeposit} {c.network === "BTC" ? "BTC" : "USDT"}
              </div>
            </div>
            <div className="text-right">
              <div className="k-num text-[15px] font-semibold text-fg">{c.required}</div>
              <div className="text-[10.5px] uppercase tracking-wider text-fg-3">conf</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export { FIN_CHAINS };
