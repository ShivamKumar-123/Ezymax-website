// Keys for this namespace. English is the source; translations live in ../<lang>/mobile.ts.
// Kalks mobile app (apps/mobile): app shell, onboarding and the states every screen shares.
// Feature screens have their own namespaces (mobileHome, mobileMarkets, mobileTrade, mobilePortfolio, ...).
const mobile = {
  // Tab bar (short: one word each)
  "tab.home": "Home",
  "tab.markets": "Markets",
  "tab.trade": "Trade",
  "tab.portfolio": "Portfolio",
  "tab.more": "More",

  // Onboarding (3 slides). Titles are shown in tall uppercase display type: keep them short.
  "onboarding.skip": "Skip",
  "onboarding.next": "Next",
  "onboarding.getStarted": "Get started",
  "onboarding.haveAccount": "I have an account",
  "onboarding.welcome.title": "Step into the markets",
  "onboarding.welcome.body": "Forex, metals, indices, energies, crypto and stocks in one account, with instant USDT funding.",
  "onboarding.markets.title": "Every tick, live",
  "onboarding.markets.body": "Real bid and ask prices, your own charts and one-tap Buy and Sell, built for the phone.",
  "onboarding.security.title": "Locked down",
  "onboarding.security.body": "Email codes on new devices, confirmation codes for withdrawals and a secure vault for your session.",
  "onboarding.step": "{n} of {total}", // slide counter, e.g. "1 of 3"

  // Shared states
  "state.offline.title": "Connection lost",
  "state.offline.body": "Check your internet connection. Prices and your account reconnect automatically.",
  "state.reconnecting": "Reconnecting…",
  "state.error.title": "Something went wrong",
  "state.error.body": "We couldn't load this. Pull down or tap to try again.",
  "state.maintenance.title": "Down for maintenance",
  "state.maintenance.body": "We're upgrading Kalks. Your positions and funds are safe. Please check back shortly.",
  "state.sessionExpired": "Your session has ended. Please sign in again.",
  "state.updated": "Updated {time}",
  "state.pullToRefresh": "Pull to refresh",

  "viewOnly": "View-only access",
  "viewOnlyBody": "This login can view shared accounts but can't make changes.",

  // Common short labels
  "action.retry": "Try again",
  "action.openWeb": "Open in the Client Area",
  "action.signOut": "Sign out",
  "action.seeAll": "See all",
  "a11y.close": "Close",
  "a11y.back": "Back",
};
export default mobile;
