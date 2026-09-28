/**
 * Extra mock data for the Wallet module (deposit networks, pending
 * withdrawals, incoming deposit tracker, limits, conversion, FAQ).
 */
import { ACCOUNTS, WALLET, WALLET_TXS, type TradingAccount, type WalletTx } from "./client";

export interface DepositNetwork {
  id: string;
  asset: string;
  network: string;
  short: string;
  icon: string;
  active: boolean;
  minDeposit: number;
  confirmations: number;
  eta: string;
  fee: string;
}

export const DEPOSIT_NETWORKS: DepositNetwork[] = [
  { id: "usdt-trc20", asset: "USDT", network: "TRON (TRC20)", short: "TRC20", icon: "usdt", active: true, minDeposit: 10, confirmations: 20, eta: "≈ 1–3 min", fee: "No Kalks fee" },
  { id: "usdt-erc20", asset: "USDT", network: "Ethereum (ERC20)", short: "ERC20", icon: "usdt", active: false, minDeposit: 50, confirmations: 12, eta: "≈ 5 min", fee: "No Kalks fee" },
  { id: "usdt-bep20", asset: "USDT", network: "BNB Chain (BEP20)", short: "BEP20", icon: "bnb", active: false, minDeposit: 10, confirmations: 15, eta: "≈ 1 min", fee: "No Kalks fee" },
  { id: "btc", asset: "BTC", network: "Bitcoin", short: "BTC", icon: "btc", active: false, minDeposit: 0.0005, confirmations: 2, eta: "≈ 20 min", fee: "No Kalks fee" },
  { id: "eth", asset: "ETH", network: "Ethereum", short: "ETH", icon: "eth", active: false, minDeposit: 0.01, confirmations: 12, eta: "≈ 3 min", fee: "No Kalks fee" },
  { id: "trx", asset: "TRX", network: "TRON", short: "TRX", icon: "trx", active: false, minDeposit: 50, confirmations: 20, eta: "≈ 1 min", fee: "No Kalks fee" },
];

export const WALLET_LIMITS = {
  deposit: { min: 10, maxPerTx: 250000 },
  withdraw: { min: 20, maxPerTx: 10000, daily: 50000, usedToday: 1250, fee: 1, monthly: 250000, usedMonth: 18450 },
  transfer: { min: 1, maxPerTx: 100000, daily: 250000, usedToday: 3200 },
};

/** Live rate + markup applied to non-USDT conversions (USDT ↔ USD is 1:1). */
export const CONVERSION = {
  markupPct: 0.5,
  rates: { USDT: 1, TRX: 0.161, BTC: 63412 } as Record<string, number>,
};

export const INCOMING_DEPOSIT = {
  hash: "7f3c9a1e44b0d2c85e61f9a73b2d4c08e1a6f5b9c3d27e40a8b1c6d9e2f4a715",
  amount: 1500,
  asset: "USDT",
  from: "TXa9Qm4Lr7Bv2PeW8nZk3HcJ5sY1dFgR6u",
  confirmations: 12,
  required: 20,
  detectedAt: "2026-09-24T18:31:12Z",
};

export interface PendingWithdrawal {
  id: string;
  amount: number;
  fee: number;
  address: string;
  label?: string;
  status: "pending" | "processing" | "review";
  createdAt: string;
  step: number; // 0 requested · 1 email verified · 2 admin review · 3 broadcast · 4 completed
}

export const PENDING_WITHDRAWALS: PendingWithdrawal[] = [
  { id: "WD-204418", amount: 1250, fee: 1, address: "TN4bP8kQ2vRm6WxZ9cJ3hLs7Ya1eDfGu8Q", label: "Binance", status: "review", createdAt: "2026-09-24T14:12:00Z", step: 2 },
  { id: "WD-204371", amount: 420, fee: 1, address: "TGy7Hk3Nq9Ls2Wm5Bx8Pd4Rc6Vf1Ze9Tj3", label: "Ledger Nano X", status: "processing", createdAt: "2026-09-23T09:48:00Z", step: 3 },
];

export const ADDRESS_BOOK = [
  { label: "Binance", address: "TN4bP8kQ2vRm6WxZ9cJ3hLs7Ya1eDfGu8Q", whitelisted: true },
  { label: "Ledger Nano X", address: "TGy7Hk3Nq9Ls2Wm5Bx8Pd4Rc6Vf1Ze9Tj3", whitelisted: true },
  { label: "OKX", address: "TLm2Rq8Wn4Kc7Vb1Hx5Zp9Jd3Ys6Ft4Ga2", whitelisted: false },
];

export const DEPOSIT_FAQ = [
  { q: "How long does a USDT (TRC20) deposit take?", a: "TRON produces a block roughly every 3 seconds. Your deposit is detected on the first block and credited to your wallet automatically after 20 confirmations — usually within 1–3 minutes." },
  { q: "What happens if I send a different token or use another network?", a: "Only send USDT on the TRON (TRC20) network to this address. Tokens sent on ERC20, BEP20 or any other chain cannot be credited automatically and may be lost. Contact support with your tx hash and we will try to help." },
  { q: "Is there a minimum deposit?", a: "The minimum is 10 USDT. Smaller deposits are still detected but are held until your cumulative pending amount reaches the minimum." },
  { q: "Does Kalks charge deposit fees?", a: "No. Kalks does not charge any deposit fee. You only pay the TRON network (energy/bandwidth) fee charged by your sending wallet or exchange." },
  { q: "Is my deposit address permanent?", a: "Yes. The address is derived from your personal HD wallet and never changes, so you can safely whitelist it on your exchange." },
  { q: "Do I need KYC to deposit?", a: "No. You can deposit and trade immediately. Identity verification is only required before your first withdrawal." },
];

/* ------------------------------------------------------------------ */

export function txDirection(tx: WalletTx): "in" | "out" {
  return tx.to === "Wallet" ? "in" : "out";
}

export const TX_TYPE_LABEL: Record<WalletTx["type"], string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  transfer: "Transfer",
  "ib-payout": "IB payout",
  "copy-fee": "Copy fee",
  bonus: "Bonus",
  conversion: "Conversion",
};

export function walletTotalUsd() {
  return WALLET.assets.reduce((s, a) => s + a.usd, 0);
}

export function liveAccounts(): TradingAccount[] {
  return ACCOUNTS.filter((a) => a.type === "live");
}

export function recentTxs(n = 8) {
  return WALLET_TXS.slice(0, n);
}

/** Pads a hash so it looks like a 64-char TRON tx id. */
export function fullHash(h?: string) {
  if (!h) return "";
  return (h + "c4e19b7a2f06d58e3b91a7c40f2e6d8b5a13c97e0f4b2d6a8c1e3f5b7d9a0c2e").slice(0, 64);
}

/** USDT available to use (wallet balance minus pending withdrawals incl. fees). */
export function walletAvailableUsdt() {
  const usdt = WALLET.assets.find((a) => a.asset === "USDT")!.balance;
  return +(usdt - PENDING_WITHDRAWALS.reduce((s, w) => s + w.amount + w.fee, 0)).toFixed(2);
}
