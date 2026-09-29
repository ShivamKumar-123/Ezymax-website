"use client";

// Paying a deposit from the client's own wallet app. Both flows end with the transaction hash, which is
// submitted to the wallet service at once (the service then verifies it on chain).
//
// - MetaMask (BNB Chain, EIP-1193 window.ethereum): eth_requestAccounts → switch / add chain 56 →
//   eth_sendTransaction of USDT transfer(companyAddress, amount) (ABI-encoded; BEP20 USDT has 18 decimals).
//   On a phone without an injected provider we open the page inside the MetaMask app (deep link).
// - TronLink (TRON, window.tronLink / window.tronWeb): tron_requestAccounts → triggerSmartContract
//   transfer(address,uint256) on the USDT contract → sign → sendRawTransaction (TRC20 USDT has 6 decimals).

import { tr } from "@kalks/i18n/react";

type Eip1193 = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown>; isMetaMask?: boolean };

type TronWebLike = {
  defaultAddress?: { base58?: string | false };
  transactionBuilder: {
    triggerSmartContract: (
      contract: string,
      fn: string,
      opts: { feeLimit: number; callValue: number },
      params: { type: string; value: string }[],
      issuer: string,
    ) => Promise<{ result?: { result?: boolean }; transaction?: { txID: string } & Record<string, unknown> }>;
  };
  trx: {
    sign: (tx: unknown) => Promise<unknown>;
    sendRawTransaction: (signed: unknown) => Promise<{ result?: boolean; txid?: string; code?: string; message?: string }>;
  };
};

type TronLinkLike = { request?: (a: { method: string }) => Promise<unknown>; ready?: boolean; tronWeb?: TronWebLike };

declare global {
  interface Window {
    ethereum?: Eip1193;
    tronLink?: TronLinkLike;
    tronWeb?: TronWebLike;
  }
}

export class PayError extends Error {
  constructor(
    public code: "no_wallet" | "rejected" | "wrong_network" | "failed" | "locked",
    message: string,
  ) {
    super(message);
  }
}

/** Decimal string → integer units (no floating point). */
export function toUnits(amount: string, decimals: number): bigint {
  const [i = "0", f = ""] = amount.trim().split(".");
  if (!/^\d+$/.test(i) || !/^\d*$/.test(f) || f.length > decimals) throw new PayError("failed", tr("wallet.pay.invalidAmount"));
  return BigInt(i + f.padEnd(decimals, "0"));
}

/** ABI data for ERC-20 transfer(address,uint256). */
export function erc20TransferData(to: string, units: bigint): string {
  const addr = to.toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{40}$/.test(addr)) throw new PayError("failed", tr("wallet.pay.invalidAddress"));
  return "0xa9059cbb" + addr.padStart(64, "0") + units.toString(16).padStart(64, "0");
}

export const hasMetaMask = () => typeof window !== "undefined" && !!window.ethereum;
export const hasTronLink = () => typeof window !== "undefined" && !!(window.tronLink || window.tronWeb);
export const isMobile = () => typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/** Opens this deposit inside the MetaMask mobile app (its in-app browser injects window.ethereum). */
export function metamaskDeepLink(intentId: string) {
  const host = window.location.host;
  return `https://metamask.app.link/dapp/${host}/wallet/deposit?intent=${encodeURIComponent(intentId)}`;
}

function rpcError(e: unknown): PayError {
  const err = e as { code?: number; message?: string };
  if (err?.code === 4001) return new PayError("rejected", tr("wallet.pay.mmCancelled"));
  if (err?.code === -32002) return new PayError("locked", tr("wallet.pay.mmPending"));
  return new PayError("failed", err?.message ? String(err.message).slice(0, 200) : tr("wallet.pay.mmSendFailed"));
}

const BSC = {
  chainId: "0x38",
  chainName: "BNB Smart Chain",
  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  rpcUrls: ["https://bsc-dataseed.binance.org"],
  blockExplorerUrls: ["https://bscscan.com"],
};

export async function payWithMetaMask(p: { token: string; to: string; amount: string; decimals: number }): Promise<{ hash: string; from: string }> {
  const eth = window.ethereum;
  if (!eth) throw new PayError("no_wallet", tr("wallet.pay.mmNotInstalled"));
  let from: string;
  try {
    const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    from = accounts?.[0] ?? "";
    if (!from) throw new PayError("locked", tr("wallet.pay.mmUnlock"));
  } catch (e) {
    throw e instanceof PayError ? e : rpcError(e);
  }
  try {
    const current = (await eth.request({ method: "eth_chainId" })) as string;
    if (String(current).toLowerCase() !== BSC.chainId) {
      try {
        await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BSC.chainId }] });
      } catch (e) {
        if ((e as { code?: number })?.code === 4902) await eth.request({ method: "wallet_addEthereumChain", params: [BSC] });
        else throw e;
      }
    }
  } catch (e) {
    const pe = rpcError(e);
    throw pe.code === "rejected" ? new PayError("wrong_network", tr("wallet.pay.mmSwitch")) : pe;
  }
  const data = erc20TransferData(p.to, toUnits(p.amount, p.decimals));
  try {
    const hash = (await eth.request({ method: "eth_sendTransaction", params: [{ from, to: p.token, data, value: "0x0" }] })) as string;
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash ?? "")) throw new PayError("failed", tr("wallet.pay.mmNoHash"));
    return { hash, from };
  } catch (e) {
    throw e instanceof PayError ? e : rpcError(e);
  }
}

export async function payWithTronLink(p: { token: string; to: string; amount: string; decimals: number }): Promise<{ hash: string; from: string }> {
  const link = window.tronLink;
  if (!link && !window.tronWeb) throw new PayError("no_wallet", tr("wallet.pay.tlNotInstalled"));
  try {
    if (link?.request) {
      const r = (await link.request({ method: "tron_requestAccounts" })) as { code?: number; message?: string } | undefined;
      if (r && typeof r === "object" && r.code === 4001) throw new PayError("rejected", tr("wallet.pay.tlDeclined"));
    }
  } catch (e) {
    if (e instanceof PayError) throw e;
    throw new PayError("failed", tr("wallet.pay.tlConnectFailed"));
  }
  const tw = link?.tronWeb ?? window.tronWeb;
  const from = tw?.defaultAddress?.base58;
  if (!tw || !from) throw new PayError("locked", tr("wallet.pay.tlUnlock"));
  const units = toUnits(p.amount, p.decimals);
  try {
    const built = await tw.transactionBuilder.triggerSmartContract(
      p.token,
      "transfer(address,uint256)",
      { feeLimit: 100_000_000, callValue: 0 },
      [
        { type: "address", value: p.to },
        { type: "uint256", value: units.toString() },
      ],
      from,
    );
    if (!built?.result?.result || !built.transaction) throw new PayError("failed", tr("wallet.pay.tlBuildFailed"));
    const signed = await tw.trx.sign(built.transaction);
    const sent = await tw.trx.sendRawTransaction(signed);
    const hash = sent?.txid ?? built.transaction.txID;
    if (sent?.result === false || !/^[0-9a-fA-F]{64}$/.test(hash ?? "")) throw new PayError("failed", sent?.message ? String(sent.message) : tr("wallet.pay.tlSendFailed"));
    return { hash, from };
  } catch (e) {
    if (e instanceof PayError) throw e;
    const m = String((e as Error)?.message ?? e ?? "");
    if (/cancel|declin|reject/i.test(m)) throw new PayError("rejected", tr("wallet.pay.tlCancelled"));
    throw new PayError("failed", m ? m.slice(0, 200) : tr("wallet.pay.tlSendFailed"));
  }
}
