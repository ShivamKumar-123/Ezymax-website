import type { NsMessages } from "../../core";

// Kalks mobile app, Reports: Statements (/reports/statements) and Analytics (/reports/analytics).
// Most labels reuse the Client Area's portfolio.st.* / portfolio.an.* keys; only mobile-specific text is here.
const mobileReports: NsMessages<"mobileReports"> = {
  eyebrow: "रिपोर्ट",
  "eyebrow.analytics": "रिपोर्ट · USD · सर्वर समय",

  // Account picker (a card that opens a sheet)
  "account.title": "अकाउंट",
  "account.choose": "अकाउंट चुनें",
  "account.allHint": { one: "{count} लाइव अकाउंट", other: "{count} लाइव अकाउंट" },
  "account.change": "अकाउंट बदलें",

  // Statements
  "st.day": "दिन",
  "st.pickDay": "दिन चुनें",
  "st.pickFrom": "शुरुआती तारीख",
  "st.pickTo": "अंतिम तारीख",
  "st.include": "शामिल करें",
  "st.summary": "#{login} · {period} · {format}",
  "st.preparing": "तैयार हो रहा है…",
  "st.ready": "स्टेटमेंट तैयार है",
  "st.saved": "{file} के रूप में सेव हुआ",
  "st.shareTitle": "स्टेटमेंट शेयर करें",
  "st.failed": "स्टेटमेंट डाउनलोड नहीं हो सका",
  "st.offline": "आप ऑफ़लाइन हैं। स्टेटमेंट डाउनलोड करने के लिए कनेक्ट करें।",
  "st.monthly.empty": "अभी किसी महीने का स्टेटमेंट नहीं।",
  "st.monthly.offline": "आप ऑफ़लाइन हैं। मासिक स्टेटमेंट देखने के लिए कनेक्ट करें।",
  "st.monthly.a11y": "{month}: नेट {net}, {trades}। डाउनलोड खोलता है।",
  "st.month.title": "{month} का स्टेटमेंट",
  "st.month.formats": "इस रूप में डाउनलोड करें",
  "st.prevMonth": "पिछला महीना",
  "st.nextMonth": "अगला महीना",

  // Analytics: hero and stat tiles
  "an.hero.label": "नेट P&L · {period}",
  "an.hero.return": "रिटर्न",
  "an.hero.trades": "ट्रेड",
  "an.hero.lots": "लॉट",
  "an.tile.sharpe": "Sharpe रेशियो",
  "an.tile.expectancy": "एक्सपेक्टेंसी",
  "an.tile.sortino": "Sortino {value}",
  "an.tile.avgWinLoss": "औसत जीत / घाटा",
  "an.tile.rr": "रिवॉर्ड : रिस्क 1 : {value}",
  "an.tile.holdSplit": "मुनाफ़े वाले {win} · घाटे वाले {loss}",
  "an.tile.streaks": "स्ट्रीक",
  "an.tile.streaksSub": "लगातार जीत / हार",
  "an.tile.trade": "{side} {volume} · #{ticket}",
  "an.tile.none": "अभी कोई ट्रेड नहीं",

  // Analytics: curves
  "an.curve.hint": "हर दिन देखने के लिए चार्ट को छूकर रखें",
  "an.curve.drawdown": "ड्रॉडाउन",
  "an.curve.a11y": "{date} को इक्विटी {equity}, बैलेंस {balance}। अधिकतम ड्रॉडाउन {drawdown}।",

  // Analytics: P&L calendar (net of closed trades per server day)
  "an.cal.title": "P&L कैलेंडर",
  "an.cal.subtitle": "हर सर्वर दिन के बंद ट्रेड का नेट नतीजा",
  "an.cal.subtitleEstimated": "दैनिक बैलेंस बदलाव, जमा और निकासी हटाकर",
  "an.cal.days": { one: "{count} ट्रेडिंग दिन", other: "{count} ट्रेडिंग दिन" },
  "an.cal.green": "{count} हरे",
  "an.cal.red": "{count} लाल",
  "an.cal.noTrades": "कोई बंद ट्रेड नहीं",
  "an.cal.select": "नतीजा देखने के लिए किसी दिन पर टैप करें",
  "an.cal.a11yDay": "{date}: {net}, {trades}",

  // Analytics: breakdowns
  "an.hour.byHour": "घंटे के अनुसार नेट P&L",
  "an.hour.byDayHour": "सप्ताह का दिन × घंटा",
  "an.hour.tap": "विवरण के लिए किसी बार या सेल पर टैप करें",
  "an.tapBar": "विवरण के लिए किसी बार पर टैप करें",
  "an.session.best": "सबसे अच्छा",
  "an.session.asia": "एशिया",
  "an.session.london": "लंदन",
  "an.session.overlap": "लंदन / न्यूयॉर्क",
  "an.session.newYork": "न्यूयॉर्क",
  "an.session.lateNewYork": "लेट न्यूयॉर्क",
  "an.side.split": "{long} · {short}",
  "an.flow.equityNow": "अभी इक्विटी",
  "an.charges.total": "चुकाए गए शुल्क",

  // Behaviour insights (the numbers come from the reports service)
  "insight.overtrading.title": { one: "{count} दिन ओवरट्रेडिंग", other: "{count} दिन ओवरट्रेडिंग" },
  "insight.overtrading.text": "इन दिनों आपने {limit} से ज़्यादा ट्रेड किए (आपके सामान्य दिन में {median})। उन दिनों का नेट नतीजा: {net}।",
  "insight.overtrading.tip": "रोज़ाना अधिकतम {cap} ट्रेड की सीमा तय करें।",
  "insight.revenge.title": { one: "{count} संभावित रिवेंज ट्रेड", other: "{count} संभावित रिवेंज ट्रेड" },
  "insight.revenge.text": "घाटे वाले ट्रेड के बंद होने के 15 मिनट के अंदर, उसी या बड़े साइज़ में खोले गए ट्रेड। इनमें से {rate}% जीते, कुल {net}।",
  "insight.revenge.tip": "घाटे के बाद अगले ट्रेड से पहले 15 मिनट रुकें।",
  "insight.risk.title": "घाटे वाले हर ट्रेड पर जोखिम",
  "insight.risk.text": {
    one: "घाटे वाले एक ट्रेड की लागत औसतन आपके बैलेंस का {avg}% रही, अधिकतम {max}%। 2% से ज़्यादा के घाटे: {count}।",
    other: "घाटे वाले एक ट्रेड की लागत औसतन आपके बैलेंस का {avg}% रही, अधिकतम {max}%। 2% से ज़्यादा के घाटे: {count}।",
  },
  "insight.risk.tip": "पोज़िशन का साइज़ ऐसा रखें कि स्टॉप लॉस लगने पर बैलेंस का अधिकतम 1–2% ही जाए।",
  "insight.holdLosers.title": "घाटे वाले ट्रेड मुनाफ़े वालों से ज़्यादा देर खुले रहते हैं",
  "insight.holdLosers.text": "घाटे वाले ट्रेड औसतन {loss} खुले रहते हैं, मुनाफ़े वाले {win}।",
  "insight.holdLosers.tip": "ट्रेड खोलते समय स्टॉप लॉस लगाएँ और उसे वहीं रहने दें।",
  "insight.stopOut.title": { one: "स्टॉप आउट से {count} पोज़िशन बंद हुई", other: "स्टॉप आउट से {count} पोज़िशन बंद हुईं" },
  "insight.stopOut.text": "पोज़िशन आपके अपने स्टॉप लॉस से नहीं, मार्जिन स्टॉप आउट से बंद हुईं।",
  "insight.stopOut.tip": "छोटी पोज़िशन रखकर मार्जिन लेवल को मार्जिन कॉल लेवल से ऊपर रखें।",
  "insight.slTp.title": "स्टॉप लॉस या टेक प्रॉफ़िट से बंद ट्रेड",
  "insight.slTp.text": "{tp} टेक प्रॉफ़िट से, {sl} स्टॉप लॉस से, बाकी हाथ से या डेस्क द्वारा बंद किए गए।",
  "insight.slTp.tip": "पहले से तय एग्ज़िट से नतीजे एक जैसे रहते हैं।",
  "insight.session.title": "सबसे अच्छा सेशन: {session}",
  "insight.session.text": "{rate}% विन रेट के साथ {trades} ट्रेड। सबसे कमज़ोर: {worst} ({net})।",
  "insight.session.tip": "{session} सेशन पर ध्यान दें।",
  "insight.tip": "सुझाव",

  // States
  "state.updating": "अपडेट हो रहा है…",
  "state.stale": "सेव किया गया डेटा दिख रहा है। रिफ़्रेश करने के लिए नीचे खींचें।",
  "state.notShared.title": "आपके साथ शेयर नहीं किया गया",
  "state.footer": "सभी राशियाँ USD में (सेंट अकाउंट कन्वर्ट किए गए)। समय सर्वर समय है, GMT+2 / GMT+3।",
  "state.footerStatements": "स्टेटमेंट अकाउंट की मुद्रा में हैं (सेंट अकाउंट के लिए USC)। समय सर्वर समय है, GMT+2 / GMT+3।",
};
export default mobileReports;
