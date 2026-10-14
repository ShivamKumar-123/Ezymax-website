"use client";

// "Ezymex Terminal" in the navigation: pick which account to trade, then hand off to the terminal.
//
// The terminal opens signed in to one account, so something has to choose it. Asking here, in a dialog, keeps the
// client where they were - a page would cost them their place for one click - and it is also the only honest
// moment to say that an account cannot be traded, since the terminal would otherwise open and refuse.
//
// The hand-off goes through `openTerminal`, which opens the tab on the click and only then fetches the SSO URL:
// browsers block a window opened after an await, so the order matters and the dialog must call it from the
// click itself.

import * as React from "react";
import Link from "next/link";
import { CandlestickChart, Loader2, Plus } from "lucide-react";
import { Button, Chip, Dialog, Skeleton, cn } from "@/components/kit";
import { useT } from "@ezymex/i18n/react";
import { curOf, isArchived, openTerminal, productOf, usePoll, type EngineAccount } from "@/components/trading/api";

type Ctx = { open: () => void };
const PickerContext = React.createContext<Ctx | null>(null);

/** Opens the account picker. Null outside the provider, so a caller can leave the control out entirely. */
export function useTerminalPicker() {
  return React.useContext(PickerContext);
}

const money = (a: EngineAccount, v: number) => `${curOf(a)}${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function AccountRow({ a, onPick }: { a: EngineAccount; onPick: (a: EngineAccount) => void }) {
  const t = useT();
  // the terminal signs in but will not trade a disabled, expired or closed account: say so here instead
  const blocked = a.status === "disabled" || a.status === "expired" || isArchived(a);
  return (
    <button
      type="button"
      disabled={blocked}
      onClick={() => onPick(a)}
      className={cn(
        "flex w-full items-center gap-3 rounded-[14px] border border-line px-4 py-3 text-start transition-colors",
        blocked ? "cursor-not-allowed opacity-55" : "hover:border-ember/40 hover:bg-surface-2",
      )}
    >
      <Chip size="sm" tone={a.type === "live" ? "up" : "gold"}>
        {t(a.type === "live" ? "accounts.badge.live" : "accounts.badge.demo")}
      </Chip>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold text-fg">
          <span className="k-num font-mono">{a.login}</span>
          {a.name ? <span className="text-fg-3"> · {a.name}</span> : null}
        </span>
        <span className="block truncate text-[12px] text-fg-3">
          {a.groupName} · 1:{a.leverage}
          {blocked ? ` · ${t.dyn(`accounts.status.${a.status}`, a.status)}` : ""}
        </span>
      </span>
      <span className="k-num shrink-0 text-[13.5px] font-semibold text-fg">{money(a, a.equity)}</span>
    </button>
  );
}

export function TerminalPickerProvider({ children }: { children: React.ReactNode }) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<number | null>(null);
  // null path = no request: the account list is fetched only once the client actually asks for the picker
  const acc = usePoll<{ accounts: EngineAccount[] }>(open ? "accounts" : null, 0);
  const ctx = React.useMemo<Ctx>(() => ({ open: () => setOpen(true) }), []);

  const accounts = acc.data?.accounts.filter((a) => !isArchived(a)) ?? null;

  const pick = (a: EngineAccount) => {
    setBusy(a.login);
    // called straight from the click so the terminal's tab is not blocked
    void openTerminal(a.login, productOf(a)).finally(() => {
      setBusy(null);
      setOpen(false);
    });
  };

  return (
    <PickerContext.Provider value={ctx}>
      {children}
      <Dialog open={open} onOpenChange={setOpen} width={460} title={t("shell.terminalPicker.title")} description={t("shell.terminalPicker.subtitle")} closeLabel={t("common.close")}>
        {!acc.data && !acc.error ? (
          <div className="space-y-2.5">
            <Skeleton className="h-[62px] w-full rounded-[14px]" />
            <Skeleton className="h-[62px] w-full rounded-[14px]" />
          </div>
        ) : acc.error && !accounts ? (
          <div className="py-6 text-center">
            <p className="text-[13.5px] text-fg-2">{t("dashboard.accounts.unavailable")}</p>
            <Button variant="surface" size="sm" className="mt-3" onClick={acc.reload}>
              {t("common.retry")}
            </Button>
          </div>
        ) : !accounts?.length ? (
          <div className="py-6 text-center">
            <p className="text-[13.5px] text-fg-2">{t("shell.terminalPicker.none")}</p>
            <Link href="/accounts/new" onClick={() => setOpen(false)}>
              <Button variant="ember" size="sm" className="mt-3">
                <Plus /> {t("dashboard.accounts.open")}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {accounts.map((a) => (
              <AccountRow key={a.login} a={a} onPick={pick} />
            ))}
            {busy !== null && (
              <p className="flex items-center justify-center gap-2 pt-1 text-[12.5px] text-fg-3">
                <Loader2 className="size-3.5 animate-spin" /> {t("shell.terminalPicker.opening")}
              </p>
            )}
          </div>
        )}
      </Dialog>
    </PickerContext.Provider>
  );
}

/** The icon the navigation entry uses, kept here so nav.ts and the picker cannot drift apart. */
export const TERMINAL_NAV_ICON = CandlestickChart;
