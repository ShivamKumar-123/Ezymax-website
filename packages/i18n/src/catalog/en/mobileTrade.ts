// Keys for this namespace. English is the source; translations live in ../<lang>/mobileTrade.ts.
// Kalks mobile app: Trade tab (chart, Sell / Buy bar, order ticket) and trade notifications.
// TRANSLATORS: trading terms follow MetaTrader 5 localisation (see the `order` namespace notes).
// {placeholders} hold numbers, prices, tickets and symbols: keep them, never translate them.
const mobileTrade = {
  // Header
  pickSymbol: "Choose a symbol",
  searchSymbol: "Search symbols",
  depth: "Depth of market",
  alert: "Price alert",
  "account.chip": "{type} · #{login}",
  "account.manage": "Manage accounts",
  "account.open": "Open account",

  // Chart
  "chart.indicators": "Indicators",
  "chart.type.candles": "Candles",
  "chart.type.line": "Line",
  "ind.ma": "Moving average 20",
  "ind.ema": "Exponential MA 50",
  "ind.bb": "Bollinger Bands 20, 2",
  "ind.rsi": "RSI 14",
  "chart.hint": "Pinch to zoom · drag to scroll · press and hold for the crosshair · double-tap to reset",

  // Sell / Buy bar and ticket
  "bar.volume": "Lots",
  "ticket.title": "New order",
  "ticket.confirmBuy": "Buy {volume} {symbol}",
  "ticket.confirmSell": "Sell {volume} {symbol}",
  "ticket.atMarket": "at market",
  "ticket.at": "at {price}",
  "ticket.addSl": "Add stop loss",
  "ticket.addTp": "Add take profit",
  "ticket.ifHit": "{money} if hit",
  "ticket.required": "Margin",
  "ticket.pip": "Pip value",
  "ticket.after": "Free after",
  "ticket.notEnough": "Not enough free margin for this volume.",
  "ticket.noSpecs": "Loading contract details…",
  "ticket.distance": "{n} pips away",

  // States
  "state.noAccount.title": "No trading account yet",
  "state.noAccount.body": "Open a demo account to practise, or a live account to trade for real.",
  "state.noAccount.action": "Open an account",
  "state.connecting": "Connecting to the trade server…",
  "state.readOnly": "This account is view-only here: prices and charts are live, trading is off.",
  "state.marketClosed.title": "Market closed",
  "state.marketClosed.body": "{symbol} opens again with the next session. You can still place pending orders.",

  // Results
  "toast.filled": "{side} {volume} {symbol} filled",
  "toast.at": "at {price}",
  "toast.placed": "{symbol} pending order placed",
  "toast.closed": "Position #{ticket} closed",
  "toast.modified": "#{ticket} updated",
  "toast.cancelled": "Order #{ticket} cancelled",

  // Engine notifications while the app is open
  "notify.sl": "Stop loss hit",
  "notify.tp": "Take profit hit",
  "notify.order_filled": "Pending order filled",
  "notify.order_triggered": "Order triggered",
  "notify.margin_call": "Margin call",
  "notify.stop_out": "Stop out",
  "notify.order_rejected": "Order rejected",
  "notify.order_expired": "Order expired",
  "notify.order_cancelled": "Order cancelled",
};
export default mobileTrade;
