import type { NsMessages } from "../../core";

const dashboard: NsMessages<"dashboard"> = {
  // Page header (Client Area home). {name} = client's first name
  "greeting.morning": "صباح الخير، {name}",
  "greeting.afternoon": "مساء الخير، {name}",
  "greeting.evening": "مساء الخير، {name}",
  "greeting.welcome": "مرحبًا، {name}",
  "subtitle.live": "مرحبًا بك في Kalks. إليك حسابك وأسواق اليوم.",
  "subtitle.demo": "إليك أداء حساباتك اليوم.",
  launchTrader: "تشغيل Kalks Trader",
  openTerminal: "فتح منصة التداول",

  // Getting started checklist
  "steps.title": "البدء",
  "steps.subtitle": "تقدّمك نحو التداول الحقيقي",
  "steps.progress": "{done} من {total}",
  "steps.account.title": "أنشئ حسابك",
  "steps.account.text": "تاريخ التسجيل: {date}.",
  "steps.email.title": "تحقّق من بريدك الإلكتروني",
  "steps.email.verified": "تم التحقق من {email}.",
  "steps.email.confirm": "أكّد {email} باستخدام الرمز الذي أرسلناه إليك.",
  "steps.kyc.title": "تحقّق من هويتك",
  "steps.kyc.verified": "تم التحقق من هويتك. أصبح السحب متاحًا.",
  "steps.kyc.moreInfo": "يحتاج فريقنا إلى مستند إضافي واحد منك.",
  "steps.kyc.review": "مستنداتك لدى فريق التحقق لدينا.",
  "steps.kyc.draft": "تابع من حيث توقفت. يستغرق ذلك نحو 3 دقائق.",
  "steps.kyc.rejected": "تعذّر علينا التحقق من مستنداتك. يمكنك البدء من جديد.",
  "steps.kyc.todo": "يستغرق نحو 3 دقائق ويتيح لك السحب.",
  "steps.accountOpen.title": "افتح حساب تداول",
  // {count} = live + demo accounts in total
  "steps.accountOpen.opened": {
    one: "الحسابات المفتوحة: {live} حقيقي و{demo} تجريبي.",
    other: "الحسابات المفتوحة: {live} حقيقي و{demo} تجريبي.",
  },
  "steps.accountOpen.todo": "افتح حسابًا حقيقيًا أو تجريبيًا؛ يتم إصدار بيانات الدخول فورًا.",
  "steps.wallet.title": "موّل محفظتك",
  "steps.wallet.text": "جارٍ ربط إيداعات USDT عبر شبكة TRC20.",
  // Step status chips
  "steps.state.done": "تم",
  "steps.state.todo": "مطلوب",
  "steps.state.review": "قيد المراجعة",
  "steps.state.rejected": "مرفوض",
  "steps.state.soon": "لم يبدأ",

  // Trading accounts card. <b> wraps the equity amount
  "accounts.title": "حسابات التداول",
  "accounts.summary": "حقوق الملكية الحقيقية <b>{equity}</b> · {live} حقيقي · {demo} تجريبي · {positions} صفقات مفتوحة",
  "accounts.subtitle": "حساباتك الحقيقية والتجريبية",
  "accounts.all": "جميع الحسابات",
  "accounts.open": "فتح حساب",
  "accounts.unavailable": "حسابات التداول غير متاحة حاليًا. أرصدتك في أمان.",
  "accounts.openLive.title": "افتح حسابًا حقيقيًا",
  "accounts.openLive.text": "أسواق حقيقية. يبدأ برصيد صفري؛ يُتاح التمويل مع إطلاق المحفظة.",
  "accounts.openDemo.title": "افتح حسابًا تجريبيًا",
  "accounts.openDemo.text": "أموال افتراضية بأسعار لحظية، قابلة لإعادة التعبئة يوميًا.",
  "accounts.more": {
    zero: "لا توجد حسابات أخرى",
    one: "حساب واحد آخر",
    two: "حسابان آخران",
    few: "{count} حسابات أخرى",
    many: "{count} حسابًا آخر",
    other: "{count} حساب آخر",
  },
  "accounts.myTitle": "حسابات التداول الخاصة بي",

  // Your account card
  "account.title": "حسابك",
  "account.clientId": "رقم العميل",
  "account.emailStatus": "حالة البريد الإلكتروني",
  "account.notVerified": "غير موثّق",
  "account.identity": "الهوية",
  "account.memberSince": "عضو منذ",
  "account.profile": "الملف الشخصي",

  // Kalks Trader banner
  "trader.chip": "أسعار مباشرة",
  "trader.text": "أسعار ورسوم بيانية لحظية لـ {count} أداة في الفوركس والمعادن والمؤشرات والطاقة والعملات المشفرة والأسهم. تعمل في متصفحك دون الحاجة إلى تثبيت.",

  // Market clock / heatmap
  "sessions.title": "ساعة الأسواق",
  "sessions.open": "{open} من {total} أسواق مفتوحة",
  "heatmap.title": "الخريطة الحرارية للسوق",
  "heatmap.subtitle": "حركة اليوم من الأسعار المباشرة · النقطة المفرغة: السوق مغلق",
  "heatmap.up": "{count} صاعد",
  "heatmap.down": "{count} هابط",
  "heatmap.allMarkets": "جميع الأسواق",
  "heatmap.tipOpen": "{symbol} · السوق مفتوح",
  "heatmap.tipClosed": "{symbol} · السوق مغلق، حركة الجلسة السابقة",

  // Support card. <mail> wraps the support email address
  "support.title": "هل تحتاج إلى مساعدة؟",
  "support.text": "راسلنا على <mail>{email}</mail> من عنوانك المسجّل مع ذكر رقم العميل الخاص بك.",
  "support.emailSupport": "راسل الدعم",
  "support.copied": "تم نسخ عنوان البريد الإلكتروني",
  "support.copyFailed": "تعذّر النسخ، يرجى تحديد العنوان يدويًا",

  // Demo dashboard: onboarding strip
  "onboarding.title": "أكمل إعداد حسابك",
  "onboarding.text": "أكمل التحقق من الهوية (KYC) لتفعيل السحب ورفع الحدود.",
  "onboarding.progress": "التقدّم",
  "onboarding.dismiss": "تجاهل",

  // Margin health
  "margin.title": "سلامة الهامش",
  "margin.subtitle": "عبر جميع الحسابات الحقيقية",
  "margin.healthy": "جيدة",
  "margin.level": "مستوى الهامش",
  "margin.used": "الهامش المستخدم",
  "margin.free": "الهامش الحر",

  // Equity / P&L. {range} = 1W, 1M, 3M, YTD, 1Y, ALL (keep as-is)
  "equity.title": "إجمالي حقوق الملكية",
  "equity.changeOver": "التغيّر خلال {range}",
  "pnl.title": "الربح / الخسارة · الشهر",
  "pnl.lowRisk": "مخاطر منخفضة",
  "pnl.winRate": "نسبة الربح (30 يومًا)",
  "pnl.trades": "الصفقات (30 يومًا)",
  "pnl.avgWin": "متوسط الصفقة الرابحة",
  "pnl.avgLoss": "متوسط الصفقة الخاسرة",
  "pnl.charges": "الرسوم المدفوعة",

  // KPI cards
  "kpi.wallet": "المحفظة",
  "kpi.today": "+{pct}% اليوم",
  "kpi.monthPnl": "ربح/خسارة الشهر",
  "kpi.vsLastMonth": "+{pct}% مقارنة بالشهر الماضي",
  "kpi.partnerEarnings": "أرباح الشريك",
  // Copy = copy-trading earnings
  "kpi.copy": "النسخ {amount}",

  // Top movers
  "movers.title": "الأكثر تحركًا",
  "movers.gainers": "الرابحون",
  "movers.losers": "الخاسرون",

  // Economic calendar. A = Actual, F = Forecast, P = Previous
  "calendar.title": "التقويم الاقتصادي",
  "calendar.subtitle": "اليوم · توقيت الخادم GMT+3",
  "calendar.actual": "الفعلي {value} · ",
  "calendar.forecastPrevious": "المتوقع {forecast} · السابق {previous}",

  // News / world
  "news.title": "أخبار السوق",
  "news.all": "جميع الأخبار",
  "news.pinned": "مثبّت",
  "world.title": "الأسواق والأخبار حول العالم",
  "world.subtitle": "عناوين مباشرة حسب الدولة ومعنويات العملات",
  "world.stories": {
    zero: "لا توجد أخبار اليوم",
    one: "خبر واحد اليوم",
    two: "خبران اليوم",
    few: "{count} أخبار اليوم",
    many: "{count} خبرًا اليوم",
    other: "{count} خبر اليوم",
  },

  // Open positions
  "positions.title": "الصفقات المفتوحة",
  "positions.summary": {
    zero: "لا توجد صفقات · عائمة",
    one: "صفقة واحدة · عائمة",
    two: "صفقتان · عائمة",
    few: "{count} صفقات · عائمة",
    many: "{count} صفقة · عائمة",
    other: "{count} صفقة · عائمة",
  },
  "positions.terminal": "المنصة",

  // Partner banner. <link> wraps the referral link
  "partner.chip": "برنامج الشركاء",
  "partner.title": "ادعُ المتداولين واربح حتى 15$ لكل لوت — مدى الحياة.",
  "partner.text": "عمولات متعددة المستويات ومكافآت CPA وتتبّع لحظي. رابطك: <link>{url}</link>",
  "partner.open": "فتح لوحة الشريك",

  // Short relative times (m = minutes, h = hours, d = days)
  "time.justNow": "الآن",
  "time.minutesAgo": "منذ {count} د",
  "time.hoursAgo": "منذ {count} س",
  "time.daysAgo": "منذ {count} ي",
  // {time} = sample value like "5m"
  "time.ago": "منذ {time}",

  // Notifications bell / panel
  "notifications.title": "الإشعارات",
  "notifications.ariaUnread": "الإشعارات، {count} غير مقروءة",
  "notifications.markAll": "تحديد الكل كمقروء",
  "notifications.clear": "مسح",
  "notifications.emptyTitle": "لا توجد إشعارات بعد",
  "notifications.emptyText": "ستظهر هنا الإيداعات وعمليات السحب والتحقق وتنبيهات التداول وردود الدعم.",
  "notifications.settings": "إعدادات الإشعارات",
};
export default dashboard;
