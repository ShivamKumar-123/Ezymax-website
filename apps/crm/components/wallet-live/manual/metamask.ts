"use client";

// "Pay with MetaMask" for a manual crypto method on an EVM network (the method's `evm` config: chain id, token contract
// or null for the native coin, token decimals). Plain EIP-1193 (window.ethereum), no library:
//   eth_requestAccounts → eth_chainId → wallet_switchEthereumChain (4902: wallet_addEthereumChain for chains we know)
//   → eth_sendTransaction: ERC-20 transfer(address,uint256) to the token contract, or a native transfer of the value.
// Amounts go from the decimal string to integer units with BigInt (pay.ts toUnits), never through floats. The tx hash
// becomes the request's reference; the broker still approves the request.

import { tr } from "@ezymex/i18n/react";
import { PayError, erc20TransferData, toUnits } from "../pay";

/** Chains MetaMask may not know, with a public RPC and explorer for wallet_addEthereumChain (Ethereum is built in). */
const KNOWN_CHAINS: Record<number, { chainName: string; nativeCurrency: { name: string; symbol: string; decimals: number }; rpcUrls: string[]; blockExplorerUrls: string[] }> = {
  56: { chainName: "BNB Smart Chain", nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 }, rpcUrls: ["https://bsc-dataseed.binance.org"], blockExplorerUrls: ["https://bscscan.com"] },
  137: { chainName: "Polygon", nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 }, rpcUrls: ["https://polygon-rpc.com"], blockExplorerUrls: ["https://polygonscan.com"] },
};

export const METAMASK_DOWNLOAD = "https://metamask.io/download/";

/** Opens the current page inside the MetaMask mobile app (its browser injects window.ethereum). */
export function metamaskDappLink(path: string) {
  return `https://metamask.app.link/dapp/${window.location.host}${path}`;
}

function rpcError(e: unknown, network: string): PayError {
  const err = e as { code?: number; message?: string };
  if (err?.code === 4001) return new PayError("rejected", tr("payments.mm.cancelled"));
  if (err?.code === -32002) return new PayError("locked", tr("payments.mm.pending"));
  if (err?.code === 4902) return new PayError("wrong_network", tr("payments.mm.wrongChain", { network }));
  return new PayError("failed", tr("payments.mm.failed", { error: err?.message ? String(err.message).slice(0, 200) : "—" }));
}

const isAddress = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a);

/** Sends the payment from the client's MetaMask; resolves with the transaction hash. */
export async function payEvm(p: { chainId: number; tokenContract: string | null; decimals: number; to: string; amount: string; network: string }): Promise<{ hash: string; from: string }> {
  const eth = typeof window !== "undefined" ? window.ethereum : undefined;
  if (!eth) throw new PayError("no_wallet", tr("payments.mm.notInstalled"));
  if (!isAddress(p.to) || (p.tokenContract && !isAddress(p.tokenContract))) throw new PayError("failed", tr("wallet.pay.invalidAddress"));
  const units = toUnits(p.amount, p.decimals);
  if (units <= 0n) throw new PayError("failed", tr("wallet.pay.invalidAmount"));

  let from: string;
  try {
    const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    from = accounts?.[0] ?? "";
  } catch (e) {
    throw rpcError(e, p.network);
  }
  if (!from) throw new PayError("locked", tr("payments.mm.unlock"));

  const want = `0x${p.chainId.toString(16)}`;
  try {
    const current = String(await eth.request({ method: "eth_chainId" })).toLowerCase();
    if (current !== want) {
      try {
        await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: want }] });
      } catch (e) {
        const known = KNOWN_CHAINS[p.chainId];
        if ((e as { code?: number })?.code === 4902 && known) await eth.request({ method: "wallet_addEthereumChain", params: [{ chainId: want, ...known }] });
        else throw e;
      }
      const after = String(await eth.request({ method: "eth_chainId" })).toLowerCase();
      if (after !== want) throw new PayError("wrong_network", tr("payments.mm.wrongChain", { network: p.network }));
    }
  } catch (e) {
    if (e instanceof PayError) throw e;
    const pe = rpcError(e, p.network);
    throw pe.code === "rejected" ? new PayError("wrong_network", tr("payments.mm.wrongChain", { network: p.network })) : pe;
  }

  const tx = p.tokenContract ? { from, to: p.tokenContract, data: erc20TransferData(p.to, units), value: "0x0" } : { from, to: p.to, value: `0x${units.toString(16)}` };
  try {
    const hash = (await eth.request({ method: "eth_sendTransaction", params: [tx] })) as string;
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash ?? "")) throw new PayError("failed", tr("payments.mm.noHash"));
    return { hash, from };
  } catch (e) {
    throw e instanceof PayError ? e : rpcError(e, p.network);
  }
}
