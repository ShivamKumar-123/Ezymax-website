import type { NsMessages } from "../../core";

const dashboard: NsMessages<"dashboard"> = {
  // Page header (Client Area home). {name} = client's first name
  "greeting.morning": "শুভ সকাল, {name}",
  "greeting.afternoon": "শুভ অপরাহ্ন, {name}",
  "greeting.evening": "শুভ সন্ধ্যা, {name}",
  "greeting.welcome": "স্বাগতম, {name}",
  "subtitle.live": "Kalks-এ স্বাগতম। এখানে আপনার অ্যাকাউন্ট ও আজকের মার্কেট দেখুন।",
  "subtitle.demo": "আজ আপনার অ্যাকাউন্টগুলোর পারফরম্যান্স দেখুন।",
  launchTrader: "Kalks Trader চালু করুন",
  openTerminal: "ট্রেডিং টার্মিনাল খুলুন",

  // Getting started checklist
  "steps.title": "শুরু করা যাক",
  "steps.subtitle": "লাইভ ট্রেডিংয়ের পথে আপনার অগ্রগতি",
  "steps.progress": "{total}-এর মধ্যে {done}",
  "steps.account.title": "আপনার অ্যাকাউন্ট তৈরি করুন",
  "steps.account.text": "{date}-এ নিবন্ধিত।",
  "steps.email.title": "আপনার ইমেইল যাচাই করুন",
  "steps.email.verified": "{email} যাচাই করা হয়েছে।",
  "steps.email.confirm": "আমাদের পাঠানো কোড দিয়ে {email} নিশ্চিত করুন।",
  "steps.kyc.title": "আপনার পরিচয় যাচাই করুন",
  "steps.kyc.verified": "আপনার পরিচয় যাচাই হয়েছে। উত্তোলন চালু আছে।",
  "steps.kyc.moreInfo": "আমাদের টিমের আপনার কাছ থেকে আরও একটি ডকুমেন্ট প্রয়োজন।",
  "steps.kyc.review": "আপনার ডকুমেন্ট আমাদের ভেরিফিকেশন টিমের কাছে আছে।",
  "steps.kyc.draft": "যেখানে ছেড়েছিলেন সেখান থেকে চালিয়ে যান। প্রায় 3 মিনিট লাগে।",
  "steps.kyc.rejected": "আপনার ডকুমেন্ট যাচাই করা যায়নি। আপনি আবার শুরু করতে পারেন।",
  "steps.kyc.todo": "প্রায় 3 মিনিট লাগে। উত্তোলন চালু হয়।",
  "steps.accountOpen.title": "একটি ট্রেডিং অ্যাকাউন্ট খুলুন",
  // {count} = live + demo accounts in total
  "steps.accountOpen.opened": { one: "{live}টি লাইভ ও {demo}টি ডেমো অ্যাকাউন্ট খোলা আছে।", other: "{live}টি লাইভ ও {demo}টি ডেমো অ্যাকাউন্ট খোলা আছে।" },
  "steps.accountOpen.todo": "একটি লাইভ বা ডেমো অ্যাকাউন্ট খুলুন; আপনার লগইন সঙ্গে সঙ্গে দেওয়া হয়।",
  "steps.wallet.title": "আপনার ওয়ালেটে ফান্ড যোগ করুন",
  "steps.wallet.text": "TRC20-এ USDT জমার ব্যবস্থা যুক্ত করা হচ্ছে।",
  // Step status chips
  "steps.state.done": "সম্পন্ন",
  "steps.state.todo": "বাকি",
  "steps.state.review": "পর্যালোচনায়",
  "steps.state.rejected": "প্রত্যাখ্যাত",
  "steps.state.soon": "শুরু হয়নি",

  // Trading accounts card. <b> wraps the equity amount
  "accounts.title": "ট্রেডিং অ্যাকাউন্ট",
  "accounts.summary": "লাইভ ইকুইটি <b>{equity}</b> · {live}টি লাইভ · {demo}টি ডেমো · {positions}টি খোলা পজিশন",
  "accounts.subtitle": "আপনার লাইভ ও ডেমো অ্যাকাউন্ট",
  "accounts.all": "সব অ্যাকাউন্ট",
  "accounts.open": "অ্যাকাউন্ট খুলুন",
  "accounts.unavailable": "ট্রেডিং অ্যাকাউন্ট এই মুহূর্তে উপলব্ধ নয়। আপনার ব্যালেন্স নিরাপদ আছে।",
  "accounts.openLive.title": "লাইভ অ্যাকাউন্ট খুলুন",
  "accounts.openLive.text": "আসল মার্কেট। শূন্য ব্যালেন্স দিয়ে শুরু হয়; ওয়ালেট চালু হলে ফান্ডিং শুরু হবে।",
  "accounts.openDemo.title": "ডেমো অ্যাকাউন্ট খুলুন",
  "accounts.openDemo.text": "রিয়েল-টাইম প্রাইসে ভার্চুয়াল ফান্ড, প্রতিদিন রিফিল করা যায়।",
  "accounts.more": { one: "আরও {count}টি অ্যাকাউন্ট", other: "আরও {count}টি অ্যাকাউন্ট" },
  "accounts.myTitle": "আমার ট্রেডিং অ্যাকাউন্ট",

  // Your account card
  "account.title": "আপনার অ্যাকাউন্ট",
  "account.clientId": "ক্লায়েন্ট আইডি",
  "account.emailStatus": "ইমেইল স্ট্যাটাস",
  "account.notVerified": "যাচাই করা হয়নি",
  "account.identity": "পরিচয়",
  "account.memberSince": "সদস্য হয়েছেন",
  "account.profile": "প্রোফাইল",

  // Kalks Trader banner
  "trader.chip": "লাইভ প্রাইস",
  "trader.text": "ফরেক্স, মেটাল, সূচক, এনার্জি, ক্রিপ্টো ও স্টক মিলিয়ে {count}টি ইনস্ট্রুমেন্টের রিয়েল-টাইম কোট ও চার্ট। আপনার ব্রাউজারেই চলে, কিছু ইনস্টল করতে হয় না।",

  // Market clock / heatmap
  "sessions.title": "মার্কেট ঘড়ি",
  "sessions.open": "{total}টির মধ্যে {open}টি মার্কেট খোলা",
  "heatmap.title": "মার্কেট হিটম্যাপ",
  "heatmap.subtitle": "লাইভ প্রাইস থেকে আজকের পরিবর্তন · ফাঁপা বিন্দু: মার্কেট বন্ধ",
  "heatmap.up": "{count}টি ঊর্ধ্বমুখী",
  "heatmap.down": "{count}টি নিম্নমুখী",
  "heatmap.allMarkets": "সব মার্কেট",
  "heatmap.tipOpen": "{symbol} · মার্কেট খোলা",
  "heatmap.tipClosed": "{symbol} · মার্কেট বন্ধ, শেষ সেশনের পরিবর্তন",

  // Support card. <mail> wraps the support email address
  "support.title": "সাহায্য প্রয়োজন?",
  "support.text": "আপনার নিবন্ধিত ঠিকানা থেকে <mail>{email}</mail>-এ লিখুন এবং আপনার ক্লায়েন্ট আইডি উল্লেখ করুন।",
  "support.emailSupport": "সাপোর্টে ইমেইল করুন",
  "support.copied": "ইমেইল ঠিকানা কপি হয়েছে",
  "support.copyFailed": "কপি করা যায়নি, অনুগ্রহ করে ঠিকানাটি সিলেক্ট করুন",

  // Demo dashboard: onboarding strip
  "onboarding.title": "আপনার অ্যাকাউন্ট সেটআপ সম্পূর্ণ করুন",
  "onboarding.text": "উত্তোলন ও উচ্চতর লিমিট চালু করতে KYC সম্পূর্ণ করুন।",
  "onboarding.progress": "অগ্রগতি",
  "onboarding.dismiss": "বাদ দিন",

  // Margin health
  "margin.title": "মার্জিনের অবস্থা",
  "margin.subtitle": "সব লাইভ অ্যাকাউন্ট মিলিয়ে",
  "margin.healthy": "স্বাস্থ্যকর",
  "margin.level": "মার্জিন লেভেল",
  "margin.used": "ব্যবহৃত মার্জিন",
  "margin.free": "ফ্রি মার্জিন",

  // Equity / P&L. {range} = 1W, 1M, 3M, YTD, 1Y, ALL (keep as-is)
  "equity.title": "মোট ইকুইটি",
  "equity.changeOver": "{range}-এ পরিবর্তন",
  "pnl.title": "মুনাফা / লোকসান · মাস",
  "pnl.lowRisk": "কম ঝুঁকি",
  "pnl.winRate": "জয়ের হার (30 দিন)",
  "pnl.trades": "ট্রেড (30 দিন)",
  "pnl.avgWin": "গড় লাভজনক ট্রেড",
  "pnl.avgLoss": "গড় লোকসানি ট্রেড",
  "pnl.charges": "পরিশোধিত চার্জ",

  // KPI cards
  "kpi.wallet": "ওয়ালেট",
  "kpi.today": "আজ +{pct}%",
  "kpi.monthPnl": "মাসের P&L",
  "kpi.vsLastMonth": "গত মাসের তুলনায় +{pct}%",
  "kpi.partnerEarnings": "পার্টনার আয়",
  // Copy = copy-trading earnings
  "kpi.copy": "কপি {amount}",

  // Top movers
  "movers.title": "শীর্ষ মুভার",
  "movers.gainers": "ঊর্ধ্বমুখী",
  "movers.losers": "নিম্নমুখী",

  // Economic calendar. A = Actual, F = Forecast, P = Previous
  "calendar.title": "অর্থনৈতিক ক্যালেন্ডার",
  "calendar.subtitle": "আজ · সার্ভার সময় GMT+3",
  "calendar.actual": "প্রকৃত {value} · ",
  "calendar.forecastPrevious": "পূর্বাভাস {forecast} · আগের {previous}",

  // News / world
  "news.title": "মার্কেট সংবাদ",
  "news.all": "সব সংবাদ",
  "news.pinned": "পিন করা",
  "world.title": "বিশ্বজুড়ে মার্কেট ও সংবাদ",
  "world.subtitle": "দেশভিত্তিক লাইভ শিরোনাম ও মুদ্রার সেন্টিমেন্ট",
  "world.stories": { one: "আজ {count}টি সংবাদ", other: "আজ {count}টি সংবাদ" },

  // Open positions
  "positions.title": "খোলা পজিশন",
  "positions.summary": { one: "{count}টি পজিশন · ফ্লোটিং", other: "{count}টি পজিশন · ফ্লোটিং" },
  "positions.terminal": "টার্মিনাল",

  // Partner banner. <link> wraps the referral link
  "partner.chip": "পার্টনার প্রোগ্রাম",
  "partner.title": "ট্রেডারদের আমন্ত্রণ জানান। প্রতি লটে $15 পর্যন্ত আয় করুন — আজীবন।",
  "partner.text": "মাল্টি-টিয়ার কমিশন, CPA বোনাস ও রিয়েল-টাইম ট্র্যাকিং। আপনার লিংক: <link>{url}</link>",
  "partner.open": "পার্টনার ড্যাশবোর্ড খুলুন",

  // Short relative times (m = minutes, h = hours, d = days)
  "time.justNow": "এইমাত্র",
  "time.minutesAgo": "{count} মি. আগে",
  "time.hoursAgo": "{count} ঘ. আগে",
  "time.daysAgo": "{count} দিন আগে",
  // {time} = sample value like "5m"
  "time.ago": "{time} আগে",

  // Notifications bell / panel
  "notifications.title": "নোটিফিকেশন",
  "notifications.ariaUnread": "নোটিফিকেশন, {count}টি অপঠিত",
  "notifications.markAll": "সব পড়া হয়েছে",
  "notifications.clear": "মুছে ফেলুন",
  "notifications.emptyTitle": "এখনো কোনো নোটিফিকেশন নেই",
  "notifications.emptyText": "জমা, উত্তোলন, ভেরিফিকেশন, ট্রেডিং অ্যালার্ট ও সাপোর্টের উত্তর এখানে দেখা যাবে।",
  "notifications.settings": "নোটিফিকেশন সেটিংস",
};
export default dashboard;
