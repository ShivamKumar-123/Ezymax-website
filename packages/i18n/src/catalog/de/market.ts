import type { NsMessages } from "../../core";

// Kalks Trader left panels: Market Watch (quotes list), segment chips and Navigator.
const market: NsMessages<"market"> = {
  // Market Watch header and tabs
  title: "Marktübersicht",
  collapse: "Einklappen",
  "tab.symbols": "Symbole",
  "tab.details": "Details",
  "tab.favourites": "Favoriten",
  segmentAria: "Segment der Marktübersicht",
  searchPlaceholder: "Symbol suchen",
  searchAria: "Marktübersicht durchsuchen",
  clear: "Leeren",

  // Market Watch columns (shown uppercase)
  "col.symbol": "Symbol",
  "col.bid": "Bid",
  "col.ask": "Ask",
  "col.spread": "Sp", // Spread, very narrow column
  "col.spreadTitle": "Spread, Punkte",
  "col.change": "Änd%", // Daily change %, narrow column

  // Row / hover card
  "row.title": "{name} · Spread {spread}",
  "tip.low": "T", // day Low (Tief), one letter
  "tip.high": "H", // day High (Hoch), one letter
  "tip.spread": "Sprd", // spread, short
  "tip.range": "Spn", // day range (Spanne), short
  bid: "Bid",
  ask: "Ask",

  // Empty states and footer
  "empty.favourites": "Noch keine Favoriten. Rechtsklick auf ein Symbol, um es hinzuzufügen.",
  "empty.favouritesTitle": "Noch keine Favoriten",
  "empty.noMatch": "Keine passenden Symbole.",
  "footer.count": "{shown} / {total} Symbole",
  "footer.hint": "Doppelklick: Chart",

  // Context menu
  "menu.newOrder": "Neue Order",
  "menu.chartWindow": "Chartfenster",
  "menu.openInActive": "Im aktiven Chart öffnen",
  "menu.depth": "Markttiefe",
  "menu.specification": "Spezifikation",
  "menu.removeFavourite": "Aus Favoriten entfernen",
  "menu.addFavourite": "Zu Favoriten hinzufügen",
  "menu.hide": "Ausblenden",
  "menu.showAll": "Alle anzeigen",

  // Toasts
  "toast.hidden": "{symbol} in der Marktübersicht ausgeblendet",
  "toast.hiddenDesc": "Blenden Sie alle Symbole über das Kontextmenü wieder ein.",
  "toast.opened": "{symbol} im aktiven Chart geöffnet",

  // Segment chips (asset classes)
  "segment.favourites": "Favoriten",
  "segment.forex": "Forex",
  "segment.metals": "Metalle",
  "segment.indices": "Indizes",
  "segment.energies": "Energie",
  "segment.crypto": "Krypto",
  "segment.stocks": "Aktien",
  "segment.aria": "Anlageklasse",
  "segment.title": { one: "{label} · {count} Symbol", other: "{label} · {count} Symbole" },

  // Navigator tree
  "nav.title": "Navigator",
  "nav.indicators": "Indikatoren",
  "nav.strategies": "Strategien",
  "nav.scripts": "Skripte",
  "nav.guest": "Gast",
  "nav.noAccount": "Noch kein Handelskonto",
  "nav.openAccount": "Konto eröffnen",
  "nav.openAccountTitle": "Kalks-Konto erstellen (öffnet den Kundenbereich)",
  "nav.signIn": "Anmelden",
  "nav.signInTitle": "Im Kundenbereich anmelden",
  "nav.accountType.live": "live",
  "nav.accountType.demo": "demo",
  "nav.category.trend": "Trend",
  "nav.category.oscillators": "Oszillatoren",
  "nav.category.volatility": "Volatilität",
  "nav.category.volume": "Volumen",
  "nav.category.billWilliams": "Bill Williams", // indicator author's name; usually kept
  "nav.indicatorTitle": "{description} · Doppelklick oder Enter, um an {symbol}, {tf} anzuhängen",
  "nav.strategyTitle": { one: "{server} · {login} · {count} Trade", other: "{server} · {login} · {count} Trades" },
  "nav.strategyRunning": "{name} läuft bereits",
  "nav.strategyAttached": "{name} angehängt",
  "nav.strategyDesc": "{login} · {server} · G/V heute {pnl}",
  "nav.script.closeAll": "Alle Positionen schließen",
  "nav.script.closeProfitable": "Gewinner schließen",
  "nav.script.closeLosing": "Verlierer schließen",
  "nav.script.deletePendings": "Alle Pending Orders löschen",
  "nav.script.breakevenAll": "Alle auf Breakeven (SL → Einstieg)", // SL = Stop Loss
  "nav.scriptTitle": "Doppelklick, um auf dem aktuellen Konto auszuführen",
  "nav.scriptsReadOnly": "Skripte sind im Nur-Lese-Modus deaktiviert",
};
export default market;
