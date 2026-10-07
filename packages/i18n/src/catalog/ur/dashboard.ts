import type { NsMessages } from "../../core";

const dashboard: NsMessages<"dashboard"> = {
  // Page header (Client Area home). {name} = client's first name
  "greeting.morning": "صبح بخیر، {name}",
  "greeting.afternoon": "سلام، {name}",
  "greeting.evening": "شام بخیر، {name}",
  "greeting.welcome": "خوش آمدید، {name}",
  "subtitle.live": "Kalks میں خوش آمدید۔ یہ رہا آپ کا اکاؤنٹ اور آج کی مارکیٹس۔",
  "subtitle.demo": "آج آپ کے اکاؤنٹس کی کارکردگی یہ ہے۔",
  launchTrader: "Kalks Trader کھولیں",
  openTerminal: "ٹریڈنگ ٹرمینل کھولیں",

  // Getting started checklist
  "steps.title": "آغاز کریں",
  "steps.subtitle": "لائیو ٹریڈنگ کی جانب آپ کی پیش رفت",
  "steps.progress": "{total} میں سے {done}",
  "steps.account.title": "اپنا اکاؤنٹ بنائیں",
  "steps.account.text": "{date} کو رجسٹر ہوا۔",
  "steps.email.title": "اپنی ای میل کی تصدیق کریں",
  "steps.email.verified": "{email} کی تصدیق ہو چکی ہے۔",
  "steps.email.confirm": "ہمارے بھیجے گئے کوڈ سے {email} کی تصدیق کریں۔",
  "steps.kyc.title": "اپنی شناخت کی تصدیق کریں",
  "steps.kyc.verified": "آپ کی شناخت کی تصدیق ہو گئی ہے۔ رقم نکالنے کی سہولت کھل گئی ہے۔",
  "steps.kyc.moreInfo": "ہماری ٹیم کو آپ سے ایک اور دستاویز درکار ہے۔",
  "steps.kyc.review": "آپ کی دستاویزات ہماری تصدیقی ٹیم کے پاس ہیں۔",
  "steps.kyc.draft": "جہاں چھوڑا تھا وہیں سے جاری رکھیں۔ تقریباً 3 منٹ لگتے ہیں۔",
  "steps.kyc.rejected": "ہم آپ کی دستاویزات کی تصدیق نہیں کر سکے۔ آپ دوبارہ شروع کر سکتے ہیں۔",
  "steps.kyc.todo": "تقریباً 3 منٹ لگتے ہیں۔ رقم نکالنے کی سہولت کھل جاتی ہے۔",
  "steps.accountOpen.title": "ٹریڈنگ اکاؤنٹ کھولیں",
  "steps.accountOpen.opened": { one: "{live} لائیو اور {demo} ڈیمو اکاؤنٹ کھلا ہے۔", other: "{live} لائیو اور {demo} ڈیمو اکاؤنٹس کھلے ہیں۔" },
  "steps.accountOpen.todo": "لائیو یا ڈیمو اکاؤنٹ کھولیں؛ آپ کا لاگ اِن فوراً جاری ہو جاتا ہے۔",
  "steps.wallet.title": "اپنے والیٹ میں فنڈز جمع کریں",
  "steps.wallet.text": "TRC20 پر USDT ڈپازٹس منسلک کیے جا رہے ہیں۔",
  // Step status chips
  "steps.state.done": "مکمل",
  "steps.state.todo": "باقی ہے",
  "steps.state.review": "زیر جائزہ",
  "steps.state.rejected": "مسترد",
  "steps.state.soon": "شروع نہیں ہوا",

  // Trading accounts card. <b> wraps the equity amount
  "accounts.title": "ٹریڈنگ اکاؤنٹس",
  "accounts.summary": "لائیو ایکویٹی <b>{equity}</b> · {live} لائیو · {demo} ڈیمو · {positions} کھلی پوزیشنز",
  "accounts.subtitle": "آپ کے لائیو اور ڈیمو اکاؤنٹس",
  "accounts.all": "تمام اکاؤنٹس",
  "accounts.open": "اکاؤنٹ کھولیں",
  "accounts.unavailable": "ٹریڈنگ اکاؤنٹس اس وقت دستیاب نہیں ہیں۔ آپ کے بیلنس محفوظ ہیں۔",
  "accounts.openLive.title": "لائیو اکاؤنٹ کھولیں",
  "accounts.openLive.text": "حقیقی مارکیٹس۔ صفر بیلنس سے شروع ہوتا ہے؛ اپنے والیٹ سے اسے فنڈ کریں۔",
  "accounts.openDemo.title": "ڈیمو اکاؤنٹ کھولیں",
  "accounts.openDemo.text": "ریئل ٹائم قیمتوں پر ورچوئل فنڈز، ہر روز دوبارہ بھرے جا سکتے ہیں۔",
  "accounts.more": { one: "{count} مزید اکاؤنٹ", other: "{count} مزید اکاؤنٹس" },
  "accounts.myTitle": "میرے ٹریڈنگ اکاؤنٹس",

  // Your account card
  "account.title": "آپ کا اکاؤنٹ",
  "account.clientId": "کلائنٹ ID",
  "account.emailStatus": "ای میل اسٹیٹس",
  "account.notVerified": "تصدیق نہیں ہوئی",
  "account.identity": "شناخت",
  "account.memberSince": "رکن بننے کی تاریخ",
  "account.profile": "پروفائل",

  // Kalks Trader banner
  "trader.chip": "لائیو قیمتیں",
  "trader.text": "فاریکس، دھاتوں، انڈیکسز، توانائی، کرپٹو اور اسٹاکس کے {count} انسٹرومنٹس کے لیے ریئل ٹائم کوٹس اور چارٹس۔ آپ کے براؤزر میں چلتا ہے، کچھ انسٹال کرنے کی ضرورت نہیں۔",

  // Market clock / heatmap
  "sessions.title": "مارکیٹ گھڑی",
  "sessions.open": "{total} میں سے {open} مارکیٹس کھلی ہیں",
  "heatmap.title": "مارکیٹ ہیٹ میپ",
  "heatmap.subtitle": "لائیو قیمتوں سے آج کی تبدیلی · خالی نقطہ: مارکیٹ بند",
  "heatmap.up": "{count} اوپر",
  "heatmap.down": "{count} نیچے",
  "heatmap.allMarkets": "تمام مارکیٹس",
  "heatmap.tipOpen": "{symbol} · مارکیٹ کھلی ہے",
  "heatmap.tipClosed": "{symbol} · مارکیٹ بند، پچھلے سیشن کی تبدیلی",

  // Support card. <mail> wraps the support email address
  "support.title": "مدد چاہیے؟",
  "support.text": "اپنے رجسٹرڈ ایڈریس سے <mail>{email}</mail> پر لکھیں اور اپنی کلائنٹ ID شامل کریں۔",
  "support.emailSupport": "سپورٹ کو ای میل کریں",
  "support.copied": "ای میل ایڈریس کاپی ہو گیا",
  "support.copyFailed": "کاپی نہیں ہو سکا، براہ کرم ایڈریس خود منتخب کریں",

  // Demo dashboard: onboarding strip
  "onboarding.title": "اپنے اکاؤنٹ کا سیٹ اپ مکمل کریں",
  "onboarding.text": "رقم نکالنے اور زیادہ حدود کے لیے KYC مکمل کریں۔",
  "onboarding.progress": "پیش رفت",
  "onboarding.dismiss": "ہٹائیں",

  // Margin health
  "margin.title": "مارجن کی صورتحال",
  "margin.subtitle": "تمام لائیو اکاؤنٹس میں",
  "margin.healthy": "صحت مند",
  "margin.level": "مارجن لیول",
  "margin.used": "استعمال شدہ مارجن",
  "margin.free": "فری مارجن",

  // Equity / P&L. {range} = 1W, 1M, 3M, YTD, 1Y, ALL (keep as-is)
  "equity.title": "کل ایکویٹی",
  "equity.changeOver": "{range} میں تبدیلی",
  "pnl.title": "منافع / نقصان · مہینہ",
  "pnl.lowRisk": "کم خطرہ",
  "pnl.winRate": "کامیابی کی شرح (30 دن)",
  "pnl.trades": "ٹریڈز (30 دن)",
  "pnl.avgWin": "اوسط منافع بخش ٹریڈ",
  "pnl.avgLoss": "اوسط نقصان والی ٹریڈ",
  "pnl.charges": "ادا شدہ چارجز",

  // KPI cards
  "kpi.wallet": "والیٹ",
  "kpi.today": "آج +{pct}%",
  "kpi.monthPnl": "ماہانہ P&L",
  "kpi.vsLastMonth": "پچھلے مہینے کے مقابلے +{pct}%",
  "kpi.partnerEarnings": "پارٹنر آمدنی",
  // Copy = copy-trading earnings
  "kpi.copy": "کاپی {amount}",

  // Top movers
  "movers.title": "سب سے زیادہ حرکت",
  "movers.gainers": "اضافہ",
  "movers.losers": "کمی",

  // Economic calendar. A = Actual, F = Forecast, P = Previous
  "calendar.title": "اکنامک کیلنڈر",
  "calendar.subtitle": "آج · سرور ٹائم GMT+3",
  "calendar.actual": "A {value} · ",
  "calendar.forecastPrevious": "F {forecast} · P {previous}",

  // News / world
  "news.title": "مارکیٹ کی خبریں",
  "news.all": "تمام خبریں",
  "news.pinned": "پن شدہ",
  "world.title": "دنیا بھر کی مارکیٹس اور خبریں",
  "world.subtitle": "ملک کے لحاظ سے تازہ سرخیاں اور کرنسی کا رجحان",
  "world.stories": { one: "آج {count} خبر", other: "آج {count} خبریں" },

  // Open positions
  "positions.title": "کھلی پوزیشنز",
  "positions.summary": { one: "{count} پوزیشن · فلوٹنگ", other: "{count} پوزیشنز · فلوٹنگ" },
  "positions.terminal": "ٹرمینل",

  // Partner banner. <link> wraps the referral link
  "partner.chip": "پارٹنر پروگرام",
  "partner.title": "ٹریڈرز کو مدعو کریں۔ فی لاٹ $15 تک کمائیں — تاحیات۔",
  "partner.text": "کثیر سطحی کمیشن، CPA بونس اور ریئل ٹائم ٹریکنگ۔ آپ کا لنک: <link>{url}</link>",
  "partner.open": "پارٹنر ڈیش بورڈ کھولیں",

  // Short relative times
  "time.justNow": "ابھی",
  "time.minutesAgo": "{count} منٹ پہلے",
  "time.hoursAgo": "{count} گھنٹے پہلے",
  "time.daysAgo": "{count} دن پہلے",
  // {time} = sample value like "5m"
  "time.ago": "{time} پہلے",

  // Notifications bell / panel
  "notifications.title": "اطلاعات",
  "notifications.ariaUnread": "اطلاعات، {count} غیر پڑھی ہوئی",
  "notifications.markAll": "سب کو پڑھا ہوا نشان زد کریں",
  "notifications.clear": "صاف کریں",
  "notifications.emptyTitle": "ابھی کوئی اطلاع نہیں",
  "notifications.emptyText": "ڈپازٹس، رقم نکالنے، تصدیق، ٹریڈنگ الرٹس اور سپورٹ کے جوابات یہاں نظر آتے ہیں۔",
  "notifications.settings": "اطلاعات کی ترتیبات",

  // Client Area redesign: side menu, dashboard overview
  "chrome.expand": "مینو پھیلائیں",
  "chrome.collapse": "مینو سمیٹیں",
  "chrome.menu": "مینو",
  "home.todayPnl": "آج کا نفع/نقصان",
  "home.walletBalance": "والیٹ بیلنس",
  "home.rewardsEarnings": "انعامات اور IB آمدنی",
  "home.todayPct": "آج {pct}%",
  "home.floating": "فلوٹنگ نفع/نقصان",
  "home.rewards": "انعامات",
  "home.accountsChip": "{live} لائیو · {positions} کھلی پوزیشنز",
  "home.statistics": "اعداد و شمار",
  "home.pnl": "نفع/نقصان",
  "home.weekly": "ہفتہ وار",
  "home.monthly": "ماہانہ",
  "home.lastYear": "پچھلا سال",
  "home.noHistory": "آپ کے لائیو اکاؤنٹس میں سرگرمی شروع ہوتے ہی ایکویٹی کی تاریخ یہاں نظر آئے گی۔",
  "home.thisPeriod": "یہ مدت",
  "home.previousPeriod": "پچھلی مدت",
  "home.yourAccounts": "آپ کے اکاؤنٹس",
  "home.tradingAccount": "ٹریڈنگ اکاؤنٹ",
  "home.accountInfo": "اکاؤنٹ کی معلومات",
  "home.accountName": "اکاؤنٹ کا نام",
  "home.leverage": "لیوریج",
  "home.previous": "پچھلا اکاؤنٹ",
  "home.next": "اگلا اکاؤنٹ",
  "home.showBalances": "بیلنس دکھائیں",
  "home.hideBalances": "بیلنس چھپائیں",
  "home.trade": "ٹریڈ کریں",
  "home.history": "تاریخچہ",
  "home.funding": "فنڈنگ",
  "home.linked": "منسلک",
  "home.connected": "منسلک",
  "home.subscriptions": { one: "{count} فعال سبسکرپشن", other: "{count} فعال سبسکرپشنز" },
  "home.points": "{points} پوائنٹس",
  "home.redeem": "ریڈیم کریں",
  "home.networkUnavailable": "موقوف",
  "home.totalBalance": "کل بیلنس",
  "home.totalBalanceSub": "لائیو اکاؤنٹس اور والیٹ",
  "home.transferFunds": "فنڈز منتقل کریں",
  "home.quickActions": "فوری کارروائیاں",
  "home.later": "بعد میں",
  "home.viewDetails": "تفصیلات دیکھیں",
  "home.verifyNow": "ابھی تصدیق کریں",
  "home.fundTitle": "اپنا والیٹ فنڈ کریں",
  "home.fundText": "لائیو اکاؤنٹ پر ٹریڈنگ شروع کرنے کے لیے USDT جمع کریں۔",
  "home.depositNow": "ابھی جمع کریں",
  "home.tradingTitle": "ٹریڈنگ",
  "home.marketsTitle": "مارکیٹس",
  "home.moreTitle": "آپ کے لیے مزید",
};
export default dashboard;
