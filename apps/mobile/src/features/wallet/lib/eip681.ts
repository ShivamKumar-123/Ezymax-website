// "Open in wallet app" for BEP20 deposits: an EIP-681 payment request,
//   ethereum:<USDT contract>@56/transfer?address=<company address>&uint256=<amount in token units>
// Every part comes from the wallet service's deposit request (contract, chain id, receiving address, amount,
// decimals). MetaMask and other EVM wallets register the `ethereum:` scheme and show the transfer for approval;
// the amount is in atomic units as the standard says (BEP20 USDT has 18 decimals).
//
// TRC20 has no equivalent one-way standard: TronLink's DeepLink "transfer" action needs the payer's own address
// (`from` / `loginAddress`) and an HTTPS `callbackUrl`, so it is not offered; TRON deposits use copy, share and QR.

const HEX40 = /^0x[0-9a-fA-F]{40}$/;

/** Decimal string -> integer string in token units ("1.5", 6 -> "1500000"); null when it doesn't fit `decimals`. */
export function toUnits(amount: string, decimals: number): string | null {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(amount.trim());
  if (!m || !Number.isInteger(decimals) || decimals < 0 || decimals > 36) return null;
  const frac = (m[2] ?? "").replace(/0+$/, "");
  if (frac.length > decimals) return null;
  return (m[1]! + frac.padEnd(decimals, "0")).replace(/^0+(?=\d)/, "");
}

export function eip681TokenTransfer(p: { token: string; chainId: number | null | undefined; to: string; amount: string; decimals: number }): string | null {
  if (!HEX40.test(p.token) || !HEX40.test(p.to)) return null;
  if (!p.chainId || !Number.isInteger(p.chainId) || p.chainId <= 0) return null;
  const units = toUnits(p.amount, p.decimals);
  if (!units || /^0+$/.test(units)) return null;
  return `ethereum:${p.token}@${p.chainId}/transfer?address=${p.to}&uint256=${units}`;
}
