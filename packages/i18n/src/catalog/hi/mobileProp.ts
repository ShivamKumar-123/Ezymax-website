import type { NsMessages } from "../../core";

// Kalks mobile app: Prop (challenge catalogue and checkout, live rule dashboard, payouts, certificates).
// "Kalks", "Kalks Prop", "Kalks Trader", "Kalks-Live", "USDT", "New York" and "17:00" stay as they are.
// Titles shown in tall uppercase display type are marked "display": keep them short.
const mobileProp: NsMessages<"mobileProp"> = {
  // Prop home
  "home.eyebrow": "Kalks Prop",
  // display
  "home.title": "फ़ंडेड बनें",
  "home.subtitle": "चैलेंज पास करें, फ़ंडेड अकाउंट पाएँ और मुनाफ़े का {split}% तक रखें। हर प्रॉप अकाउंट सिम्युलेटेड है।",
  "home.subtitleNoSplit": "चैलेंज पास करें, फ़ंडेड अकाउंट पाएँ और मुनाफ़े का हिस्सा रखें। हर प्रॉप अकाउंट सिम्युलेटेड है।",
  "home.payouts": "पेआउट",
  "home.payoutsReady": "{amount} तैयार",
  "home.payoutsNone": "अभी कोई तैयार नहीं",
  "home.certificates": "सर्टिफ़िकेट",
  "home.certCount": { one: "{count} मिला", other: "{count} मिले" },
  "home.mine": "आपके चैलेंज",
  "home.past": "पिछले चैलेंज",
  "home.showAll": "सभी {count} दिखाएँ",
  "home.yourCertificates": "आपके सर्टिफ़िकेट",
  "home.plans": "अपना चैलेंज चुनें",
  "home.newChallenge": "नया चैलेंज शुरू करें",
  // display
  "home.emptyTitle": "अभी कोई चैलेंज नहीं",
  "home.emptyBody": "नए चैलेंज प्लान तैयार किए जा रहे हैं। कृपया जल्द फिर से देखें।",
  "home.mineError": "आपके चैलेंज लोड नहीं हो सके।",
  "home.plansError": "चैलेंज प्लान लोड नहीं हो सके।",

  // How it works (numbered 01–04 on the Prop home)
  "how.title": "यह कैसे काम करता है",
  "how.1.title": "प्लान चुनें",
  "how.1.body": "मॉडल और अकाउंट साइज़ चुनें। फ़ीस आपके USDT वॉलेट से एक बार कटती है।",
  "how.2.title": "टारगेट हासिल करें",
  "how.2.body": "न्यूनतम ट्रेडिंग दिनों में, दैनिक घाटा और ड्रॉडाउन सीमाओं के भीतर रहते हुए प्रॉफ़िट टारगेट तक पहुँचें।",
  "how.3.title": "फ़ंडेड बनें",
  "how.3.body": "पास होते ही आपका फ़ंडेड अकाउंट अपने-आप खुल जाता है, साथ में शेयर करने के लिए एक सर्टिफ़िकेट।",
  "how.4.title": "भुगतान पाएँ",
  "how.4.body": "हर पेआउट चक्र में मुनाफ़े के अपने हिस्से का अपने USDT वॉलेट में अनुरोध करें।",
  "how.enforce": "सीमाएँ सर्वर पर हर सेकंड इक्विटी पर जाँची जाती हैं। दैनिक घाटे के 50, 75 और 90% पर आपको चेतावनी मिलती है; उल्लंघन होने पर सभी पोज़िशन बंद हो जाती हैं और चैलेंज समाप्त हो जाता है।",

  // Plan models
  "type.oneStep": "1-स्टेप",
  "type.twoStep": "2-स्टेप",
  "type.instant": "इंस्टेंट",
  "typeText.oneStep": "एक इवैल्यूएशन फ़ेज़। टारगेट हासिल करें, सीमाओं का पालन करें, फ़ंडेड बनें।",
  "typeText.twoStep": "कम टारगेट और व्यापक सीमाओं वाले दो इवैल्यूएशन फ़ेज़।",
  "typeText.instant": "कोई इवैल्यूएशन नहीं। कड़ी सीमाओं के साथ सीधे फ़ंडेड अकाउंट पर शुरू करें।",

  // Plan card
  "plan.refundable": "फ़ीस रिफ़ंड",
  "plan.fee": "फ़ीस",
  "plan.account": "अकाउंट",
  "plan.leverage": "लीवरेज 1:{n}",
  "plan.target": "टारगेट",
  "plan.dailyLoss": "दैनिक घाटा",
  "plan.maxDD": "अधिकतम ड्रॉडाउन",
  "plan.static": "स्टैटिक",
  "plan.trailing": "ट्रेलिंग",
  "plan.start": "शुरू करें · {fee}",

  // Checkout
  "checkout.eyebrow": "चेकआउट",
  "checkout.fee": "एक बार की फ़ीस",
  "checkout.chargedRefund": "आपके USDT वॉलेट से भुगतान। आपके पहले पेआउट के साथ रिफ़ंड।",
  "checkout.chargedNoRefund": "आपके USDT वॉलेट से भुगतान। नॉन-रिफ़ंडेबल।",
  "checkout.walletBalance": "वॉलेट बैलेंस: {balance} USDT",
  "checkout.shortTitle": "आपके वॉलेट में फ़ीस के लिए कम राशि है",
  "checkout.short": "आपके पास {balance} USDT हैं। इस चैलेंज का भुगतान करने के लिए {missing} USDT और जमा करें।",
  "checkout.rules": "नियम",
  "checkout.limitsNote": "सीमाएँ शुरुआती बैलेंस का प्रतिशत हैं। दैनिक घाटा या अधिकतम ड्रॉडाउन का उल्लंघन करने पर अकाउंट विफल हो जाता है और सभी पोज़िशन मार्केट पर बंद हो जाती हैं। ट्रेडिंग दिन 17:00 New York पर रीसेट होता है।",
  "checkout.agree": "मैंने नियम पढ़ लिए हैं और समझता/समझती हूँ कि अकाउंट सिम्युलेटेड है और घाटा सीमा का उल्लंघन होने पर अपने-आप विफल हो जाता है।",
  "checkout.pay": "{fee} भुगतान करें",
  "checkout.retry": "फिर से कोशिश करें · {fee}",
  "checkout.paying": "भुगतान हो रहा है…",
  "checkout.goToMine": "मेरे चैलेंज देखें",
  // display
  "checkout.readyTitle": "आप शामिल हो गए",
  "checkout.readyBody": "आपके USDT वॉलेट से {fee} का भुगतान हुआ और आपका {size} {phase} अकाउंट खुल गया है। नियम अब से लागू हैं।",
  "checkout.savePasswords": "ये पासवर्ड अभी सेव करें: ये केवल एक बार दिखाए जाते हैं और हम इन्हें स्टोर नहीं करते। आप इनके बिना भी ऐप से इस अकाउंट पर हमेशा ट्रेड कर सकते हैं।",
  "checkout.passwordsShown": "ट्रेडिंग पासवर्ड इस खरीद की पहली पुष्टि के समय दिखाए गए थे। आप इनके बिना भी ऐप से इस अकाउंट पर ट्रेड कर सकते हैं।",
  "checkout.viewChallenge": "चैलेंज देखें",
  "checkout.readOnly": "यह सेशन चैलेंज नहीं खरीद सकता।",

  // Account credentials
  "cred.login": "लॉगिन",
  "cred.server": "सर्वर",
  "cred.password": "ट्रेडिंग पासवर्ड",
  "cred.investorPassword": "इन्वेस्टर पासवर्ड (केवल पढ़ने के लिए)",
  "cred.show": "पासवर्ड दिखाएँ",
  "cred.hide": "पासवर्ड छिपाएँ",
  copied: "{what} कॉपी हो गया",
  "a11y.copy": "{what} कॉपी करें",

  // Challenge statuses
  "status.pendingPayment": "भुगतान की प्रतीक्षा",
  "status.provisioning": "अकाउंट खुल रहा है",
  "status.active": "सक्रिय",
  "status.funded": "फ़ंडेड",
  "status.failed": "विफल",
  "status.closed": "बंद",
  "status.paymentFailed": "भुगतान विफल",
  // {phase} is the phase name from the plan, e.g. "Phase 2"
  "stage.active": "{phase} · सक्रिय",
  "stage.failed": "{phase} · विफल",
  "phaseStatus.provisioning": "खुल रहा है",
  "phaseStatus.active": "लाइव",
  "phaseStatus.passed": "पास",
  "phaseStatus.failed": "विफल",
  "phaseStatus.closed": "बंद",

  // Challenge cards (Prop home)
  "card.target": "प्रॉफ़िट टारगेट",
  "card.profit": "मुनाफ़ा",
  "card.equity": "इक्विटी {amount}",
  "card.dailyLeft": "बचा दैनिक घाटा {amount}",
  "card.opening": "आपका ट्रेडिंग अकाउंट खोला जा रहा है। इसमें कुछ सेकंड लगते हैं।",

  // Dashboard
  "dash.equity": "इक्विटी",
  "dash.balance": "बैलेंस",
  "dash.floating": "फ़्लोटिंग",
  "dash.open": "खुली",
  "dash.sinceStart": "फ़ेज़ शुरू होने से",
  "dash.rules": "नियम",
  "dash.rulesTitle": "इस चैलेंज के नियम",
  // display
  "dash.notFound": "चैलेंज नहीं मिला",
  "dash.notFoundBody": "हो सकता है इसे किसी दूसरे लॉगिन से खोला गया हो।",
  "dash.backToProp": "प्रॉप पर वापस जाएँ",
  "live.live": "लाइव",
  "live.connecting": "कनेक्ट हो रहा है…",
  "live.offline": "ऑफ़लाइन",
  // {time}: date and time of the last rule check
  "live.updated": "{time} पर जाँचा गया",
  // {time}: when the phase ended
  "live.final": "अंतिम · {time}",

  // Rule names (gauges, the rule log)
  "rule.dailyLoss": "दैनिक घाटा",
  "rule.maxDrawdown": "अधिकतम ड्रॉडाउन",
  "rule.profitTarget": "प्रॉफ़िट टारगेट",
  "rule.tradingDays": "ट्रेडिंग दिन",
  "rule.timeLimit": "समय सीमा",
  "rule.weekendHolding": "वीकेंड होल्डिंग",
  "rule.newsWindow": "न्यूज़ विंडो",
  "rule.bannedStrategy": "प्रतिबंधित रणनीति",
  "rule.consistency": "कंसिस्टेंसी",
  "rule.riskDesk": "रिस्क डेस्क का फ़ैसला",
  "ruleState.ok": "प्रगति में",
  "ruleState.passed": "पूरा",
  "ruleState.failed": "उल्लंघन",
  "ruleState.off": "बंद",

  // Gauges
  "target.ofTarget": "टारगेट का",
  "target.of": "टारगेट {amount} ({pct}%)",
  "target.left": "{amount} बाकी",
  "target.reachedBy": "हासिल, {amount} ज़्यादा",
  "limit.left": "{amount} बाकी",
  "limit.breachAt": "{amount} पर उल्लंघन",
  days: { one: "{count} दिन", other: "{count} दिन" },
  "days.of": "{min} में से {v}",
  "days.count": { one: "{count} दिन", other: "{count} दिन" },
  "days.met": "न्यूनतम पूरा",
  "days.toGo": { one: "{count} और बाकी", other: "{count} और बाकी" },
  "days.noMinimum": "कोई न्यूनतम नहीं",
  "time.left": "{d}दि {h}घं बाकी",
  "time.deadline": "{date} को समाप्त",
  "consistency.rule": "सबसे अच्छा दिन ≤ मुनाफ़े का {pct}%",
  "consistency.noProfit": "अभी कोई मुनाफ़ा नहीं",
  "reset.title": "दैनिक घाटा रीसेट होने में",
  "reset.note": "17:00 New York, हर ट्रेडिंग दिन",

  // Funded account: payout window ring
  "payoutHero.title": "अगला पेआउट",
  "payoutHero.share": "अब तक आपका हिस्सा",
  // display
  "payoutHero.open": "खुला",
  // display
  "payoutHero.ready": "तैयार",
  // display
  "payoutHero.days": { one: "{count} दिन", other: "{count} दिन" },
  "payoutHero.eligible": "आपके {split}% स्प्लिट पर अभी योग्य।",
  "payoutHero.opens": "पेआउट विंडो {date} को खुलेगी।",
  "payoutHero.later": "योग्य मुनाफ़ा होने पर पेआउट का अनुरोध करें।",

  // Big states (titles are display)
  "hero.opening.title": "आपका अकाउंट खुल रहा है",
  "hero.opening.body": "भुगतान की पुष्टि हो गई है और आपका ट्रेडिंग अकाउंट सेट किया जा रहा है। यह पेज अपने-आप अपडेट होता है।",
  "hero.closed.title": "चैलेंज बंद",
  "hero.closed.body": "इस चैलेंज का ट्रेडिंग अकाउंट नहीं खुल सका, इसलिए चैलेंज बंद कर दिया गया और फ़ीस आपके USDT वॉलेट में रिफ़ंड कर दी गई। कोई सवाल हो तो सहायता टीम से संपर्क करें।",
  // {reason} is the prop service's reason, in English
  "hero.closed.reason": "{reason}। फ़ीस आपके USDT वॉलेट में रिफ़ंड कर दी गई।",
  "hero.failed.title": "{phase} विफल",
  "hero.failed.on": "{date} को समाप्त",
  // {reason} is the breach reason from the risk engine
  "hero.failed.body": "{reason}। सभी पोज़िशन बंद कर दी गईं और अकाउंट डिसेबल है।",
  "hero.failed.ruleBreached": "एक नियम का उल्लंघन हुआ",
  // {rule} is a rule name, e.g. "Daily loss"
  "hero.failed.rule": "{rule}: सीमा का उल्लंघन",
  "hero.failed.new": "नया चैलेंज शुरू करें",
  "hero.passed.title": "{phase} पास",
  "hero.passed.on": "{date} को पास हुआ।",
  "hero.passed.next": "आपका {phase} अकाउंट खुल गया है।",
  "hero.passed.nextLogin": "आपका {phase} अकाउंट खुल गया है (#{login})।",
  "hero.passed.opening": "आपका अगला अकाउंट खोला जा रहा है।",
  "hero.passed.certificate": "सर्टिफ़िकेट देखें",
  "hero.passed.goNext": "{phase} पर जाएँ",
  "hero.funded.title": "फ़ंडेड",
  "hero.funded.body": "फ़ंडेड अकाउंट पर ट्रेड करें और मुनाफ़े का {split}% पेआउट के रूप में पाएँ।",
  "hero.funded.certificate": "अपना फ़ंडेड सर्टिफ़िकेट देखें",

  // Warnings while trading
  "warn.lossUsed": "आज की घाटा सीमा का {pct}% इस्तेमाल हुआ",
  "warn.lossUsedBody": "इक्विटी {floor} या उससे नीचे जाने पर अकाउंट विफल हो जाता है और सभी पोज़िशन बंद हो जाती हैं। आज बाकी: {left}।",
  "warn.weekend": "वीकेंड क्लोज़",
  "warn.weekendBody": "यह प्लान वीकेंड पर होल्ड करने की अनुमति नहीं देता: खुली पोज़िशन शुक्रवार 16:45 New York पर बंद हो जाती हैं।",

  // Actions
  "action.openTrade": "ट्रेड में खोलें",
  "action.trade": "ट्रेड करें",
  "action.tradeBlocked": "केवल सक्रिय चैलेंज के लाइव अकाउंट पर ट्रेड किया जा सकता है।",
  "action.payouts": "पेआउट",
  "action.support": "सहायता से संपर्क करें",

  // Equity chart
  "chart.title": "इक्विटी कर्व",
  "chart.start": "शुरुआत",
  "chart.target": "टारगेट",
  "chart.ddFloor": "अधिकतम ड्रॉडाउन",
  "chart.dailyFloor": "दैनिक घाटा",
  "chart.now": "अभी",
  "chart.empty": "कर्व ट्रेडिंग के पहले कुछ मिनटों के बाद दिखता है।",

  // Trading stats
  "stats.title": "ट्रेडिंग आँकड़े",
  "stats.trades": "ट्रेड",
  "stats.winRate": "विन रेट",
  "stats.profitFactor": "प्रॉफ़िट फ़ैक्टर",
  "stats.avgWin": "औसत जीत",
  "stats.avgLoss": "औसत घाटा",
  "stats.lots": "लॉट",
  "stats.bestDay": "सबसे अच्छा दिन {date}: {amount}",

  // Rule log
  "events.title": "नियम लॉग",
  "events.empty": "कोई चेतावनी या उल्लंघन नहीं। ऐसे ही बनाए रखें।",
  "events.equity": "इक्विटी {amount}",
  "events.limit": "सीमा {amount}",
  "severity.breach": "उल्लंघन",
  "severity.violation": "नियम-भंग",
  "severity.warning": "चेतावनी",
  "severity.info": "जानकारी",

  // Closed trades
  "trades.title": "बंद ट्रेड",
  "trades.all": "सभी {count}",
  "trades.count": { one: "{count} बंद ट्रेड", other: "{count} बंद ट्रेड" },
  "trades.empty": "अभी कोई बंद ट्रेड नहीं।",
  "trades.buy": "बाय",
  "trades.sell": "सेल",
  // Compact durations: s = seconds, m = minutes, h = hours, d = days
  "duration.s": "{s}से",
  "duration.ms": "{m}मि {s}से",
  "duration.hm": "{h}घं {m}मि",
  "duration.dh": "{d}दि {h}घं",

  // Account details
  "account.title": "अकाउंट",
  "account.split": "आपका स्प्लिट",
  "account.initial": "शुरुआती बैलेंस",
  "account.started": "फ़ेज़ शुरू हुआ",
  "account.ended": "समाप्त",
  "account.deadline": "अंतिम तिथि",
  "account.passwordNote": "ट्रेडिंग पासवर्ड खरीद के समय एक बार दिखाए गए थे। “ट्रेड में खोलें” आपको इनके बिना इस अकाउंट में साइन इन करता है।",

  // Payouts
  // display
  "payouts.title": "पेआउट",
  "payouts.available": "अभी उपलब्ध",
  "payouts.eligibleCount": { one: "{count} में से {eligible} फ़ंडेड अकाउंट योग्य", other: "{count} में से {eligible} फ़ंडेड अकाउंट योग्य" },
  "payouts.requests": { one: "{count} अनुरोध", other: "{count} अनुरोध" },
  "payouts.count": { one: "{count} पेआउट", other: "{count} पेआउट" },
  "payouts.paidToDate": "अब तक भुगतान",
  "payouts.funded": "फ़ंडेड अकाउंट",
  // display
  "payouts.account": "{size} फ़ंडेड",
  "payouts.quote": "पेआउट अनुमान",
  "payouts.eligibleNow": "अभी योग्य",
  "payouts.notYet": "अभी नहीं",
  "payouts.toWallet": "आपके वॉलेट में",
  "payouts.yourSplit": "आपका स्प्लिट",
  "payouts.firmShare": "फ़र्म का हिस्सा",
  "payouts.alreadyRefunded": "पहले ही रिफ़ंड",
  "payouts.withFirst": "पहले पेआउट के साथ",
  "payouts.opens": "{date} को खुलेगा।",
  "payouts.minimum": "न्यूनतम {amount}।",
  "payouts.kycNote": "यह पेआउट माँगने के लिए अपनी पहचान वेरिफ़ाई करें।",
  "payouts.kycPendingNote": "पहचान वेरिफ़िकेशन स्वीकृत होते ही आप यह पेआउट माँग सकेंगे।",
  "payouts.readOnly": "यह सेशन पेआउट का अनुरोध नहीं कर सकता।",
  "payouts.request": "पेआउट का अनुरोध करें",
  // Opens the account's live rule dashboard; short: it shares a row with Trade
  "payouts.dashboard": "नियम",
  "payouts.history": "हिस्ट्री",
  "payouts.historyEmpty": "अभी कोई पेआउट नहीं।",
  // display
  "payouts.emptyTitle": "अभी कोई फ़ंडेड अकाउंट नहीं",
  "payouts.emptyBody": "फ़ंडेड अकाउंट पाने के लिए चैलेंज पास करें। योग्य मुनाफ़ा होने पर यहाँ पेआउट का अनुरोध करें।",
  "payouts.emptyAction": "फ़ंडेड बनें",
  "payoutStatus.pending": "समीक्षा में",
  "payoutStatus.approved": "स्वीकृत",
  "payoutStatus.paid": "भुगतान हुआ",
  "payoutStatus.rejected": "अस्वीकृत",
  "payoutStatus.failed": "विफल",
  "split.title": "प्रॉफ़िट स्प्लिट और स्केलिंग",
  "split.upTo": "स्केलिंग के साथ {pct}% तक",
  "split.cycle": "पेआउट",
  // {days} e.g. "14 days"
  "split.first": "{days} के बाद पहला",
  "split.firstNow": "पहले दिन से",
  // {months} e.g. "4 months"; {cap} e.g. "$2,000,000"
  "scaling.text": "{months} में {profit}% मुनाफ़ा कमाएँ और अकाउंट {increase}% बढ़ेगा, {cap} तक।",
  "scaling.none": "यह प्लान अकाउंट को स्केल नहीं करता।",
  months: { one: "{count} महीना", other: "{count} महीने" },

  // Payout request sheet
  "request.eyebrow": "पेआउट अनुरोध",
  "request.profit": "अकाउंट पर मुनाफ़ा",
  "request.share": "आपका हिस्सा ({pct}%)",
  "request.feeRefund": "चैलेंज फ़ीस रिफ़ंड",
  "request.total": "आपके वॉलेट में कुल",
  "request.note": "पूरा मौजूदा मुनाफ़ा अभी ट्रेडिंग अकाउंट से निकाल लिया जाता है, ताकि समीक्षा के दौरान यह ट्रेडिंग में न गँवाया जाए। स्वीकृत होने पर आपका हिस्सा आपके USDT वॉलेट में क्रेडिट होता है; अनुरोध अस्वीकार होने पर मुनाफ़ा अकाउंट में वापस डाल दिया जाता है।",
  "request.submit": "{amount} का अनुरोध करें",
  "request.done": "पेआउट का अनुरोध किया गया",
  "request.doneBody": "स्वीकृत होने पर {amount} आपके USDT वॉलेट में जाएगा।",

  // Identity verification (payouts)
  "kyc.verified": "पहचान वेरिफ़ाइड: पेआउट स्वीकृत किए जा सकते हैं।",
  "kyc.pendingTitle": "वेरिफ़िकेशन समीक्षा में",
  "kyc.pendingText": "आपका वेरिफ़िकेशन समीक्षा में है। आपकी पहचान वेरिफ़ाई होते ही आप पेआउट का अनुरोध कर सकेंगे।",
  "kyc.requiredTitle": "अपनी पहचान वेरिफ़ाई करें",
  "kyc.requiredText": "पेआउट केवल वेरिफ़ाइड ट्रेडर को दिए जाते हैं। अपने पहले पेआउट से पहले वेरिफ़ाई करें।",
  "kyc.rejectedText": "आपका वेरिफ़िकेशन अस्वीकार कर दिया गया। पेआउट पाने के लिए इसे फिर से सबमिट करें।",

  // Why a payout can't be requested yet
  "blocker.notYetEligible": "पेआउट विंडो अभी खुली नहीं है।",
  "blocker.belowMinimum": "मुनाफ़ा न्यूनतम पेआउट से कम है।",
  "blocker.positionsOpen": "पेआउट का अनुरोध करने के लिए सभी खुली पोज़िशन बंद करें।",
  "blocker.payoutPending": "एक पेआउट पहले से समीक्षा में है।",
  "blocker.consistency": "कंसिस्टेंसी नियम पूरा नहीं हुआ: मुनाफ़े में आपके सबसे अच्छे दिन का हिस्सा बहुत बड़ा है।",

  // Certificates
  // display
  "certs.title": "सर्टिफ़िकेट",
  "certs.subtitle": "आपके पास किए हर फ़ेज़, हर फ़ंडेड अकाउंट और हर पेआउट पर एक सर्टिफ़िकेट मिलता है, जिसे कोई भी वेरिफ़ाई कर सकता है।",
  "certs.kind.pass": "फ़ेज़ पास",
  "certs.kind.funded": "फ़ंडेड ट्रेडर",
  "certs.kind.payout": "पेआउट",
  "certs.revoked": "रद्द",
  "certs.revokedBody": "यह सर्टिफ़िकेट Kalks द्वारा रद्द कर दिया गया है और अब मान्य नहीं है, इसलिए इसे शेयर नहीं किया जा सकता।",
  "certs.meta": "{plan} · {size} · {date}",
  "certs.number": "नं. {code}",
  "certs.shareImage": "इमेज शेयर करें",
  "certs.shareLink": "लिंक शेयर करें",
  "certs.copyLink": "लिंक कॉपी करें",
  "certs.linkCopied": "वेरिफ़ाई लिंक कॉपी हुआ",
  "certs.shareTitle": "मेरा Kalks Prop सर्टिफ़िकेट",
  "certs.shareMessage": "मेरा Kalks Prop सर्टिफ़िकेट। इसे यहाँ वेरिफ़ाई करें:",
  "certs.shareFailed": "सर्टिफ़िकेट शेयर नहीं हो सका। कृपया फिर से कोशिश करें।",
  "certs.shareUnavailable": "इस डिवाइस पर शेयर करना उपलब्ध नहीं है।",
  // display
  "certs.emptyTitle": "अभी कोई सर्टिफ़िकेट नहीं",
  "certs.emptyBody": "अपना पहला सर्टिफ़िकेट पाने के लिए कोई चैलेंज फ़ेज़ पास करें, एक सार्वजनिक लिंक के साथ जिसे कोई भी वेरिफ़ाई कर सकता है।",
  "certs.emptyAction": "चैलेंज देखें",

  // Rule words shared by the checkout and the rules sheet
  accountSize: "अकाउंट साइज़",
  profitSplit: "प्रॉफ़िट स्प्लिट",
  feeRefund: "फ़ीस रिफ़ंड",
  nonRefundable: "नॉन-रिफ़ंडेबल",
  leverage: "लीवरेज",
  none: "कोई नहीं",
  allowed: "अनुमति है",
  notAllowed: "अनुमति नहीं",
  noTimeLimit: "कोई समय सीमा नहीं",
  // {phase} is the phase name, e.g. "Phase 1"
  "rules.phaseTarget": "{phase} टारगेट",
  "rules.phaseMinDays": "{phase} न्यूनतम दिन",
  "rules.phaseTimeLimit": "{phase} समय सीमा",
  "rules.evaluation": "इवैल्यूएशन",
  "rules.evaluationNone": "कोई नहीं, पहले दिन से फ़ंडेड",
  "rules.dailyLoss": "दैनिक घाटा सीमा",
  "rules.dailyLossBalance": "{pct}% · {amount} · 17:00 New York पर बैलेंस से",
  "rules.dailyLossEquity": "{pct}% · {amount} · 17:00 New York पर बैलेंस और इक्विटी में से जो अधिक हो उससे",
  "rules.ddStatic": "{pct}% स्टैटिक",
  "rules.ddTrailing": "{pct}% ट्रेलिंग",
  "rules.ddLocks": "{dd}, शुरुआत पर लॉक",
  // ≤ = at most
  "rules.consistencyValue": "सबसे अच्छा दिन ≤ कुल मुनाफ़े का {pct}%",
  "rules.news": "न्यूज़ ट्रेडिंग",
  "rules.newsBlocked": "उच्च प्रभाव वाली न्यूज़ के ±{min} मिनट के भीतर नहीं",
  "rules.newsBlockedFails": "उच्च प्रभाव वाली न्यूज़ के ±{min} मिनट के भीतर नहीं (अकाउंट विफल हो जाता है)",
  "rules.weekendClosed": "शुक्रवार 16:45 New York पर पोज़िशन बंद",
  "rules.ea": "Expert Advisors",
  "rules.banned": "प्रतिबंधित रणनीतियाँ",
  "rules.splitScaling": "{split}%, {max}% तक बढ़ता है",
  "rules.firstPayout": "पहला पेआउट",
  // {freq} is a lower-case payout cycle, e.g. "weekly"
  "rules.firstPayoutValue": "{days} के बाद, फिर {freq} · न्यूनतम {min}",
  "rules.refunded": "पहले पेआउट के साथ रिफ़ंड",

  // Banned trading strategies
  "banned.hft": "हाई-फ़्रीक्वेंसी ट्रेडिंग",
  "banned.latencyArbitrage": "लेटेंसी आर्बिट्राज",
  "banned.tickScalping": "टिक स्कैल्पिंग",
  "banned.crossAccountCopying": "अकाउंट के बीच कॉपी करना",
  "banned.crossAccountHedging": "अकाउंट के बीच हेजिंग",
  "banned.martingale": "मार्टिंगेल",
  "banned.grid": "ग्रिड ट्रेडिंग",

  // Payout cycle, lower case: used inside sentences ("then weekly")
  "payoutFreq.weekly": "हर सप्ताह",
  "payoutFreq.biWeekly": "हर 2 सप्ताह",
  "payoutFreq.monthly": "हर महीने",
  "payoutFreq.onDemand": "मांग पर",

  // Errors (messages for the prop service's error codes)
  "errorLink.deposit": "जमा करें",
  "errorLink.verify": "पहचान वेरिफ़ाई करें",
  "error.insufficientFunds": "इस फ़ीस के लिए आपका USDT वॉलेट बैलेंस बहुत कम है। USDT जमा करें और फिर से कोशिश करें।",
  "error.kycRequired": "पेआउट का अनुरोध करने से पहले अपनी पहचान वेरिफ़ाई करें।",
  "error.paymentPending": "हम अभी वॉलेट भुगतान की पुष्टि नहीं कर सके। एक मिनट में फिर से कोशिश करें: आपसे दो बार शुल्क नहीं लिया जाएगा।",
  "error.paymentFailed": "वॉलेट भुगतान पूरा नहीं हुआ। आपसे कोई शुल्क नहीं लिया गया है।",
  "error.walletPending": "वॉलेट ने अभी पुष्टि नहीं की है। कृपया एक मिनट में फिर से कोशिश करें।",
  "error.walletRejected": "वॉलेट ने यह भुगतान अस्वीकार कर दिया। कृपया सहायता टीम से संपर्क करें।",
  "error.provisioning": "भुगतान प्राप्त हुआ। आपका ट्रेडिंग अकाउंट अभी खुल रहा है: यह एक मिनट के भीतर आपके चैलेंज में दिखेगा।",
  "error.planUnavailable": "यह प्लान या साइज़ अब उपलब्ध नहीं है। कृपया कोई दूसरा चुनें।",
  "error.notYetEligible": "यह अकाउंट अभी पेआउट के योग्य नहीं है।",
  "error.belowMinimum": "मुनाफ़ा न्यूनतम पेआउट राशि से कम है।",
  "error.positionsOpen": "पेआउट का अनुरोध करने से पहले सभी खुली पोज़िशन बंद करें।",
  "error.payoutPending": "इस अकाउंट का एक पेआउट पहले से समीक्षा में है।",
  "error.consistency": "कंसिस्टेंसी नियम अभी पूरा नहीं हुआ: मुनाफ़े में आपके सबसे अच्छे दिन का हिस्सा बहुत बड़ा है।",
  "error.notFunded": "पेआउट केवल फ़ंडेड अकाउंट पर उपलब्ध हैं।",
  "error.accountUnavailable": "हम इस चैलेंज का ट्रेडिंग अकाउंट नहीं खोल सके, इसलिए फ़ीस आपके USDT वॉलेट में रिफ़ंड कर दी गई। अगर ऐसा बार-बार हो, तो सहायता टीम से संपर्क करें।",
  "error.idempotencyConflict": "यह चेकआउट पहले ही किसी दूसरी खरीद के लिए इस्तेमाल हो चुका है। इसे बंद करें और फिर से शुरू करें।",
  "error.notActive": "यह चैलेंज सक्रिय नहीं है।",
  "error.accountLimit": "आप प्रॉप अकाउंट की अधिकतम संख्या तक पहुँच गए हैं। सीमा बढ़ाने के लिए सहायता टीम से संपर्क करें।",
  "error.staffReadOnly": "यह केवल-देखने वाला स्टाफ़ सेशन है। बदलाव की अनुमति नहीं है।",
  "error.engine": "ट्रेडिंग सर्वर ने जवाब नहीं दिया। कृपया थोड़ी देर में फिर से कोशिश करें।",
  "error.generic": "कुछ गलत हो गया। कृपया फिर से कोशिश करें।",
  // display
  "load.title": "प्रॉप उपलब्ध नहीं",
  "load.body": "हम प्रॉप सेवा से कनेक्ट नहीं हो सके। आपके अकाउंट सुरक्षित हैं; कृपया थोड़ी देर में फिर से कोशिश करें।",
};
export default mobileProp;
