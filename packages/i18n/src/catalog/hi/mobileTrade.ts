import type { NsMessages } from "../../core";

// Kalks mobile app: Trade tab (chart, Sell / Buy bar, order ticket) and trade notifications.
// Trading terms follow the MT5 wording of the `order` namespace. Keep every {placeholder}.
const mobileTrade: NsMessages<"mobileTrade"> = {
  // Header
  pickSymbol: "सिंबल चुनें",
  searchSymbol: "सिंबल खोजें",
  depth: "डेप्थ ऑफ़ मार्केट",
  alert: "प्राइस अलर्ट",
  news: "{symbol} की न्यूज़", // a header button's accessibility label
  calendar: "{currency} आर्थिक कैलेंडर", // a header button's accessibility label, e.g. "EUR economic calendar"
  "account.chip": "{type} · #{login}",
  "account.manage": "अकाउंट मैनेज करें",
  "account.open": "अकाउंट खोलें",

  // Chart
  "chart.indicators": "इंडिकेटर",
  "chart.type.candles": "कैंडल",
  "chart.type.line": "लाइन",
  "ind.ma": "मूविंग एवरेज 20",
  "ind.ema": "एक्सपोनेंशियल MA 50",
  "ind.bb": "बोलिंजर बैंड्स 20, 2",
  "ind.rsi": "RSI 14",
  "chart.noData": "इस सिंबल की अभी कोई चार्ट हिस्ट्री नहीं",
  "chart.hint": "ज़ूम के लिए पिंच करें · स्क्रॉल के लिए ड्रैग करें · क्रॉसहेयर के लिए दबाकर रखें · रीसेट के लिए डबल-टैप करें",

  // Sell / Buy bar and ticket
  "bar.volume": "लॉट",
  "ticket.title": "नया ऑर्डर",
  "ticket.confirmBuy": "बाय {volume} {symbol}",
  "ticket.confirmSell": "सेल {volume} {symbol}",
  "ticket.atMarket": "मार्केट प्राइस पर",
  "ticket.at": "{price} पर",
  "ticket.addSl": "स्टॉप लॉस जोड़ें",
  "ticket.addTp": "टेक प्रॉफ़िट जोड़ें",
  "ticket.ifHit": "हिट होने पर {money}",
  "ticket.required": "मार्जिन",
  "ticket.pip": "पिप वैल्यू",
  "ticket.after": "बचा फ़्री मार्जिन",
  "ticket.notEnough": "इस वॉल्यूम के लिए पर्याप्त फ़्री मार्जिन नहीं है।",
  "ticket.noSpecs": "कॉन्ट्रैक्ट विवरण लोड हो रहा है…",
  "ticket.distance": "{n} पिप्स दूर",
  "ticket.price": "प्राइस",

  // Rejections: a plain-language line under the reason (order.reject.<code>); the engine's own detail follows it
  "reject.no_money": "आपका फ़्री मार्जिन इस ऑर्डर के लिए काफ़ी नहीं है। वॉल्यूम घटाएँ या इस अकाउंट में फ़ंड जोड़ें।",
  "reject.insufficient_funds": "आपका फ़्री मार्जिन इस ऑर्डर के लिए काफ़ी नहीं है। वॉल्यूम घटाएँ या इस अकाउंट में फ़ंड जोड़ें।",
  "reject.market_closed": "यह मार्केट अभी बंद है। खुलने पर फिर से कोशिश करें।",
  "reject.invalid_volume": "इस सिंबल की सीमाओं और लॉट स्टेप के अंदर वॉल्यूम रखें।",
  "reject.max_lot": "यह वॉल्यूम आपके अकाउंट के लिए प्रति ऑर्डर अधिकतम से ज़्यादा है।",
  "reject.close_only": "आपका अकाउंट अभी पोज़िशन बंद कर सकता है, लेकिन नई नहीं खोल सकता।",
  "reject.symbol_close_only": "इस सिंबल पर अभी पोज़िशन बंद की जा सकती हैं, खोली नहीं जा सकतीं।",
  "reject.trading_disabled": "इस अकाउंट पर ट्रेडिंग बंद है। विवरण के लिए सहायता टीम से संपर्क करें।",
  "reject.symbol_halted": "इस सिंबल पर ट्रेडिंग रुकी हुई है। बाद में फिर से कोशिश करें।",
  "reject.requote.title": "कीमत बदल गई",
  "reject.requote": "आपका ऑर्डर पहुँचने के दौरान मार्केट बदल गया। नई कीमत देखें और फिर से पुष्टि करें।",
  "reject.invalid_sl": "स्टॉप लॉस कीमत की गलत तरफ़ है, या उसके बहुत पास है।",
  "reject.invalid_tp": "टेक प्रॉफ़िट कीमत की गलत तरफ़ है, या उसके बहुत पास है।",
  "reject.invalid_price": "इस ऑर्डर प्रकार के लिए यह प्राइस मार्केट की गलत तरफ़ है।",
  "reject.off_market": "यह प्राइस मार्केट से बहुत दूर है। वैल्यू जाँचें।",
  "reject.stale_price": "इस सिंबल की कीमतें कुछ पल के लिए रुकी हैं। थोड़ी देर में फिर से कोशिश करें।",
  "reject.no_price": "इस सिंबल की अभी कोई लाइव कीमत नहीं है।",
  "reject.read_only": "यह लॉगिन अकाउंट देख सकता है, लेकिन ट्रेड नहीं कर सकता।",
  "reject.uncertain.title": "ट्रेड सर्वर से कोई जवाब नहीं",
  "reject.uncertain": "हो सकता है ऑर्डर पहुँच गया हो। फिर से कोशिश करने से पहले पोर्टफ़ोलियो देखें।",
  "reject.uncertain.ticket": "फिर से पुष्टि करना सुरक्षित है: एक ही ऑर्डर दो बार नहीं लग सकता।",

  // States
  "state.noAccount.title": "अभी कोई ट्रेडिंग अकाउंट नहीं",
  "state.noAccount.body": "प्रैक्टिस के लिए डेमो अकाउंट खोलें, या असली ट्रेडिंग के लिए लाइव अकाउंट।",
  "state.noAccount.action": "अकाउंट खोलें",
  "state.connecting": "ट्रेड सर्वर से कनेक्ट हो रहा है…",
  "state.readOnly": "यह अकाउंट यहाँ केवल देखने के लिए है: कीमतें और चार्ट लाइव हैं, ट्रेडिंग बंद है।",
  "state.marketClosed.title": "मार्केट बंद",
  "state.marketClosed.body": "{symbol} अगले सेशन के साथ फिर से खुलेगा। खुलने के बाद ऑर्डर लगाए जा सकते हैं।",
  "state.streamError": "ट्रेड सर्वर से संपर्क नहीं हो पा रहा",
  "state.streamErrorBody": "आपकी पोज़िशन और ऑर्डर सर्वर पर सुरक्षित हैं। हम फिर से कनेक्ट करने की कोशिश करते रहेंगे।",

  // Results
  "toast.filled": "{side} {volume} {symbol} फ़िल हुआ",
  "toast.at": "{price} पर",
  "toast.placed": "{symbol} पेंडिंग ऑर्डर लगाया गया",
  "toast.duplicate": "पहले ही #{ticket} के रूप में लग चुका है",
  "toast.duplicateBody": "यह ऑर्डर पहले ही सर्वर तक पहुँच चुका था; कुछ नया नहीं खोला गया।",
  "toast.closed": "पोज़िशन #{ticket} बंद हुई",
  "toast.partial": "#{ticket} के {volume} लॉट बंद हुए",
  "toast.modified": "#{ticket} अपडेट हुआ",
  "toast.cancelled": "ऑर्डर #{ticket} रद्द हुआ",

  // Engine notifications while the app is open
  "notify.sl": "स्टॉप लॉस हिट",
  "notify.tp": "टेक प्रॉफ़िट हिट",
  "notify.order_filled": "पेंडिंग ऑर्डर फ़िल हुआ",
  "notify.order_triggered": "ऑर्डर ट्रिगर हुआ",
  "notify.margin_call": "मार्जिन कॉल",
  "notify.stop_out": "स्टॉप आउट",
  "notify.order_rejected": "ऑर्डर अस्वीकृत",
  "notify.order_expired": "ऑर्डर एक्सपायर हुआ",
  "notify.order_cancelled": "ऑर्डर रद्द हुआ",
};
export default mobileTrade;
