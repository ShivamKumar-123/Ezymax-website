import { toast } from "@/lib/notify";
import { IS_LIVE, type TradingAccount } from "@kalks/mock";

/**
 * Guest mode (live builds): real market data only. Trading accounts are served by the trading engine,
 * which isn't connected yet, so the terminal runs without any account: charts, quotes, symbol specs,
 * indicators, drawings, alerts and the AI Trader composer work; every trade action explains why not.
 * Demo builds keep the full mock-account showcase.
 */
export const GUEST_MODE = IS_LIVE;

export const CLIENT_AREA = process.env.NEXT_PUBLIC_CLIENT_AREA_URL ?? "http://localhost:3000";
export const REGISTER_URL = `${CLIENT_AREA}/register`;
export const SIGNIN_URL = `${CLIENT_AREA}/login`;

export const GUEST_LOGIN = "guest";
export const GUEST_TITLE = "Trading accounts are opening soon";
export const GUEST_TEXT = "Trading accounts are opening soon — create your Kalks account to be first";

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
  server: "Kalks Market Data",
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
  toast(GUEST_TITLE, {
    id: "kalks-guest",
    description: `${what ? `${what} needs a trading account. ` : ""}Create your Kalks account to be first.`,
    action: { label: "Open account", onClick: openRegister },
  });
}
