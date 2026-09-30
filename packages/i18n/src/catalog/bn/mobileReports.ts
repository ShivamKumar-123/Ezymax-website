import type { NsMessages } from "../../core";

// Kalks mobile app, Reports: Statements (/reports/statements) and Analytics (/reports/analytics).
// Most labels reuse the Client Area's portfolio.st.* / portfolio.an.* keys; only mobile-specific text is here.
const mobileReports: NsMessages<"mobileReports"> = {
  eyebrow: "রিপোর্ট",
  "eyebrow.analytics": "রিপোর্ট · USD · সার্ভার সময়",

  // Account picker (a card that opens a sheet)
  "account.title": "অ্যাকাউন্ট",
  "account.choose": "একটি অ্যাকাউন্ট বেছে নিন",
  "account.allHint": { one: "{count}টি লাইভ অ্যাকাউন্ট", other: "{count}টি লাইভ অ্যাকাউন্ট" },
  "account.change": "অ্যাকাউন্ট পরিবর্তন",

  // Statements
  "st.day": "দিন",
  "st.pickDay": "একটি দিন বেছে নিন",
  "st.pickFrom": "শুরুর তারিখ",
  "st.pickTo": "শেষ তারিখ",
  "st.include": "অন্তর্ভুক্ত করুন",
  "st.summary": "#{login} · {period} · {format}",
  "st.preparing": "প্রস্তুত হচ্ছে…",
  "st.ready": "স্টেটমেন্ট প্রস্তুত",
  "st.saved": "{file} হিসেবে সংরক্ষিত",
  "st.shareTitle": "স্টেটমেন্ট শেয়ার করুন",
  "st.failed": "স্টেটমেন্ট ডাউনলোড করা যায়নি",
  "st.offline": "আপনি অফলাইনে আছেন। স্টেটমেন্ট ডাউনলোড করতে সংযুক্ত হন।",
  "st.monthly.empty": "এখনো কোনো মাসিক স্টেটমেন্ট নেই।",
  "st.monthly.offline": "আপনি অফলাইনে আছেন। মাসিক স্টেটমেন্ট দেখতে সংযুক্ত হন।",
  "st.monthly.a11y": "{month}: নেট {net}, {trades}। ডাউনলোড খোলে।",
  "st.month.title": "{month}-এর স্টেটমেন্ট",
  "st.month.formats": "ডাউনলোডের ফরম্যাট",
  "st.prevMonth": "আগের মাস",
  "st.nextMonth": "পরের মাস",

  // Analytics: hero and stat tiles
  "an.hero.label": "নেট P&L · {period}",
  "an.hero.return": "রিটার্ন",
  "an.hero.trades": "ট্রেড",
  "an.hero.lots": "লট",
  "an.tile.sharpe": "Sharpe রেশিও",
  "an.tile.expectancy": "প্রত্যাশিত মান",
  "an.tile.sortino": "Sortino {value}",
  "an.tile.avgWinLoss": "গড় লাভ / ক্ষতি",
  "an.tile.rr": "লাভ : ঝুঁকি 1 : {value}",
  "an.tile.holdSplit": "লাভজনক {win} · লোকসানি {loss}",
  "an.tile.streaks": "ধারাবাহিকতা",
  "an.tile.streaksSub": "টানা লাভ / ক্ষতি",
  "an.tile.trade": "{side} {volume} · #{ticket}",
  "an.tile.none": "এখনো কোনো ট্রেড নেই",

  // Analytics: curves
  "an.curve.hint": "প্রতিটি দিন দেখতে চার্ট স্পর্শ করে ধরে রাখুন",
  "an.curve.drawdown": "ড্রডাউন",
  "an.curve.a11y": "{date}-এ ইকুইটি {equity}, ব্যালেন্স {balance}। সর্বোচ্চ ড্রডাউন {drawdown}।",

  // Analytics: P&L calendar (net of closed trades per server day)
  "an.cal.title": "P&L ক্যালেন্ডার",
  "an.cal.subtitle": "প্রতি সার্ভার দিনে ক্লোজড ট্রেডের নেট ফলাফল",
  "an.cal.subtitleEstimated": "দৈনিক ব্যালেন্স পরিবর্তন, জমা ও উত্তোলন বাদে",
  "an.cal.days": { one: "{count} ট্রেডিং দিন", other: "{count} ট্রেডিং দিন" },
  "an.cal.green": "{count}টি সবুজ",
  "an.cal.red": "{count}টি লাল",
  "an.cal.noTrades": "কোনো ক্লোজড ট্রেড নেই",
  "an.cal.select": "ফলাফল দেখতে একটি দিনে ট্যাপ করুন",
  "an.cal.a11yDay": "{date}: {net}, {trades}",

  // Analytics: breakdowns
  "an.hour.byHour": "ঘণ্টা অনুযায়ী নেট P&L",
  "an.hour.byDayHour": "সপ্তাহের দিন × ঘণ্টা",
  "an.hour.tap": "বিস্তারিত দেখতে একটি বার বা সেলে ট্যাপ করুন",
  "an.tapBar": "বিস্তারিত দেখতে একটি বারে ট্যাপ করুন",
  "an.session.best": "সেরা",
  "an.session.asia": "এশিয়া",
  "an.session.london": "লন্ডন",
  "an.session.overlap": "লন্ডন / নিউ ইয়র্ক",
  "an.session.newYork": "নিউ ইয়র্ক",
  "an.session.lateNewYork": "নিউ ইয়র্ক (শেষভাগ)",
  "an.side.split": "{long} · {short}",
  "an.flow.equityNow": "বর্তমান ইকুইটি",
  "an.charges.total": "পরিশোধিত চার্জ",

  // Behaviour insights (the numbers come from the reports service)
  "insight.overtrading.title": { one: "{count} দিনে ওভারট্রেডিং", other: "{count} দিনে ওভারট্রেডিং" },
  "insight.overtrading.text": "এই দিনগুলোতে আপনি {limit}টির বেশি ট্রেড করেছেন (আপনার সাধারণ দিনে {median}টি)। সেই দিনগুলোর নেট ফলাফল: {net}।",
  "insight.overtrading.tip": "দিনে সর্বোচ্চ {cap}টি ট্রেডের সীমা ঠিক করুন।",
  "insight.revenge.title": { one: "{count}টি সম্ভাব্য রিভেঞ্জ ট্রেড", other: "{count}টি সম্ভাব্য রিভেঞ্জ ট্রেড" },
  "insight.revenge.text": "লোকসানে ক্লোজের 15 মিনিটের মধ্যে একই বা বড় সাইজে খোলা ট্রেড। এগুলো {rate}% ক্ষেত্রে লাভ করেছে, মোট ফলাফল {net}।",
  "insight.revenge.tip": "লোকসানের পর পরবর্তী ট্রেডের আগে 15 মিনিট বিরতি নিন।",
  "insight.risk.title": "প্রতি লোকসানি ট্রেডে ঝুঁকি",
  "insight.risk.text": {
    one: "একটি লোকসানি ট্রেডে গড়ে আপনার ব্যালেন্সের {avg}%, সর্বোচ্চ {max}% খরচ হয়েছে। {count}টি লোকসান 2% ছাড়িয়েছে।",
    other: "একটি লোকসানি ট্রেডে গড়ে আপনার ব্যালেন্সের {avg}%, সর্বোচ্চ {max}% খরচ হয়েছে। {count}টি লোকসান 2% ছাড়িয়েছে।",
  },
  "insight.risk.tip": "পজিশনের সাইজ এমনভাবে ঠিক করুন যাতে একটি স্টপ লসে ব্যালেন্সের সর্বোচ্চ 1–2% খরচ হয়।",
  "insight.holdLosers.title": "লোকসানি ট্রেড লাভজনকগুলোর চেয়ে বেশি সময় ধরে রাখা হয়",
  "insight.holdLosers.text": "লোকসানি ট্রেড গড়ে {loss} খোলা থাকে, লাভজনকগুলো {win}।",
  "insight.holdLosers.tip": "ট্রেড খোলার সময়ই একটি স্টপ লস দিন এবং সেটি সরাবেন না।",
  "insight.stopOut.title": { one: "{count}টি স্টপ-আউট ক্লোজ", other: "{count}টি স্টপ-আউট ক্লোজ" },
  "insight.stopOut.text": "পজিশনগুলো আপনার নিজের স্টপ লসে নয়, মার্জিন স্টপ-আউটে ক্লোজ হয়েছে।",
  "insight.stopOut.tip": "ছোট পজিশন নিয়ে মার্জিন লেভেল মার্জিন কল লেভেলের উপরে রাখুন।",
  "insight.slTp.title": "স্টপ লস বা টেক প্রফিটে ক্লোজ হওয়া ট্রেড",
  "insight.slTp.text": "টেক প্রফিটে {tp}টি, স্টপ লসে {sl}টি, বাকিগুলো হাতে বা ডেস্ক থেকে ক্লোজ করা হয়েছে।",
  "insight.slTp.tip": "পরিকল্পিত এক্সিট ফলাফলকে ধারাবাহিক রাখে।",
  "insight.session.title": "সেরা সেশন: {session}",
  "insight.session.text": "{rate}% জয়ের হারে {trades}টি ট্রেড। সবচেয়ে দুর্বল: {worst} ({net})।",
  "insight.session.tip": "{session} সেশনে মনোযোগ দিন।",
  "insight.tip": "টিপ",

  // States
  "state.updating": "আপডেট হচ্ছে…",
  "state.stale": "সংরক্ষিত ডেটা দেখানো হচ্ছে। রিফ্রেশ করতে নিচে টানুন।",
  "state.notShared.title": "আপনার সাথে শেয়ার করা হয়নি",
  "state.footer": "সব পরিমাণ USD-তে (সেন্ট অ্যাকাউন্ট রূপান্তরিত)। সময় সার্ভার সময়ে, GMT+2 / GMT+3।",
  "state.footerStatements": "স্টেটমেন্ট অ্যাকাউন্টের মুদ্রায় (সেন্ট অ্যাকাউন্টে USC)। সময় সার্ভার সময়ে, GMT+2 / GMT+3।",
};
export default mobileReports;
