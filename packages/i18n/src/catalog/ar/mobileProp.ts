import type { NsMessages } from "../../core";

// Kalks mobile app: Prop (challenge catalogue and checkout, live rule dashboard, payouts, certificates).
// "Kalks", "Kalks Prop", "Kalks Trader", "Kalks-Live", "USDT", "New York" and "17:00" stay as they are.
// Terms follow the `prop` namespace (funded = ممول, payout = الصرف, drawdown = التراجع, breach = مخالفة).
// Titles shown in tall display type are marked "display": keep them short.
const mobileProp: NsMessages<"mobileProp"> = {
  // Prop home
  "home.eyebrow": "Kalks Prop",
  "home.title": "احصل على التمويل", // display
  "home.subtitle": "اجتز تحديًا، واحصل على حساب ممول، واحتفظ بما يصل إلى {split}% من الربح. جميع حسابات Prop حسابات محاكاة.",
  "home.subtitleNoSplit": "اجتز تحديًا، واحصل على حساب ممول، واحتفظ بحصة من الربح. جميع حسابات Prop حسابات محاكاة.",
  "home.payouts": "الصرف",
  "home.payoutsReady": "{amount} جاهز",
  "home.payoutsNone": "لا شيء جاهز بعد",
  "home.certificates": "الشهادات",
  "home.certCount": {
    zero: "لا شهادات",
    one: "شهادة واحدة",
    two: "شهادتان",
    few: "{count} شهادات",
    many: "{count} شهادة",
    other: "{count} شهادة",
  },
  "home.mine": "تحدياتك",
  "home.past": "التحديات السابقة",
  "home.showAll": "عرض الكل ({count})",
  "home.yourCertificates": "شهاداتك",
  "home.plans": "اختر تحديك",
  "home.newChallenge": "ابدأ تحديًا جديدًا",
  "home.emptyTitle": "لا توجد تحديات معروضة", // display
  "home.emptyBody": "يجري إعداد خطط تحديات جديدة. يُرجى العودة قريبًا.",
  "home.mineError": "تعذّر تحميل تحدياتك.",
  "home.plansError": "تعذّر تحميل خطط التحديات.",

  // How it works (numbered 01–04 on the Prop home)
  "how.title": "كيف يعمل",
  "how.1.title": "اختر خطة",
  "how.1.body": "اختر النموذج وحجم الحساب. تُخصم الرسوم من محفظة USDT الخاصة بك مرة واحدة.",
  "how.2.title": "حقّق الهدف",
  "how.2.body": "بلّغ هدف الربح ضمن حدود الخسارة اليومية والتراجع، خلال الحد الأدنى لأيام التداول.",
  "how.3.title": "احصل على التمويل",
  "how.3.body": "عند الاجتياز، يُفتح حسابك الممول تلقائيًا مع شهادة يمكنك مشاركتها.",
  "how.4.title": "احصل على أرباحك",
  "how.4.body": "اطلب حصتك من الربح إلى محفظة USDT الخاصة بك في كل دورة صرف.",
  "how.enforce": "تُفحص الحدود على الخادم كل ثانية على أساس حقوق الملكية. تتلقى تنبيهًا عند 50% و75% و90% من الخسارة اليومية؛ وتؤدي المخالفة إلى إغلاق جميع الصفقات وإنهاء التحدي.",

  // Plan models
  "type.oneStep": "مرحلة واحدة",
  "type.twoStep": "مرحلتان",
  "type.instant": "فوري",
  "typeText.oneStep": "مرحلة تقييم واحدة. حقّق الهدف، والتزم بالحدود، واحصل على التمويل.",
  "typeText.twoStep": "مرحلتا تقييم بأهداف أقل وحدود أوسع.",
  "typeText.instant": "بلا تقييم. ابدأ على حساب ممول فورًا بحدود أكثر صرامة.",

  // Plan card
  "plan.refundable": "رسوم مستردة",
  "plan.fee": "الرسوم",
  "plan.account": "الحساب",
  "plan.leverage": "رافعة 1:{n}",
  "plan.target": "الهدف",
  "plan.dailyLoss": "الخسارة اليومية",
  "plan.maxDD": "أقصى تراجع",
  "plan.static": "ثابت",
  "plan.trailing": "متحرك",
  "plan.start": "ابدأ · {fee}",

  // Checkout
  "checkout.eyebrow": "الدفع",
  "checkout.fee": "رسوم لمرة واحدة",
  "checkout.chargedRefund": "تُدفع من محفظة USDT الخاصة بك، وتُسترد مع الصرف الأول.",
  "checkout.chargedNoRefund": "تُدفع من محفظة USDT الخاصة بك. غير قابلة للاسترداد.",
  "checkout.walletBalance": "رصيد المحفظة: {balance} USDT",
  "checkout.shortTitle": "رصيد محفظتك لا يغطي الرسوم",
  "checkout.short": "لديك {balance} USDT. أودِع {missing} USDT إضافية لدفع رسوم هذا التحدي.",
  "checkout.rules": "القواعد",
  "checkout.limitsNote": "الحدود نسبة مئوية من الرصيد الابتدائي. تجاوز الخسارة اليومية أو أقصى تراجع يؤدي إلى فشل الحساب وإغلاق جميع الصفقات بسعر السوق. يبدأ يوم التداول الجديد عند 17:00 New York.",
  "checkout.agree": "لقد قرأت القواعد وأدرك أن الحساب حساب محاكاة وأنه يفشل تلقائيًا عند تجاوز حد الخسارة.",
  "checkout.pay": "ادفع {fee}",
  "checkout.retry": "إعادة المحاولة · {fee}",
  "checkout.paying": "جارٍ الدفع…",
  "checkout.goToMine": "عرض تحدياتي",
  "checkout.readyTitle": "تحديك جاهز", // display
  "checkout.readyBody": "تم دفع {fee} من محفظة USDT الخاصة بك وفُتح حساب {phase} بحجم {size}. القواعد سارية اعتبارًا من الآن.",
  "checkout.savePasswords": "احفظ كلمات المرور هذه الآن: تُعرض مرة واحدة فقط ولا نحتفظ بها. يمكنك دائمًا التداول على هذا الحساب من التطبيق دونها.",
  "checkout.passwordsShown": "عُرضت كلمات مرور التداول عند تأكيد هذا الشراء لأول مرة. يمكنك التداول على هذا الحساب من التطبيق دونها.",
  "checkout.viewChallenge": "عرض التحدي",
  "checkout.readOnly": "لا يمكن لهذه الجلسة شراء التحديات.",

  // Account credentials
  "cred.login": "رقم الحساب",
  "cred.server": "الخادم",
  "cred.password": "كلمة مرور التداول",
  "cred.investorPassword": "كلمة مرور المستثمر (للقراءة فقط)",
  "cred.show": "إظهار كلمة المرور",
  "cred.hide": "إخفاء كلمة المرور",
  copied: "تم نسخ {what}",
  "a11y.copy": "نسخ {what}",

  // Challenge statuses
  "status.pendingPayment": "بانتظار الدفع",
  "status.provisioning": "جارٍ فتح الحساب",
  "status.active": "نشط",
  "status.funded": "ممول",
  "status.failed": "فشل",
  "status.closed": "مغلق",
  "status.paymentFailed": "فشل الدفع",
  // {phase} is the phase name from the plan, e.g. "Phase 2"
  "stage.active": "{phase} · نشط",
  "stage.failed": "{phase} · فشل",
  "phaseStatus.provisioning": "قيد الفتح",
  "phaseStatus.active": "جارية",
  "phaseStatus.passed": "ناجحة",
  "phaseStatus.failed": "فاشلة",
  "phaseStatus.closed": "مغلقة",

  // Challenge cards (Prop home)
  "card.target": "هدف الربح",
  "card.profit": "الربح",
  "card.equity": "حقوق الملكية {amount}",
  "card.dailyLeft": "المتبقي من الخسارة اليومية {amount}",
  "card.opening": "جارٍ فتح حساب التداول الخاص بك. يستغرق ذلك بضع ثوانٍ.",

  // Dashboard
  "dash.equity": "حقوق الملكية",
  "dash.balance": "الرصيد",
  "dash.floating": "العائم",
  "dash.open": "المفتوحة",
  "dash.sinceStart": "منذ بداية المرحلة",
  "dash.rules": "القواعد",
  "dash.rulesTitle": "قواعد هذا التحدي",
  "dash.notFound": "التحدي غير موجود", // display
  "dash.notFoundBody": "ربما فُتح بتسجيل دخول آخر.",
  "dash.backToProp": "العودة إلى Prop",
  "live.live": "مباشر",
  "live.connecting": "جارٍ الاتصال…",
  "live.offline": "غير متصل",
  // {time}: date and time of the last rule check
  "live.updated": "آخر فحص {time}",
  // {time}: when the phase ended
  "live.final": "نهائي · {time}",

  // Rule names (gauges, the rule log)
  "rule.dailyLoss": "الخسارة اليومية",
  "rule.maxDrawdown": "أقصى تراجع",
  "rule.profitTarget": "هدف الربح",
  "rule.tradingDays": "أيام التداول",
  "rule.timeLimit": "المهلة الزمنية",
  "rule.weekendHolding": "الاحتفاظ خلال عطلة نهاية الأسبوع",
  "rule.newsWindow": "نافذة الأخبار",
  "rule.bannedStrategy": "استراتيجية محظورة",
  "rule.consistency": "الاتساق",
  "rule.riskDesk": "قرار مكتب المخاطر",
  "ruleState.ok": "قيد التقدم",
  "ruleState.passed": "مستوفى",
  "ruleState.failed": "مخالَف",
  "ruleState.off": "متوقف",

  // Gauges
  "target.ofTarget": "من الهدف",
  "target.of": "الهدف {amount} ({pct}%)",
  "target.left": "تبقّى {amount}",
  "target.reachedBy": "تم بلوغه، بزيادة {amount}",
  "limit.left": "متبقٍ {amount}",
  "limit.breachAt": "المخالفة عند {amount}",
  days: {
    zero: "{count} يوم",
    one: "يوم واحد",
    two: "يومان",
    few: "{count} أيام",
    many: "{count} يومًا",
    other: "{count} يوم",
  },
  "days.of": "{v} من {min}",
  "days.count": {
    zero: "{count} يوم",
    one: "يوم واحد",
    two: "يومان",
    few: "{count} أيام",
    many: "{count} يومًا",
    other: "{count} يوم",
  },
  "days.met": "تم بلوغ الحد الأدنى",
  "days.toGo": {
    zero: "لم يتبقَّ شيء",
    one: "تبقّى يوم واحد",
    two: "تبقّى يومان",
    few: "تبقّى {count} أيام",
    many: "تبقّى {count} يومًا",
    other: "تبقّى {count} يوم",
  },
  "days.noMinimum": "بلا حد أدنى",
  "time.left": "تبقّى {d} ي {h} س",
  "time.deadline": "ينتهي في {date}",
  "consistency.rule": "أفضل يوم ≤ {pct}% من الربح",
  "consistency.noProfit": "لا ربح بعد",
  "reset.title": "يُعاد ضبط الخسارة اليومية خلال",
  "reset.note": "17:00 New York، كل يوم تداول",

  // Funded account: payout window ring
  "payoutHero.title": "الصرف التالي",
  "payoutHero.share": "حصتك حتى الآن",
  "payoutHero.open": "متاح", // display
  "payoutHero.ready": "جاهز", // display
  "payoutHero.days": {
    zero: "{count} يوم",
    one: "يوم واحد",
    two: "يومان",
    few: "{count} أيام",
    many: "{count} يومًا",
    other: "{count} يوم",
  }, // display
  "payoutHero.eligible": "مؤهل الآن بحصتك البالغة {split}%.",
  "payoutHero.opens": "تُفتح نافذة الصرف في {date}.",
  "payoutHero.later": "اطلب الصرف عندما تحقق ربحًا مؤهلًا.",

  // Big states
  "hero.opening.title": "جارٍ فتح حسابك", // display
  "hero.opening.body": "تم تأكيد الدفع ويجري إعداد حساب التداول الخاص بك. تتحدث هذه الصفحة تلقائيًا.",
  "hero.closed.title": "أُغلق التحدي", // display
  "hero.closed.body": "تعذّر فتح حساب التداول لهذا التحدي، لذا أُغلق التحدي وأُعيدت الرسوم إلى محفظة USDT الخاصة بك. تواصل مع الدعم إن كانت لديك أسئلة.",
  // {reason} is the prop service's reason, in English
  "hero.closed.reason": "{reason}. أُعيدت الرسوم إلى محفظة USDT الخاصة بك.",
  "hero.failed.title": "فشل {phase}", // display
  "hero.failed.on": "انتهى في {date}",
  // {reason} is the breach reason from the risk engine
  "hero.failed.body": "{reason}. تم إغلاق جميع الصفقات وتعطيل الحساب.",
  "hero.failed.ruleBreached": "تمت مخالفة قاعدة",
  // {rule} is a rule name, e.g. "الخسارة اليومية"
  "hero.failed.rule": "{rule}: تم تجاوز الحد",
  "hero.failed.new": "ابدأ تحديًا جديدًا",
  "hero.passed.title": "تم اجتياز {phase}", // display
  "hero.passed.on": "تم الاجتياز في {date}.",
  "hero.passed.next": "حساب {phase} الخاص بك مفتوح.",
  "hero.passed.nextLogin": "حساب {phase} الخاص بك مفتوح (#{login}).",
  "hero.passed.opening": "جارٍ فتح حسابك التالي.",
  "hero.passed.certificate": "عرض الشهادة",
  "hero.passed.goNext": "الانتقال إلى {phase}",
  "hero.funded.title": "ممول", // display
  "hero.funded.body": "تداول على الحساب الممول واحصل على {split}% من الربح عبر عمليات الصرف.",
  "hero.funded.certificate": "عرض شهادة التمويل الخاصة بك",

  // Warnings while trading
  "warn.lossUsed": "تم استخدام {pct}% من حد خسارة اليوم",
  "warn.lossUsedBody": "وصول حقوق الملكية إلى {floor} أو أقل يؤدي إلى فشل الحساب وإغلاق جميع الصفقات. المتبقي اليوم: {left}.",
  "warn.weekend": "إغلاق نهاية الأسبوع",
  "warn.weekendBody": "لا تسمح هذه الخطة بالاحتفاظ بالصفقات خلال عطلة نهاية الأسبوع: تُغلق الصفقات المفتوحة يوم الجمعة 16:45 New York.",

  // Actions
  "action.openTrade": "فتح في التداول",
  "action.trade": "تداول",
  "action.tradeBlocked": "لا يمكن التداول إلا على الحساب الجاري لتحدٍّ نشط.",
  "action.payouts": "الصرف",
  "action.support": "التواصل مع الدعم",

  // Equity chart
  "chart.title": "منحنى حقوق الملكية",
  "chart.start": "البداية",
  "chart.target": "الهدف",
  "chart.ddFloor": "أقصى تراجع",
  "chart.dailyFloor": "الخسارة اليومية",
  "chart.now": "الآن",
  "chart.empty": "يظهر المنحنى بعد الدقائق الأولى من التداول.",

  // Trading stats
  "stats.title": "إحصاءات التداول",
  "stats.trades": "الصفقات",
  "stats.winRate": "نسبة الربح",
  "stats.profitFactor": "معامل الربح",
  "stats.avgWin": "متوسط الربح",
  "stats.avgLoss": "متوسط الخسارة",
  "stats.lots": "اللوتات",
  "stats.bestDay": "أفضل يوم {date}: {amount}",

  // Rule log
  "events.title": "سجل القواعد",
  "events.empty": "لا تحذيرات ولا مخالفات. حافظ على ذلك.",
  "events.equity": "حقوق الملكية {amount}",
  "events.limit": "الحد {amount}",
  "severity.breach": "مخالفة جسيمة",
  "severity.violation": "انتهاك",
  "severity.warning": "تحذير",
  "severity.info": "معلومة",

  // Closed trades
  "trades.title": "الصفقات المغلقة",
  "trades.all": "الكل ({count})",
  "trades.count": {
    zero: "لا صفقات مغلقة",
    one: "صفقة مغلقة واحدة",
    two: "صفقتان مغلقتان",
    few: "{count} صفقات مغلقة",
    many: "{count} صفقة مغلقة",
    other: "{count} صفقة مغلقة",
  },
  "trades.empty": "لا صفقات مغلقة بعد.",
  "trades.buy": "شراء",
  "trades.sell": "بيع",
  // compact durations: s = seconds, m = minutes, h = hours, d = days
  "duration.s": "{s} ث",
  "duration.ms": "{m} د {s} ث",
  "duration.hm": "{h} س {m} د",
  "duration.dh": "{d} ي {h} س",

  // Account details
  "account.title": "الحساب",
  "account.split": "حصتك",
  "account.initial": "الرصيد الابتدائي",
  "account.started": "بداية المرحلة",
  "account.ended": "انتهت",
  "account.deadline": "الموعد النهائي",
  "account.passwordNote": "عُرضت كلمات مرور التداول مرة واحدة عند الشراء. يسجّل «فتح في التداول» دخولك إلى هذا الحساب دونها.",

  // Payouts
  "payouts.title": "صرف الأرباح", // display
  "payouts.available": "متاح الآن",
  "payouts.eligibleCount": {
    zero: "{eligible} من أصل {count} حساب ممول مؤهل",
    one: "{eligible} من أصل حساب ممول واحد مؤهل",
    two: "{eligible} من أصل حسابين ممولين مؤهل",
    few: "{eligible} من أصل {count} حسابات ممولة مؤهلة",
    many: "{eligible} من أصل {count} حسابًا ممولًا مؤهلًا",
    other: "{eligible} من أصل {count} حساب ممول مؤهل",
  },
  "payouts.requests": {
    zero: "لا طلبات",
    one: "طلب واحد",
    two: "طلبان",
    few: "{count} طلبات",
    many: "{count} طلبًا",
    other: "{count} طلب",
  },
  "payouts.count": {
    zero: "لا عمليات صرف",
    one: "عملية صرف واحدة",
    two: "عمليتا صرف",
    few: "{count} عمليات صرف",
    many: "{count} عملية صرف",
    other: "{count} عملية صرف",
  },
  "payouts.paidToDate": "المدفوع حتى الآن",
  "payouts.funded": "الحسابات الممولة",
  "payouts.account": "{size} ممول", // display
  "payouts.quote": "تقدير الصرف",
  "payouts.eligibleNow": "مؤهل الآن",
  "payouts.notYet": "ليس بعد",
  "payouts.toWallet": "إلى محفظتك",
  "payouts.yourSplit": "حصتك",
  "payouts.firmShare": "حصة الشركة",
  "payouts.alreadyRefunded": "تم الاسترداد مسبقًا",
  "payouts.withFirst": "مع الصرف الأول",
  "payouts.opens": "يُتاح في {date}.",
  "payouts.minimum": "الحد الأدنى {amount}.",
  "payouts.kycNote": "تحقّق من هويتك لطلب هذا الصرف.",
  "payouts.kycPendingNote": "يمكنك طلب هذا الصرف بمجرد الموافقة على التحقق من هويتك.",
  "payouts.readOnly": "لا يمكن لهذه الجلسة طلب الصرف.",
  "payouts.request": "طلب الصرف",
  // opens the account's live rule dashboard (the web calls it "Rules dashboard"); short: it shares a row with Trade
  "payouts.dashboard": "القواعد",
  "payouts.history": "السجل",
  "payouts.historyEmpty": "لا توجد عمليات صرف بعد.",
  "payouts.emptyTitle": "لا يوجد حساب ممول بعد", // display
  "payouts.emptyBody": "اجتز تحديًا للحصول على حساب ممول. اطلب الصرف هنا عندما يحقق ربحًا مؤهلًا.",
  "payouts.emptyAction": "احصل على التمويل",
  "payoutStatus.pending": "قيد المراجعة",
  "payoutStatus.approved": "تمت الموافقة",
  "payoutStatus.paid": "مدفوع",
  "payoutStatus.rejected": "مرفوض",
  "payoutStatus.failed": "فشل",
  "split.title": "تقسيم الأرباح والتوسيع",
  "split.upTo": "حتى {pct}% مع التوسيع",
  "split.cycle": "الصرف",
  // {days} e.g. "14 يومًا"
  "split.first": "الأول بعد {days}",
  "split.firstNow": "من اليوم الأول",
  // {months} e.g. "4 أشهر"; {cap} e.g. "$2,000,000"
  "scaling.text": "حقّق ربحًا بنسبة {profit}% خلال {months} وسيزداد حسابك بنسبة {increase}%، حتى {cap}.",
  "scaling.none": "لا تتضمن هذه الخطة توسيع الحساب.",
  months: {
    zero: "{count} شهر",
    one: "شهر واحد",
    two: "شهران",
    few: "{count} أشهر",
    many: "{count} شهرًا",
    other: "{count} شهر",
  },

  // Payout request sheet
  "request.eyebrow": "طلب الصرف",
  "request.profit": "الربح في الحساب",
  "request.share": "حصتك ({pct}%)",
  "request.feeRefund": "استرداد رسوم التحدي",
  "request.total": "الإجمالي إلى محفظتك",
  "request.note": "يُخصم كامل الربح الحالي من حساب التداول الآن، حتى لا يُخسر في التداول أثناء المراجعة. بعد الموافقة تُضاف حصتك إلى محفظة USDT الخاصة بك؛ وفي حال رفض الطلب يُعاد الربح إلى الحساب.",
  "request.submit": "طلب {amount}",
  "request.done": "تم طلب الصرف",
  "request.doneBody": "يُضاف {amount} إلى محفظة USDT الخاصة بك بعد الموافقة.",

  // Identity verification (payouts)
  "kyc.verified": "تم التحقق من الهوية: يمكن الموافقة على عمليات الصرف.",
  "kyc.pendingTitle": "التحقق قيد المراجعة",
  "kyc.pendingText": "طلب التحقق الخاص بك قيد المراجعة. يمكنك طلب الصرف بمجرد التحقق من هويتك.",
  "kyc.requiredTitle": "تحقّق من هويتك",
  "kyc.requiredText": "تُصرف الأرباح للمتداولين الموثّقين فقط. تحقّق من هويتك قبل الصرف الأول.",
  "kyc.rejectedText": "تم رفض طلب التحقق الخاص بك. أعد تقديمه لتلقي عمليات الصرف.",

  // Why a payout can't be requested yet
  "blocker.notYetEligible": "لم تُفتح نافذة الصرف بعد.",
  "blocker.belowMinimum": "الربح أقل من الحد الأدنى للصرف.",
  "blocker.positionsOpen": "أغلق جميع الصفقات المفتوحة لطلب الصرف.",
  "blocker.payoutPending": "يوجد طلب صرف قيد المراجعة بالفعل.",
  "blocker.consistency": "لم تتحقق قاعدة الاتساق: حصة أفضل يوم لديك من الربح كبيرة جدًا.",

  // Certificates
  "certs.title": "الشهادات", // display
  "certs.subtitle": "كل مرحلة تجتازها وكل حساب ممول وكل عملية صرف تمنحك شهادة يمكن لأي شخص التحقق منها.",
  "certs.kind.pass": "اجتياز مرحلة",
  "certs.kind.funded": "متداول ممول",
  "certs.kind.payout": "صرف أرباح",
  "certs.revoked": "ملغاة",
  "certs.revokedBody": "ألغت Kalks هذه الشهادة ولم تعد صالحة، لذا لا يمكن مشاركتها.",
  "certs.meta": "{plan} · {size} · {date}",
  "certs.number": "رقم {code}",
  "certs.shareImage": "مشاركة الصورة",
  "certs.shareLink": "مشاركة الرابط",
  "certs.copyLink": "نسخ الرابط",
  "certs.linkCopied": "تم نسخ رابط التحقق",
  "certs.shareTitle": "شهادتي من Kalks Prop",
  "certs.shareMessage": "شهادتي من Kalks Prop. تحقّق منها هنا:",
  "certs.shareFailed": "تعذّرت مشاركة الشهادة. يُرجى المحاولة مرة أخرى.",
  "certs.shareUnavailable": "المشاركة غير متاحة على هذا الجهاز.",
  "certs.emptyTitle": "لا توجد شهادات بعد", // display
  "certs.emptyBody": "اجتز مرحلة من مراحل التحدي لتحصل على شهادتك الأولى، مع رابط عام يمكن لأي شخص التحقق منه.",
  "certs.emptyAction": "تصفح التحديات",

  // Rule words shared by the checkout and the rules sheet
  accountSize: "حجم الحساب",
  profitSplit: "تقسيم الأرباح",
  feeRefund: "استرداد الرسوم",
  nonRefundable: "غير قابلة للاسترداد",
  leverage: "الرافعة المالية",
  none: "لا يوجد",
  allowed: "مسموح",
  notAllowed: "غير مسموح",
  noTimeLimit: "بلا مهلة زمنية",
  // {phase} is the phase name, e.g. "Phase 1"
  "rules.phaseTarget": "هدف {phase}",
  "rules.phaseMinDays": "الحد الأدنى للأيام في {phase}",
  "rules.phaseTimeLimit": "المهلة الزمنية لـ {phase}",
  "rules.evaluation": "التقييم",
  "rules.evaluationNone": "لا يوجد، ممول من اليوم الأول",
  "rules.dailyLoss": "حد الخسارة اليومية",
  "rules.dailyLossBalance": "{pct}% · {amount} · من الرصيد عند 17:00 New York",
  "rules.dailyLossEquity": "{pct}% · {amount} · من الأعلى بين الرصيد وحقوق الملكية عند 17:00 New York",
  "rules.ddStatic": "{pct}% ثابت",
  "rules.ddTrailing": "{pct}% متحرك",
  "rules.ddLocks": "{dd}، يثبت عند نقطة البداية",
  // ≤ = at most
  "rules.consistencyValue": "أفضل يوم ≤ {pct}% من إجمالي الربح",
  "rules.news": "التداول وقت الأخبار",
  "rules.newsBlocked": "ليس خلال ±{min} دقيقة من الأخبار عالية التأثير",
  "rules.newsBlockedFails": "ليس خلال ±{min} دقيقة من الأخبار عالية التأثير (يؤدي إلى فشل الحساب)",
  "rules.weekendClosed": "تُغلق الصفقات يوم الجمعة 16:45 New York",
  "rules.ea": "المستشارون الخبراء",
  "rules.banned": "الاستراتيجيات المحظورة",
  "rules.splitScaling": "{split}%، ترتفع حتى {max}%",
  "rules.firstPayout": "الصرف الأول",
  // {freq} is a lower-case payout cycle, e.g. "أسبوعيًا"
  "rules.firstPayoutValue": "بعد {days}، ثم {freq} · الحد الأدنى {min}",
  "rules.refunded": "تُسترد مع الصرف الأول",

  // Banned trading strategies
  "banned.hft": "التداول عالي التردد",
  "banned.latencyArbitrage": "مراجحة زمن الاستجابة",
  "banned.tickScalping": "مضاربة التيك",
  "banned.crossAccountCopying": "النسخ بين الحسابات",
  "banned.crossAccountHedging": "التحوط بين الحسابات",
  "banned.martingale": "مارتينجال",
  "banned.grid": "تداول الشبكة",

  // Payout cycle, used inside sentences ("ثم أسبوعيًا")
  "payoutFreq.weekly": "أسبوعيًا",
  "payoutFreq.biWeekly": "كل أسبوعين",
  "payoutFreq.monthly": "شهريًا",
  "payoutFreq.onDemand": "عند الطلب",

  // Errors (messages for the prop service's error codes)
  "errorLink.deposit": "إيداع",
  "errorLink.verify": "التحقق من الهوية",
  "error.insufficientFunds": "رصيد محفظة USDT لديك غير كافٍ لهذه الرسوم. أودِع USDT وحاول مرة أخرى.",
  "error.kycRequired": "تحقّق من هويتك قبل طلب صرف الأرباح.",
  "error.paymentPending": "لم نتمكن من تأكيد الدفع من المحفظة بعد. حاول مرة أخرى بعد دقيقة: لن يتم الخصم مرتين.",
  "error.paymentFailed": "لم تتم عملية الدفع من المحفظة. لم يتم خصم أي مبلغ منك.",
  "error.walletPending": "لم تؤكد المحفظة بعد. يُرجى المحاولة مرة أخرى بعد دقيقة.",
  "error.walletRejected": "رفضت المحفظة هذه الدفعة. يُرجى التواصل مع الدعم.",
  "error.provisioning": "تم استلام الدفعة. لا يزال حساب التداول قيد الفتح: سيظهر ضمن تحدياتك خلال دقيقة.",
  "error.planUnavailable": "هذه الخطة أو هذا الحجم لم يعد متاحًا. يُرجى اختيار خيار آخر.",
  "error.notYetEligible": "هذا الحساب غير مؤهل لصرف الأرباح بعد.",
  "error.belowMinimum": "الربح أقل من الحد الأدنى لمبلغ الصرف.",
  "error.positionsOpen": "أغلق جميع الصفقات المفتوحة قبل طلب صرف الأرباح.",
  "error.payoutPending": "يوجد طلب صرف لهذا الحساب قيد المراجعة بالفعل.",
  "error.consistency": "لم تتحقق قاعدة الاتساق بعد: حصة أفضل يوم لديك من الربح كبيرة جدًا.",
  "error.notFunded": "صرف الأرباح متاح للحسابات الممولة فقط.",
  "error.accountUnavailable": "تعذّر فتح حساب التداول لهذا التحدي، لذا أُعيدت الرسوم إلى محفظة USDT الخاصة بك. تواصل مع الدعم إذا تكرر ذلك.",
  "error.idempotencyConflict": "تم استخدام عملية الدفع هذه بالفعل لشراء آخر. أغلقها وابدأ من جديد.",
  "error.notActive": "هذا التحدي غير نشط.",
  "error.accountLimit": "لقد وصلت إلى الحد الأقصى لعدد حسابات Prop. تواصل مع الدعم لرفع الحد.",
  "error.staffReadOnly": "هذه جلسة موظف للقراءة فقط. التغييرات غير مسموح بها.",
  "error.engine": "لم يستجب خادم التداول. يُرجى المحاولة مرة أخرى بعد قليل.",
  "error.generic": "حدث خطأ ما. يُرجى المحاولة مرة أخرى.",
  "load.title": "تحديات Prop غير متاحة", // display
  "load.body": "تعذّر الوصول إلى خدمة Prop. حساباتك آمنة؛ يُرجى المحاولة مرة أخرى بعد قليل.",
};
export default mobileProp;
