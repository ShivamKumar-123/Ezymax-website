"use client";

// The pieces of "Hide balances" (lib/hide-balances.ts): the eye button and <AccountMoney>, which every account-level
// amount goes through (balance, equity, credit, floating P&L, margin, free margin).
import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@ezymex/ui";
import { useT } from "@ezymex/i18n/react";
import { MASK, setBalancesHidden, useBalancesHidden } from "@/lib/hide-balances";
import { IconButton } from "./kit";

/** The keyboard shortcut (shell/hotkeys.ts). */
export const HIDE_BALANCES_KEYS = "Shift+H";

/**
 * An account-level amount: the figure (`children`: text, <LiveMoney>, <Pnl>…), or •••••• while balances are hidden.
 * Wrap the number only: the currency label next to it stays. The mask is neutral (no profit / loss colour).
 */
export function AccountMoney({ children, className }: { children: React.ReactNode; className?: string }) {
  const hidden = useBalancesHidden();
  const t = useT();
  if (!hidden) return <>{children}</>;
  return (
    <span role="img" aria-label={t("desk.top.balancesHidden")} className={cn("k-num select-none tracking-[0.04em]", className)}>
      {MASK}
    </span>
  );
}

/** The eye: hides / shows every account amount (tooltip "Hide balances" / "Show balances", pressed while hidden). */
export function HideBalancesButton({ size = "md", tipSide, shortcut = true, className }: { size?: "sm" | "md" | "lg"; tipSide?: "top" | "bottom"; shortcut?: boolean; className?: string }) {
  const t = useT();
  const hidden = useBalancesHidden();
  return (
    <IconButton
      label={hidden ? t("desk.top.showBalances") : t("desk.top.hideBalances")}
      shortcut={shortcut ? HIDE_BALANCES_KEYS : undefined}
      size={size}
      tipSide={tipSide}
      active={hidden}
      onClick={() => setBalancesHidden(!hidden)}
      className={className}
    >
      {hidden ? <Eye /> : <EyeOff />}
    </IconButton>
  );
}
