// Keys for this namespace. English is the source; translations live in ../<lang>/market.ts.
// Ezymex Trader left panels: Market Watch (quotes list), segment chips and Navigator.
const market = {
  // Market Watch header and tabs
  title: "Market Watch",
  collapse: "Collapse",
  "tab.symbols": "Symbols",
  "tab.details": "Details",
  "tab.favourites": "Favourites",
  segmentAria: "Market Watch segment",
  searchPlaceholder: "Search symbol",
  searchAria: "Search Market Watch",
  clear: "Clear",

  // Market Watch columns (shown uppercase)
  "col.symbol": "Symbol",
  "col.bid": "Bid",
  "col.ask": "Ask",
  "col.spread": "Sp", // Spread, very narrow column
  "col.spreadTitle": "Spread, points",
  "col.change": "Chg%", // Daily change %, narrow column

  // Row / hover card
  "row.title": "{name} · spread {spread}",
  "tip.low": "L", // day Low, one letter
  "tip.high": "H", // day High, one letter
  "tip.spread": "Sprd", // spread, short
  "tip.range": "Rng", // day range, short
  bid: "Bid",
  ask: "Ask",

  // Empty states and footer
  "empty.favourites": "No favourites yet. Right-click a symbol to add it.",
  // title of the empty Favourites tab on the Client Area's Markets page
  "empty.favouritesTitle": "No favourites yet",
  "empty.noMatch": "No symbols match.",
  "footer.count": "{shown} / {total} symbols",
  "footer.hint": "dbl-click: chart",

  // Context menu
  "menu.newOrder": "New Order",
  "menu.chartWindow": "Chart Window",
  "menu.openInActive": "Open in active chart",
  "menu.depth": "Depth of Market",
  "menu.specification": "Specification",
  "menu.removeFavourite": "Remove from Favourites",
  "menu.addFavourite": "Add to Favourites",
  "menu.hide": "Hide",
  "menu.showAll": "Show All",

  // Toasts
  "toast.hidden": "{symbol} hidden from Market Watch",
  "toast.hiddenDesc": "Show all symbols from the context menu.",
  "toast.opened": "{symbol} opened in active chart",

  // Segment chips (asset classes)
  "segment.favourites": "Favourites",
  "segment.forex": "Forex",
  "segment.metals": "Metals",
  "segment.indices": "Indices",
  "segment.energies": "Energies",
  "segment.crypto": "Crypto",
  "segment.stocks": "Stocks",
  "segment.aria": "Asset class",
  "segment.title": { one: "{label} · {count} symbol", other: "{label} · {count} symbols" },

  // Navigator tree
  "nav.title": "Navigator",
  "nav.indicators": "Indicators",
  "nav.strategies": "Strategies",
  "nav.scripts": "Scripts",
  "nav.guest": "guest",
  "nav.noAccount": "No trading account yet",
  "nav.openAccount": "Open account",
  "nav.openAccountTitle": "Create your Ezymex account (opens the Client Area)",
  "nav.signIn": "Sign in",
  "nav.signInTitle": "Sign in to the Client Area",
  "nav.accountType.live": "live",
  "nav.accountType.demo": "demo",
  "nav.category.trend": "Trend",
  "nav.category.oscillators": "Oscillators",
  "nav.category.volatility": "Volatility",
  "nav.category.volume": "Volume",
  "nav.category.billWilliams": "Bill Williams", // indicator author's name; usually kept
  "nav.indicatorTitle": "{description} · Double-click or Enter to attach to {symbol}, {tf}",
  "nav.strategyTitle": { one: "{server} · {login} · {count} trade", other: "{server} · {login} · {count} trades" },
  "nav.strategyRunning": "{name} is already running",
  "nav.strategyAttached": "{name} attached",
  "nav.strategyDesc": "{login} · {server} · P&L today {pnl}",
  "nav.script.closeAll": "Close all positions",
  "nav.script.closeProfitable": "Close profitable",
  "nav.script.closeLosing": "Close losing",
  "nav.script.deletePendings": "Delete all pendings",
  "nav.script.breakevenAll": "Breakeven all (SL → entry)", // SL = Stop Loss
  "nav.scriptTitle": "Double-click to run on the current account",
  "nav.scriptsReadOnly": "Scripts are disabled in read-only mode",
};
export default market;
