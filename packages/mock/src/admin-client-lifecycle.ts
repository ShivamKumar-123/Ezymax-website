/**
 * Demo data for Back Office client management (hide / delete): what the delete check answers for a showcase client
 * of ./admin-clients. Live builds ask the gateway (GET /api/admin/users/{id}/delete-check, client_lifecycle.rs).
 *
 * The rules mirror the gateway's: money or open risk blocks the delete, a client who funded or traded is anonymised
 * (financial records kept), a client who never did is deleted permanently. Showcase clients with equity are blocked,
 * funded clients gone inactive have withdrawn everything (anonymised), the others never funded (purged).
 */
import { getClient } from "./admin-clients";

export type DemoDeleteCheck = {
  client: { id: number; email: string; name: string; status: string; hidden: boolean };
  mode: "purge" | "anonymize" | "blocked";
  blockers: { code: string; message: string }[];
  history: string[];
  archive: number[];
  skipped: number[];
  checked_at: string;
};

const money = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function demoDeleteCheck(id: string | number): DemoDeleteCheck {
  const c = getClient(String(id));
  const logins = c.logins.map(Number);
  const withdrawn = c.funded && c.status === "inactive";
  const blockers: DemoDeleteCheck["blockers"] = [];
  if (c.funded && !withdrawn) {
    const [first] = logins;
    blockers.push({ code: "account_balance", message: `Live account #${first} holds money (balance ${money(c.balance)}, equity ${money(c.equity)}, credit ${money(c.credit)} USD). Bring it to zero first.` });
    if (c.lifetimeLots > 400) blockers.push({ code: "open_positions", message: `Live account #${first} has 3 open positions.` });
    if (c.net > 20_000) blockers.push({ code: "open_withdrawal", message: "1 withdrawal is still open. Complete, reject or cancel it first." });
  }
  const history = c.funded
    ? [`Wallet: ${Math.max(2, Math.round(c.deposits / 900))} transactions`, `Live account #${logins[0]}: ${Math.max(4, Math.round(c.lifetimeLots * 3))} deals, ${Math.max(2, Math.round(c.deposits / 1500))} ledger entries`]
    : [];
  return {
    client: { id: Number(c.id), email: c.email, name: c.name, status: c.status === "blocked" ? "blocked" : "active", hidden: false },
    mode: blockers.length ? "blocked" : history.length ? "anonymize" : "purge",
    blockers,
    history,
    archive: logins,
    skipped: [],
    checked_at: new Date().toISOString(),
  };
}
