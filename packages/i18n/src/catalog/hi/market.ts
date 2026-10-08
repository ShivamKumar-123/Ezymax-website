import type { NsMessages } from "../../core";

// Ezymex Trader left panels: Market Watch (quotes list), segment chips and Navigator.
const market: NsMessages<"market"> = {
  // Market Watch header and tabs
  title: "मार्केट वॉच",
  collapse: "छोटा करें",
  "tab.symbols": "सिंबल",
  "tab.details": "विवरण",
  "tab.favourites": "पसंदीदा",
  segmentAria: "मार्केट वॉच सेगमेंट",
  searchPlaceholder: "सिंबल खोजें",
  searchAria: "मार्केट वॉच में खोजें",
  clear: "साफ़ करें",

  // Market Watch columns (shown uppercase)
  "col.symbol": "सिंबल",
  "col.bid": "बिड",
  "col.ask": "आस्क",
  "col.spread": "स्प्रे.", // Spread, very narrow column
  "col.spreadTitle": "स्प्रेड, पॉइंट",
  "col.change": "बदलाव%", // Daily change %, narrow column

  // Row / hover card
  "row.title": "{name} · स्प्रेड {spread}",
  "tip.low": "लो", // day Low
  "tip.high": "हाई", // day High
  "tip.spread": "स्प्रेड", // spread, short
  "tip.range": "रेंज", // day range, short
  bid: "बिड",
  ask: "आस्क",

  // Empty states and footer
  "empty.favourites": "अभी कोई पसंदीदा नहीं। जोड़ने के लिए किसी सिंबल पर राइट-क्लिक करें।",
  "empty.favouritesTitle": "अभी कोई पसंदीदा नहीं",
  "empty.noMatch": "कोई सिंबल मेल नहीं खाता।",
  "footer.count": "{shown} / {total} सिंबल",
  "footer.hint": "डबल-क्लिक: चार्ट",

  // Context menu
  "menu.newOrder": "नया ऑर्डर",
  "menu.chartWindow": "चार्ट विंडो",
  "menu.openInActive": "सक्रिय चार्ट में खोलें",
  "menu.depth": "डेप्थ ऑफ़ मार्केट",
  "menu.specification": "स्पेसिफ़िकेशन",
  "menu.removeFavourite": "पसंदीदा से हटाएँ",
  "menu.addFavourite": "पसंदीदा में जोड़ें",
  "menu.hide": "छिपाएँ",
  "menu.showAll": "सभी दिखाएँ",

  // Toasts
  "toast.hidden": "{symbol} मार्केट वॉच से छिपाया गया",
  "toast.hiddenDesc": "कॉन्टेक्स्ट मेन्यू से सभी सिंबल दिखाएँ।",
  "toast.opened": "{symbol} सक्रिय चार्ट में खोला गया",

  // Segment chips (asset classes)
  "segment.favourites": "पसंदीदा",
  "segment.forex": "फ़ॉरेक्स",
  "segment.metals": "मेटल्स",
  "segment.indices": "इंडाइसेस",
  "segment.energies": "एनर्जी",
  "segment.crypto": "क्रिप्टो",
  "segment.stocks": "स्टॉक्स",
  "segment.aria": "एसेट क्लास",
  "segment.title": { one: "{label} · {count} सिंबल", other: "{label} · {count} सिंबल" },

  // Navigator tree
  "nav.title": "नेविगेटर",
  "nav.indicators": "इंडिकेटर",
  "nav.strategies": "स्ट्रैटेजी",
  "nav.scripts": "स्क्रिप्ट",
  "nav.guest": "गेस्ट",
  "nav.noAccount": "अभी कोई ट्रेडिंग अकाउंट नहीं",
  "nav.openAccount": "अकाउंट खोलें",
  "nav.openAccountTitle": "अपना Ezymex अकाउंट बनाएँ (क्लाइंट एरिया खुलेगा)",
  "nav.signIn": "साइन इन",
  "nav.signInTitle": "क्लाइंट एरिया में साइन इन करें",
  "nav.accountType.live": "लाइव",
  "nav.accountType.demo": "डेमो",
  "nav.category.trend": "ट्रेंड",
  "nav.category.oscillators": "ऑसिलेटर",
  "nav.category.volatility": "वोलैटिलिटी",
  "nav.category.volume": "वॉल्यूम",
  "nav.category.billWilliams": "Bill Williams", // indicator author's name; usually kept
  "nav.indicatorTitle": "{description} · {symbol}, {tf} पर लगाने के लिए डबल-क्लिक करें या Enter दबाएँ",
  "nav.strategyTitle": { one: "{server} · {login} · {count} ट्रेड", other: "{server} · {login} · {count} ट्रेड" },
  "nav.strategyRunning": "{name} पहले से चल रही है",
  "nav.strategyAttached": "{name} लगाई गई",
  "nav.strategyDesc": "{login} · {server} · आज का P&L {pnl}",
  "nav.script.closeAll": "सभी पोज़िशन बंद करें",
  "nav.script.closeProfitable": "मुनाफ़े वाली बंद करें",
  "nav.script.closeLosing": "घाटे वाली बंद करें",
  "nav.script.deletePendings": "सभी पेंडिंग डिलीट करें",
  "nav.script.breakevenAll": "सभी ब्रेकईवन (SL → एंट्री)", // SL = Stop Loss
  "nav.scriptTitle": "मौजूदा अकाउंट पर चलाने के लिए डबल-क्लिक करें",
  "nav.scriptsReadOnly": "केवल देखने वाले मोड में स्क्रिप्ट बंद हैं",
};
export default market;
