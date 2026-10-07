import type { NsMessages } from "../../core";

const dashboard: NsMessages<"dashboard"> = {
  // Page header (Client Area home). {name} = client's first name
  "greeting.morning": "सुप्रभात, {name}",
  "greeting.afternoon": "नमस्ते, {name}",
  "greeting.evening": "शुभ संध्या, {name}",
  "greeting.welcome": "स्वागत है, {name}",
  "subtitle.live": "Kalks में आपका स्वागत है। यह रहा आपका अकाउंट और आज का मार्केट।",
  "subtitle.demo": "आज आपके अकाउंट कैसा प्रदर्शन कर रहे हैं, यहाँ देखें।",
  launchTrader: "Kalks Trader खोलें",
  openTerminal: "ट्रेडिंग टर्मिनल खोलें",

  // Getting started checklist
  "steps.title": "शुरुआत करें",
  "steps.subtitle": "लाइव ट्रेडिंग की ओर आपकी प्रगति",
  "steps.progress": "{total} में से {done}",
  "steps.account.title": "अपना अकाउंट बनाएँ",
  "steps.account.text": "{date} को रजिस्टर किया गया।",
  "steps.email.title": "अपना ईमेल वेरिफ़ाई करें",
  "steps.email.verified": "{email} वेरिफ़ाइड है।",
  "steps.email.confirm": "हमारे भेजे गए कोड से {email} की पुष्टि करें।",
  "steps.kyc.title": "अपनी पहचान वेरिफ़ाई करें",
  "steps.kyc.verified": "आपकी पहचान वेरिफ़ाई हो गई है। निकासी अनलॉक हो गई है।",
  "steps.kyc.moreInfo": "हमारी टीम को आपसे एक और दस्तावेज़ चाहिए।",
  "steps.kyc.review": "आपके दस्तावेज़ हमारी वेरिफ़िकेशन टीम के पास हैं।",
  "steps.kyc.draft": "जहाँ छोड़ा था वहीं से जारी रखें। लगभग 3 मिनट लगते हैं।",
  "steps.kyc.rejected": "हम आपके दस्तावेज़ वेरिफ़ाई नहीं कर सके। आप फिर से शुरू कर सकते हैं।",
  "steps.kyc.todo": "लगभग 3 मिनट लगते हैं। निकासी अनलॉक होती है।",
  "steps.accountOpen.title": "ट्रेडिंग अकाउंट खोलें",
  // {count} = live + demo accounts in total
  "steps.accountOpen.opened": { one: "{live} लाइव और {demo} डेमो अकाउंट खुला है।", other: "{live} लाइव और {demo} डेमो अकाउंट खुले हैं।" },
  "steps.accountOpen.todo": "लाइव या डेमो अकाउंट खोलें; आपका लॉगिन तुरंत जारी हो जाता है।",
  "steps.wallet.title": "अपने वॉलेट में फ़ंड डालें",
  "steps.wallet.text": "TRC20 पर USDT जमा को जोड़ा जा रहा है।",
  // Step status chips
  "steps.state.done": "हो गया",
  "steps.state.todo": "करना है",
  "steps.state.review": "समीक्षा में",
  "steps.state.rejected": "अस्वीकृत",
  "steps.state.soon": "शुरू नहीं हुआ",

  // Trading accounts card. <b> wraps the equity amount
  "accounts.title": "ट्रेडिंग अकाउंट",
  "accounts.summary": "लाइव इक्विटी <b>{equity}</b> · {live} लाइव · {demo} डेमो · {positions} खुली पोज़िशन",
  "accounts.subtitle": "आपके लाइव और डेमो अकाउंट",
  "accounts.all": "सभी अकाउंट",
  "accounts.open": "अकाउंट खोलें",
  "accounts.unavailable": "ट्रेडिंग अकाउंट अभी उपलब्ध नहीं हैं। आपके बैलेंस सुरक्षित हैं।",
  "accounts.openLive.title": "लाइव अकाउंट खोलें",
  "accounts.openLive.text": "असली मार्केट। शून्य बैलेंस से शुरू होता है; इसे अपने वॉलेट से फ़ंड करें।",
  "accounts.openDemo.title": "डेमो अकाउंट खोलें",
  "accounts.openDemo.text": "रियल-टाइम कीमतों पर वर्चुअल फ़ंड, हर दिन रीफ़िल किए जा सकते हैं।",
  "accounts.more": { one: "{count} और अकाउंट", other: "{count} और अकाउंट" },
  "accounts.myTitle": "मेरे ट्रेडिंग अकाउंट",

  // Your account card
  "account.title": "आपका अकाउंट",
  "account.clientId": "क्लाइंट ID",
  "account.emailStatus": "ईमेल की स्थिति",
  "account.notVerified": "वेरिफ़ाइड नहीं",
  "account.identity": "पहचान",
  "account.memberSince": "सदस्य कब से",
  "account.profile": "प्रोफ़ाइल",

  // Kalks Trader banner
  "trader.chip": "लाइव कीमतें",
  "trader.text": "फ़ॉरेक्स, मेटल्स, इंडाइसेस, एनर्जी, क्रिप्टो और स्टॉक्स में {count} इंस्ट्रूमेंट के रियल-टाइम कोट्स और चार्ट। आपके ब्राउज़र में चलता है, कुछ भी इंस्टॉल करने की ज़रूरत नहीं।",

  // Market clock / heatmap
  "sessions.title": "मार्केट घड़ी",
  "sessions.open": "{total} में से {open} मार्केट खुले हैं",
  "heatmap.title": "मार्केट हीटमैप",
  "heatmap.subtitle": "लाइव कीमतों से आज का बदलाव · खाली बिंदु: मार्केट बंद",
  "heatmap.up": "{count} ऊपर",
  "heatmap.down": "{count} नीचे",
  "heatmap.allMarkets": "सभी मार्केट",
  "heatmap.tipOpen": "{symbol} · मार्केट खुला है",
  "heatmap.tipClosed": "{symbol} · मार्केट बंद, पिछले सेशन का बदलाव",

  // Support card. <mail> wraps the support email address
  "support.title": "मदद चाहिए?",
  "support.text": "अपने रजिस्टर्ड ईमेल से <mail>{email}</mail> पर लिखें और अपनी क्लाइंट ID शामिल करें।",
  "support.emailSupport": "सहायता को ईमेल करें",
  "support.copied": "ईमेल पता कॉपी हो गया",
  "support.copyFailed": "कॉपी नहीं हो सका, कृपया पता सेलेक्ट करें",

  // Demo dashboard: onboarding strip
  "onboarding.title": "अपने अकाउंट का सेटअप पूरा करें",
  "onboarding.text": "निकासी और ऊँची लिमिट अनलॉक करने के लिए KYC पूरा करें।",
  "onboarding.progress": "प्रगति",
  "onboarding.dismiss": "हटाएँ",

  // Margin health
  "margin.title": "मार्जिन हेल्थ",
  "margin.subtitle": "सभी लाइव अकाउंट में",
  "margin.healthy": "स्वस्थ",
  "margin.level": "मार्जिन लेवल",
  "margin.used": "उपयोग किया मार्जिन",
  "margin.free": "फ़्री मार्जिन",

  // Equity / P&L. {range} = 1W, 1M, 3M, YTD, 1Y, ALL (keep as-is)
  "equity.title": "कुल इक्विटी",
  "equity.changeOver": "{range} में बदलाव",
  "pnl.title": "मुनाफ़ा / घाटा · महीना",
  "pnl.lowRisk": "कम जोखिम",
  "pnl.winRate": "विन रेट (30 दिन)",
  "pnl.trades": "ट्रेड (30 दिन)",
  "pnl.avgWin": "औसत मुनाफ़े वाला ट्रेड",
  "pnl.avgLoss": "औसत घाटे वाला ट्रेड",
  "pnl.charges": "चुकाए गए शुल्क",

  // KPI cards
  "kpi.wallet": "वॉलेट",
  "kpi.today": "आज +{pct}%",
  "kpi.monthPnl": "महीने का P&L",
  "kpi.vsLastMonth": "पिछले महीने से +{pct}%",
  "kpi.partnerEarnings": "पार्टनर कमाई",
  // Copy = copy-trading earnings
  "kpi.copy": "कॉपी {amount}",

  // Top movers
  "movers.title": "टॉप मूवर्स",
  "movers.gainers": "बढ़त वाले",
  "movers.losers": "गिरावट वाले",

  // Economic calendar. A = Actual, F = Forecast, P = Previous
  "calendar.title": "आर्थिक कैलेंडर",
  "calendar.subtitle": "आज · सर्वर समय GMT+3",
  "calendar.actual": "वास्तविक {value} · ",
  "calendar.forecastPrevious": "अनुमान {forecast} · पिछला {previous}",

  // News / world
  "news.title": "मार्केट न्यूज़",
  "news.all": "सभी न्यूज़",
  "news.pinned": "पिन किया गया",
  "world.title": "दुनिया भर के मार्केट और न्यूज़",
  "world.subtitle": "देश के अनुसार लाइव हेडलाइन और मुद्रा का सेंटिमेंट",
  "world.stories": { one: "आज {count} खबर", other: "आज {count} खबरें" },

  // Open positions
  "positions.title": "खुली पोज़िशन",
  "positions.summary": { one: "{count} पोज़िशन · फ़्लोटिंग", other: "{count} पोज़िशन · फ़्लोटिंग" },
  "positions.terminal": "टर्मिनल",

  // Partner banner. <link> wraps the referral link
  "partner.chip": "पार्टनर प्रोग्राम",
  "partner.title": "ट्रेडर्स को आमंत्रित करें। प्रति लॉट $15 तक कमाएँ — जीवन भर।",
  "partner.text": "मल्टी-टियर कमीशन, CPA बोनस और रियल-टाइम ट्रैकिंग। आपका लिंक: <link>{url}</link>",
  "partner.open": "पार्टनर डैशबोर्ड खोलें",

  // Short relative times (m = minutes, h = hours, d = days)
  "time.justNow": "अभी-अभी",
  "time.minutesAgo": "{count} मि. पहले",
  "time.hoursAgo": "{count} घं. पहले",
  "time.daysAgo": "{count} दिन पहले",
  // {time} = sample value like "5m"
  "time.ago": "{time} पहले",

  // Notifications bell / panel
  "notifications.title": "सूचनाएँ",
  "notifications.ariaUnread": "सूचनाएँ, {count} अपठित",
  "notifications.markAll": "सभी को पढ़ा हुआ मार्क करें",
  "notifications.clear": "साफ़ करें",
  "notifications.emptyTitle": "अभी कोई सूचना नहीं",
  "notifications.emptyText": "जमा, निकासी, वेरिफ़िकेशन, ट्रेडिंग अलर्ट और सहायता टीम के जवाब यहाँ दिखाई देंगे।",
  "notifications.settings": "सूचना सेटिंग्स",

  // Client Area redesign: side menu, dashboard overview
  "chrome.expand": "मेनू फैलाएँ",
  "chrome.collapse": "मेनू समेटें",
  "chrome.menu": "मेनू",
  "home.todayPnl": "आज का P&L",
  "home.walletBalance": "वॉलेट बैलेंस",
  "home.rewardsEarnings": "रिवॉर्ड्स और IB कमाई",
  "home.todayPct": "आज {pct}%",
  "home.floating": "फ़्लोटिंग P&L",
  "home.rewards": "रिवॉर्ड्स",
  "home.accountsChip": "{live} लाइव · {positions} ओपन पोज़िशन",
  "home.statistics": "आँकड़े",
  "home.pnl": "P&L",
  "home.weekly": "साप्ताहिक",
  "home.monthly": "मासिक",
  "home.lastYear": "पिछला साल",
  "home.noHistory": "आपके लाइव खातों में गतिविधि होते ही आपकी इक्विटी का इतिहास यहाँ दिखेगा।",
  "home.thisPeriod": "यह अवधि",
  "home.previousPeriod": "पिछली अवधि",
  "home.yourAccounts": "आपके खाते",
  "home.tradingAccount": "ट्रेडिंग खाता",
  "home.accountInfo": "खाते की जानकारी",
  "home.accountName": "खाते का नाम",
  "home.leverage": "लीवरेज",
  "home.previous": "पिछला खाता",
  "home.next": "अगला खाता",
  "home.showBalances": "बैलेंस दिखाएँ",
  "home.hideBalances": "बैलेंस छिपाएँ",
  "home.trade": "ट्रेड करें",
  "home.history": "इतिहास",
  "home.funding": "फ़ंडिंग",
  "home.linked": "जुड़े हुए",
  "home.connected": "कनेक्टेड",
  "home.subscriptions": { one: "{count} सक्रिय सब्सक्रिप्शन", other: "{count} सक्रिय सब्सक्रिप्शन" },
  "home.points": "{points} पॉइंट",
  "home.redeem": "रिडीम करें",
  "home.networkUnavailable": "रुका हुआ",
  "home.totalBalance": "कुल बैलेंस",
  "home.totalBalanceSub": "लाइव खाते और वॉलेट",
  "home.transferFunds": "फ़ंड ट्रांसफ़र करें",
  "home.quickActions": "त्वरित कार्य",
  "home.later": "बाद में",
  "home.viewDetails": "विवरण देखें",
  "home.verifyNow": "अभी सत्यापित करें",
  "home.fundTitle": "अपना वॉलेट फ़ंड करें",
  "home.fundText": "लाइव खाते पर ट्रेडिंग शुरू करने के लिए USDT जमा करें।",
  "home.depositNow": "अभी जमा करें",
  "home.tradingTitle": "ट्रेडिंग",
  "home.marketsTitle": "बाज़ार",
  "home.moreTitle": "आपके लिए और",
};
export default dashboard;
