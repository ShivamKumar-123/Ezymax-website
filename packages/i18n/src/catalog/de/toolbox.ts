import type { NsMessages } from "../../core";

// Ezymex Trader bottom panel ("Toolbox", MT5 style): Trade, History, Exposure, News, Calendar, Alerts, Journal.
const toolbox: NsMessages<"toolbox"> = {
  // Panel header
  title: "Werkzeuge",
  bulkClose: "Sammelschließung",
  restore: "Wiederherstellen",
  maximise: "Maximieren",
  hide: "Werkzeuge ausblenden (Ctrl+T)",

  // Tab names
  "tab.trade": "Handel",
  "tab.history": "Historie",
  "tab.exposure": "Exposure",
  "tab.news": "News",
  "tab.calendar": "Kalender",
  "tab.alerts": "Alarme",
  "tab.journal": "Journal",
  "tab.ai": "AI Trader",

  // Guest mode notices (no trading account logged in)
  "guest.trade": "Offene Positionen, Pending Orders, Kontostand, Eigenkapital und Margin erscheinen hier, sobald Sie sich bei einem Handelskonto anmelden. Charts, Kurse und Alarme funktionieren bereits.",
  "guest.history": "Ihre geschlossenen Trades und Performance-Statistiken erscheinen hier, sobald Sie sich bei einem Handelskonto anmelden.",
  "guest.exposure": "Das Netto-Exposure nach Währung und Asset wird aus Ihren offenen Positionen berechnet, sobald Sie sich bei einem Handelskonto anmelden.",

  // Table column headers (shown uppercase)
  "col.symbol": "Symbol",
  "col.ticket": "Ticket",
  "col.time": "Zeit",
  "col.type": "Typ",
  "col.volume": "Volumen",
  "col.price": "Preis",
  "col.sl": "S / L", // Stop Loss; MT5 abbreviation
  "col.tp": "T / P", // Take Profit; MT5 abbreviation
  "col.swap": "Swap",
  "col.commission": "Kommission",
  "col.profit": "Gewinn",
  "col.comment": "Kommentar",
  "col.openTime": "Eröffnung",
  "col.closeTime": "Schließung",
  "col.reason": "Grund",
  "col.asset": "Asset",
  "col.rate": "Kurs",
  "col.graph": "Grafik",
  "col.ccy": "Whg", // currency, short
  "col.impact": "Einfluss",
  "col.event": "Ereignis",
  "col.actual": "Aktuell",
  "col.forecast": "Prognose",
  "col.previous": "Vorher",
  "col.condition": "Bedingung",
  "col.current": "Aktuell",
  "col.note": "Notiz",
  "col.status": "Status",
  "col.created": "Erstellt",

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
  "source.manual": "Manuell",
  "source.copy": "Copy",
  "source.api": "API",
  "source.strategy": "Strategie",
  "source.ai": "KI",
  "source.pamm": "PAMM",

  // Bulk close menu
  "bulk.closeAll": "Alle Positionen schließen",
  "bulk.closeProfitable": "Gewinner schließen",
  "bulk.closeLosing": "Verlierer schließen",
  "bulk.closeBuys": "Alle Buys schließen",
  "bulk.closeSells": "Alle Sells schließen",
  "bulk.closeBySymbol": "Nach Symbol schließen",
  "bulk.cancelPendings": "Alle Pending Orders löschen",

  // Position / order context menus
  "menu.closeTicket": "#{ticket} schließen",
  "menu.closePartial": "Teilweise schließen…",
  "menu.close50": "50% schließen",
  "menu.modifyOrDelete": "Ändern oder Löschen…",
  "menu.moveSlBreakeven": "SL auf Breakeven setzen", // SL = Stop Loss
  "menu.closeBy": "Schließen durch", // MT5 "Close By": close against an opposite position
  "menu.closeByItem": "#{ticket} {side} {volume} zu {price}",
  "menu.shareTrade": "Diesen Trade teilen…",
  "menu.shareOrder": "Diese Order teilen…",
  "menu.showOnChart": "Im Chart anzeigen",
  "menu.copyTicket": "Ticket kopieren",
  "menu.deleteTicket": "#{ticket} löschen",
  "toast.ticketCopied": "Ticket kopiert",

  // Trade tab
  "trade.empty": "Keine offenen Positionen",
  "trade.emptyHint": "Keine offenen Positionen · drücken Sie F9 oder nutzen Sie das One-Click-Panel im Chart",
  "trade.placed": "platziert", // pending order status in the Profit column
  "trade.closePosition": "Position schließen",
  "trade.closePositionAria": "Position {ticket} schließen",
  "trade.deleteOrder": "Order löschen",
  "trade.deleteOrderAria": "Order {ticket} löschen",

  // Totals row under the Trade tab
  "summary.balance": "Kontostand",
  "summary.equity": "Eigenkapital",
  "summary.margin": "Margin",
  "summary.freeMargin": "Freie Margin",
  "summary.marginLevel": "Margin-Level",
  "summary.credit": "Kredit",

  // History tab
  "history.period.today": "Heute",
  "history.period.3d": "Letzte 3 Tage",
  "history.period.week": "Letzte Woche",
  "history.period.month": "Letzter Monat",
  "history.period.3m": "Letzte 3 Monate",
  "history.period.all": "Gesamte Historie",
  "history.symbolFilter": "Symbolfilter",
  "history.allSymbols": "Alle Symbole",
  "history.trades": "Trades",
  "history.winRate": "Trefferquote",
  "history.gross": "Brutto",
  "history.pf": "PF", // Profit factor; keep abbreviation
  "history.report": "Bericht",
  "history.reportExported": "Bericht exportiert",
  "history.reportExportedDesc": { one: "{file} · {count} Deal", other: "{file} · {count} Deals" },
  "history.empty": "Keine geschlossenen Trades in diesem Zeitraum",
  "history.profit": "Gewinn",
  "history.credit": "Kredit",
  "history.deposit": "Einzahlung",
  "history.withdrawal": "Auszahlung",
  "history.balance": "Kontostand",
  "history.showingLatest": "neueste {shown} von {total}",

  // Exposure tab
  "exposure.empty": "Kein Exposure",
  "exposure.emptySub": "Eröffnen Sie Positionen, um Ihr Netto-Exposure je Asset zu sehen.",
  "exposure.footer": "Netto-Exposure je Asset in {ccy} · Long positiv, Short negativ",
  "exposure.usdCent": "USD (Konto in USC angezeigt)",

  // News tab (demo content)
  "news.minAgo": "{source} · vor {count} Min.",
  "news.minShort": "{count}m", // minutes ago, compact
  "sentiment.bullish": "bullish",
  "sentiment.bearish": "bearish",
  "sentiment.neutral": "neutral",

  // Alerts tab
  "alerts.updated": "Alarm aktualisiert",
  "alerts.edit": "Alarm bearbeiten",
  "alerts.new": "Neuer Alarm",
  "alerts.symbolAria": "Alarmsymbol",
  "alerts.condition": "Bedingung",
  "alerts.bidAbove": "Bid ≥",
  "alerts.bidBelow": "Bid ≤",
  "alerts.priceAria": "Alarmpreis",
  "alerts.notePlaceholder": "Notiz (optional)",
  "alerts.create": "Alarm erstellen",
  "alerts.helpGuest": "Alarme werden in diesem Browser bei jedem Live-Tick geprüft, solange das Terminal geöffnet ist, und lösen Ton + Benachrichtigung aus.",
  "alerts.helpServer": "Alarme werden serverseitig bei jedem Tick ausgewertet und lösen Ton + Hinweis aus.",
  "alerts.helpChart": "Rechtsklick auf einen Chart, um einen Alarm bei einem Preis zu setzen.",
  "alerts.empty": "Keine Alarme",
  "alerts.triggered": "Ausgelöst {time}",
  "alerts.disable": "Deaktivieren",
  "alerts.enable": "Aktivieren",

  // Journal tab (log sources as in MT5)
  "journal.src.trade": "Handel",
  "journal.src.network": "Netzwerk",
  "journal.src.terminal": "Terminal",
  "journal.src.alerts": "Alarme",
  "journal.src.experts": "Experten",
  "journal.src.account": "Konto",
  "journal.filter": "Filter…",
  "journal.copied": "Journal kopiert",
  "journal.lines": { one: "{count} Zeile", other: "{count} Zeilen" },
  "journal.clear": "Leeren",
  "journal.empty": "Journal ist leer",
  "group.show": "Jeden Trade anzeigen",
  "group.hide": "Trades gruppieren",
  "group.closeAll": "Alle schließen",
  "group.closeTitle": "Alle {symbol}-Positionen schließen?",
  "group.avgTip": "Durchschnittlicher Eröffnungskurs, nach Volumen gewichtet",
};
export default toolbox;
