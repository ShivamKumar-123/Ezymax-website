"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Check, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, Dialog, DialogClose, Icon3D, KeyValue, cn } from "@kalks/ui";
import { LOYALTY, LOYALTY_TIERS, REDEEM_CATALOGUE } from "@kalks/mock/rewards";

const TIER_STYLE: Record<string, string> = {
  bronze: "bg-[radial-gradient(circle_at_30%_25%,#ffd9b8,#d98b4a_45%,#8a4b1f)]",
  silver: "bg-[radial-gradient(circle_at_30%_25%,#ffffff,#c7ccd4_45%,#7a818c)]",
  gold: "bg-[radial-gradient(circle_at_30%_25%,#fff3c4,#e9b949_45%,#9c6f14)]",
  platinum: "bg-[radial-gradient(circle_at_30%_25%,#ffffff,#b9c6cf_40%,#55636e)]",
  diamond: "bg-[radial-gradient(circle_at_30%_25%,#ffffff,#9fe3f5_40%,#2b7f97)]",
};

export function TierOrb({ tier, size = 40, className }: { tier: string; size?: number; className?: string }) {
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-full text-[11px] font-bold uppercase text-black/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_8px_18px_-8px_rgba(0,0,0,0.7)]", TIER_STYLE[tier], className)}
      style={{ width: size, height: size, fontSize: size * 0.3 }}
    >
      {tier[0]}
    </span>
  );
}

