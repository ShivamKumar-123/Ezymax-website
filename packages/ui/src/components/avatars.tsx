import * as React from "react";
import { getInstrument, type SymbolIcon } from "@kalks/mock";
import { cn } from "../lib/cn";
import { AnimIcon } from "./anim-icon";

export function Flag({ country, className }: { country: string; className?: string }) {
  return <span className={cn("fi fis inline-block size-5 shrink-0 rounded-full bg-cover ring-1 ring-black/20", `fi-${country}`, className)} />;
}

export function Avatar({
  src,
  name,
  size = 36,
  verified,
  online,
  className,
}: {
  src?: string;
  name: string;
  size?: number;
  verified?: boolean;
  online?: boolean;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <span className={cn("relative inline-block shrink-0", className)} style={{ width: size, height: size }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="size-full rounded-full object-cover ring-1 ring-white/10" />
      ) : (
        <span className="grid size-full place-items-center rounded-full bg-surface-3 text-xs font-semibold text-fg-2">{initials}</span>
      )}
      {verified && (
        <span className="absolute -bottom-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-up ring-2 ring-bg">
          <svg viewBox="0 0 12 12" className="size-2.5 fill-none stroke-white stroke-2">
            <path d="M2.5 6.2l2.2 2.2 4.8-4.8" />
          </svg>
        </span>
      )}
      {online && <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-up ring-2 ring-bg" />}
    </span>
  );
}

export function CoinIcon({ coin, size = 32, className }: { coin: string; size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/assets/coins/${coin}.svg`} alt={coin.toUpperCase()} width={size} height={size} className={cn("shrink-0 rounded-full", className)} />;
}

/**
 * Accent icon for KPIs, heroes and empty states. Formerly a 3D emoji PNG; now the Kalks animated line icon
 * (same `name` keys, see ANIM_ICONS).
 */
export function Icon3D({ name, size = 64, className }: { name: string; size?: number; className?: string }) {
  // accent tiles stay compact — large tinted boxes read as empty placeholders
  return <AnimIcon name={name} size={Math.min(size, 52)} className={className} />;
}

function IconBody({ icon, size }: { icon: SymbolIcon; size: number }) {
  const inner = Math.round(size * 0.62);
  switch (icon.kind) {
    case "pair":
      return (
        <span className="relative inline-block shrink-0" style={{ width: size * 1.45, height: size }}>
          <span className={cn("fi fis absolute left-0 top-0 rounded-full ring-2 ring-surface", `fi-${icon.base}`)} style={{ width: size, height: size, position: "absolute" }} />
          <span className={cn("fi fis absolute right-0 top-0 rounded-full ring-2 ring-surface", `fi-${icon.quote}`)} style={{ width: size, height: size, position: "absolute" }} />
        </span>
      );
    case "coin":
      return <CoinIcon coin={icon.coin} size={size} />;
    case "flag":
      return <span className={cn("fi fis inline-block shrink-0 rounded-full", `fi-${icon.country}`)} style={{ width: size, height: size }} />;
    case "stock":
      return (
        <span className="grid shrink-0 place-items-center rounded-full" style={{ width: size, height: size, background: icon.bg }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/assets/stocks/${icon.logo}.svg`} alt="" width={inner} height={inner} className="invert" />
        </span>
      );
    case "metal":
      return (
        <span
          className="grid shrink-0 place-items-center rounded-full text-[10px] font-bold text-black/70"
          style={{
            width: size,
            height: size,
            background: icon.metal === "gold" ? "radial-gradient(circle at 30% 25%, #fff3c4, #e9b949 45%, #9c6f14)" : "radial-gradient(circle at 30% 25%, #ffffff, #c7ccd4 45%, #7a818c)",
          }}
        >
          {icon.metal === "gold" ? "Au" : "Ag"}
        </span>
      );
    case "energy":
      return (
        <span className="grid shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_30%_25%,#3b3b44,#141418)] text-[9px] font-bold text-gold ring-1 ring-white/10" style={{ width: size, height: size }}>
          {icon.code}
        </span>
      );
  }
}

export function SymbolAvatar({ symbol, size = 28 }: { symbol: string; size?: number }) {
  return <IconBody icon={getInstrument(symbol).icon} size={size} />;
}

export function SymbolCell({ symbol, size = 28, sub, className }: { symbol: string; size?: number; sub?: React.ReactNode; className?: string }) {
  const inst = getInstrument(symbol);
  return (
    <span className={cn("flex min-w-0 items-center gap-3", className)}>
      <SymbolAvatar symbol={symbol} size={size} />
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-medium text-fg">{symbol}</span>
        <span className="block truncate text-[12px] text-fg-3">{sub ?? inst.name}</span>
      </span>
    </span>
  );
}
