import type { NsMessages } from "../../core";

const dashboard: NsMessages<"dashboard"> = {
  // Page header (Client Area home). {name} = client's first name
  "greeting.morning": "صبح بخیر، {name}",
  "greeting.afternoon": "عصر بخیر، {name}",
  "greeting.evening": "شب بخیر، {name}",
  "greeting.welcome": "خوش آمدید، {name}",
  "subtitle.live": "به Kalks خوش آمدید. وضعیت حساب شما و بازارهای امروز را اینجا ببینید.",
  "subtitle.demo": "عملکرد امروز حساب‌های شما را اینجا ببینید.",
  launchTrader: "اجرای Kalks Trader",
  openTerminal: "باز کردن ترمینال معاملاتی",

  // Getting started checklist
  "steps.title": "شروع کار",
  "steps.subtitle": "پیشرفت شما تا معامله واقعی",
  "steps.progress": "{done} از {total}",
  "steps.account.title": "حساب خود را بسازید",
  "steps.account.text": "ثبت‌نام در {date}.",
  "steps.email.title": "ایمیل خود را تأیید کنید",
  "steps.email.verified": "{email} تأیید شده است.",
  "steps.email.confirm": "{email} را با کدی که برایتان ارسال کردیم تأیید کنید.",
  "steps.kyc.title": "هویت خود را تأیید کنید",
  "steps.kyc.verified": "هویت شما تأیید شده است. برداشت فعال شد.",
  "steps.kyc.moreInfo": "تیم ما به یک مدرک دیگر از شما نیاز دارد.",
  "steps.kyc.review": "مدارک شما نزد تیم احراز هویت ما در حال بررسی است.",
  "steps.kyc.draft": "از همان‌جا که بودید ادامه دهید. حدود 3 دقیقه طول می‌کشد.",
  "steps.kyc.rejected": "امکان تأیید مدارک شما نبود. می‌توانید از نو شروع کنید.",
  "steps.kyc.todo": "حدود 3 دقیقه طول می‌کشد. برداشت را فعال می‌کند.",
  "steps.accountOpen.title": "یک حساب معاملاتی باز کنید",
  // {count} = live + demo accounts in total
  "steps.accountOpen.opened": { one: "{live} حساب واقعی و {demo} حساب دمو باز است.", other: "{live} حساب واقعی و {demo} حساب دمو باز است." },
  "steps.accountOpen.todo": "یک حساب واقعی یا دمو باز کنید؛ شناسه ورود شما فوراً صادر می‌شود.",
  "steps.wallet.title": "کیف پول خود را شارژ کنید",
  "steps.wallet.text": "واریز USDT روی شبکه TRC20 در حال راه‌اندازی است.",
  // Step status chips
  "steps.state.done": "انجام شد",
  "steps.state.todo": "انجام نشده",
  "steps.state.review": "در حال بررسی",
  "steps.state.rejected": "رد شده",
  "steps.state.soon": "شروع نشده",

  // Trading accounts card. <b> wraps the equity amount
  "accounts.title": "حساب‌های معاملاتی",
  "accounts.summary": "اکوئیتی واقعی <b>{equity}</b> · {live} واقعی · {demo} دمو · {positions} پوزیشن باز",
  "accounts.subtitle": "حساب‌های واقعی و دموی شما",
  "accounts.all": "همه حساب‌ها",
  "accounts.open": "افتتاح حساب",
  "accounts.unavailable": "حساب‌های معاملاتی در حال حاضر در دسترس نیستند. موجودی شما امن است.",
  "accounts.openLive.title": "افتتاح حساب واقعی",
  "accounts.openLive.text": "بازارهای واقعی. با موجودی صفر شروع می‌شود؛ از کیف پول خود به آن واریز کنید.",
  "accounts.openDemo.title": "افتتاح حساب دمو",
  "accounts.openDemo.text": "وجوه مجازی با قیمت‌های لحظه‌ای، قابل شارژ مجدد در هر روز.",
  "accounts.more": { one: "{count} حساب دیگر", other: "{count} حساب دیگر" },
  "accounts.myTitle": "حساب‌های معاملاتی من",

  // Your account card
  "account.title": "حساب شما",
  "account.clientId": "شناسه مشتری",
  "account.emailStatus": "وضعیت ایمیل",
  "account.notVerified": "تأیید نشده",
  "account.identity": "هویت",
  "account.memberSince": "عضو از",
  "account.profile": "پروفایل",

  // Kalks Trader banner
  "trader.chip": "قیمت‌های زنده",
  "trader.text": "قیمت‌ها و نمودارهای لحظه‌ای برای {count} ابزار در فارکس، فلزات، شاخص‌ها، انرژی، رمزارز و سهام. در مرورگر شما اجرا می‌شود و نیازی به نصب ندارد.",

  // Market clock / heatmap
  "sessions.title": "ساعت بازار",
  "sessions.open": "{open} از {total} بازار باز است",
  "heatmap.title": "نقشه حرارتی بازار",
  "heatmap.subtitle": "تغییرات امروز بر اساس قیمت‌های زنده · نقطه توخالی: بازار بسته",
  "heatmap.up": "{count} صعودی",
  "heatmap.down": "{count} نزولی",
  "heatmap.allMarkets": "همه بازارها",
  "heatmap.tipOpen": "{symbol} · بازار باز",
  "heatmap.tipClosed": "{symbol} · بازار بسته، تغییرات جلسه قبل",

  // Support card. <mail> wraps the support email address
  "support.title": "به کمک نیاز دارید؟",
  "support.text": "از آدرس ایمیل ثبت‌شده خود به <mail>{email}</mail> بنویسید و شناسه مشتری خود را ذکر کنید.",
  "support.emailSupport": "ایمیل به پشتیبانی",
  "support.copied": "آدرس ایمیل کپی شد",
  "support.copyFailed": "کپی انجام نشد، لطفاً آدرس را دستی انتخاب کنید",

  // Demo dashboard: onboarding strip
  "onboarding.title": "راه‌اندازی حساب خود را کامل کنید",
  "onboarding.text": "برای فعال شدن برداشت و سقف‌های بالاتر، احراز هویت (KYC) را تکمیل کنید.",
  "onboarding.progress": "پیشرفت",
  "onboarding.dismiss": "بستن",

  // Margin health
  "margin.title": "وضعیت مارجین",
  "margin.subtitle": "در همه حساب‌های واقعی",
  "margin.healthy": "سالم",
  "margin.level": "سطح مارجین",
  "margin.used": "مارجین استفاده‌شده",
  "margin.free": "مارجین آزاد",

  // Equity / P&L. {range} = 1W, 1M, 3M, YTD, 1Y, ALL (keep as-is)
  "equity.title": "کل اکوئیتی",
  "equity.changeOver": "تغییر در {range}",
  "pnl.title": "سود / زیان · ماه",
  "pnl.lowRisk": "ریسک پایین",
  "pnl.winRate": "نرخ برد (30 روز)",
  "pnl.trades": "معاملات (30 روز)",
  "pnl.avgWin": "میانگین معامله سودده",
  "pnl.avgLoss": "میانگین معامله زیان‌ده",
  "pnl.charges": "هزینه‌های پرداختی",

  // KPI cards
  "kpi.wallet": "کیف پول",
  "kpi.today": "+{pct}% امروز",
  "kpi.monthPnl": "سود و زیان ماه",
  "kpi.vsLastMonth": "+{pct}% نسبت به ماه قبل",
  "kpi.partnerEarnings": "درآمد همکاری",
  // Copy = copy-trading earnings
  "kpi.copy": "کپی {amount}",

  // Top movers
  "movers.title": "بیشترین تغییرات",
  "movers.gainers": "بیشترین رشد",
  "movers.losers": "بیشترین افت",

  // Economic calendar. A = Actual, F = Forecast, P = Previous
  "calendar.title": "تقویم اقتصادی",
  "calendar.subtitle": "امروز · زمان سرور GMT+3",
  "calendar.actual": "واقعی {value} · ",
  "calendar.forecastPrevious": "پیش‌بینی {forecast} · قبلی {previous}",

  // News / world
  "news.title": "اخبار بازار",
  "news.all": "همه اخبار",
  "news.pinned": "سنجاق‌شده",
  "world.title": "بازارها و اخبار سراسر جهان",
  "world.subtitle": "سرخط‌های زنده بر اساس کشور و احساسات بازار ارزها",
  "world.stories": { one: "{count} خبر امروز", other: "{count} خبر امروز" },

  // Open positions
  "positions.title": "پوزیشن‌های باز",
  "positions.summary": { one: "{count} پوزیشن · شناور", other: "{count} پوزیشن · شناور" },
  "positions.terminal": "ترمینال",

  // Partner banner. <link> wraps the referral link
  "partner.chip": "برنامه همکاری",
  "partner.title": "معامله‌گران را دعوت کنید. تا 15 دلار برای هر لات — مادام‌العمر.",
  "partner.text": "کمیسیون چندسطحی، پاداش CPA و ردیابی لحظه‌ای. لینک شما: <link>{url}</link>",
  "partner.open": "باز کردن داشبورد همکاری",

  // Short relative times (m = minutes, h = hours, d = days)
  "time.justNow": "همین حالا",
  "time.minutesAgo": "{count} دقیقه پیش",
  "time.hoursAgo": "{count} ساعت پیش",
  "time.daysAgo": "{count} روز پیش",
  // {time} = sample value like "5m"
  "time.ago": "{time} پیش",

  // Notifications bell / panel
  "notifications.title": "اعلان‌ها",
  "notifications.ariaUnread": "اعلان‌ها، {count} خوانده‌نشده",
  "notifications.markAll": "علامت‌گذاری همه به‌عنوان خوانده‌شده",
  "notifications.clear": "پاک کردن",
  "notifications.emptyTitle": "هنوز اعلانی ندارید",
  "notifications.emptyText": "واریزها، برداشت‌ها، احراز هویت، هشدارهای معاملاتی و پاسخ‌های پشتیبانی اینجا نمایش داده می‌شوند.",
  "notifications.settings": "تنظیمات اعلان‌ها",
};
export default dashboard;
