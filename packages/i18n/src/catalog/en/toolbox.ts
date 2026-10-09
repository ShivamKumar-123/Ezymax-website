// Keys for this namespace. English is the source; translations live in ../<lang>/toolbox.ts.
// Ezymex Trader bottom panel ("Toolbox", MT5 style): Trade, History, Exposure, News, Calendar, Alerts, Journal.
const toolbox = {
  // Panel header
  title: "Toolbox",
  bulkClose: "Bulk close",
  restore: "Restore",
  maximise: "Maximise",
  hide: "Hide Toolbox (Ctrl+T)",

  // Tab names
  "tab.trade": "Trade",
  "tab.history": "History",
  "tab.exposure": "Exposure",
  "tab.news": "News",
  "tab.calendar": "Calendar",
  "tab.alerts": "Alerts",
  "tab.journal": "Journal",
  "tab.ai": "AI Trader",

  // Guest mode notices (no trading account logged in)
  "guest.trade": "Open positions, pending orders, balance, equity and margin appear here once you log in to a trading account. Charts, quotes and alerts work now.",
  "guest.history": "Your closed trades and performance stats are listed here once you log in to a trading account.",
  "guest.exposure": "Net exposure by currency and asset is calculated from your open positions once you log in to a trading account.",

  // Table column headers (shown uppercase)
  "col.symbol": "Symbol",
  "col.ticket": "Ticket",
  "col.time": "Time",
  "col.type": "Type",
  "col.volume": "Volume",
  "col.price": "Price",
  "col.sl": "S / L", // Stop Loss; MT5 abbreviation
  "col.tp": "T / P", // Take Profit; MT5 abbreviation
  "col.swap": "Swap",
  "col.commission": "Commission",
  "col.profit": "Profit",
  "col.comment": "Comment",
  "col.openTime": "Open time",
  "col.closeTime": "Close time",
  "col.reason": "Reason",
  "col.asset": "Asset",
  "col.rate": "Rate",
  "col.graph": "Graph",
  "col.ccy": "Ccy", // currency, short
  "col.impact": "Impact",
  "col.event": "Event",
  "col.actual": "Actual",
  "col.forecast": "Forecast",
  "col.previous": "Previous",
  "col.condition": "Condition",
  "col.current": "Current",
  "col.note": "Note",
  "col.status": "Status",
  "col.created": "Created",

  // Trade direction and order types (lowercase, as in MT5)
  "side.buy": "buy",
  "side.sell": "sell",
  "orderType.buy.limit": "buy limit",
  "orderType.buy.stop": "buy stop",
  "orderType.buy.stopLimit": "buy stop limit",
  "orderType.sell.limit": "sell limit",
  "orderType.sell.stop": "sell stop",
  "orderType.sell.stopLimit": "sell stop limit",

  // Where a trade came from (comment column chip)
  "source.manual": "Manual",
  "source.copy": "Copy",
  "source.api": "API",
  "source.strategy": "Strategy",
  "source.ai": "AI",
  "source.pamm": "PAMM",

  // Bulk close menu
  "bulk.closeAll": "Close all positions",
  "bulk.closeProfitable": "Close profitable",
  "bulk.closeLosing": "Close losing",
  "bulk.closeBuys": "Close all buys",
  "bulk.closeSells": "Close all sells",
  "bulk.closeBySymbol": "Close by symbol",
  "bulk.cancelPendings": "Cancel all pending orders",

  // Position / order context menus
  "menu.closeTicket": "Close #{ticket}",
  "menu.closePartial": "Close partial…",
  "menu.close50": "Close 50%",
  "menu.modifyOrDelete": "Modify or Delete…",
  "menu.moveSlBreakeven": "Move SL to breakeven", // SL = Stop Loss
  "menu.closeBy": "Close By", // MT5 "Close By": close against an opposite position
  "menu.closeByItem": "#{ticket} {side} {volume} at {price}",
  "menu.shareTrade": "Share this trade…",
  "menu.shareOrder": "Share this order…",
  "menu.showOnChart": "Show on chart",
  "menu.copyTicket": "Copy ticket",
  "menu.deleteTicket": "Delete #{ticket}",
  "toast.ticketCopied": "Ticket copied",

  // Trade tab
  "trade.empty": "No open positions",
  "trade.emptyHint": "No open positions · press F9 or use the one-click panel on a chart",
  "trade.placed": "placed", // pending order status in the Profit column
  "trade.closePosition": "Close position",
  "trade.closePositionAria": "Close position {ticket}",
  "trade.deleteOrder": "Delete order",
  "trade.deleteOrderAria": "Delete order {ticket}",

  // Totals row under the Trade tab
  "summary.balance": "Balance",
  "summary.equity": "Equity",
  "summary.margin": "Margin",
  "summary.freeMargin": "Free margin",
  "summary.marginLevel": "Margin level",
  "summary.credit": "Credit",

  // History tab
  "history.period.today": "Today",
  "history.period.3d": "Last 3 days",
  "history.period.week": "Last week",
  "history.period.month": "Last month",
  "history.period.3m": "Last 3 months",
  "history.period.all": "All history",
  "history.symbolFilter": "Symbol filter",
  "history.allSymbols": "All symbols",
  "history.trades": "Trades",
  "history.winRate": "Win rate",
  "history.gross": "Gross",
  "history.pf": "PF", // Profit factor; keep abbreviation
  "history.report": "Report",
  "history.reportExported": "Report exported",
  "history.reportExportedDesc": { one: "{file} · {count} deal", other: "{file} · {count} deals" },
  "history.empty": "No closed trades in this period",
  "history.profit": "Profit",
  "history.credit": "Credit",
  "history.deposit": "Deposit",
  "history.withdrawal": "Withdrawal",
  "history.balance": "Balance",
  "history.showingLatest": "showing latest {shown} of {total}",

  // Exposure tab
  "exposure.empty": "No exposure",
  "exposure.emptySub": "Open positions to see your net exposure per asset.",
  "exposure.footer": "Net exposure per asset in {ccy} · long positive, short negative",
  "exposure.usdCent": "USD (account shown in USC)",

  // News tab (demo content)
  "news.minAgo": "{source} · {count} min ago",
  "news.minShort": "{count}m", // minutes ago, compact
  "sentiment.bullish": "bullish",
  "sentiment.bearish": "bearish",
  "sentiment.neutral": "neutral",

  // Alerts tab
  "alerts.updated": "Alert updated",
  "alerts.edit": "Edit alert",
  "alerts.new": "New alert",
  "alerts.symbolAria": "Alert symbol",
  "alerts.condition": "Condition",
  "alerts.bidAbove": "Bid ≥",
  "alerts.bidBelow": "Bid ≤",
  "alerts.priceAria": "Alert price",
  "alerts.notePlaceholder": "Note (optional)",
  "alerts.create": "Create alert",
  "alerts.helpGuest": "Alerts are checked in this browser on every live tick while the terminal is open, with a sound + notification when triggered.",
  "alerts.helpServer": "Alerts are evaluated server-side on every tick and play a sound + toast when triggered.",
  "alerts.helpChart": "Right-click a chart to set one at a price.",
  "alerts.empty": "No alerts",
  "alerts.triggered": "Triggered {time}",
  "alerts.disable": "Disable",
  "alerts.enable": "Enable",

  // Journal tab (log sources as in MT5)
  "journal.src.trade": "Trade",
  "journal.src.network": "Network",
  "journal.src.terminal": "Terminal",
  "journal.src.alerts": "Alerts",
  "journal.src.experts": "Experts",
  "journal.src.account": "Account",
  "journal.filter": "Filter…",
  "journal.copied": "Journal copied",
  "journal.lines": { one: "{count} line", other: "{count} lines" },
  "journal.clear": "Clear",
  "journal.empty": "Journal is empty",
  "group.show": "Show each trade",
  "group.hide": "Group trades",
  "group.closeAll": "Close all",
  "group.closeTitle": "Close all {symbol} positions?",
  "group.avgTip": "Average open price, weighted by volume",
};
export default toolbox;
