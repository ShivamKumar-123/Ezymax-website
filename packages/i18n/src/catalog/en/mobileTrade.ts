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
  "chart.noData": "No chart history for this symbol yet",
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
  "ticket.price": "Price",

  // Rejections: a plain-language line under the reason (order.reject.<code>); the engine's own detail follows it
  "reject.no_money": "Your free margin can't cover this order. Lower the volume or add funds to this account.",
  "reject.insufficient_funds": "Your free margin can't cover this order. Lower the volume or add funds to this account.",
  "reject.market_closed": "This market is closed right now. Try again when it opens.",
  "reject.invalid_volume": "Use a volume within this symbol's limits and lot step.",
  "reject.max_lot": "This volume is above the maximum per order for your account.",
  "reject.close_only": "Your account can close positions but can't open new ones right now.",
  "reject.symbol_close_only": "This symbol can be closed but not opened right now.",
  "reject.trading_disabled": "Trading is switched off on this account. Contact support for details.",
  "reject.symbol_halted": "Trading on this symbol is paused. Try again later.",
  "reject.requote.title": "The price moved",
  "reject.requote": "The market moved while your order was on its way. Check the new price and confirm again.",
  "reject.invalid_sl": "The stop loss is on the wrong side of the price, or too close to it.",
  "reject.invalid_tp": "The take profit is on the wrong side of the price, or too close to it.",
  "reject.invalid_price": "This price is on the wrong side of the market for this order type.",
  "reject.off_market": "This price is too far from the market. Check the value.",
  "reject.stale_price": "Prices for this symbol are paused for a moment. Try again shortly.",
  "reject.no_price": "There's no live price for this symbol right now.",
  "reject.read_only": "This login can view the account but not trade.",
  "reject.uncertain.title": "No answer from the trade server",
  "reject.uncertain": "It may have gone through. Check Portfolio before you try again.",
  "reject.uncertain.ticket": "Confirming again is safe: the same order can't be placed twice.",

  // States
  "state.noAccount.title": "No trading account yet",
  "state.noAccount.body": "Open a demo account to practise, or a live account to trade for real.",
  "state.noAccount.action": "Open an account",
  "state.connecting": "Connecting to the trade server…",
  "state.readOnly": "This account is view-only here: prices and charts are live, trading is off.",
  "state.marketClosed.title": "Market closed",
  "state.marketClosed.body": "{symbol} opens again with the next session. Orders can be placed once it opens.",
  "state.streamError": "Can't reach the trade server",
  "state.streamErrorBody": "Your positions and orders are safe on the server. We keep trying to reconnect.",

  // Results
  "toast.filled": "{side} {volume} {symbol} filled",
  "toast.at": "at {price}",
  "toast.placed": "{symbol} pending order placed",
  "toast.duplicate": "Already placed as #{ticket}",
  "toast.duplicateBody": "This order reached the server before; nothing new was opened.",
  "toast.closed": "Position #{ticket} closed",
  "toast.partial": "Closed {volume} lots of #{ticket}",
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
