"use client";

import * as React from "react";
import { Bot, Code2, Copy as CopyIcon, Hand, Headset, Network, Sparkles, Users2, Webhook } from "lucide-react";
import { Avatar, Chip, SymbolAvatar, Tooltip, cn, formatNumber } from "@ezymex/ui";
import { getInstrument } from "@ezymex/mock";
import { getClient } from "@ezymex/mock/admin-clients";
import { IS_DEMO } from "@ezymex/mock/mode";
import type { OrderSource } from "@ezymex/mock/admin-trading";
import { digitsOf } from "@/lib/trading-desk/calc";
import { liveClientName, useLiveDirectory } from "@/lib/trading-desk/directory";

export function RouteChip({ route }: { route: "A" | "B" }) {
  return (
    <Tooltip content={route === "A" ? "A-book · hedged with LP (falls back to B while LP offline)" : "B-book · internalised"}>
      <span>
        <Chip size="sm" tone={route === "A" ? "info" : "neutral"} className="font-mono">
          {route}
        </Chip>
      </span>
    </Tooltip>
  );
}

const SOURCE_ICON: Record<OrderSource, React.ReactNode> = { manual: <Hand />, copy: <CopyIcon />, api: <Code2 />, fix: <Network />, webhook: <Webhook />, strategy: <Bot />, pamm: <Users2 />, ai: <Sparkles />, dealer: <Headset /> };
export const SOURCE_LABEL: Record<OrderSource, string> = { manual: "Manual", copy: "Copy", api: "API", fix: "FIX", webhook: "Webhook", strategy: "Strategy", pamm: "PAMM", ai: "AI", dealer: "Dealer" };

export function SourceTag({ source, platform }: { source: OrderSource; platform?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11.5px] text-fg-2 [&_svg]:size-3 [&_svg]:text-fg-3">
      {SOURCE_ICON[source]}
      <span className={source === "dealer" ? "text-ember" : undefined}>{SOURCE_LABEL[source]}</span>
      {platform && <span className="text-fg-3">· {platform}</span>}
    </span>
  );
}

/** Live builds: the gateway user behind a trading account (name from the live directory). */
function LiveMiniClient({ clientId, login }: { clientId: string; login: string }) {
  useLiveDirectory();
  const name = liveClientName(clientId, login.split(" ")[0]);
  return (
    <a href={`/clients/${clientId}`} onClick={(e) => e.stopPropagation()} className="group/mc flex min-w-0 items-center gap-2">
      <Avatar name={name} size={24} />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[12.5px] group-hover/mc:text-ember">{name}</span>
        <span className="block font-mono text-[10.5px] text-fg-3">{login}</span>
      </span>
    </a>
  );
}

export function MiniClient({ clientId, login }: { clientId: string; login: string }) {
  if (!IS_DEMO) return <LiveMiniClient clientId={clientId} login={login} />;
  const c = getClient(clientId);
  return (
    <a href={`/clients/${c.id}`} onClick={(e) => e.stopPropagation()} className="group/mc flex min-w-0 items-center gap-2">
      <Avatar src={c.photo} name={c.name} size={24} />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[12.5px] group-hover/mc:text-ember">{c.name}</span>
        <span className="block font-mono text-[10.5px] text-fg-3">{login}</span>
      </span>
    </a>
  );
}

export function SymbolMini({ symbol }: { symbol: string }) {
  return (
    <span className="flex items-center gap-2 whitespace-nowrap">
      <SymbolAvatar symbol={symbol} size={20} />
      <span className="text-[13px] font-medium">{symbol}</span>
    </span>
  );
}

export function fmtPrice(symbol: string, v: number) {
  return formatNumber(v, IS_DEMO ? getInstrument(symbol).digits : digitsOf(symbol));
}

export function SideChip({ side, volume }: { side: "buy" | "sell"; volume?: number }) {
  return (
    <Chip size="sm" tone={side === "buy" ? "up" : "down"} className={cn("font-semibold")}>
      {side.toUpperCase()}
      {volume !== undefined && ` ${volume}`}
    </Chip>
  );
}
