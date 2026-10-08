import type { NsMessages } from "../../core";

// Ezymex Trader bottom panel ("Toolbox", MT5 style): Trade, History, Exposure, News, Calendar, Alerts, Journal.
const toolbox: NsMessages<"toolbox"> = {
  // Panel header
  title: "टूलबॉक्स",
  bulkClose: "एक साथ बंद करें",
  restore: "रीस्टोर",
  maximise: "बड़ा करें",
  hide: "टूलबॉक्स छिपाएँ (Ctrl+T)",

  // Tab names
  "tab.trade": "ट्रेड",
  "tab.history": "हिस्ट्री",
  "tab.exposure": "एक्सपोज़र",
  "tab.news": "न्यूज़",
  "tab.calendar": "कैलेंडर",
  "tab.alerts": "अलर्ट",
  "tab.journal": "जर्नल",
  "tab.ai": "AI ट्रेडर",

  // Guest mode notices (no trading account logged in)
  "guest.trade": "ट्रेडिंग अकाउंट में लॉग इन करने के बाद खुली पोज़िशन, पेंडिंग ऑर्डर, बैलेंस, इक्विटी और मार्जिन यहाँ दिखेंगे। चार्ट, कोट्स और अलर्ट अभी काम करते हैं।",
  "guest.history": "ट्रेडिंग अकाउंट में लॉग इन करने के बाद आपके बंद ट्रेड और प्रदर्शन के आँकड़े यहाँ दिखेंगे।",
  "guest.exposure": "ट्रेडिंग अकाउंट में लॉग इन करने के बाद मुद्रा और एसेट के अनुसार नेट एक्सपोज़र आपकी खुली पोज़िशन से निकाला जाता है।",

  // Table column headers (shown uppercase)
  "col.symbol": "सिंबल",
  "col.ticket": "टिकट",
  "col.time": "समय",
  "col.type": "प्रकार",
  "col.volume": "वॉल्यूम",
  "col.price": "प्राइस",
  "col.sl": "S / L", // Stop Loss; MT5 abbreviation
  "col.tp": "T / P", // Take Profit; MT5 abbreviation
  "col.swap": "स्वैप",
  "col.commission": "कमीशन",
  "col.profit": "प्रॉफ़िट",
  "col.comment": "टिप्पणी",
  "col.openTime": "ओपन समय",
  "col.closeTime": "क्लोज़ समय",
  "col.reason": "कारण",
  "col.asset": "एसेट",
  "col.rate": "रेट",
  "col.graph": "ग्राफ़",
  "col.ccy": "मुद्रा", // currency, short
  "col.impact": "प्रभाव",
  "col.event": "इवेंट",
  "col.actual": "वास्तविक",
  "col.forecast": "अनुमान",
  "col.previous": "पिछला",
  "col.condition": "शर्त",
  "col.current": "मौजूदा",
  "col.note": "नोट",
  "col.status": "स्थिति",
  "col.created": "बनाया गया",

  // Trade direction and order types
  "side.buy": "बाय",
  "side.sell": "सेल",
  "orderType.buy.limit": "बाय लिमिट",
  "orderType.buy.stop": "बाय स्टॉप",
  "orderType.buy.stopLimit": "बाय स्टॉप लिमिट",
  "orderType.sell.limit": "सेल लिमिट",
  "orderType.sell.stop": "सेल स्टॉप",
  "orderType.sell.stopLimit": "सेल स्टॉप लिमिट",

  // Where a trade came from (comment column chip)
  "source.manual": "मैन्युअल",
  "source.copy": "कॉपी",
  "source.api": "API",
  "source.strategy": "स्ट्रैटेजी",
  "source.ai": "AI",
  "source.pamm": "PAMM",

  // Bulk close menu
  "bulk.closeAll": "सभी पोज़िशन बंद करें",
  "bulk.closeProfitable": "मुनाफ़े वाली बंद करें",
  "bulk.closeLosing": "घाटे वाली बंद करें",
  "bulk.closeBuys": "सभी बाय बंद करें",
  "bulk.closeSells": "सभी सेल बंद करें",
  "bulk.closeBySymbol": "सिंबल के अनुसार बंद करें",
  "bulk.cancelPendings": "सभी पेंडिंग ऑर्डर रद्द करें",

  // Position / order context menus
  "menu.closeTicket": "#{ticket} बंद करें",
  "menu.closePartial": "आंशिक बंद करें…",
  "menu.close50": "50% बंद करें",
  "menu.modifyOrDelete": "मॉडिफ़ाई या डिलीट करें…",
  "menu.moveSlBreakeven": "SL को ब्रेकईवन पर ले जाएँ", // SL = Stop Loss
  "menu.closeBy": "क्लोज़ बाय", // MT5 "Close By": close against an opposite position
  "menu.closeByItem": "#{ticket} {side} {volume} {price} पर",
  "menu.shareTrade": "यह ट्रेड शेयर करें…",
  "menu.shareOrder": "यह ऑर्डर शेयर करें…",
  "menu.showOnChart": "चार्ट पर दिखाएँ",
  "menu.copyTicket": "टिकट कॉपी करें",
  "menu.deleteTicket": "#{ticket} डिलीट करें",
  "toast.ticketCopied": "टिकट कॉपी हो गया",

  // Trade tab
  "trade.empty": "कोई खुली पोज़िशन नहीं",
  "trade.emptyHint": "कोई खुली पोज़िशन नहीं · F9 दबाएँ या चार्ट पर वन-क्लिक पैनल का उपयोग करें",
  "trade.placed": "लगाया गया", // pending order status in the Profit column
  "trade.closePosition": "पोज़िशन बंद करें",
  "trade.closePositionAria": "पोज़िशन {ticket} बंद करें",
  "trade.deleteOrder": "ऑर्डर डिलीट करें",
  "trade.deleteOrderAria": "ऑर्डर {ticket} डिलीट करें",

  // Totals row under the Trade tab
  "summary.balance": "बैलेंस",
  "summary.equity": "इक्विटी",
  "summary.margin": "मार्जिन",
  "summary.freeMargin": "फ़्री मार्जिन",
  "summary.marginLevel": "मार्जिन लेवल",
  "summary.credit": "क्रेडिट",

  // History tab
  "history.period.today": "आज",
  "history.period.3d": "पिछले 3 दिन",
  "history.period.week": "पिछला सप्ताह",
  "history.period.month": "पिछला महीना",
  "history.period.3m": "पिछले 3 महीने",
  "history.period.all": "पूरी हिस्ट्री",
  "history.symbolFilter": "सिंबल फ़िल्टर",
  "history.allSymbols": "सभी सिंबल",
  "history.trades": "ट्रेड",
  "history.winRate": "विन रेट",
  "history.gross": "ग्रॉस",
  "history.pf": "PF", // Profit factor; keep abbreviation
  "history.report": "रिपोर्ट",
  "history.reportExported": "रिपोर्ट एक्सपोर्ट हुई",
  "history.reportExportedDesc": { one: "{file} · {count} डील", other: "{file} · {count} डील" },
  "history.empty": "इस अवधि में कोई बंद ट्रेड नहीं",
  "history.profit": "प्रॉफ़िट",
  "history.credit": "क्रेडिट",
  "history.deposit": "जमा",
  "history.withdrawal": "निकासी",
  "history.balance": "बैलेंस",
  "history.showingLatest": "{total} में से नवीनतम {shown} दिखाए जा रहे हैं",

  // Exposure tab
  "exposure.empty": "कोई एक्सपोज़र नहीं",
  "exposure.emptySub": "हर एसेट पर अपना नेट एक्सपोज़र देखने के लिए पोज़िशन खोलें।",
  "exposure.footer": "{ccy} में हर एसेट का नेट एक्सपोज़र · लॉन्ग पॉज़िटिव, शॉर्ट नेगेटिव",
  "exposure.usdCent": "USD (अकाउंट USC में दिखाया गया)",

  // News tab (demo content)
  "news.minAgo": "{source} · {count} मिनट पहले",
  "news.minShort": "{count}मि", // minutes ago, compact
  "sentiment.bullish": "तेज़ी",
  "sentiment.bearish": "मंदी",
  "sentiment.neutral": "न्यूट्रल",

  // Alerts tab
  "alerts.updated": "अलर्ट अपडेट हुआ",
  "alerts.edit": "अलर्ट एडिट करें",
  "alerts.new": "नया अलर्ट",
  "alerts.symbolAria": "अलर्ट सिंबल",
  "alerts.condition": "शर्त",
  "alerts.bidAbove": "बिड ≥",
  "alerts.bidBelow": "बिड ≤",
  "alerts.priceAria": "अलर्ट प्राइस",
  "alerts.notePlaceholder": "नोट (वैकल्पिक)",
  "alerts.create": "अलर्ट बनाएँ",
  "alerts.helpGuest": "टर्मिनल खुला रहने तक हर लाइव टिक पर इस ब्राउज़र में अलर्ट जाँचे जाते हैं, ट्रिगर होने पर साउंड और सूचना के साथ।",
  "alerts.helpServer": "अलर्ट हर टिक पर सर्वर-साइड जाँचे जाते हैं और ट्रिगर होने पर साउंड और टोस्ट दिखाते हैं।",
  "alerts.helpChart": "किसी प्राइस पर अलर्ट लगाने के लिए चार्ट पर राइट-क्लिक करें।",
  "alerts.empty": "कोई अलर्ट नहीं",
  "alerts.triggered": "{time} पर ट्रिगर हुआ",
  "alerts.disable": "बंद करें",
  "alerts.enable": "चालू करें",

  // Journal tab (log sources as in MT5)
  "journal.src.trade": "ट्रेड",
  "journal.src.network": "नेटवर्क",
  "journal.src.terminal": "टर्मिनल",
  "journal.src.alerts": "अलर्ट",
  "journal.src.experts": "एक्सपर्ट्स",
  "journal.src.account": "अकाउंट",
  "journal.filter": "फ़िल्टर…",
  "journal.copied": "जर्नल कॉपी हुआ",
  "journal.lines": { one: "{count} लाइन", other: "{count} लाइनें" },
  "journal.clear": "साफ़ करें",
  "journal.empty": "जर्नल खाली है",
};
export default toolbox;
