"use client";

import * as React from "react";
import { Lock, Timer } from "lucide-react";
import { Button, Chip, CoinIcon, Dialog, Toggle, formatNumber } from "@ezymex/ui";
import type { FinRate } from "@ezymex/mock/admin-finance";
import { MiniField, NumInput, Section, Select, SettingRow, Slider, auditToast, useReason } from "@/components/config/kit";
import { Line, usd } from "./shared";

export const effRate = (r: Pick<FinRate, "rate" | "markup" | "fixed">) => (r.fixed ? 1 : r.rate * (1 - r.markup / 100));
export const rateDigits = (v: number) => (v >= 1 ? 2 : 5);

const SOURCES: FinRate["source"][] = ["Median (Binance · Kraken · CoinGecko)", "Binance", "Kraken", "CoinGecko"];

export function RateEditor({ rate, onOpenChange, onSave }: { rate: FinRate | null; onOpenChange: (o: boolean) => void; onSave: (r: FinRate) => void }) {
  const [d, setD] = React.useState<FinRate | null>(rate);
  const reason = useReason();
  React.useEffect(() => setD(rate), [rate]);
  const set = (p: Partial<FinRate>) => setD((x) => (x ? { ...x, ...p } : x));

  return (
    <>
      <Dialog
        open={!!rate}
        onOpenChange={onOpenChange}
        side="right"
        title={rate ? `${rate.symbol} → USD conversion` : ""}
        description={rate ? `${rate.name} · ${rate.network}` : undefined}
        footer={
          d && (
            <>
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                variant="ember"
                size="sm"
                onClick={() =>
                  reason.ask({
                    title: `Save ${d.symbol} conversion settings`,
                    description: `Markup ${d.markup.toFixed(2)}% · ${d.source} · stale guard ${d.staleSec}s`,
                    reasons: ["Market volatility adjustment", "Competitive pricing review", "Liquidity provider change", "Treasury policy update"],
                    confirmLabel: "Save",
                    onConfirm: (r) => {
                      onSave(d);
                      onOpenChange(false);
                      auditToast(`${d.symbol} conversion updated`, r);
                    },
                  })
                }
              >
                Save changes
              </Button>
            </>
          )
        }
      >
        {d && (
          <div>
            <Section title="Rate">
              <div className="k-row flex items-center gap-3 p-4">
                <CoinIcon coin={d.coin} size={40} />
                <div className="flex-1">
                  <div className="text-[11px] uppercase tracking-wider text-fg-3">Live · {d.source.startsWith("Median") ? "median of 3" : d.source}</div>
                  <div className="k-num text-[22px] font-semibold">{usd(d.rate, rateDigits(d.rate))}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-wider text-fg-3">Client gets</div>
                  <div className="k-num text-[18px] font-semibold text-ember">{usd(effRate(d), rateDigits(d.rate))}</div>
                </div>
              </div>
              {d.fixed && (
                <div className="mt-3 flex items-center gap-2 rounded-[12px] border border-line bg-surface-2 px-3 py-2.5 text-[12.5px] text-fg-2">
                  <Lock className="size-4 text-gold" /> USDT is pegged 1:1 to the USD wallet. Markup is disabled by policy.
                </div>
              )}
            </Section>
            {!d.fixed && <Section title="Markup" hint="Deducted from the live rate when crediting the USD wallet">
              <div className="flex items-center gap-4">
                <Slider value={d.markup} onChange={(v) => set({ markup: v })} min={0} max={3} step={0.05} marks={[0, 0.5, 1, 1.5, 2, 3]} className="flex-1" />
                <NumInput value={d.markup} onChange={(v) => set({ markup: v })} min={0} max={3} step={0.05} suffix="%" size="sm" className="w-24" decimals={2} />
              </div>
              <div className="mt-2 text-[12px] text-fg-3">
                On {usd(10_000, 0)} converted, the broker earns <span className="k-num text-fg-2">{usd(10_000 * (d.markup / 100))}</span>.
              </div>
            </Section>}
            <Section title="Limits">
              <div className="grid grid-cols-2 gap-3">
                <MiniField label="Min per conversion">
                  <NumInput value={d.min} onChange={(v) => set({ min: v })} min={0} prefix="$" />
                </MiniField>
                <MiniField label="Max per conversion">
                  <NumInput value={d.max} onChange={(v) => set({ max: v })} min={0} step={1000} prefix="$" />
                </MiniField>
              </div>
            </Section>
            <Section title="Price feed">
              <MiniField label="Rate source">
                <Select value={d.source} onChange={(v) => set({ source: v })} options={SOURCES} />
              </MiniField>
              {!d.fixed && <SettingRow label={<span className="inline-flex items-center gap-1.5"><Timer className="size-3.5" /> Stale-rate guard</span>} hint="Pause conversions if the feed hasn't updated for this long" className="mt-2">
                <NumInput value={d.staleSec} onChange={(v) => set({ staleSec: Math.round(v) })} min={5} max={600} step={5} suffix="sec" size="sm" className="w-28" />
              </SettingRow>}
              <SettingRow label="Conversions enabled" hint={d.enabled ? "Deposits in this coin convert automatically" : "Deposits are held in-coin until re-enabled"}>
                <Toggle checked={d.enabled} onChange={(v) => set({ enabled: v })} label="Enabled" />
              </SettingRow>
            </Section>
            <Section title="Preview">
              <div className="divide-y divide-line">
                <Line k={`1 ${d.symbol} at live`} v={usd(d.rate, rateDigits(d.rate))} />
                <Line k={`Markup ${d.markup.toFixed(2)}%`} v={`- ${usd(d.rate - effRate(d), rateDigits(d.rate))}`} tone="down" />
                <Line k="Credited per coin" v={usd(effRate(d), rateDigits(d.rate))} />
                <Line k="24h volume" v={<Chip size="sm">{usd(d.volume24h, 0)}</Chip>} />
                <Line k="Coin units at max" v={`${formatNumber(d.max / Math.max(effRate(d), 1e-9), d.rate > 100 ? 4 : 0)} ${d.symbol}`} />
              </div>
            </Section>
          </div>
        )}
      </Dialog>
      {reason.node}
    </>
  );
}
