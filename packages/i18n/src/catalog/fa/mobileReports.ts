import type { NsMessages } from "../../core";

// Kalks mobile app, Reports: Statements (/reports/statements) and Analytics (/reports/analytics).
// Most labels reuse the Client Area's portfolio.st.* / portfolio.an.* keys; only mobile-specific text is here.
const mobileReports: NsMessages<"mobileReports"> = {
  eyebrow: "گزارش‌ها",
  "eyebrow.analytics": "گزارش‌ها · USD · زمان سرور",

  // Account picker (a card that opens a sheet)
  "account.title": "حساب",
  "account.choose": "انتخاب حساب",
  "account.allHint": { one: "{count} حساب واقعی", other: "{count} حساب واقعی" },
  "account.change": "تغییر حساب",

  // Statements
  "st.day": "روز",
  "st.pickDay": "انتخاب روز",
  "st.pickFrom": "تاریخ شروع",
  "st.pickTo": "تاریخ پایان",
  "st.include": "شامل",
  "st.summary": "#{login} · {period} · {format}",
  "st.preparing": "در حال آماده‌سازی…",
  "st.ready": "صورت‌حساب آماده است",
  "st.saved": "با نام {file} ذخیره شد",
  "st.shareTitle": "اشتراک صورت‌حساب",
  "st.failed": "دانلود صورت‌حساب انجام نشد",
  "st.offline": "آفلاین هستید. برای دانلود صورت‌حساب‌ها متصل شوید.",
  "st.monthly.empty": "هنوز صورت‌حساب ماهانه‌ای وجود ندارد.",
  "st.monthly.offline": "آفلاین هستید. برای دیدن صورت‌حساب‌های ماهانه متصل شوید.",
  "st.monthly.a11y": "{month}: خالص {net}، {trades}. دانلودها را باز می‌کند.",
  "st.month.title": "صورت‌حساب {month}",
  "st.month.formats": "دانلود با قالب",
  "st.prevMonth": "ماه قبل",
  "st.nextMonth": "ماه بعد",

  // Analytics: hero and stat tiles
  "an.hero.label": "سود/زیان خالص · {period}",
  "an.hero.return": "بازده",
  "an.hero.trades": "معاملات",
  "an.hero.lots": "لات",
  "an.tile.sharpe": "نسبت Sharpe",
  "an.tile.expectancy": "امید ریاضی",
  "an.tile.sortino": "Sortino {value}",
  "an.tile.avgWinLoss": "میانگین سود / زیان",
  "an.tile.rr": "سود : ریسک 1 : {value}",
  "an.tile.holdSplit": "سودده {win} · زیان‌ده {loss}",
  "an.tile.streaks": "توالی‌ها",
  "an.tile.streaksSub": "سود / زیان پشت سر هم",
  "an.tile.trade": "{side} {volume} · #{ticket}",
  "an.tile.none": "هنوز معامله‌ای نیست",

  // Analytics: curves
  "an.curve.hint": "برای دیدن هر روز، نمودار را لمس کنید و نگه دارید",
  "an.curve.drawdown": "افت سرمایه",
  "an.curve.a11y": "اکوئیتی {equity}، موجودی {balance} در {date}. حداکثر افت سرمایه {drawdown}.",

  // Analytics: P&L calendar (net of closed trades per server day)
  "an.cal.title": "تقویم سود/زیان",
  "an.cal.subtitle": "نتیجه خالص معاملات بسته‌شده در هر روز سرور",
  "an.cal.subtitleEstimated": "تغییر روزانه موجودی، بدون واریزها و برداشت‌ها",
  "an.cal.days": { one: "{count} روز معاملاتی", other: "{count} روز معاملاتی" },
  "an.cal.green": "{count} سبز",
  "an.cal.red": "{count} قرمز",
  "an.cal.noTrades": "بدون معامله بسته‌شده",
  "an.cal.select": "برای دیدن نتیجه، روی یک روز ضربه بزنید",
  "an.cal.a11yDay": "{date}: {net}، {trades}",

  // Analytics: breakdowns
  "an.hour.byHour": "سود/زیان خالص به تفکیک ساعت",
  "an.hour.byDayHour": "روز هفته × ساعت",
  "an.hour.tap": "برای جزئیات روی یک ستون یا خانه ضربه بزنید",
  "an.tapBar": "برای جزئیات روی یک ستون ضربه بزنید",
  "an.session.best": "بهترین",
  "an.session.asia": "آسیا",
  "an.session.london": "لندن",
  "an.session.overlap": "لندن / نیویورک",
  "an.session.newYork": "نیویورک",
  "an.session.lateNewYork": "اواخر نیویورک",
  "an.side.split": "{long} · {short}",
  "an.flow.equityNow": "اکوئیتی فعلی",
  "an.charges.total": "هزینه‌های پرداختی",

  // Behaviour insights (the numbers come from the reports service)
  "insight.overtrading.title": { one: "معامله بیش از حد در {count} روز", other: "معامله بیش از حد در {count} روز" },
  "insight.overtrading.text": "در این روزها بیش از {limit} معامله انجام دادید (روز معمول شما {median} است). نتیجه خالص این روزها: {net}.",
  "insight.overtrading.tip": "سقف روزانه {cap} معامله تعیین کنید.",
  "insight.revenge.title": { one: "{count} معامله انتقامی احتمالی", other: "{count} معامله انتقامی احتمالی" },
  "insight.revenge.text": "معاملاتی که ظرف 15 دقیقه پس از بستن یک معامله زیان‌ده، با همان حجم یا بیشتر باز شدند. {rate}% آن‌ها سودده بودند و در مجموع {net}.",
  "insight.revenge.tip": "پس از هر زیان، پیش از معامله بعدی 15 دقیقه صبر کنید.",
  "insight.risk.title": "ریسک هر معامله زیان‌ده",
  "insight.risk.text": {
    one: "هر معامله زیان‌ده به‌طور میانگین {avg}% و حداکثر {max}% از موجودی شما را از بین برد. {count} زیان بیش از 2% بود.",
    other: "هر معامله زیان‌ده به‌طور میانگین {avg}% و حداکثر {max}% از موجودی شما را از بین برد. {count} زیان بیش از 2% بود.",
  },
  "insight.risk.tip": "حجم پوزیشن‌ها را طوری تعیین کنید که حد ضرر حداکثر 1–2% از موجودی هزینه داشته باشد.",
  "insight.holdLosers.title": "معاملات زیان‌ده بیشتر از سودده‌ها نگه داشته می‌شوند",
  "insight.holdLosers.text": "معاملات زیان‌ده به‌طور میانگین {loss} و معاملات سودده {win} باز می‌مانند.",
  "insight.holdLosers.tip": "هنگام باز کردن معامله حد ضرر بگذارید و آن را تغییر ندهید.",
  "insight.stopOut.title": { one: "{count} بستن با استاپ‌اوت", other: "{count} بستن با استاپ‌اوت" },
  "insight.stopOut.text": "پوزیشن‌ها با استاپ‌اوت مارجین بسته شدند، نه با حد ضرر خودتان.",
  "insight.stopOut.tip": "با پوزیشن‌های کوچک‌تر، سطح مارجین را بالاتر از سطح مارجین کال نگه دارید.",
  "insight.slTp.title": "معاملات بسته‌شده با حد ضرر یا حد سود",
  "insight.slTp.text": "{tp} با حد سود، {sl} با حد ضرر و بقیه به‌صورت دستی یا توسط دیلینگ دسک بسته شدند.",
  "insight.slTp.tip": "خروج‌های برنامه‌ریزی‌شده نتایج را پایدار نگه می‌دارند.",
  "insight.session.title": "بهترین سشن: {session}",
  "insight.session.text": "{trades} معامله با نرخ برد {rate}%. ضعیف‌ترین: {worst} ({net}).",
  "insight.session.tip": "روی سشن {session} تمرکز کنید.",
  "insight.tip": "نکته",

  // States
  "state.updating": "در حال به‌روزرسانی…",
  "state.stale": "نمایش داده‌های ذخیره‌شده. برای به‌روزرسانی به پایین بکشید.",
  "state.notShared.title": "با شما به اشتراک گذاشته نشده است",
  "state.footer": "همه مبالغ به USD (حساب‌های سنت تبدیل شده‌اند). زمان‌ها به وقت سرور، GMT+2 / GMT+3.",
  "state.footerStatements": "صورت‌حساب‌ها به ارز حساب هستند (USC برای حساب‌های سنت). زمان‌ها به وقت سرور، GMT+2 / GMT+3.",
};
export default mobileReports;
