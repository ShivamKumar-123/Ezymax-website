import type { NsMessages } from "../../core";

// Kalks mobile app: Algo (/algo): strategies running 24/7 on the server (deployments), the kill switch, backtest
// reports, the strategy marketplace, API keys and webhooks.
// Kept as they are: Kalks, Algo, API, USDT, USD, indicator names (EMA, RSI, MACD, ATR, CCI, ADX, DI…), symbols
// (EURUSD, XAUUSD), timeframes (M15, H1, H4), "R" (a multiple of the stop distance), DD, SL / TP.
// Terms follow the `developer` namespace: deployment = التشغيل, deploy = تشغيل, kill switch = مفتاح الإيقاف الطارئ,
// kill = إنهاء, backtest = الاختبار التاريخي, bar = شمعة, clone = استنساخ. Pips = "بيب" and points = "نقطة".
// Titles marked (display) are shown in tall display type: keep them short.
const mobileAlgo: NsMessages<"mobileAlgo"> = {
  never: "أبدًا",
  // {n} days, compact
  days: "{n} ي",
  lot: "لوت",
  // How long a trade was held: د = minutes, س = hours, ي = days (compact)
  "dur.m": "{m} د",
  "dur.h": "{h} س",
  "dur.hm": "{h} س {m} د",
  "dur.d": "{d} ي",
  "dur.dh": "{d} ي {h} س",
  nTrades: {
    zero: "لا صفقات",
    one: "صفقة واحدة",
    two: "صفقتان",
    few: "{count} صفقات",
    many: "{count} صفقة",
    other: "{count} صفقة",
  },
  readOnly: "يمكن لتسجيل الدخول هذا عرض الاستراتيجيات، لكن لا يمكنه تغيير أي شيء.",

  /* ---------------------------------------------------------------- */
  /* Screen states                                                     */
  /* ---------------------------------------------------------------- */
  "state.unavailable.title": "Algo غير متاح", // (display)
  "state.unavailable.text": "تعذّر الوصول إلى خدمة الاستراتيجيات. تستمر استراتيجياتك في العمل على الخادم؛ يرجى المحاولة مرة أخرى بعد لحظات.",
  "state.disabled.title": "غير متاح", // (display)
  "state.disabled.text": "هذه الميزة غير متاحة لحسابك.",
  "state.notFound.title": "غير موجود", // (display)
  "state.notFound.text": "ربما أُزيل أو أن الرابط غير صحيح.",
  "state.back": "العودة إلى Algo",

  /* ---------------------------------------------------------------- */
  /* Server errors (codes of the strategy service)                     */
  /* ---------------------------------------------------------------- */
  "error.haltedMine": "مفتاح الإيقاف الطارئ الخاص بك مفعّل. حرّره من شاشة Algo قبل تشغيل الاستراتيجيات مجددًا.",
  "error.haltedPlatform": "أوقف الوسيط التداول الآلي مؤقتًا حاليًا. يرجى المحاولة لاحقًا.",
  // {n} = the most strategies that can run at once
  "error.limitRunning": "الحد الأقصى للاستراتيجيات العاملة في الوقت نفسه هو {n}. أوقف إحداها أولًا.",
  "error.accountStatus": "لا يمكن لهذا الحساب التداول حاليًا.",
  "error.alreadyRunning": "هذا الإصدار قيد التشغيل بالفعل على ذلك الحساب.",
  "error.invalidStrategy": "أصلح أخطاء الاستراتيجية أولًا (في منطقة العملاء أو عبر المتداول الذكي).",
  "error.state": "تغيّرت حالتها بالفعل. اسحب للأسفل لعرض حالتها الحالية.",
  "error.queueFull": "لديك بالفعل 3 اختبارات تاريخية في قائمة الانتظار أو قيد التشغيل. انتظر حتى ينتهي أحدها.",
  "error.dailyLimit": "بلغت الحد اليومي للاختبارات التاريخية ({n}).",
  "error.ownListing": "لا يمكنك الاشتراك في استراتيجيتك الخاصة.",
  "error.subscribed": "أنت مشترك في هذه الاستراتيجية بالفعل.",
  "error.cloneNotAllowed": "لا يسمح المؤلف بالاستنساخ؛ انسخها إلى حسابك بدلًا من ذلك.",
  // {amount} in USDT
  "error.insufficientFunds": "رصيد محفظتك أقل من {amount} USDT. أودِع USDT للاشتراك.",
  "error.insufficientFundsPlain": "رصيد محفظتك غير كافٍ. أودِع USDT للاشتراك.",
  "error.inactive": "لم يعد هذا الاشتراك نشطًا.",
  "error.archiveRunning": "أوقف عمليات تشغيل هذه الاستراتيجية قبل أرشفتها.",
  "error.archived": "هذه الاستراتيجية مؤرشفة.",
  "error.finished": "انتهى هذا الاختبار التاريخي بالفعل.",
  "error.revoked": "تم إلغاء هذا المفتاح بالفعل.",
  "error.notFound": "لم يعد موجودًا.",
  // {tf} = timeframe (H1), {days} = number of days
  "error.rangeTooLong": "يمكن أن تغطي الاختبارات التاريخية على {tf} ما يصل إلى {days} يومًا. اختر فترة أقصر.",
  "error.balanceRange": "يجب أن يكون الرصيد الابتدائي بين 100 و10,000,000.",
  "error.dates": "يجب أن يكون تاريخ البداية قبل تاريخ النهاية.",

  /* ---------------------------------------------------------------- */
  /* Home                                                              */
  /* ---------------------------------------------------------------- */
  "home.eyebrow": "التداول الآلي",
  "home.title": "Algo", // (display)
  "home.heroEyebrow": "قيد التشغيل الآن",
  "home.heroRunning": {
    zero: "استراتيجية تتداول على مدار الساعة على الخادم",
    one: "استراتيجية تتداول على مدار الساعة على الخادم",
    two: "استراتيجيتان تتداولان على مدار الساعة على الخادم",
    few: "استراتيجيات تتداول على مدار الساعة على الخادم",
    many: "استراتيجية تتداول على مدار الساعة على الخادم",
    other: "استراتيجية تتداول على مدار الساعة على الخادم",
  },
  "home.heroRealized": "الربح/الخسارة المحققة",
  "home.heroOpen": "مفتوحة الآن",
  // closed trades so far
  "home.heroTrades": "الصفقات",
  "home.qaAi": "إنشاء بالذكاء الاصطناعي",
  "home.qaAiHint": "صِف فكرة واحصل على قواعد دقيقة",
  "home.qaMarket": "سوق الاستراتيجيات",
  "home.qaMarketHint": "انسخ استراتيجيات موثّقة",
  "home.qaKeys": "مفاتيح API وWebhooks",
  "home.qaKeysHint": "الاستخدام والإلغاء وأحدث التنبيهات",
  "home.running": "عمليات التشغيل", // (display)
  "home.runningSub": {
    zero: "لا شيء قيد التشغيل حاليًا",
    one: "واحدة قيد التشغيل",
    two: "اثنتان قيد التشغيل",
    few: "{count} قيد التشغيل",
    many: "{count} قيد التشغيل",
    other: "{count} قيد التشغيل",
  },
  // {n} = count shown on the filter pill
  "home.filterActive": "النشطة · {n}",
  "home.filterAll": "الكل · {n}",
  "home.strategies": "استراتيجياتي", // (display)
  "home.strategiesSub": {
    zero: "لا شيء محفوظ بعد",
    one: "واحدة محفوظة",
    two: "اثنتان محفوظتان",
    few: "{count} محفوظة",
    many: "{count} محفوظة",
    other: "{count} محفوظة",
  },
  "home.newWithAi": "جديدة بالذكاء الاصطناعي",
  "home.backtests": "الاختبارات التاريخية", // (display)
  "home.backtestsSub": "أحدث التشغيلات، الأحدث أولًا",
  "home.emptyDeps": "لم يُشغَّل شيء بعد. افتح إحدى استراتيجياتك أدناه وشغّلها على حساب تجريبي أولًا.",
  "home.emptyActive": "لا شيء قيد التشغيل حاليًا. الاستراتيجيات المتوقفة ضمن «الكل».",
  "home.showAll": "عرض الكل",
  "home.emptyStrats": "لا توجد استراتيجية خاصة بك بعد. صِف فكرتك للمتداول الذكي لتتحول إلى قواعد دقيقة يمكنك اختبارها.",
  "home.browseMarket": "تصفح سوق الاستراتيجيات",
  "home.emptyBts": "لا اختبارات تاريخية بعد. افتح استراتيجية وشغّل اختبارًا على سجل أسعار حقيقي.",
  "home.startEyebrow": "ابدأ",
  "home.startTitle": "شغّل استراتيجية", // (display)
  "home.step1": "صِف فكرتك للمتداول الذكي: تتحول إلى قواعد دقيقة يمكنك قراءتها وتعديلها.",
  "home.step2": "اختبر القواعد على سجل أسعار حقيقي، بتكاليف حسابك.",
  "home.step3": "شغّلها على مدار الساعة على حساب تجريبي أولًا. أوقفها مؤقتًا أو نهائيًا أو أنهِها في أي وقت.",
  "home.footnote": "تعمل الاستراتيجيات على خوادم Kalks على مدار الساعة، على الشموع المغلقة، مع فحوصات الأوامر نفسها المطبقة على التداول اليدوي: الهامش وساعات السوق وحدودك. أنشئ الاستراتيجيات وعدّلها عبر المتداول الذكي أو في منطقة العملاء.",
  "home.openWeb": "فتح منشئ الاستراتيجيات على الويب",

  /* ---------------------------------------------------------------- */
  /* Kill switch (account-wide)                                        */
  /* ---------------------------------------------------------------- */
  "kill.cardTitle": "مفتاح الإيقاف الطارئ",
  "kill.cardBody": "أوقف كل الاستراتيجيات دفعة واحدة واحظر أوامر Webhook وAPI.",
  "kill.stopAll": "إيقاف الكل",
  "kill.onTitle": "مفتاح الإيقاف الطارئ مفعّل",
  // {at} = date and time
  "kill.onSince": "منذ {at}. الاستراتيجيات متوقفة؛ وأوامر Webhook وAPI محظورة.",
  "kill.onBody": "الاستراتيجيات متوقفة؛ وأوامر Webhook وAPI محظورة.",
  "kill.release": "تحرير",
  "kill.title": "إيقاف كل شيء؟", // (display)
  "kill.body": {
    zero: "تتوقف كل الاستراتيجيات فورًا، وتُحظر أوامر Webhook وAPI حتى تحرر المفتاح.",
    one: "تتوقف الاستراتيجية العاملة فورًا، وتُحظر أوامر Webhook وAPI حتى تحرر المفتاح.",
    two: "تتوقف الاستراتيجيتان العاملتان فورًا، وتُحظر أوامر Webhook وAPI حتى تحرر المفتاح.",
    few: "تتوقف الاستراتيجيات العاملة ({count}) فورًا، وتُحظر أوامر Webhook وAPI حتى تحرر المفتاح.",
    many: "تتوقف الاستراتيجيات العاملة ({count}) فورًا، وتُحظر أوامر Webhook وAPI حتى تحرر المفتاح.",
    other: "تتوقف الاستراتيجيات العاملة ({count}) فورًا، وتُحظر أوامر Webhook وAPI حتى تحرر المفتاح.",
  },
  "kill.alsoClose": "إغلاق صفقاتها أيضًا",
  "kill.alsoCloseHint": "يغلق بسعر السوق كل صفقة فتحتها استراتيجية أو Webhook أو API على جميع حساباتك. تبقى صفقاتك اليدوية مفتوحة.",
  "kill.confirm": "إيقاف الكل الآن",
  "kill.doneTitle": "توقف كل شيء", // (display)
  "kill.stopped": "الاستراتيجيات المتوقفة",
  "kill.doneBody": "يبقى مفتاح الإيقاف الطارئ مفعّلًا حتى تحرره. لا تعود الاستراتيجيات المتوقفة إلى العمل من تلقاء نفسها.",
  "kill.releaseTitle": "تحرير مفتاح الإيقاف الطارئ؟", // (display)
  "kill.releaseBody": "يُسمح بأوامر Webhook وAPI مجددًا. تبقى الاستراتيجيات المتوقفة متوقفة: شغّلها مجددًا عندما تكون مستعدًا.",
  "kill.releasedTitle": "تم تحرير المفتاح", // (display)
  "kill.releasedBody": "يُسمح بأوامر Webhook وAPI مجددًا. شغّل استراتيجية لبدء عملها.",
  "kill.globalTitle": "التداول الآلي متوقف مؤقتًا",
  "kill.globalBody": "أوقف الوسيط مؤقتًا كل الاستراتيجيات وأوامر Webhook وAPI. تحتفظ الصفقات المفتوحة بأوامر الإيقاف الخاصة بها.",

  /* ---------------------------------------------------------------- */
  /* Deployment statuses, controls                                     */
  /* ---------------------------------------------------------------- */
  "dep.status.running": "قيد التشغيل",
  "dep.status.paused": "متوقفة مؤقتًا",
  "dep.status.stopped": "متوقفة",
  "dep.status.killed": "أُنهيت",
  "dep.status.error": "خطأ",
  "dep.realized": "الربح/الخسارة المحققة",
  "dep.trades": "الصفقات",
  "dep.winRate": "نسبة الربح",
  "dep.open": "المفتوحة",
  "dep.orders": "الأوامر",
  "dep.openNow": "مفتوحة",
  // {ago} = "منذ 5 دقائق"
  "dep.lastCheck": "آخر شمعة فُحصت {ago}",
  // {since} = start date
  "dep.lastCheckSince": "آخر شمعة فُحصت {ago} · قيد التشغيل منذ {since}",
  // {reason} = the service's reason, e.g. "stopped by the owner"
  "dep.stoppedWhy": "متوقفة: {reason}",
  "dep.stoppedTitle": "توقفت {at}",
  "dep.errorTitle": "واجهت الاستراتيجية خطأ",
  // {account} = "تجريبي 50000083"
  "dep.eyebrow": "التشغيل · {account}",
  "dep.marketplaceCopy": "نسخة من السوق",
  "dep.openStrategy": "فتح الاستراتيجية",
  "dep.openSubscription": "فتح اشتراكاتي",
  // {pct} = return %, {amount} = starting balance
  "dep.onStart": "{pct} على {amount}",
  "dep.curveA11y": "الرصيد يوميًا على مدى {days} يوم، المحقق {pnl}",
  "dep.tabLog": "السجل · {n}",
  "dep.tabTrades": "الصفقات · {n}",
  "dep.tabSetup": "الإعداد",
  "dep.noLogs": "لم يُسجَّل شيء بعد: أول شمعة مغلقة للإحماء.",
  "dep.noTrades": "لا صفقات بعد.",
  "dep.older": "تحميل الإدخالات الأقدم",
  "dep.logStart": "هذا هو الإدخال الأول.",
  "dep.rules": "القواعد",
  "dep.rulesHidden": "يحتفظ المؤلف بالقواعد بشكل خاص: تعمل الاستراتيجية على حسابك كما نُشرت.",
  "dep.lotMultiplier": "مضاعف اللوت",
  "dep.maxLots": "أقصى لوتات لكل أمر",
  "dep.maxOpen": "أقصى عدد للصفقات المفتوحة",
  "dep.dailyLoss": "حد الخسارة اليومية",
  "dep.started": "البداية",
  "dep.startBalance": "الرصيد الابتدائي",
  "dep.setupNote": "يشغّل كل تشغيل إصدارًا محددًا واحدًا: حفظ إصدار جديد لا يغيّره. شغّل الإصدار الجديد للتبديل إليه.",

  "ctl.pause": "إيقاف مؤقت",
  "ctl.resume": "استئناف",
  "ctl.stop": "إيقاف",
  "ctl.kill": "إنهاء",
  "ctl.killNow": "إنهاء الآن",
  "ctl.closePositions": "إغلاق الصفقات",
  "ctl.pauseTitle": "إيقافها مؤقتًا؟", // (display)
  "ctl.pauseBody": "لا صفقات جديدة. تحتفظ الصفقات المفتوحة بالإيقاف والهدف ونقطة التعادل. استأنفها متى شئت.",
  "ctl.resumeTitle": "استئنافها؟", // (display)
  "ctl.resumeBody": "تعود إلى التداول بدءًا من الشمعة المغلقة التالية.",
  "ctl.stopTitle": "إيقافها؟", // (display)
  "ctl.stopBody": "تتوقف نهائيًا: لا صفقات جديدة. لتشغيلها مجددًا، شغّلها من جديد.",
  "ctl.keepTitle": "إبقاء الصفقات مفتوحة",
  "ctl.keepText": {
    zero: "لا صفقات مفتوحة.",
    one: "تحتفظ الصفقة المفتوحة بالإيقاف والهدف؛ وتديرها بنفسك.",
    two: "تحتفظ الصفقتان المفتوحتان بالإيقاف والهدف؛ وتديرهما بنفسك.",
    few: "تحتفظ الصفقات المفتوحة ({count}) بالإيقاف والهدف؛ وتديرها بنفسك.",
    many: "تحتفظ الصفقات المفتوحة ({count}) بالإيقاف والهدف؛ وتديرها بنفسك.",
    other: "تحتفظ الصفقات المفتوحة ({count}) بالإيقاف والهدف؛ وتديرها بنفسك.",
  },
  "ctl.closeAllTitle": "إغلاقها الآن",
  "ctl.closeAllText": {
    zero: "لا صفقات مفتوحة.",
    one: "تُغلق الصفقة المفتوحة بسعر السوق.",
    two: "تُغلق الصفقتان المفتوحتان بسعر السوق.",
    few: "تُغلق الصفقات المفتوحة ({count}) بسعر السوق.",
    many: "تُغلق الصفقات المفتوحة ({count}) بسعر السوق.",
    other: "تُغلق الصفقات المفتوحة ({count}) بسعر السوق.",
  },
  "ctl.killTitle": "إنهاؤها الآن؟", // (display)
  "ctl.killBody": "يوقف مفتاح الإيقاف الطارئ هذه الاستراتيجية فورًا، ويغلق افتراضيًا الصفقات التي فتحتها بسعر السوق.",
  "ctl.killClose": "إغلاق صفقاتها",
  "ctl.killCloseHint": "بسعر السوق، الآن. أوقف هذا الخيار لإبقائها مفتوحة مع أوامر الإيقاف.",
  "ctl.closeTitle": "إغلاق صفقاتها؟", // (display)
  "ctl.closeBody": {
    zero: "لا صفقات فتحتها هذه الاستراتيجية. تستمر الاستراتيجية في العمل.",
    one: "تُغلق الصفقة التي فتحتها هذه الاستراتيجية بسعر السوق. تستمر الاستراتيجية في العمل.",
    two: "تُغلق الصفقتان اللتان فتحتهما هذه الاستراتيجية بسعر السوق. تستمر الاستراتيجية في العمل.",
    few: "تُغلق الصفقات التي فتحتها هذه الاستراتيجية ({count}) بسعر السوق. تستمر الاستراتيجية في العمل.",
    many: "تُغلق الصفقات التي فتحتها هذه الاستراتيجية ({count}) بسعر السوق. تستمر الاستراتيجية في العمل.",
    other: "تُغلق الصفقات التي فتحتها هذه الاستراتيجية ({count}) بسعر السوق. تستمر الاستراتيجية في العمل.",
  },
  "ctl.done.pause": "متوقفة مؤقتًا", // (display)
  "ctl.done.resume": "عادت إلى العمل", // (display)
  "ctl.done.stop": "متوقفة", // (display)
  "ctl.done.kill": "أُنهيت", // (display)
  "ctl.done.close": "أُغلقت الصفقات", // (display)
  "ctl.donePause": "لا صفقات جديدة حتى تستأنفها.",
  "ctl.doneResume": "تعود إلى التداول بدءًا من الشمعة المغلقة التالية.",
  "ctl.doneClosed": {
    zero: "لم تُغلق أي صفقة.",
    one: "تم إغلاق صفقة واحدة.",
    two: "تم إغلاق صفقتين.",
    few: "تم إغلاق {count} صفقات.",
    many: "تم إغلاق {count} صفقة.",
    other: "تم إغلاق {count} صفقة.",
  },
  "ctl.doneKept": "تبقى صفقاتها المفتوحة، إن وُجدت، مفتوحة مع الإيقاف والهدف.",
  "ctl.doneNothing": "لم يكن هناك شيء مفتوح لإغلاقه.",
  "ctl.closedLabel": "المغلقة",
  "ctl.failedLabel": "تعذّر إغلاقها",
  "ctl.failedTitle": {
    zero: "لا صفقات تعذّر إغلاقها",
    one: "تعذّر إغلاق صفقة واحدة",
    two: "تعذّر إغلاق صفقتين",
    few: "تعذّر إغلاق {count} صفقات",
    many: "تعذّر إغلاق {count} صفقة",
    other: "تعذّر إغلاق {count} صفقة",
  },
  "ctl.failedBody": "ربما يكون السوق مغلقًا. أغلقها من «الصفقات» عند استئناف التداول.",
  // stopping or killing a marketplace copy leaves its subscription (and a paid one's renewals) running
  "ctl.copyNote": "هذه نسخة من السوق: إيقافها لا ينهي الاشتراك. لإيقاف الدفع، ألغِ الاشتراك من السوق ← الاشتراكات.",

  /* ---------------------------------------------------------------- */
  /* Strategy                                                          */
  /* ---------------------------------------------------------------- */
  // {version} = version number
  "strat.eyebrow": "الاستراتيجية · v{version}",
  "strat.runningN": {
    zero: "{count} قيد التشغيل",
    one: "قيد التشغيل",
    two: "{count} قيد التشغيل",
    few: "{count} قيد التشغيل",
    many: "{count} قيد التشغيل",
    other: "{count} قيد التشغيل",
  },
  "strat.draft": "مسودة",
  "strat.ready": "جاهزة",
  "strat.errors": {
    zero: "لا أخطاء",
    one: "خطأ واحد",
    two: "خطآن",
    few: "{count} أخطاء",
    many: "{count} خطأً",
    other: "{count} خطأ",
  },
  "strat.archivedTag": "مؤرشفة",
  "strat.lastBacktest": "آخر اختبار تاريخي",
  "strat.backtested": "اختبار تاريخي",
  "strat.notTested": "لم تُختبر تاريخيًا بعد", // (display)
  "strat.notTestedBody": "اختبر القواعد على سجل أسعار حقيقي، بتكاليف حسابك، قبل تشغيلها.",
  "strat.runFirst": "تشغيل اختبار تاريخي",
  "strat.openReport": "فتح التقرير الكامل",
  "strat.deployV": "تشغيل v{version}",
  "strat.backtest": "اختبار تاريخي",
  "strat.fixFirst": "أصلح هذه قبل الاختبار أو التشغيل",
  "strat.line": "السطر {n}:",
  "strat.rules": "القواعد", // (display)
  "strat.rulesSub": "تُفحص عند كل شمعة مغلقة",
  "strat.rulesCodeSub": "إشارات الكود، تُفحص عند كل شمعة مغلقة",
  "strat.showCode": "عرض ككود",
  "strat.risk": "المخاطرة", // (display)
  "strat.riskSub": "الحجم والإيقافات والساعات والحدود",
  "strat.editVisual": "لتغيير القواعد، اطلب ذلك من المتداول الذكي أو عدّلها في منطقة العملاء؛ يُحفظ كل تغيير كإصدار جديد.",
  "strat.editCode": "تُعدَّل استراتيجيات الكود في منطقة العملاء على الويب؛ يُحفظ كل تغيير كإصدار جديد.",
  "strat.openWeb": "تعديل الكود على الويب",
  "strat.deployments": "عمليات التشغيل", // (display)
  "strat.deploymentsSub": {
    zero: "لا تعمل في أي مكان",
    one: "عملية تشغيل واحدة",
    two: "عمليتا تشغيل",
    few: "{count} عمليات تشغيل",
    many: "{count} عملية تشغيل",
    other: "{count} عملية تشغيل",
  },
  "strat.notRunning": "لا تعمل. شغّلها على حساب تجريبي أولًا لترى كيف تتداول مباشرةً.",
  "strat.backtests": "الاختبارات التاريخية", // (display)
  "strat.backtestsSub": {
    zero: "لا شيء بعد",
    one: "تشغيل واحد",
    two: "تشغيلان",
    few: "{count} تشغيلات",
    many: "{count} تشغيلًا",
    other: "{count} تشغيل",
  },
  "strat.runNew": "تشغيل جديد",
  "strat.noBacktests": "لا اختبارات تاريخية بعد.",
  "strat.versions": "الإصدارات", // (display)
  "strat.versionsSub": {
    zero: "لا إصدارات",
    one: "إصدار واحد",
    two: "إصداران",
    few: "{count} إصدارات",
    many: "{count} إصدارًا",
    other: "{count} إصدار",
  },
  "strat.current": "الحالي",
  "strat.archive": "أرشفة",
  "strat.archiveTitle": "أرشفتها؟", // (display)
  "strat.archiveBody": "تخرج «{name}» من قائمتك. تبقى اختباراتها التاريخية وعمليات تشغيلها السابقة في سجلك.",
  "strat.archived": "تمت أرشفة «{name}»",

  "kind.visual": "قواعد بصرية",
  "kind.code": "كود",
  // Where a strategy came from
  "origin.ai": "المتداول الذكي",
  "origin.template": "قالب",
  "origin.manual": "يدوية",
  "origin.marketplace": "السوق",

  /* ---------------------------------------------------------------- */
  /* Rules in words                                                    */
  /* ---------------------------------------------------------------- */
  "rules.buy": "شراء عندما",
  "rules.sell": "بيع عندما",
  "rules.exitBuy": "إغلاق صفقات الشراء عندما",
  "rules.exitSell": "إغلاق صفقات البيع عندما",
  "rules.and": "و",
  "rules.or": "أو",
  // {tf} = timeframe, e.g. "على H4"
  "rules.onTf": "على {tf}",
  "rules.noRules": "لا توجد قواعد دخول بعد.",
  "rules.size": "الحجم",
  "rules.stop": "إيقاف الخسارة",
  "rules.target": "جني الربح",
  "rules.trailing": "الوقف المتحرك",
  "rules.window": "ساعات التداول",
  "rules.limits": "الحدود",
  "rules.none": "لا يوجد",
  "rules.lots": "{lots} لوت",
  "rules.riskPct": "مخاطرة {pct}% لكل صفقة",
  "rules.maxLots": "بحد أقصى {lots} لوت",
  // points: move the stop to entry + {o} after {v} points in profit
  "rules.breakeven": "نقطة التعادل عند {v} نقطة (+{o})",
  "rules.allDay": "على مدار الساعة",
  "rules.perDay": {
    zero: "{count} صفقة يوميًا",
    one: "صفقة واحدة يوميًا",
    two: "صفقتان يوميًا",
    few: "{count} صفقات يوميًا",
    many: "{count} صفقة يوميًا",
    other: "{count} صفقة يوميًا",
  },
  "rules.dailyLoss": "يتوقف لبقية اليوم عند خسارة {amount}",
  "rules.oneAtATime": "صفقة واحدة في كل مرة",
  "rules.closeOutside": "يغلق خارج ساعات التداول",
  "rules.noLimits": "بلا حدود يومية",
  "op.crossesAbove": "يتقاطع صعودًا فوق",
  "op.crossesBelow": "يتقاطع هبوطًا تحت",
  "dist.pips": "{v} بيب",
  "dist.points": "{v} نقطة",
  "dist.price": "عند {v}",
  "dist.percent": "{v}% من السعر",
  // {v} × ATR({p})
  "dist.atr": "{v} × ATR({p})",
  "dist.level": "المستوى {v}",
  // a multiple of the stop distance
  "dist.rr": "{v}R",
  "field.close": "الإغلاق",
  "field.open": "الافتتاح",
  "field.high": "الأعلى",
  "field.low": "الأدنى",
  "field.hl2": "السعر الوسيط",
  "field.hlc3": "السعر النموذجي",
  "field.ohlc4": "متوسط السعر",
  "field.volume": "الحجم",
  "pattern.bullish": "شمعة صاعدة",
  "pattern.bearish": "شمعة هابطة",
  "pattern.bullish_engulfing": "ابتلاعية صاعدة",
  "pattern.bearish_engulfing": "ابتلاعية هابطة",
  "pattern.hammer": "المطرقة",
  "pattern.shooting_star": "الشهاب",
  "pattern.doji": "دوجي",
  "pattern.inside_bar": "الشمعة الداخلية",
  "ind.sma": "SMA",
  "ind.ema": "EMA",
  "ind.wma": "WMA",
  "ind.rsi": "RSI",
  "ind.macd": "MACD",
  "ind.macd_signal": "إشارة MACD",
  "ind.macd_hist": "مدرج MACD",
  "ind.bb_upper": "Bollinger العلوي",
  "ind.bb_middle": "Bollinger الأوسط",
  "ind.bb_lower": "Bollinger السفلي",
  "ind.atr": "ATR",
  "ind.stoch_k": "Stochastic %K",
  "ind.stoch_d": "Stochastic %D",
  "ind.highest": "أعلى قمة",
  "ind.lowest": "أدنى قاع",
  "ind.cci": "CCI",
  "ind.willr": "Williams %R",
  "ind.adx": "ADX",
  "ind.plus_di": "+DI",
  "ind.minus_di": "−DI",
  "ind.momentum": "الزخم",
  "ind.roc": "ROC",
  "ind.stddev": "الانحراف المعياري",
  "note.noDailyLimit": "لا يوجد حد يومي للصفقات",
  "note.noStop": "لا يوجد إيقاف خسارة: الصفقات غير محمية",
  "note.riskNeedsStop": "تحديد الحجم حسب المخاطرة يتطلب إيقاف خسارة",
  "note.rrNeedsStop": "جني الربح بمضاعف R يتطلب إيقاف خسارة",
  "note.noEntry": "لا توجد قاعدة دخول: أضف شرط شراء أو بيع",

  /* ---------------------------------------------------------------- */
  /* Deploy (form)                                                     */
  /* ---------------------------------------------------------------- */
  "deploy.eyebrow": "تشغيل · v{version}",
  "deploy.title": "شغّلها على مدار الساعة", // (display)
  "deploy.body": "تتداول «{name}» v{version} على {symbol} عند كل شمعة {tf} مغلقة، على خوادم Kalks، حتى عندما يكون هاتفك مغلقًا. أوقفها مؤقتًا أو نهائيًا أو أنهِها في أي وقت.",
  "deploy.account": "الحساب",
  "deploy.equity": "حقوق الملكية {amount}",
  "deploy.noAccounts": "تحتاج إلى حساب تداول نشط. افتح حسابًا تجريبيًا لتجربة الاستراتيجيات دون مخاطرة.",
  "deploy.openAccount": "فتح حساب",
  "deploy.multiplier": "مضاعف اللوت",
  "deploy.multiplierHint": "يضاعف حجم كل أمر. 1× يتداول بحجم الاستراتيجية نفسه.",
  "deploy.maxOpen": "أقصى عدد للصفقات المفتوحة",
  "deploy.maxOpenHint": "حد إضافي فوق قواعد الاستراتيجية نفسها.",
  "deploy.strategyDefault": "قاعدة الاستراتيجية",
  "deploy.dailyLoss": "حد الخسارة اليومية",
  "deploy.dailyLossHint": "عندما تبلغه خسارة اليوم المغلقة والمفتوحة، لا صفقات جديدة حتى الغد (بتوقيت الخادم).",
  "deploy.off": "متوقف",
  "deploy.custom": "مخصص",
  "deploy.dailyLossAmount": "الخسارة اليومية",
  "deploy.lossInvalid": "أدخل مبلغًا أكبر من 0.",
  "deploy.liveTitle": "أموال حقيقية",
  "deploy.liveBody": "هذا حساب حقيقي. تضع الاستراتيجية أوامر حقيقية بأموال حقيقية، وقد تخسرها.",
  "deploy.ack": "أدرك أن الاستراتيجية تتداول بأموال حقيقية على حسابي الحقيقي وأنني مسؤول عن ذلك.",
  "deploy.note": "قد يؤدي التداول الآلي إلى خسارة الأموال. الاختبارات التاريخية محاكاة ولا تتنبأ بالنتائج المستقبلية. هذه ليست نصيحة مالية.",
  // {account} = "تجريبي 50000083"
  "deploy.confirm": "تشغيل على حساب {account}",
  "deploy.doneTitle": "قيد التشغيل", // (display)
  "deploy.doneBody": "«{name}» v{version} قيد التشغيل على حساب {account}.",
  "deploy.warmup": "أول شمعة {tf} مغلقة للإحماء؛ يمكن أن تبدأ الأوامر من الشمعة التالية.",
  "deploy.open": "فتح التشغيل",

  /* ---------------------------------------------------------------- */
  /* Backtests                                                         */
  /* ---------------------------------------------------------------- */
  "bt.status.queued": "في الانتظار",
  "bt.status.running": "قيد التشغيل",
  "bt.status.done": "مكتمل",
  "bt.status.failed": "فشل",
  "bt.status.cancelled": "ملغى",
  "bt.stage.queued": "بانتظار معالج متاح",
  "bt.stage.loading": "جارٍ تحميل سجل الأسعار",
  "bt.stage.m1": "جارٍ تحميل شموع الدقيقة",
  "bt.stage.simulating": "جارٍ محاكاة الصفقات",
  "bt.stage.running": "قيد التشغيل",
  // {id} = backtest number, {version} = strategy version
  "bt.eyebrow": "اختبار تاريخي #{id} · v{version}",
  "bt.title": "اختبار تاريخي", // (display)
  "bt.start": "البداية {amount}",
  "bt.runningNote": "يعمل على الخادم: يمكنك مغادرة هذه الشاشة والعودة لاحقًا.",
  "bt.failed": "فشل الاختبار التاريخي",
  "bt.cancelled": "ملغى", // (display)
  "bt.runAgain": "إعادة التشغيل",
  "bt.net": "صافي الربح",
  // {pct} = return, {amount} = starting balance
  "bt.returnOf": "{pct} على {amount}",
  "bt.pf": "معامل الربح",
  "bt.winRate": "نسبة الربح",
  "bt.winsOf": "{wins} من {trades}",
  "bt.maxDd": "أقصى تراجع",
  "bt.maxDdShort": "أقصى DD",
  "bt.sharpe": "Sharpe",
  "bt.sortino": "Sortino {v}",
  "bt.trades": "الصفقات",
  "bt.longShort": "{long} شراء · {short} بيع",
  "bt.expectancy": "العائد المتوقع",
  "bt.perTrade": "لكل صفقة",
  "bt.equity": "حقوق الملكية", // (display)
  "bt.drawdown": "التراجع",
  "bt.legendEquity": "حقوق الملكية",
  "bt.legendBalance": "الرصيد",
  "bt.legendStart": "البداية",
  "bt.noCurve": "لا توجد شموع كافية لرسم منحنى.",
  "bt.scrubHint": "اسحب عبر الرسم البياني، أو المس مطولًا، لقراءة أي نقطة.",
  "bt.curveA11y": "حقوق الملكية من {from} إلى {to}؛ أقصى تراجع {dd}",
  "bt.monthly": "العوائد الشهرية", // (display)
  "bt.monthlySub": "عائد كل شهر، % من الرصيد",
  "bt.noTradesMonth": "لا صفقات",
  "bt.statistics": "الإحصاءات", // (display)
  "bt.tradeList": "الصفقات", // (display)
  "bt.tradeListSub": "الأحدث أولًا، صافية من التكاليف",
  "bt.truncated": "أول {n} صفقة، الأحدث أولًا",
  "bt.fAll": "الكل · {n}",
  "bt.fWins": "الرابحة · {n}",
  "bt.fLosses": "الخاسرة · {n}",
  "bt.noTrades": "لم تتداول القواعد في هذه الفترة.",
  "bt.data": "البيانات والتكاليف", // (display)
  "bt.m1Bars": "شموع الدقيقة (داخل الشمعة)",
  "bt.since": "منذ {date}",
  "bt.signals": "الإشارات",
  "bt.signalsValue": "{buy} شراء · {sell} بيع · {exits} خروج",
  "bt.skipped": "المتجاوزة: {reason}",
  "bt.model": "النموذج",
  "bt.group": "نوع الحساب",
  "bt.spread": "السبريد",
  "bt.spreadValue": "{points} نقطة ({source})",
  "bt.commission": "العمولة",
  "bt.perLot": "{amount} لكل لوت",
  "bt.swaps": "السواب",
  "bt.swapsOn": "يُحتسب عند كل تبييت",
  "bt.swapsOff": "لا يُحتسب (بدون سواب)",
  "bt.conversion": "تحويل الربح/الخسارة",
  "bt.usdBase": "USD عملة أساسية: بسعر الخروج",
  "bt.usdQuoted": "مسعّر بالدولار",
  "bt.currentRate": "بالسعر الحالي ({rate})",
  "bt.simNote": "الاختبار التاريخي #{id} محاكاة على أسعار سابقة: التنفيذ عند افتتاح الشمعة التالية، والإيقافات والأهداف على مسار OHLC (شموع الدقيقة حيثما توفرت)، مع سبريد نوع حسابك وعمولته والسواب. النتائج السابقة لا تتنبأ بالنتائج المستقبلية.",
  // History sources and skip reasons from the service
  "source.native": "أصلي",
  "source.built_from_M1": "مبني من M1",
  "source.built_from_M5": "مبني من M5",
  "source.built_from_M15": "مبني من M15",
  "source.built_from_M30": "مبني من M30",
  "source.built_from_H1": "مبني من H1",
  "skip.outside_trading_window": "خارج ساعات التداول",
  "skip.position_already_open": "كانت هناك صفقة مفتوحة بالفعل",
  "skip.daily_trade_limit": "الحد اليومي للصفقات",
  "skip.max_daily_loss": "حد الخسارة اليومية",
  "skip.market_closed": "السوق مغلق",
  "skip.20_open_positions": "20 صفقة مفتوحة بالفعل",
  "skip.buy_and_sell_on_the_same_bar": "شراء وبيع على الشمعة نفسها",
  "skip.stop_distance_not_ready": "مسافة الإيقاف غير جاهزة بعد",
  "skip.SL_level_on_the_wrong_side": "مستوى الإيقاف في الجانب الخاطئ",
  "skip.volume_below_the_minimum_lot": "الحجم أقل من الحد الأدنى للوت",
  "spreadSource.group_quote": "التسعير المباشر لنوع حسابك",
  "spreadSource.catalogue": "سبريد الكتالوج",
  "spreadSource.fixed": "ثابت",

  "btNew.title": "تشغيل اختبار تاريخي", // (display)
  "btNew.period": "الفترة",
  "btNew.balance": "الرصيد الابتدائي",
  "btNew.other": "أخرى",
  "btNew.amount": "المبلغ",
  "btNew.costs": "التكاليف من",
  "btNew.accountType": "نوع الحساب",
  "btNew.myAccount": "حسابي",
  "btNew.costsGroupHint": "سبريد نوع الحساب هذا وعمولته والسواب.",
  "btNew.costsAccountHint": "سبريد مجموعة ذلك الحساب وعمولتها والسواب.",
  "btNew.noAccounts": "ليس لديك حساب تداول نشط بعد.",
  "btNew.run": "تشغيل الاختبار التاريخي",
  "btNew.note": "تعتمد أطول فترة على الإطار الزمني. يمكن تشغيل 3 اختبارات تاريخية كحد أقصى في الوقت نفسه.",

  "period.p1m": "1 ش",
  "period.p3m": "3 ش",
  "period.p6m": "6 ش",
  "period.p1y": "1 س",
  "period.p2y": "2 س",
  "period.p5y": "5 س",

  // Trade exit reasons (server codes)
  "exit.sl": "إيقاف الخسارة",
  "exit.tp": "جني الربح",
  "exit.trailing": "الوقف المتحرك",
  "exit.breakeven": "نقطة التعادل",
  "exit.signal": "إشارة",
  "exit.exit_rule": "قاعدة الخروج",
  "exit.session": "خارج الساعات",
  "exit.end_of_test": "نهاية الاختبار",
  "exit.stop_out": "الإيقاف الإجباري",
  "exit.kill": "مفتاح الإيقاف الطارئ",
  "exit.stopped": "متوقف",
  "exit.client": "مغلقة",
  "exit.close": "مغلقة",

  "stat.balance": "الرصيد",
  "stat.gross": "إجمالي الربح / الخسارة",
  "stat.cagr": "النمو السنوي (CAGR)",
  "stat.avgWinLoss": "متوسط الربح / الخسارة",
  "stat.largest": "أكبر ربح / خسارة",
  "stat.payoff": "نسبة العائد",
  "stat.long": "صفقات الشراء · نسبة الربح",
  "stat.short": "صفقات البيع · نسبة الربح",
  "stat.streaks": "أقصى أرباح / خسائر متتالية",
  "stat.maxDd": "أقصى تراجع",
  "stat.recovery": "عامل التعافي",
  "stat.sharpeSortino": "Sharpe / Sortino",
  "stat.avgBars": "متوسط عدد الشموع للاحتفاظ",
  "stat.exposure": "الوقت في السوق",
  "stat.costs": "العمولة / السواب / السبريد",
  "stat.bars": "الشموع المختبرة",
  "stat.cpu": "مدة الحساب",
  "stat.seconds": "{s} ث",

  /* ---------------------------------------------------------------- */
  /* Log kinds (runtime)                                               */
  /* ---------------------------------------------------------------- */
  "log.eval": "شمعة",
  "log.signal": "إشارة",
  "log.order": "أمر",
  "log.close": "إغلاق",
  "log.manage": "إدارة",
  "log.error": "خطأ",
  "log.info": "معلومة",

  /* ---------------------------------------------------------------- */
  /* Marketplace                                                       */
  /* ---------------------------------------------------------------- */
  "house.badge": "استراتيجية الشركة · تديرها Kalks",
  "house.disclosure": "استراتيجية تديرها Kalks: حساب حقيقي مملوك للوسيط يشغّل هذه الاستراتيجية. سجل الأداء يقتصر على صفقاته الحقيقية منذ بدء التشغيل؛ لا شيء محاكى أو مضاف بأثر رجعي.",
  "market.eyebrow": "سوق الاستراتيجيات",
  "market.title": "السوق", // (display)
  "market.subtitle": "استراتيجيات بسجلات أداء موثّقة من حسابات Kalks حقيقية. انسخ إحداها إلى حسابك، أو استنسخ قواعدها عندما يسمح المؤلف بذلك.",
  "market.browse": "تصفح",
  "market.subs": "الاشتراكات",
  "market.subsN": "الاشتراكات · {n}",
  "market.mine": "قوائمك",
  "market.search": "ابحث عن استراتيجيات، مؤلفين…",
  "market.clear": "مسح البحث",
  "market.all": "الكل",
  "market.free": "مجاني",
  "market.paid": "مدفوع",
  "market.newest": "الأحدث",
  "market.topRated": "الأعلى تقييمًا",
  "market.popular": "الأكثر شيوعًا",
  // {price} in USDT
  "market.perMonth": "{price} USDT/شهر",
  "market.by": "بواسطة {author}",
  "market.return": "العائد",
  "market.winRate": "نسبة الربح",
  "market.maxDd": "أقصى DD",
  "market.trades": "الصفقات",
  // {type} = حقيقي / تجريبي
  "market.verified": "{type} موثّق",
  "market.verifiedDays": "{type} موثّق · {days} يوم",
  // a track record younger than a day
  "market.verifiedNew": "{type} موثّق · أقل من يوم",
  "market.subscribed": "مشترك",
  "market.ratings": {
    zero: "لا تقييمات",
    one: "تقييم واحد",
    two: "تقييمان",
    few: "{count} تقييمات",
    many: "{count} تقييمًا",
    other: "{count} تقييم",
  },
  "market.subscribers": {
    zero: "لا مشتركين",
    one: "مشترك واحد",
    two: "مشتركان",
    few: "{count} مشتركين",
    many: "{count} مشتركًا",
    other: "{count} مشترك",
  },
  "market.emptyTitle": "لا شيء مدرج بعد", // (display)
  "market.emptyText": "تظهر الاستراتيجيات هنا بمجرد أن ينشرها مؤلفوها مع سجل أداء موثّق.",
  "market.noMatchTitle": "لا نتائج مطابقة", // (display)
  "market.noMatchText": "جرّب بحثًا أو عامل تصفية آخر.",
  "market.noSubsTitle": "لا اشتراكات", // (display)
  "market.noSubsText": "تظهر هنا الاستراتيجيات التي تنسخها أو تستنسخها من السوق.",
  "market.disclaimer": "الأداء السابق لا يضمن النتائج المستقبلية. تأتي سجلات الأداء من حسابات حقيقية أو تجريبية على Kalks وتُصنَّف وفقًا لذلك. رسوم المنصة على الاشتراكات المدفوعة: {pct}%.",
  "market.houseFootnote": "تعمل استراتيجيات الشركة على حسابات حقيقية مملوكة للوسيط؛ وتقتصر سجلات أدائها على صفقاتها الحقيقية فقط.",
  "market.earned": "الأرباح",
  "market.fees": "رسوم المنصة",
  "market.payments": "المدفوعات",
  "market.publishWeb": "يتم نشر الاستراتيجية (مع سجل أدائها الموثّق) وتعديل القوائم في منطقة العملاء على الويب.",
  "market.openWeb": "فتح سوق الاستراتيجيات على الويب",
  // Listing statuses (server values)
  "listing.pending": "قيد المراجعة",
  "listing.approved": "مدرجة",
  "listing.rejected": "مرفوضة",
  "listing.suspended": "معلّقة",
  "listing.unlisted": "غير مدرجة",
  "listing.eyebrow": "السوق · {symbol} {tf}",
  "listing.verified": "سجل أداء {type} موثّق",
  "listing.cloneAllowed": "الاستنساخ مسموح",
  "listing.trackReturn": "العائد الموثّق",
  "listing.net": "الصافي",
  "listing.noCurve": "يظهر المنحنى اليومي بعد يومين من التداول.",
  "listing.curveA11y": "حقوق الملكية يوميًا على مدى {days} يوم، العائد {ret}",
  "listing.trackNote": "من تشغيل المؤلف الخاص على Kalks منذ {since}، محسوب من الصفقات المغلقة على محرك التداول: لا يُدخله المؤلف أبدًا.",
  "listing.btSimulated": "اختبار تاريخي · محاكاة",
  "listing.btNote": "يوضح كيف كانت القواعد ستتداول على الأسعار التاريخية بتكاليف نوع الحساب هذا؛ وهو ليس جزءًا من سجل الأداء الحقيقي أعلاه.",
  "listing.btA11y": "منحنى حقوق الملكية للاختبار التاريخي (محاكاة)",
  "listing.about": "نبذة", // (display)
  "listing.risk": "المخاطرة", // (display)
  "listing.rules": "القواعد", // (display)
  "listing.rulesPrivate": "القواعد خاصة: انسخ الاستراتيجية لتشغيلها على حسابك.",
  "listing.reviews": "التقييمات · {n}", // (display)
  "listing.noReviews": "لا توجد تقييمات بعد.",
  "listing.subscribeFree": "اشترك مجانًا",
  "listing.subscribePaid": "اشترك · {price} USDT / شهريًا",
  "listing.copying": "قيد النسخ على {login}",
  "listing.clonedTo": "تم استنساخها إلى استراتيجياتك",
  "listing.openDeployment": "فتح التشغيل",
  "listing.openStrategy": "فتح الاستراتيجية",
  "listing.cancel": "إلغاء",
  "listing.cancelConfirm": "إلغاء الاشتراك",
  "listing.keep": "الإبقاء عليه",
  "listing.cancelTitle": "إلغاء الاشتراك؟", // (display)
  "listing.cancelCopy": "تتوقف الاستراتيجية على حسابك الآن. تبقى صفقاتها المفتوحة مفتوحة مع الإيقاف والهدف.",
  "listing.cancelClone": "ينتهي الاشتراك. تبقى الاستراتيجية المستنسخة في قائمتك.",
  // {date} = end of the paid period
  "listing.cancelPaid": "يستمر حتى {date} ولن يتجدد. لا يُسترد أي مبلغ عن الفترة الحالية.",
  "listing.cancelled": "تم إلغاء الاشتراك",
  "listing.cancelledPaid": "لن يتجدد",
  "listing.yours": "قائمتك",
  "listing.manageWeb": "الإدارة عبر الويب",

  /* ---------------------------------------------------------------- */
  /* Subscribe (form), subscriptions                                   */
  /* ---------------------------------------------------------------- */
  "sub.eyebrow": "اشتراك",
  "sub.title": "اشتراك",
  "sub.body": "بواسطة {author} · {symbol} {tf}",
  "sub.how": "الطريقة",
  "sub.copyTitle": "نسخ إلى حسابي",
  "sub.copyText": "يعمل إصدار المؤلف نفسه على حسابك على مدار الساعة. تبقى القواعد خاصة.",
  "sub.copyTextOpen": "يعمل إصدار المؤلف نفسه على حسابك على مدار الساعة.",
  "sub.cloneTitle": "استنساخ القواعد",
  "sub.cloneText": "تصبح القواعد إحدى استراتيجياتك: اختبرها وعدّلها وشغّلها بنفسك.",
  "sub.multiplierHint": "يضاعف أحجام أوامر الاستراتيجية على حسابك.",
  "sub.price": "السعر",
  "sub.dueNow": "المستحق الآن",
  "sub.wallet": "المحفظة (المتاح)",
  "sub.renewal": "التجديد",
  "sub.noCharge": "مجاني، لا يُخصم أي مبلغ",
  "sub.shortTitle": "رصيد USDT غير كافٍ",
  "sub.shortBody": "يجب أن يتوفر في محفظتك {amount} USDT على الأقل.",
  "sub.deposit": "إيداع",
  "sub.liveBody": "تضع الاستراتيجية أوامر حقيقية بأموال حقيقية على هذا الحساب، وقد تخسرها.",
  "sub.ackPay": "اخصم {price} USDT من محفظة Kalks الخاصة بي الآن وكل 30 يومًا حتى ألغي الاشتراك.",
  "sub.doneTitle": "تم الاشتراك", // (display)
  // {title} = strategy, {account} = "تجريبي 50000083"
  "sub.doneCopy": "«{title}» قيد التشغيل على حساب {account}.",
  "sub.doneClone": "أصبحت «{title}» إحدى استراتيجياتك.",
  "sub.charged": "تم خصم {amount} USDT من محفظتك.",
  // the answer to a subscribe request was lost (connection, timeout): the app re-reads the listing before a retry
  "sub.noAnswer": "لم نتلقَّ ردًا. ربما تم الاشتراك بالفعل.",
  "sub.checkingTitle": "جارٍ التحقق من اشتراكك",
  "sub.checkingBody": "فُقد الرد في الطريق. نتحقق من الخادم قبل أن تتمكن من المحاولة مجددًا، حتى لا يُخصم منك مرتين أبدًا.",
  "sub.noAnswerRetry": "لا يوجد رد حتى الآن، ولا اشتراك جديد على حسابك. يمكنك المحاولة مرة أخرى.",
  "sub.notThrough": "لم يتم الاشتراك، ولا يبقى أي مبلغ مخصومًا (يُعاد أي خصم إلى محفظتك). يمكنك المحاولة مرة أخرى.",
  "sub.unfinished": "لا يزال قيد الإعداد على الخادم. تحقّق من السوق ← الاشتراكات وسجل محفظتك، أو تواصل مع الدعم، قبل المحاولة مجددًا.",
  "sub.free": "اشتراك مجاني: لم يُخصم أي مبلغ.",
  "sub.copyOn": "نسخ على {login}",
  "sub.cloned": "مستنسخة",
  "sub.renews": "يتجدد في {date}",
  "sub.ends": "ينتهي في {date}",
  "sub.status.active": "نشط",
  "sub.status.cancelled": "ملغى",
  "sub.status.expired": "منتهي الصلاحية",
  "sub.status.past_due": "الدفع مستحق",

  "review.title": "قيّمها", // (display)
  "review.rating": "تقييمك",
  "review.stars": {
    zero: "{count} نجمة",
    one: "نجمة واحدة",
    two: "نجمتان",
    few: "{count} نجوم",
    many: "{count} نجمة",
    other: "{count} نجمة",
  },
  "review.comment": "تعليق (اختياري)",
  "review.placeholder": "كيف كان أداؤها بالنسبة لك؟",
  "review.post": "نشر التقييم",
  "review.saved": "تم حفظ التقييم",
  "review.rate": "قيّمها",
  "review.edit": "تعديل التقييم",
  "review.you": "أنت",

  /* ---------------------------------------------------------------- */
  /* API keys and webhooks                                             */
  /* ---------------------------------------------------------------- */
  "keys.eyebrow": "المطورون",
  "keys.title": "API", // (display)
  "keys.subtitle": "مفاتيح لبرامج التداول الخاصة بك وروابط Webhook للتنبيهات (TradingView وغيرها).",
  "keys.requests24h": "الطلبات · آخر 24 س",
  "keys.errors": "الأخطاء",
  // requests refused by the rate limit
  "keys.limited": "محدودة",
  "keys.p50": "الوسيط",
  "keys.writes": "الأوامر",
  "keys.keys": "مفاتيح API", // (display)
  "keys.keysSub": "{n} نشطة · حتى 20",
  "keys.none": "لا توجد مفاتيح API. أنشئ واحدًا في منطقة العملاء على الويب.",
  "keys.status.active": "نشط",
  "keys.status.revoked": "ملغى",
  "keys.status.expired": "منتهي الصلاحية",
  "keys.scope.read": "قراءة",
  "keys.scope.trade": "تداول",
  // {ips} = list of IP addresses
  "keys.ips": "فقط من {ips}",
  "keys.anyIp": "من أي عنوان IP",
  "keys.expires": "ينتهي في {date}",
  "keys.noExpiry": "لا ينتهي أبدًا",
  "keys.lastUsed": "آخر استخدام {ago}",
  "keys.revoke": "إلغاء",
  "keys.revokeTitle": "إلغاء هذا المفتاح؟", // (display)
  "keys.revokeBody": "يتوقف «{name}» ({id}) عن العمل فورًا لكل برنامج يستخدمه. لا يمكن التراجع عن ذلك.",
  "keys.revoked": "تم إلغاء «{name}»",
  "keys.webTitle": "الإنشاء عبر الويب",
  "keys.webBody": "تُنشأ المفاتيح وWebhooks الجديدة في منطقة العملاء: يُعرض سر المفتاح ورابط الـ Webhook مرة واحدة، حيث يمكنك نسخهما إلى أدوات التداول الخاصة بك.",
  "keys.openWeb": "فتح منطقة العملاء",
  "keys.killHint": "هل تحتاج إلى إيقاف كل شيء؟ يوقف مفتاح الإيقاف الطارئ في شاشة Algo كل الاستراتيجيات ويحظر أوامر Webhook وAPI.",

  "hooks.title": "Webhooks", // (display)
  "hooks.sub": "{n} من أصل 20 كحد أقصى",
  "hooks.none": "لا توجد Webhooks. أنشئ واحدًا في منطقة العملاء على الويب.",
  // {hint} = the URL's last characters
  "hooks.hint": "الرابط …{hint}",
  "hooks.accounts": {
    zero: "لا حسابات",
    one: "حساب واحد",
    two: "حسابان",
    few: "{count} حسابات",
    many: "{count} حسابًا",
    other: "{count} حساب",
  },
  "hooks.today": {
    zero: "لا تنبيهات اليوم",
    one: "تنبيه واحد اليوم",
    two: "تنبيهان اليوم",
    few: "{count} تنبيهات اليوم",
    many: "{count} تنبيهًا اليوم",
    other: "{count} تنبيه اليوم",
  },
  "hooks.used": "استُخدم {ago}",
  "hooks.on": "مفعّل",
  "hooks.off": "متوقف",
  "hooks.switch": "تفعيل الـ Webhook «{name}»",
  "hooks.passphrase": "عبارة المرور مطلوبة",
  "hooks.noPassphrase": "بدون عبارة مرور",
  "hooks.delete": "حذف",
  "hooks.deleteTitle": "حذف هذا الـ Webhook؟", // (display)
  "hooks.deleteBody": "يتوقف «{name}» ورابطه السري عن العمل فورًا؛ وتُرفض التنبيهات المرسلة إليه. لا يمكن التراجع عن ذلك.",
  "hooks.deleted": "تم حذف «{name}»",
  "hooks.alerts": "أحدث التنبيهات", // (display)
  "hooks.alertsSub": "كل تنبيه مع نتيجة كل حساب",
  // Alert statuses (server values)
  "hooks.status.accepted": "مقبول",
  "hooks.status.partial": "جزئي",
  "hooks.status.failed": "فشل",
  "hooks.status.received": "مستلم",
  "hooks.status.rejected": "مرفوض",
  "hooks.status.blocked": "محظور (الإيقاف الطارئ)",
  // Each account's result of an alert (server values)
  "hooks.result.filled": "منفذ",
  "hooks.result.pending": "تم وضع الأمر",
  "hooks.result.closed": "مغلق",
  "hooks.result.nothing_to_close": "لا شيء لإغلاقه",
  "hooks.result.rejected": "مرفوض",
};
export default mobileAlgo;
