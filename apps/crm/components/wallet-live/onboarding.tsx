"use client";

// "Fund your wallet" step of the dashboard's Getting started list, from the real wallet.

import { Wallet } from "lucide-react";
import { fmt, useWallet, type Overview } from "./api";

export function useWalletFunded() {
  const { data } = useWallet<Overview>("overview", 30000);
  return data;
}

export function walletStep(o: Overview | null) {
  const b = o?.balances.find((x) => x.currency === "USDT");
  const total = b ? Number(b.available) + Number(b.locked) : 0;
  const base = { key: "wallet", icon: <Wallet />, title: "Fund your wallet" };
  if (total > 0) return { ...base, text: `Your wallet holds ${fmt(total)} USDT. Move it to a live account to trade.`, state: "done" as const, href: "/wallet/transfer" };
  if (o?.pending_deposits.length) return { ...base, text: "Your deposit is being confirmed on the network.", state: "review" as const, href: "/wallet" };
  return { ...base, text: "Deposit USDT on BNB Chain or TRON with MetaMask or TronLink.", state: "todo" as const, href: "/wallet/deposit" };
}
