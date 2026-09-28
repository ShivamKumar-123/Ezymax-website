"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, PencilLine, Star, XCircle } from "lucide-react";
import { Avatar, Button, Chip, SpotlightCard, SymbolAvatar, cn } from "@kalks/ui";
import type { Listing } from "@kalks/mock/admin-partners";
import { ago } from "@/components/partners/common";

export const CAT_TONE: Record<Listing["category"], "ember" | "gold" | "info" | "neutral"> = { Strategy: "ember", EA: "gold", Signal: "info", Indicator: "neutral" };

export function priceLabel(l: Listing) {
  return l.priceModel === "free" ? "Free" : l.priceModel === "profit-share" ? `${l.price}% profit share` : l.priceModel === "monthly" ? `$${l.price}/mo` : `$${l.price} one-time`;
}

function Stat({ k, v, bad }: { k: string; v: string; bad?: boolean }) {
  return (
    <div className="rounded-[10px] border border-line bg-surface-2 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-fg-3">{k}</div>
      <div className={cn("k-num text-[13px] font-medium", bad ? "text-down" : "text-fg")}>{v}</div>
    </div>
  );
}

export function ListingCard({ l, onApprove, onChanges, onReject }: { l: Listing; onApprove: () => void; onChanges: () => void; onReject: () => void }) {
  const b = l.backtest;
  const risky = l.flags.length > 0;
  return (
    <SpotlightCard className={cn("flex h-full flex-col", risky && "border-down/30")}>
      <div className="flex items-start gap-3 px-5 pt-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip size="sm" tone={CAT_TONE[l.category]}>{l.category}</Chip>
            <Chip size="sm">{l.platform}</Chip>
            {l.status === "changes" && <Chip size="sm" tone="warn" dot>Changes requested</Chip>}
          </div>
          <div className="mt-2 truncate text-[16px] font-medium">{l.title}</div>
          <div className="mt-1 flex items-center gap-2 text-[12px] text-fg-3">
            <Avatar src={l.photo} name={l.author} size={18} />
            {l.author} · <span className="font-mono">{l.id}</span> · {ago(l.submitted)}
          </div>
        </div>
        <div className="text-right">
          <div className="k-num text-[14px] font-semibold">{priceLabel(l)}</div>
          <div className="mt-1 flex justify-end -space-x-1">
            {l.symbols.map((s) => (
              <SymbolAvatar key={s} symbol={s} size={18} />
            ))}
          </div>
        </div>
      </div>
      <div className={cn("mx-5 mt-3 rounded-[12px] border px-3 py-2 text-[12.5px] italic", risky ? "border-down/25 bg-down-soft text-fg" : "border-line bg-surface-2 text-fg-2")}>&ldquo;{l.claim}&rdquo;</div>
      <div className="mt-3 grid grid-cols-3 gap-1.5 px-5">
        <Stat k="Win rate" v={`${b.winRate}%`} bad={b.winRate > 85} />
        <Stat k="Profit factor" v={b.profitFactor.toFixed(2)} bad={b.profitFactor > 3} />
        <Stat k="Max DD" v={`${b.maxDD}%`} bad={b.maxDD > 35} />
        <Stat k="CAGR" v={`${b.cagr}%`} bad={b.cagr > 150} />
        <Stat k="Sharpe" v={b.sharpe.toFixed(2)} bad={b.sharpe > 3} />
        <Stat k="Trades" v={b.trades.toLocaleString()} />
      </div>
      <div className="px-5 pt-2 text-[11px] text-fg-3">Backtest {b.period} · tick data 99% quality</div>
      <div className="flex min-h-7 flex-wrap gap-1.5 px-5 pt-3">
        {l.flags.map((f) => (
          <Chip key={f} size="sm" tone="down"><AlertTriangle className="size-3" /> {f}</Chip>
        ))}
        {!risky && <Chip size="sm" tone="up"><CheckCircle2 className="size-3" /> Automated checks passed</Chip>}
      </div>
      <div className="mt-auto flex items-center gap-2 px-5 pb-5 pt-4">
        <Button size="sm" variant={risky ? "surface" : "buy"} onClick={onApprove}>
          <CheckCircle2 /> Approve
        </Button>
        <Button size="sm" variant="surface" onClick={onChanges}>
          <PencilLine /> Request changes
        </Button>
        <span className="flex-1" />
        <Button size="sm" variant="down-outline" onClick={onReject}>
          <XCircle /> Reject
        </Button>
      </div>
    </SpotlightCard>
  );
}

export function Rating({ v }: { v: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[12.5px]">
      <Star className="size-3.5 fill-gold text-gold" />
      <span className="k-num font-medium">{v.toFixed(1)}</span>
    </span>
  );
}
