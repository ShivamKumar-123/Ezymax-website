/**
 * Back Office finance permissions for the wallet (deposits, withdrawals, client wallets, reconciliation,
 * wallet settings).
 *
 * The gateway's role → permission matrix (services/gateway/src/admin.rs) has no finance permissions yet, so the
 * admin BFF owns this map, like lib/trading-perms.ts does for trading. It mirrors the role checks the wallet
 * service enforces itself (services/wallet/src/state.rs: ROLES_READ / ROLES_WRITE / ROLES_APPROVE /
 * ROLES_SETTINGS); the BFF checks first and the UI hides what the role can't use.
 *
 * When the gateway starts returning these for a role (any "finance.read" entry in `/v1/admin/auth/me` →
 * permissions), that list wins and this map is no longer consulted. To move them into the gateway, add
 * FinanceRead / FinanceWrite / FinanceApprove / FinanceSettings to `Perm` with the rows below.
 *
 * | permission        | what it allows                                                           | roles                                                  |
 * |-------------------|--------------------------------------------------------------------------|--------------------------------------------------------|
 * | finance.read      | deposits, withdrawals (with risk checklist), wallets, reconciliation,    | platform_owner, super_admin, admin, finance,           |
 * |                   | wallet settings (read), wallet audit                                     | compliance, risk_manager                               |
 * | finance.write     | assign / reject / re-check deposits, manual wallet adjustments,          | platform_owner, super_admin, admin, finance            |
 * |                   | mark withdrawals paid (payout hash)                                      |                                                        |
 * | finance.approve   | approve / reject withdrawals                                             | platform_owner, super_admin, admin, finance            |
 * | finance.settings  | receiving / payout addresses, confirmations, limits, fees                | platform_owner, super_admin, admin                     |
 */

export const WALLET_PERMS = ["finance.read", "finance.write", "finance.approve", "finance.settings"] as const;
export type WalletPerm = (typeof WALLET_PERMS)[number];

const READERS = ["platform_owner", "super_admin", "admin", "finance", "compliance", "risk_manager"];
const FINANCE = ["platform_owner", "super_admin", "admin", "finance"];
const CONFIG = ["platform_owner", "super_admin", "admin"];

export const WALLET_ROLE_MAP: Record<WalletPerm, readonly string[]> = {
  "finance.read": READERS,
  "finance.write": FINANCE,
  "finance.approve": FINANCE,
  "finance.settings": CONFIG,
};

export const isWalletPerm = (p: string): p is WalletPerm => (WALLET_PERMS as readonly string[]).includes(p);

/** Whether a staff member (role + gateway permission list) holds a wallet permission. */
export function walletAllows(staff: { role: string; permissions?: string[] }, perm: WalletPerm): boolean {
  if (staff.permissions?.includes("finance.read")) return staff.permissions.includes(perm);
  return WALLET_ROLE_MAP[perm].includes(staff.role);
}
