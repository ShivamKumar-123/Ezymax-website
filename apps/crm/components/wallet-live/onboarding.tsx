"use client";

// "Fund your wallet" step of the dashboard's Getting started list, from the real wallet.

import { Wallet } from "lucide-react";
import { tr } from "@kalks/i18n/react";
import type { T } from "@kalks/i18n";
import { fmt, useWallet, type Overview } from "./api";

export function useWalletFunded() {
  const { data } = useWallet<Overview>("overview", 30000);
  return data;
}

/** Pass the component's useT() translator as `t`; `tr` (outside React) is the fallback. */
export function walletStep(o: Overview | null, t: T = tr) {
  const b = o?.balances.find((x) => x.currency === "USDT");
  const total = b ? Number(b.available) + Number(b.locked) : 0;
  const base = { key: "wallet", icon: <Wallet />, title: t("wallet.onboarding.title") };
  if (total > 0) return { ...base, text: t("wallet.onboarding.done", { amount: fmt(total) }), state: "done" as const, href: "/wallet/transfer" };
  if (o?.pending_deposits.length) return { ...base, text: t("wallet.onboarding.review"), state: "review" as const, href: "/wallet" };
  return { ...base, text: t("wallet.onboarding.todo"), state: "todo" as const, href: "/wallet/deposit" };
}
