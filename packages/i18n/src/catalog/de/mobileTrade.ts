import type { NsMessages } from "../../core";

// Kalks mobile app: Trade tab (chart, Sell / Buy bar, order ticket) and trade notifications.
// Trading terms follow MetaTrader 5 localisation (see the `order` namespace). Keep {placeholders} as they are.
// {side} is the translated common.buy / common.sell ("Kaufen" / "Verkaufen").
const mobileTrade: NsMessages<"mobileTrade"> = {
  // Header
  pickSymbol: "Symbol wählen",
  searchSymbol: "Symbole suchen",
  depth: "Markttiefe",
  alert: "Kursalarm",
  news: "News zu {symbol}", // a header button's accessibility label
  calendar: "Wirtschaftskalender {currency}", // a header button's accessibility label, e.g. "Wirtschaftskalender EUR"
  "account.chip": "{type} · #{login}",
  "account.manage": "Konten verwalten",
  "account.open": "Konto eröffnen",

  // Chart
  "chart.indicators": "Indikatoren",
  "chart.type.candles": "Kerzen",
  "chart.type.line": "Linie",
  "ind.ma": "Gleitender Durchschnitt 20",
  "ind.ema": "Exponentieller MA 50",
  "ind.bb": "Bollinger-Bänder 20, 2",
  "ind.rsi": "RSI 14",
  "chart.noData": "Noch keine Chart-Historie für dieses Symbol",
  "chart.hint": "Mit zwei Fingern zoomen · ziehen zum Scrollen · gedrückt halten für das Fadenkreuz · doppelt tippen zum Zurücksetzen",

  // Sell / Buy bar and ticket
  "bar.volume": "Lots",
  "ticket.title": "Neue Order",
  "ticket.confirmBuy": "{volume} {symbol} kaufen",
  "ticket.confirmSell": "{volume} {symbol} verkaufen",
  "ticket.atMarket": "zum Marktpreis",
  "ticket.at": "zu {price}",
  "ticket.addSl": "Stop Loss hinzufügen",
  "ticket.addTp": "Take Profit hinzufügen",
  "ticket.ifHit": "{money} bei Auslösung",
  "ticket.required": "Margin",
  "ticket.pip": "Pip-Wert",
  "ticket.after": "Freie Margin danach",
  "ticket.notEnough": "Nicht genug freie Margin für dieses Volumen.",
  "ticket.noSpecs": "Kontraktdetails werden geladen…",
  "ticket.distance": "{n} Pips entfernt",
  "ticket.price": "Preis",

  // Rejections: a plain-language line under the reason (order.reject.<code>); the engine's own detail follows it
  "reject.no_money": "Ihre freie Margin reicht für diese Order nicht aus. Verringern Sie das Volumen oder laden Sie dieses Konto auf.",
  "reject.insufficient_funds": "Ihre freie Margin reicht für diese Order nicht aus. Verringern Sie das Volumen oder laden Sie dieses Konto auf.",
  "reject.market_closed": "Dieser Markt ist gerade geschlossen. Versuchen Sie es nach der Öffnung erneut.",
  "reject.invalid_volume": "Wählen Sie ein Volumen innerhalb der Limits und der Lot-Schrittweite dieses Symbols.",
  "reject.max_lot": "Dieses Volumen übersteigt das Maximum pro Order für Ihr Konto.",
  "reject.close_only": "Ihr Konto kann derzeit Positionen schließen, aber keine neuen eröffnen.",
  "reject.symbol_close_only": "Dieses Symbol kann derzeit nur geschlossen, aber nicht eröffnet werden.",
  "reject.trading_disabled": "Der Handel ist für dieses Konto deaktiviert. Wenden Sie sich für Details an den Support.",
  "reject.symbol_halted": "Der Handel mit diesem Symbol ist ausgesetzt. Versuchen Sie es später erneut.",
  "reject.requote.title": "Der Kurs hat sich bewegt",
  "reject.requote": "Der Markt hat sich bewegt, während Ihre Order unterwegs war. Prüfen Sie den neuen Kurs und bestätigen Sie erneut.",
  "reject.invalid_sl": "Der Stop Loss liegt auf der falschen Seite des Kurses oder zu nah daran.",
  "reject.invalid_tp": "Der Take Profit liegt auf der falschen Seite des Kurses oder zu nah daran.",
  "reject.invalid_price": "Dieser Preis liegt für diesen Ordertyp auf der falschen Seite des Marktes.",
  "reject.off_market": "Dieser Preis ist zu weit vom Markt entfernt. Prüfen Sie den Wert.",
  "reject.stale_price": "Die Kurse für dieses Symbol sind kurz pausiert. Versuchen Sie es gleich erneut.",
  "reject.no_price": "Für dieses Symbol gibt es gerade keinen Live-Kurs.",
  "reject.read_only": "Mit diesem Login können Sie das Konto ansehen, aber nicht handeln.",
  "reject.uncertain.title": "Keine Antwort vom Handelsserver",
  "reject.uncertain": "Die Order wurde möglicherweise ausgeführt. Prüfen Sie das Portfolio, bevor Sie es erneut versuchen.",
  "reject.uncertain.ticket": "Erneutes Bestätigen ist sicher: Dieselbe Order kann nicht doppelt platziert werden.",

  // States
  "state.noAccount.title": "Noch kein Handelskonto",
  "state.noAccount.body": "Eröffnen Sie ein Demokonto zum Üben oder ein Live-Konto, um mit echtem Geld zu handeln.",
  "state.noAccount.action": "Konto eröffnen",
  "state.connecting": "Verbindung zum Handelsserver…",
  "state.readOnly": "Dieses Konto ist hier nur zur Ansicht: Kurse und Charts sind live, der Handel ist deaktiviert.",
  "state.marketClosed.title": "Markt geschlossen",
  "state.marketClosed.body": "{symbol} öffnet wieder mit der nächsten Sitzung. Orders können ab der Öffnung platziert werden.",
  "state.streamError": "Handelsserver nicht erreichbar",
  "state.streamErrorBody": "Ihre Positionen und Orders sind auf dem Server sicher. Wir versuchen weiter, die Verbindung wiederherzustellen.",

  // Results
  "toast.filled": "Ausgeführt: {side} {volume} {symbol}",
  "toast.at": "zu {price}",
  "toast.placed": "Pending Order für {symbol} platziert",
  "toast.duplicate": "Bereits als #{ticket} platziert",
  "toast.duplicateBody": "Diese Order hatte den Server bereits erreicht; es wurde nichts Neues eröffnet.",
  "toast.closed": "Position #{ticket} geschlossen",
  "toast.partial": "{volume} Lots von #{ticket} geschlossen",
  "toast.modified": "#{ticket} aktualisiert",
  "toast.cancelled": "Order #{ticket} storniert",

  // Engine notifications while the app is open
  "notify.sl": "Stop Loss ausgelöst",
  "notify.tp": "Take Profit ausgelöst",
  "notify.order_filled": "Pending Order ausgeführt",
  "notify.order_triggered": "Order ausgelöst",
  "notify.margin_call": "Margin Call",
  "notify.stop_out": "Stop Out",
  "notify.order_rejected": "Order abgelehnt",
  "notify.order_expired": "Order abgelaufen",
  "notify.order_cancelled": "Order storniert",
};
export default mobileTrade;
