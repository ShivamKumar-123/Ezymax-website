import type { NsMessages } from "../../core";

// Kalks mobile app (apps/mobile), Reports: Statements (/reports/statements) and Analytics (/reports/analytics).
// Most labels reuse the Client Area's portfolio.st.* / portfolio.an.* keys; only mobile-specific text is here.
const mobileReports: NsMessages<"mobileReports"> = {
  eyebrow: "رپورٹس",
  "eyebrow.analytics": "رپورٹس · USD · سرور ٹائم",

  // Account picker (a card that opens a sheet)
  "account.title": "اکاؤنٹ",
  "account.choose": "اکاؤنٹ منتخب کریں",
  "account.allHint": { one: "{count} لائیو اکاؤنٹ", other: "{count} لائیو اکاؤنٹس" },
  "account.change": "اکاؤنٹ تبدیل کریں",

  // Statements
  "st.day": "دن",
  "st.pickDay": "دن منتخب کریں",
  "st.pickFrom": "شروع کی تاریخ",
  "st.pickTo": "اختتامی تاریخ",
  "st.include": "شامل کریں",
  "st.summary": "#{login} · {period} · {format}",
  "st.preparing": "تیار ہو رہی ہے…",
  "st.ready": "اسٹیٹمنٹ تیار ہے",
  "st.saved": "{file} کے نام سے محفوظ ہو گئی",
  "st.shareTitle": "اسٹیٹمنٹ شیئر کریں",
  "st.failed": "اسٹیٹمنٹ ڈاؤن لوڈ نہیں ہو سکی",
  "st.offline": "آپ آف لائن ہیں۔ اسٹیٹمنٹس ڈاؤن لوڈ کرنے کے لیے انٹرنیٹ سے جڑیں۔",
  "st.monthly.empty": "ابھی کسی مہینے کی اسٹیٹمنٹ نہیں۔",
  "st.monthly.offline": "آپ آف لائن ہیں۔ ماہانہ اسٹیٹمنٹس دیکھنے کے لیے انٹرنیٹ سے جڑیں۔",
  "st.monthly.a11y": "{month}: خالص {net}، {trades}۔ ڈاؤن لوڈز کھولتا ہے۔",
  "st.month.title": "{month} کی اسٹیٹمنٹ",
  "st.month.formats": "ڈاؤن لوڈ فارمیٹ",
  "st.prevMonth": "پچھلا مہینہ",
  "st.nextMonth": "اگلا مہینہ",

  // Analytics: hero and stat tiles
  "an.hero.label": "خالص P&L · {period}",
  "an.hero.return": "ریٹرن",
  "an.hero.trades": "ٹریڈز",
  "an.hero.lots": "لاٹ",
  "an.tile.sharpe": "Sharpe ریشو",
  "an.tile.expectancy": "متوقع قدر",
  "an.tile.sortino": "Sortino {value}",
  "an.tile.avgWinLoss": "اوسط جیت / نقصان",
  "an.tile.rr": "منافع : رسک 1 : {value}",
  "an.tile.holdSplit": "جیتنے والی {win} · ہارنے والی {loss}",
  "an.tile.streaks": "مسلسل سلسلے",
  "an.tile.streaksSub": "لگاتار جیت / نقصان",
  "an.tile.trade": "{side} {volume} · #{ticket}",
  "an.tile.none": "ابھی کوئی ٹریڈ نہیں",

  // Analytics: curves
  "an.curve.hint": "ہر دن دیکھنے کے لیے چارٹ کو چھو کر رکھیں",
  "an.curve.drawdown": "ڈرا ڈاؤن",
  "an.curve.a11y": "{date} کو ایکویٹی {equity}، بیلنس {balance}۔ زیادہ سے زیادہ ڈرا ڈاؤن {drawdown}۔",

  // Analytics: P&L calendar (net of closed trades per server day)
  "an.cal.title": "P&L کیلنڈر",
  "an.cal.subtitle": "ہر سرور دن کی بند ٹریڈز کا خالص نتیجہ",
  "an.cal.subtitleEstimated": "روزانہ بیلنس کی تبدیلی، ڈپازٹس اور رقم نکالنا منہا کر کے",
  "an.cal.days": { one: "{count} ٹریڈنگ دن", other: "{count} ٹریڈنگ دن" },
  "an.cal.green": "{count} سبز",
  "an.cal.red": "{count} سرخ",
  "an.cal.noTrades": "کوئی بند ٹریڈ نہیں",
  "an.cal.select": "نتیجہ دیکھنے کے لیے کسی دن پر ٹیپ کریں",
  "an.cal.a11yDay": "{date}: {net}، {trades}",

  // Analytics: breakdowns
  "an.hour.byHour": "گھنٹے کے لحاظ سے خالص P&L",
  "an.hour.byDayHour": "دن × گھنٹہ",
  "an.hour.tap": "تفصیلات کے لیے کسی بار یا خانے پر ٹیپ کریں",
  "an.tapBar": "تفصیلات کے لیے کسی بار پر ٹیپ کریں",
  "an.session.best": "بہترین",
  "an.session.asia": "ایشیا",
  "an.session.london": "لندن",
  "an.session.overlap": "لندن / نیویارک",
  "an.session.newYork": "نیویارک",
  "an.session.lateNewYork": "نیویارک کا آخری حصہ",
  "an.side.split": "{long} · {short}",
  "an.flow.equityNow": "موجودہ ایکویٹی",
  "an.charges.total": "ادا شدہ چارجز",

  // Behaviour insights (the numbers come from the reports service)
  "insight.overtrading.title": { one: "{count} دن اوور ٹریڈنگ", other: "{count} دن اوور ٹریڈنگ" },
  "insight.overtrading.text": "ان دنوں آپ نے {limit} سے زیادہ ٹریڈز کیں (آپ کے عام دن میں {median} ہوتی ہیں)۔ ان دنوں کا خالص نتیجہ: {net}۔",
  "insight.overtrading.tip": "روزانہ {cap} ٹریڈز کی حد مقرر کریں۔",
  "insight.revenge.title": { one: "{count} ممکنہ ریوینج ٹریڈ", other: "{count} ممکنہ ریوینج ٹریڈز" },
  "insight.revenge.text": "نقصان پر بند ہونے کے 15 منٹ کے اندر اسی یا اس سے بڑے سائز پر کھولی گئی ٹریڈز۔ یہ {rate}% بار جیتیں، مجموعی طور پر {net}۔",
  "insight.revenge.tip": "نقصان کے بعد اگلی ٹریڈ سے پہلے 15 منٹ رکیں۔",
  "insight.risk.title": "ہر نقصان والی ٹریڈ پر رسک",
  "insight.risk.text": {
    one: "نقصان والی ٹریڈ پر اوسطاً آپ کے بیلنس کا {avg}% گیا، زیادہ سے زیادہ {max}%۔ {count} نقصان 2% سے زیادہ تھا۔",
    other: "نقصان والی ٹریڈ پر اوسطاً آپ کے بیلنس کا {avg}% گیا، زیادہ سے زیادہ {max}%۔ {count} نقصانات 2% سے زیادہ تھے۔",
  },
  "insight.risk.tip": "پوزیشن کا سائز ایسا رکھیں کہ اسٹاپ لاس لگنے پر بیلنس کا زیادہ سے زیادہ 1–2% جائے۔",
  "insight.holdLosers.title": "نقصان والی ٹریڈز منافع والی ٹریڈز سے زیادہ دیر رکھی جاتی ہیں",
  "insight.holdLosers.text": "نقصان والی ٹریڈز اوسطاً {loss} کھلی رہتی ہیں، منافع والی {win}۔",
  "insight.holdLosers.tip": "ٹریڈ کھولتے وقت اسٹاپ لاس لگائیں اور اسے وہیں رہنے دیں۔",
  "insight.stopOut.title": { one: "اسٹاپ آؤٹ سے {count} پوزیشن بند", other: "اسٹاپ آؤٹ سے {count} پوزیشنز بند" },
  "insight.stopOut.text": "پوزیشنز مارجن اسٹاپ آؤٹ سے بند ہوئیں، آپ کے اپنے اسٹاپ لاس سے نہیں۔",
  "insight.stopOut.tip": "چھوٹی پوزیشنز کے ذریعے مارجن لیول کو مارجن کال لیول سے اوپر رکھیں۔",
  "insight.slTp.title": "اسٹاپ لاس یا ٹیک پرافٹ سے بند ہونے والی ٹریڈز",
  "insight.slTp.text": "{tp} ٹیک پرافٹ سے، {sl} اسٹاپ لاس سے، باقی دستی طور پر یا ڈیسک نے بند کیں۔",
  "insight.slTp.tip": "منصوبہ بند ایگزٹس نتائج کو مستحکم رکھتے ہیں۔",
  "insight.session.title": "بہترین سیشن: {session}",
  "insight.session.text": "{rate}% جیت کی شرح کے ساتھ {trades} ٹریڈز۔ سب سے کمزور: {worst} ({net})۔",
  "insight.session.tip": "{session} سیشن پر توجہ دیں۔",
  "insight.tip": "مشورہ",

  // States
  "state.updating": "اپ ڈیٹ ہو رہا ہے…",
  "state.stale": "محفوظ شدہ ڈیٹا دکھایا جا رہا ہے۔ ریفریش کے لیے نیچے کھینچیں۔",
  "state.notShared.title": "آپ کے ساتھ شیئر نہیں کیا گیا",
  "state.footer": "تمام رقوم USD میں ہیں (سینٹ اکاؤنٹس تبدیل شدہ)۔ اوقات سرور ٹائم، GMT+2 / GMT+3 میں ہیں۔",
  "state.footerStatements": "اسٹیٹمنٹس اکاؤنٹ کی کرنسی میں ہیں (سینٹ اکاؤنٹس کے لیے USC)۔ اوقات سرور ٹائم، GMT+2 / GMT+3 میں ہیں۔",
};
export default mobileReports;