export function TierTrack() {
  const q = LOYALTY.tierProgress;
  const idx = LOYALTY_TIERS.findIndex((t) => t.key === LOYALTY.tier);
  const next = LOYALTY_TIERS[idx + 1];
  const cur = LOYALTY_TIERS[idx]!;
  const segPct = next ? (q - cur.min) / (next.min - cur.min) : 1;
  // overall track position: each tier is an equal step
  const overall = ((idx + segPct) / (LOYALTY_TIERS.length - 1)) * 100;
  const [sel, setSel] = React.useState(idx);
  const selTier = LOYALTY_TIERS[sel]!;
  return (
    <Card className="h-full">
      <CardHeader
        title="Loyalty tiers"
        subtitle="Based on qualifying points over the last 12 months"
        action={
          <Chip tone="gold" dot>
            {cur.name} member
          </Chip>
        }
      />
      <div className="px-4 pb-6 pt-8 sm:px-8">
        <div className="relative">
          <div className="absolute left-5 right-5 top-5 h-1.5 -translate-y-1/2 rounded-full bg-surface-3" />
          <div className="absolute left-5 right-5 top-5 h-1.5 -translate-y-1/2">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#d98b4a] via-[#e9b949] to-[#ff8a3d] shadow-[0_0_18px_-2px_rgba(233,185,73,0.7)]"
              initial={{ width: 0 }}
              animate={{ width: `${overall}%` }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <div className="relative flex justify-between">
            {LOYALTY_TIERS.map((t, i) => {
              const reached = i <= idx;
              return (
                <button key={t.key} onClick={() => setSel(i)} className="group flex w-10 flex-col items-center">
                  <span className={cn("relative rounded-full transition-transform group-hover:scale-110", i === idx && "ring-4 ring-gold/25", i === sel && "scale-110")}>
                    {reached ? (
                      <TierOrb tier={t.key} size={40} />
                    ) : (
                      <span className="grid size-10 place-items-center rounded-full border border-line bg-surface-2 text-fg-3">
                        <Lock className="size-3.5" />
                      </span>
                    )}
                  </span>
                  <span className={cn("mt-2.5 text-[12px] font-medium", i === idx ? "text-gold" : reached ? "text-fg" : "text-fg-3")}>{t.name}</span>
                  <span className="k-num text-[10.5px] text-fg-3">{t.min ? `${(t.min / 1000).toFixed(0)}k` : "0"}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="k-row px-4 py-4">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-fg-3">Progress to {next?.name}</span>
              <span className="k-num text-fg-2">
                {q.toLocaleString()} / {next?.min.toLocaleString()}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-[#c9971f] to-[#f3cf6b]" initial={{ width: 0 }} animate={{ width: `${segPct * 100}%` }} transition={{ duration: 1, delay: 0.2 }} />
            </div>
            <div className="mt-2.5 text-[13px]">
              <span className="k-num font-semibold text-gold">{next ? (next.min - q).toLocaleString() : 0} pts</span>
              <span className="text-fg-2"> to {next?.name} · about 250 lots of forex at your pace (≈ 5 weeks)</span>
            </div>
          </div>
          <div className="k-row px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[13px] font-medium">
                <TierOrb tier={selTier.key} size={22} /> {selTier.name} perks
              </div>
              {sel <= idx ? (
                <Chip size="sm" tone="up">
                  Unlocked
                </Chip>
              ) : (
                <Chip size="sm">Locked</Chip>
              )}
            </div>
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {selTier.perks.map((p) => (
                <li key={p} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-3 px-2.5 py-1 text-[11.5px] text-fg-2">
                  <Check className={cn("size-3", sel <= idx ? "text-up" : "text-fg-3")} />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function RedeemCatalogue({ balance, onRedeem }: { balance: number; onRedeem: (cost: number, title: string) => void }) {
  const [open, setOpen] = React.useState<string | null>(null);
  const item = REDEEM_CATALOGUE.find((i) => i.id === open);
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 px-4 pb-6 sm:gap-3 sm:px-6 xl:grid-cols-4">
        {REDEEM_CATALOGUE.map((it, i) => {
          const afford = balance >= it.cost;
          return (
            <motion.div
              key={it.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i, duration: 0.4 }}
              className="group relative flex flex-col overflow-hidden rounded-[18px] border border-line bg-surface-2 p-3.5 sm:p-4 transition-colors hover:border-[var(--k-border-top)] hover:bg-surface-3/60"
            >
              <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-[radial-gradient(circle,rgba(255,90,31,0.18),transparent_70%)] opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="flex items-start justify-between">
                <Icon3D name={it.icon} size={44} />
                {"tag" in it && it.tag && (
                  <Chip size="sm" tone={it.tag === "Gold+" ? "gold" : "ember"}>
                    {it.tag}
                  </Chip>
                )}
              </div>
              <div className="mt-3 text-[13.5px] font-medium sm:text-[14.5px]">{it.title}</div>
              <div className="mt-0.5 line-clamp-2 min-h-[34px] text-[12px] text-fg-3">{it.text}</div>
              <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <div className="k-num text-[15px] font-semibold text-gold">{it.cost.toLocaleString()} pts</div>
                  <div className="k-num text-[10.5px] text-fg-3">≈ ${(it.cost * LOYALTY.pointValue).toFixed(0)} value</div>
                </div>
                <Button size="xs" variant={afford ? "ember" : "surface"} onClick={() => (afford ? setOpen(it.id) : toast.error("Not enough points", { description: `You need ${(it.cost - balance).toLocaleString()} more points.` }))}>
                  Redeem
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>
      <Dialog
        open={!!item}
        onOpenChange={(o) => !o && setOpen(null)}
        title={item ? `Redeem ${item.title}` : ""}
        description="Rewards are delivered instantly and can't be reversed."
        width={460}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              variant="ember"
              onClick={() => {
                if (item) {
                  onRedeem(item.cost, item.title);
                  toast.success(`${item.title} redeemed`, { description: `${item.cost.toLocaleString()} points deducted · reward is active now.` });
                }
                setOpen(null);
              }}
            >
              Confirm redemption
            </Button>
          </>
        }
      >
        {item && (
          <div>
            <div className="flex items-center gap-4 rounded-[18px] border border-line bg-surface-2 p-4">
              <Icon3D name={item.icon} size={64} />
              <div>
                <div className="text-[15px] font-medium">{item.title}</div>
                <div className="text-[12.5px] text-fg-3">{item.text}</div>
              </div>
            </div>
            <KeyValue
              className="mt-3"
              rows={[
                ["Cost", <span key="c" className="text-gold">{item.cost.toLocaleString()} pts</span>],
                ["Current balance", `${balance.toLocaleString()} pts`],
                ["Balance after", `${(balance - item.cost).toLocaleString()} pts`],
                ["Applies to", item.id.startsWith("r_cash") ? "USDT wallet · TRC20" : "Account #80412337 (Pro)"],
              ]}
            />
          </div>
        )}
      </Dialog>
    </>
  );
}
