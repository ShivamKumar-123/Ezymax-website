import { toast } from "@/lib/notify";
import { IS_LIVE, type TradingAccount } from "@ezymex/mock";
import { tr } from "@ezymex/i18n/react";

/**
 * Live builds (`GUEST_MODE`): accounts, orders and positions come from the trading engine. Until a
 * trading account is logged in, the terminal runs in guest mode: charts, quotes, symbol specs,
 * indicators, drawings, alerts and the AI Trader composer work; every trade action explains how to log in.
 * Demo builds keep the full mock-account showcase.
 */
export const GUEST_MODE = IS_LIVE;
export const LOGIN_URL = "/login";

export const CLIENT_AREA = process.env.NEXT_PUBLIC_CLIENT_AREA_URL ?? "http://localhost:3000";
export const REGISTER_URL = `${CLIENT_AREA}/register`;
export const SIGNIN_URL = `${CLIENT_AREA}/login`;

export const GUEST_LOGIN = "guest";
// English copies kept for existing imports; UI should render t("trader.guest.title") / t("trader.guest.text").
export const GUEST_TITLE = "Log in to a trading account";
export const GUEST_TEXT = "Log in to a trading account to trade, or open one in the Client Area";

/**
 * Placeholder the store hands out as `account` while in guest mode, so account-shaped code never has
 * to deal with `undefined`. It is never shown: guest UI checks `T.guest` and renders its own copy.
 */
export const GUEST_ACCOUNT: TradingAccount = {
  login: GUEST_LOGIN,
  type: "live",
  group: "Standard",
  mode: "hedging",
  cent: false,
  server: "Ezymex Market Data",
  leverage: 1,
  currency: "USD",
  balance: 0,
  equity: 0,
  credit: 0,
  margin: 0,
  createdAt: "",
  swapFree: false,
};

export function openRegister() {
  window.open(REGISTER_URL, "_blank", "noopener");
}
export function openSignIn() {
  window.open(SIGNIN_URL, "_blank", "noopener");
}

let lastNotice = 0;
/** Explains a blocked trade action (order ticket, one-click, DOM, F9…) with a link to open an account. */
export function guestNotice(what?: string) {
  const now = Date.now();
  if (now - lastNotice < 600) return; // one toast per click burst (e.g. double-clicks)
  lastNotice = now;
  toast(tr("trader.guest.title"), {
    id: "ezymex-guest",
    description: `${what ? `${tr("trader.guest.needsAccount", { what })} ` : ""}${tr("trader.guest.noticeText")}`,
    action: { label: tr("trader.guest.logIn"), onClick: () => window.location.assign(LOGIN_URL) },
  });
}
