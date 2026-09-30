import type { NsMessages } from "../../core";

// Kalks mobile app: Prop (challenge catalogue and checkout, live rule dashboard, payouts, certificates).
// "Kalks", "Kalks Prop", "Kalks Trader", "Kalks-Live", "USDT", "New York" and "17:00" stay as they are.
// Titles shown in tall uppercase display type are marked "display": keep them short.
const mobileProp: NsMessages<"mobileProp"> = {
  // Prop home
  "home.eyebrow": "Kalks Prop",
  "home.title": "ফান্ডেড হন", // display
  "home.subtitle": "একটি চ্যালেঞ্জ পাস করুন, ফান্ডেড অ্যাকাউন্ট পান এবং মুনাফার {split}% পর্যন্ত রাখুন। প্রতিটি প্রপ অ্যাকাউন্ট সিমুলেটেড।",
  "home.subtitleNoSplit": "একটি চ্যালেঞ্জ পাস করুন, ফান্ডেড অ্যাকাউন্ট পান এবং মুনাফার একটি অংশ রাখুন। প্রতিটি প্রপ অ্যাকাউন্ট সিমুলেটেড।",
  "home.payouts": "পেআউট",
  "home.payoutsReady": "{amount} প্রস্তুত",
  "home.payoutsNone": "এখনো কিছু প্রস্তুত নয়",
  "home.certificates": "সার্টিফিকেট",
  "home.certCount": { one: "{count}টি অর্জিত", other: "{count}টি অর্জিত" },
  "home.mine": "আপনার চ্যালেঞ্জ",
  "home.past": "আগের চ্যালেঞ্জ",
  "home.showAll": "সব {count}টি দেখান",
  "home.yourCertificates": "আপনার সার্টিফিকেট",
  "home.plans": "আপনার চ্যালেঞ্জ বেছে নিন",
  "home.newChallenge": "নতুন চ্যালেঞ্জ শুরু করুন",
  "home.emptyTitle": "কোনো চ্যালেঞ্জ নেই", // display
  "home.emptyBody": "নতুন চ্যালেঞ্জ প্ল্যান প্রস্তুত করা হচ্ছে। শিগগিরই আবার দেখুন।",
  "home.mineError": "আপনার চ্যালেঞ্জ লোড করা যায়নি।",
  "home.plansError": "চ্যালেঞ্জ প্ল্যান লোড করা যায়নি।",

  // How it works (numbered 01–04 on the Prop home)
  "how.title": "কীভাবে কাজ করে",
  "how.1.title": "প্ল্যান বেছে নিন",
  "how.1.body": "মডেল ও অ্যাকাউন্ট সাইজ বেছে নিন। ফি একবারই আপনার USDT ওয়ালেট থেকে কাটা হয়।",
  "how.2.title": "টার্গেটে পৌঁছান",
  "how.2.body": "দৈনিক লস ও ড্রডাউন সীমার মধ্যে থেকে, ন্যূনতম ট্রেডিং দিন পূরণ করে মুনাফা টার্গেটে পৌঁছান।",
  "how.3.title": "ফান্ডেড হন",
  "how.3.body": "পাস করলে আপনার ফান্ডেড অ্যাকাউন্ট স্বয়ংক্রিয়ভাবে খোলে, সাথে শেয়ার করার মতো একটি সার্টিফিকেট।",
  "how.4.title": "পেমেন্ট পান",
  "how.4.body": "প্রতিটি পেআউট চক্রে মুনাফার আপনার অংশ আপনার USDT ওয়ালেটে অনুরোধ করুন।",
  "how.enforce": "সীমাগুলো সার্ভারে প্রতি সেকেন্ডে ইকুইটির ভিত্তিতে যাচাই করা হয়। দৈনিক লসের 50, 75 ও 90%-এ আপনাকে সতর্ক করা হয়; লঙ্ঘন হলে সব পজিশন ক্লোজ হয় এবং চ্যালেঞ্জ শেষ হয়।",

  // Plan models
  "type.oneStep": "1-ধাপ",
  "type.twoStep": "2-ধাপ",
  "type.instant": "ইনস্ট্যান্ট",
  "typeText.oneStep": "একটি মূল্যায়ন ফেজ। টার্গেটে পৌঁছান, সীমা মেনে চলুন, ফান্ডেড হন।",
  "typeText.twoStep": "কম টার্গেট ও বড় সীমাসহ দুটি মূল্যায়ন ফেজ।",
  "typeText.instant": "কোনো মূল্যায়ন নেই। কঠোর সীমাসহ সরাসরি একটি ফান্ডেড অ্যাকাউন্টে শুরু করুন।",

  // Plan card
  "plan.refundable": "ফি রিফান্ড হয়",
  "plan.fee": "ফি",
  "plan.account": "অ্যাকাউন্ট",
  "plan.leverage": "লিভারেজ 1:{n}",
  "plan.target": "টার্গেট",
  "plan.dailyLoss": "দৈনিক লস",
  "plan.maxDD": "সর্বোচ্চ ড্রডাউন",
  "plan.static": "স্ট্যাটিক",
  "plan.trailing": "ট্রেইলিং",
  "plan.start": "শুরু করুন · {fee}",

  // Checkout
  "checkout.eyebrow": "চেকআউট",
  "checkout.fee": "এককালীন ফি",
  "checkout.chargedRefund": "আপনার USDT ওয়ালেট থেকে পরিশোধ। প্রথম পেআউটের সাথে রিফান্ড করা হয়।",
  "checkout.chargedNoRefund": "আপনার USDT ওয়ালেট থেকে পরিশোধ। অফেরতযোগ্য।",
  "checkout.walletBalance": "ওয়ালেট ব্যালেন্স: {balance} USDT",
  "checkout.shortTitle": "আপনার ওয়ালেটে ফি-এর চেয়ে কম আছে",
  "checkout.short": "আপনার আছে {balance} USDT। এই চ্যালেঞ্জের জন্য আরও {missing} USDT জমা করুন।",
  "checkout.rules": "নিয়ম",
  "checkout.limitsNote": "সীমাগুলো শুরুর ব্যালেন্সের শতাংশ। দৈনিক লস বা সর্বোচ্চ ড্রডাউন লঙ্ঘন করলে অ্যাকাউন্ট ব্যর্থ হয় এবং সব পজিশন মার্কেট দামে ক্লোজ হয়। ট্রেডিং দিন New York সময় 17:00-এ রিসেট হয়।",
  "checkout.agree": "আমি নিয়মগুলো পড়েছি এবং বুঝেছি যে অ্যাকাউন্টটি সিমুলেটেড এবং কোনো লস সীমা লঙ্ঘন হলে স্বয়ংক্রিয়ভাবে ব্যর্থ হয়।",
  "checkout.pay": "{fee} পরিশোধ করুন",
  "checkout.retry": "আবার চেষ্টা · {fee}",
  "checkout.paying": "পরিশোধ হচ্ছে…",
  "checkout.goToMine": "আমার চ্যালেঞ্জ দেখুন",
  "checkout.readyTitle": "আপনি যুক্ত হয়েছেন", // display
  "checkout.readyBody": "আপনার USDT ওয়ালেট থেকে {fee} পরিশোধ করা হয়েছে এবং আপনার {size} {phase} অ্যাকাউন্ট খোলা হয়েছে। এখন থেকে নিয়মগুলো কার্যকর।",
  "checkout.savePasswords": "এই পাসওয়ার্ডগুলো এখনই সংরক্ষণ করুন: এগুলো শুধু একবার দেখানো হয় এবং আমরা এগুলো সংরক্ষণ করি না। এগুলো ছাড়াও আপনি সবসময় অ্যাপ থেকে এই অ্যাকাউন্টে ট্রেড করতে পারবেন।",
  "checkout.passwordsShown": "এই কেনাকাটা প্রথম সম্পন্ন হওয়ার সময় ট্রেডিং পাসওয়ার্ড দেখানো হয়েছিল। এগুলো ছাড়াই আপনি অ্যাপ থেকে এই অ্যাকাউন্টে ট্রেড করতে পারবেন।",
  "checkout.viewChallenge": "চ্যালেঞ্জ দেখুন",
  "checkout.readOnly": "এই সেশন থেকে চ্যালেঞ্জ কেনা যায় না।",

  // Account credentials
  "cred.login": "লগইন",
  "cred.server": "সার্ভার",
  "cred.password": "ট্রেডিং পাসওয়ার্ড",
  "cred.investorPassword": "ইনভেস্টর পাসওয়ার্ড (শুধু দেখা)",
  "cred.show": "পাসওয়ার্ড দেখান",
  "cred.hide": "পাসওয়ার্ড লুকান",
  "copied": "{what} কপি হয়েছে",
  "a11y.copy": "{what} কপি করুন",

  // Challenge statuses
  "status.pendingPayment": "পেমেন্টের অপেক্ষায়",
  "status.provisioning": "অ্যাকাউন্ট খোলা হচ্ছে",
  "status.active": "সক্রিয়",
  "status.funded": "ফান্ডেড",
  "status.failed": "ব্যর্থ",
  "status.closed": "বন্ধ",
  "status.paymentFailed": "পেমেন্ট ব্যর্থ",
  // {phase} is the phase name from the plan, e.g. "Phase 2"
  "stage.active": "{phase} · সক্রিয়",
  "stage.failed": "{phase} · ব্যর্থ",
  "phaseStatus.provisioning": "খোলা হচ্ছে",
  "phaseStatus.active": "লাইভ",
  "phaseStatus.passed": "পাস",
  "phaseStatus.failed": "ব্যর্থ",
  "phaseStatus.closed": "বন্ধ",

  // Challenge cards (Prop home)
  "card.target": "মুনাফা টার্গেট",
  "card.profit": "মুনাফা",
  "card.equity": "ইকুইটি {amount}",
  "card.dailyLeft": "দৈনিক লস বাকি {amount}",
  "card.opening": "আপনার ট্রেডিং অ্যাকাউন্ট খোলা হচ্ছে। এতে কয়েক সেকেন্ড লাগে।",

  // Dashboard
  "dash.equity": "ইকুইটি",
  "dash.balance": "ব্যালেন্স",
  "dash.floating": "ফ্লোটিং",
  "dash.open": "খোলা",
  "dash.sinceStart": "ফেজ শুরুর পর থেকে",
  "dash.rules": "নিয়ম",
  "dash.rulesTitle": "এই চ্যালেঞ্জের নিয়ম",
  "dash.notFound": "চ্যালেঞ্জ পাওয়া যায়নি", // display
  "dash.notFoundBody": "এটি হয়তো অন্য লগইন দিয়ে খোলা হয়েছিল।",
  "dash.backToProp": "প্রপ-এ ফিরে যান",
  "live.live": "লাইভ",
  "live.connecting": "সংযোগ হচ্ছে…",
  "live.offline": "অফলাইন",
  // {time}: date and time of the last rule check
  "live.updated": "যাচাই {time}",
  // {time}: when the phase ended
  "live.final": "চূড়ান্ত · {time}",

  // Rule names (gauges, the rule log)
  "rule.dailyLoss": "দৈনিক লস",
  "rule.maxDrawdown": "সর্বোচ্চ ড্রডাউন",
  "rule.profitTarget": "মুনাফা টার্গেট",
  "rule.tradingDays": "ট্রেডিং দিন",
  "rule.timeLimit": "সময়সীমা",
  "rule.weekendHolding": "সপ্তাহান্তে হোল্ডিং",
  "rule.newsWindow": "নিউজ উইন্ডো",
  "rule.bannedStrategy": "নিষিদ্ধ কৌশল",
  "rule.consistency": "কনসিস্টেন্সি",
  "rule.riskDesk": "রিস্ক ডেস্কের সিদ্ধান্ত",
  "ruleState.ok": "চলমান",
  "ruleState.passed": "পূরণ হয়েছে",
  "ruleState.failed": "লঙ্ঘিত",
  "ruleState.off": "বন্ধ",

  // Gauges
  "target.ofTarget": "টার্গেটের",
  "target.of": "টার্গেট {amount} ({pct}%)",
  "target.left": "আরও {amount} বাকি",
  "target.reachedBy": "পূরণ হয়েছে, {amount} বেশি",
  "limit.left": "{amount} বাকি",
  "limit.breachAt": "{amount}-এ লঙ্ঘন",
  "days": { one: "{count} দিন", other: "{count} দিন" },
  "days.of": "{min}-এর মধ্যে {v}",
  "days.count": { one: "{count} দিন", other: "{count} দিন" },
  "days.met": "ন্যূনতম পূরণ হয়েছে",
  "days.toGo": { one: "আরও {count} বাকি", other: "আরও {count} বাকি" },
  "days.noMinimum": "কোনো ন্যূনতম নেই",
  "time.left": "{d}দি {h}ঘ বাকি",
  "time.deadline": "শেষ {date}",
  "consistency.rule": "সেরা দিন ≤ মুনাফার {pct}%",
  "consistency.noProfit": "এখনো কোনো মুনাফা নেই",
  "reset.title": "দৈনিক লস রিসেট হবে",
  "reset.note": "প্রতি ট্রেডিং দিনে New York সময় 17:00",

  // Funded account: payout window ring
  "payoutHero.title": "পরবর্তী পেআউট",
  "payoutHero.share": "এ পর্যন্ত আপনার অংশ",
  "payoutHero.open": "খোলা", // display
  "payoutHero.ready": "প্রস্তুত", // display
  "payoutHero.days": { one: "{count} দিন", other: "{count} দিন" }, // display
  "payoutHero.eligible": "আপনার {split}% ভাগে এখন যোগ্য।",
  "payoutHero.opens": "পেআউট উইন্ডো খুলবে {date}।",
  "payoutHero.later": "যোগ্য মুনাফা হলে পেআউটের অনুরোধ করুন।",

  // Big states
  "hero.opening.title": "অ্যাকাউন্ট খোলা হচ্ছে", // display
  "hero.opening.body": "পেমেন্ট নিশ্চিত হয়েছে এবং আপনার ট্রেডিং অ্যাকাউন্ট সেট আপ করা হচ্ছে। এই পেজটি নিজে থেকেই আপডেট হয়।",
  "hero.closed.title": "চ্যালেঞ্জ বন্ধ", // display
  "hero.closed.body": "এই চ্যালেঞ্জের ট্রেডিং অ্যাকাউন্ট খোলা যায়নি, তাই চ্যালেঞ্জটি বন্ধ করা হয়েছে এবং ফি আপনার USDT ওয়ালেটে রিফান্ড করা হয়েছে। কোনো প্রশ্ন থাকলে সাপোর্টে যোগাযোগ করুন।",
  // {reason} is the prop service's reason, in English
  "hero.closed.reason": "{reason}। ফি আপনার USDT ওয়ালেটে রিফান্ড করা হয়েছে।",
  "hero.failed.title": "{phase} ব্যর্থ", // display
  "hero.failed.on": "শেষ {date}",
  // {reason} is the breach reason from the risk engine
  "hero.failed.body": "{reason}। সব পজিশন ক্লোজ করা হয়েছে এবং অ্যাকাউন্ট নিষ্ক্রিয় করা হয়েছে।",
  "hero.failed.ruleBreached": "একটি নিয়ম লঙ্ঘিত হয়েছে",
  // {rule} is a rule name, e.g. "Daily loss"
  "hero.failed.rule": "{rule}: সীমা লঙ্ঘিত",
  "hero.failed.new": "নতুন চ্যালেঞ্জ শুরু করুন",
  "hero.passed.title": "{phase} পাস", // display
  "hero.passed.on": "পাস {date}।",
  "hero.passed.next": "আপনার {phase} অ্যাকাউন্ট খোলা হয়েছে।",
  "hero.passed.nextLogin": "আপনার {phase} অ্যাকাউন্ট খোলা হয়েছে (#{login})।",
  "hero.passed.opening": "আপনার পরবর্তী অ্যাকাউন্ট খোলা হচ্ছে।",
  "hero.passed.certificate": "সার্টিফিকেট দেখুন",
  "hero.passed.goNext": "{phase}-এ যান",
  "hero.funded.title": "ফান্ডেড", // display
  "hero.funded.body": "ফান্ডেড অ্যাকাউন্টে ট্রেড করুন এবং মুনাফার {split}% পেআউট হিসেবে নিন।",
  "hero.funded.certificate": "আপনার ফান্ডেড সার্টিফিকেট দেখুন",

  // Warnings while trading
  "warn.lossUsed": "আজকের লস সীমার {pct}% ব্যবহৃত",
  "warn.lossUsedBody": "ইকুইটি {floor} বা তার নিচে নামলে অ্যাকাউন্ট ব্যর্থ হয় এবং সব পজিশন ক্লোজ হয়। আজ বাকি {left}।",
  "warn.weekend": "সপ্তাহান্তের ক্লোজ",
  "warn.weekendBody": "এই প্ল্যানে সপ্তাহান্তে পজিশন রাখা যায় না: খোলা পজিশন শুক্রবার New York সময় 16:45-এ ক্লোজ হয়।",

  // Actions
  "action.openTrade": "ট্রেডে খুলুন",
  "action.trade": "ট্রেড",
  "action.tradeBlocked": "শুধু সক্রিয় চ্যালেঞ্জের লাইভ অ্যাকাউন্টে ট্রেড করা যায়।",
  "action.payouts": "পেআউট",
  "action.support": "সাপোর্টে যোগাযোগ",

  // Equity chart
  "chart.title": "ইকুইটি কার্ভ",
  "chart.start": "শুরু",
  "chart.target": "টার্গেট",
  "chart.ddFloor": "সর্বোচ্চ ড্রডাউন",
  "chart.dailyFloor": "দৈনিক লস",
  "chart.now": "এখন",
  "chart.empty": "ট্রেডিংয়ের প্রথম কয়েক মিনিট পরে কার্ভ দেখা যাবে।",

  // Trading stats
  "stats.title": "ট্রেডিং পরিসংখ্যান",
  "stats.trades": "ট্রেড",
  "stats.winRate": "জয়ের হার",
  "stats.profitFactor": "প্রফিট ফ্যাক্টর",
  "stats.avgWin": "গড় লাভ",
  "stats.avgLoss": "গড় লোকসান",
  "stats.lots": "লট",
  "stats.bestDay": "সেরা দিন {date}: {amount}",

  // Rule log
  "events.title": "নিয়মের লগ",
  "events.empty": "কোনো সতর্কতা বা লঙ্ঘন নেই। এভাবেই চালিয়ে যান।",
  "events.equity": "ইকুইটি {amount}",
  "events.limit": "সীমা {amount}",
  "severity.breach": "লঙ্ঘন",
  "severity.violation": "নিয়মভঙ্গ",
  "severity.warning": "সতর্কতা",
  "severity.info": "তথ্য",

  // Closed trades
  "trades.title": "ক্লোজ করা ট্রেড",
  "trades.all": "সব {count}টি",
  "trades.count": { one: "{count}টি ক্লোজ করা ট্রেড", other: "{count}টি ক্লোজ করা ট্রেড" },
  "trades.empty": "এখনো কোনো ক্লোজ করা ট্রেড নেই।",
  "trades.buy": "ক্রয়",
  "trades.sell": "বিক্রয়",
  // compact durations: s = seconds, m = minutes, h = hours, d = days
  "duration.s": "{s}সে",
  "duration.ms": "{m}মি {s}সে",
  "duration.hm": "{h}ঘ {m}মি",
  "duration.dh": "{d}দি {h}ঘ",

  // Account details
  "account.title": "অ্যাকাউন্ট",
  "account.split": "আপনার ভাগ",
  "account.initial": "শুরুর ব্যালেন্স",
  "account.started": "ফেজ শুরু",
  "account.ended": "শেষ",
  "account.deadline": "শেষ সময়",
  "account.passwordNote": "কেনার সময় ট্রেডিং পাসওয়ার্ড একবার দেখানো হয়েছিল। “ট্রেডে খুলুন” পাসওয়ার্ড ছাড়াই আপনাকে এই অ্যাকাউন্টে সাইন ইন করায়।",

  // Payouts
  "payouts.title": "পেআউট", // display
  "payouts.available": "এখন উপলব্ধ",
  "payouts.eligibleCount": { one: "{count}টি ফান্ডেড অ্যাকাউন্টের মধ্যে {eligible}টি যোগ্য", other: "{count}টি ফান্ডেড অ্যাকাউন্টের মধ্যে {eligible}টি যোগ্য" },
  "payouts.requests": { one: "{count}টি অনুরোধ", other: "{count}টি অনুরোধ" },
  "payouts.count": { one: "{count}টি পেআউট", other: "{count}টি পেআউট" },
  "payouts.paidToDate": "এ পর্যন্ত পরিশোধিত",
  "payouts.funded": "ফান্ডেড অ্যাকাউন্ট",
  "payouts.account": "{size} ফান্ডেড", // display
  "payouts.quote": "পেআউট হিসাব",
  "payouts.eligibleNow": "এখন যোগ্য",
  "payouts.notYet": "এখনো নয়",
  "payouts.toWallet": "আপনার ওয়ালেটে",
  "payouts.yourSplit": "আপনার ভাগ",
  "payouts.firmShare": "ফার্মের ভাগ",
  "payouts.alreadyRefunded": "ইতিমধ্যে রিফান্ড করা হয়েছে",
  "payouts.withFirst": "প্রথম পেআউটের সাথে",
  "payouts.opens": "{date} থেকে খোলে।",
  "payouts.minimum": "ন্যূনতম {amount}।",
  "payouts.kycNote": "এই পেআউটের অনুরোধ করতে আপনার পরিচয় যাচাই করুন।",
  "payouts.kycPendingNote": "আপনার পরিচয় যাচাই অনুমোদিত হলে এই পেআউটের অনুরোধ করতে পারবেন।",
  "payouts.readOnly": "এই সেশন থেকে পেআউটের অনুরোধ করা যায় না।",
  "payouts.request": "পেআউটের অনুরোধ",
  // opens the account's live rule dashboard (the web calls it "Rules dashboard"); short: it shares a row with Trade
  "payouts.dashboard": "নিয়ম",
  "payouts.history": "ইতিহাস",
  "payouts.historyEmpty": "এখনো কোনো পেআউট নেই।",
  "payouts.emptyTitle": "এখনো ফান্ডেড অ্যাকাউন্ট নেই", // display
  "payouts.emptyBody": "ফান্ডেড অ্যাকাউন্ট পেতে একটি চ্যালেঞ্জ পাস করুন। যোগ্য মুনাফা হলে এখান থেকে পেআউটের অনুরোধ করুন।",
  "payouts.emptyAction": "ফান্ডেড হন",
  "payoutStatus.pending": "পর্যালোচনায়",
  "payoutStatus.approved": "অনুমোদিত",
  "payoutStatus.paid": "পরিশোধিত",
  "payoutStatus.rejected": "প্রত্যাখ্যাত",
  "payoutStatus.failed": "ব্যর্থ",
  "split.title": "মুনাফা ভাগ ও স্কেলিং",
  "split.upTo": "স্কেলিংসহ {pct}% পর্যন্ত",
  "split.cycle": "পেআউট",
  // {days} e.g. "14 days"
  "split.first": "প্রথমটি {days} পরে",
  "split.firstNow": "প্রথম দিন থেকেই",
  // {months} e.g. "4 months"; {cap} e.g. "$2,000,000"
  "scaling.text": "{months}-এ {profit}% মুনাফা করুন, অ্যাকাউন্ট {increase}% বাড়বে, সর্বোচ্চ {cap} পর্যন্ত।",
  "scaling.none": "এই প্ল্যানে অ্যাকাউন্ট স্কেল হয় না।",
  "months": { one: "{count} মাস", other: "{count} মাস" },

  // Payout request sheet
  "request.eyebrow": "পেআউটের অনুরোধ",
  "request.profit": "অ্যাকাউন্টের মুনাফা",
  "request.share": "আপনার অংশ ({pct}%)",
  "request.feeRefund": "চ্যালেঞ্জ ফি রিফান্ড",
  "request.total": "আপনার ওয়ালেটে মোট",
  "request.note": "বর্তমান সম্পূর্ণ মুনাফা এখনই ট্রেডিং অ্যাকাউন্ট থেকে সরিয়ে নেওয়া হয়, তাই পর্যালোচনার সময় তা ট্রেডে হারানো যায় না। অনুমোদিত হলে আপনার অংশ আপনার USDT ওয়ালেটে ক্রেডিট হয়; অনুরোধ প্রত্যাখ্যাত হলে মুনাফা অ্যাকাউন্টে ফেরত যায়।",
  "request.submit": "{amount} অনুরোধ করুন",
  "request.done": "পেআউটের অনুরোধ করা হয়েছে",
  "request.doneBody": "অনুমোদনের পরে {amount} আপনার USDT ওয়ালেটে যাবে।",

  // Identity verification (payouts)
  "kyc.verified": "পরিচয় যাচাই হয়েছে: পেআউট অনুমোদন করা যাবে।",
  "kyc.pendingTitle": "যাচাই পর্যালোচনায়",
  "kyc.pendingText": "আপনার যাচাই পর্যালোচনায় আছে। আপনার পরিচয় যাচাই হলে আপনি পেআউটের অনুরোধ করতে পারবেন।",
  "kyc.requiredTitle": "আপনার পরিচয় যাচাই করুন",
  "kyc.requiredText": "পেআউট শুধু যাচাইকৃত ট্রেডারদের দেওয়া হয়। প্রথম পেআউটের আগে যাচাই করুন।",
  "kyc.rejectedText": "আপনার যাচাই প্রত্যাখ্যাত হয়েছে। পেআউট পেতে আবার জমা দিন।",

  // Why a payout can't be requested yet
  "blocker.notYetEligible": "পেআউট উইন্ডো এখনো খোলেনি।",
  "blocker.belowMinimum": "মুনাফা ন্যূনতম পেআউটের চেয়ে কম।",
  "blocker.positionsOpen": "পেআউটের অনুরোধ করতে সব খোলা পজিশন ক্লোজ করুন।",
  "blocker.payoutPending": "একটি পেআউট ইতিমধ্যে পর্যালোচনায় আছে।",
  "blocker.consistency": "কনসিস্টেন্সি নিয়ম পূরণ হয়নি: মোট মুনাফায় আপনার সেরা দিনের অংশ অনেক বেশি।",

  // Certificates
  "certs.title": "সার্টিফিকেট", // display
  "certs.subtitle": "আপনার পাস করা প্রতিটি ফেজ, প্রতিটি ফান্ডেড অ্যাকাউন্ট ও প্রতিটি পেআউটে একটি সার্টিফিকেট পাবেন, যা যে কেউ যাচাই করতে পারে।",
  "certs.kind.pass": "ফেজ পাস",
  "certs.kind.funded": "ফান্ডেড ট্রেডার",
  "certs.kind.payout": "পেআউট",
  "certs.revoked": "বাতিল",
  "certs.revokedBody": "এই সার্টিফিকেটটি Kalks বাতিল করেছে এবং এটি আর বৈধ নয়, তাই শেয়ার করা যাবে না।",
  "certs.meta": "{plan} · {size} · {date}",
  "certs.number": "নং {code}",
  "certs.shareImage": "ছবি শেয়ার করুন",
  "certs.shareLink": "লিংক শেয়ার করুন",
  "certs.copyLink": "লিংক কপি করুন",
  "certs.linkCopied": "যাচাই লিংক কপি হয়েছে",
  "certs.shareTitle": "আমার Kalks Prop সার্টিফিকেট",
  "certs.shareMessage": "আমার Kalks Prop সার্টিফিকেট। এখানে যাচাই করুন:",
  "certs.shareFailed": "সার্টিফিকেট শেয়ার করা যায়নি। আবার চেষ্টা করুন।",
  "certs.shareUnavailable": "এই ডিভাইসে শেয়ার করা যায় না।",
  "certs.emptyTitle": "এখনো সার্টিফিকেট নেই", // display
  "certs.emptyBody": "আপনার প্রথম সার্টিফিকেট পেতে একটি চ্যালেঞ্জ ফেজ পাস করুন, সাথে একটি পাবলিক লিংক যা যে কেউ যাচাই করতে পারে।",
  "certs.emptyAction": "চ্যালেঞ্জ দেখুন",

  // Rule words shared by the checkout and the rules sheet
  "accountSize": "অ্যাকাউন্ট সাইজ",
  "profitSplit": "মুনাফা ভাগ",
  "feeRefund": "ফি রিফান্ড",
  "nonRefundable": "অফেরতযোগ্য",
  "leverage": "লিভারেজ",
  "none": "নেই",
  "allowed": "অনুমোদিত",
  "notAllowed": "অনুমোদিত নয়",
  "noTimeLimit": "কোনো সময়সীমা নেই",
  // {phase} is the phase name, e.g. "Phase 1"
  "rules.phaseTarget": "{phase} টার্গেট",
  "rules.phaseMinDays": "{phase} ন্যূনতম দিন",
  "rules.phaseTimeLimit": "{phase} সময়সীমা",
  "rules.evaluation": "মূল্যায়ন",
  "rules.evaluationNone": "নেই, প্রথম দিন থেকেই ফান্ডেড",
  "rules.dailyLoss": "দৈনিক লস সীমা",
  "rules.dailyLossBalance": "{pct}% · {amount} · New York সময় 17:00-এর ব্যালেন্স থেকে",
  "rules.dailyLossEquity": "{pct}% · {amount} · New York সময় 17:00-এ ব্যালেন্স ও ইকুইটির মধ্যে যেটি বেশি তা থেকে",
  "rules.ddStatic": "{pct}% স্ট্যাটিক",
  "rules.ddTrailing": "{pct}% ট্রেইলিং",
  "rules.ddLocks": "{dd}, শুরুর স্তরে লক হয়",
  // ≤ = at most
  "rules.consistencyValue": "সেরা দিন ≤ মোট মুনাফার {pct}%",
  "rules.news": "নিউজ ট্রেডিং",
  "rules.newsBlocked": "উচ্চ-প্রভাবের নিউজের ±{min} মিনিটের মধ্যে নয়",
  "rules.newsBlockedFails": "উচ্চ-প্রভাবের নিউজের ±{min} মিনিটের মধ্যে নয় (অ্যাকাউন্ট ব্যর্থ হয়)",
  "rules.weekendClosed": "শুক্রবার New York সময় 16:45-এ পজিশন ক্লোজ হয়",
  "rules.ea": "এক্সপার্ট অ্যাডভাইজার",
  "rules.banned": "নিষিদ্ধ কৌশল",
  "rules.splitScaling": "{split}%, {max}% পর্যন্ত বাড়ে",
  "rules.firstPayout": "প্রথম পেআউট",
  // {freq} is a lower-case payout cycle, e.g. "weekly"
  "rules.firstPayoutValue": "{days} পরে, তারপর {freq} · ন্যূনতম {min}",
  "rules.refunded": "প্রথম পেআউটের সাথে রিফান্ড করা হয়",

  // Banned trading strategies
  "banned.hft": "হাই-ফ্রিকোয়েন্সি ট্রেডিং",
  "banned.latencyArbitrage": "লেটেন্সি আর্বিট্রাজ",
  "banned.tickScalping": "টিক স্ক্যাল্পিং",
  "banned.crossAccountCopying": "অ্যাকাউন্টের মধ্যে কপি করা",
  "banned.crossAccountHedging": "অ্যাকাউন্টের মধ্যে হেজিং",
  "banned.martingale": "মার্টিংগেল",
  "banned.grid": "গ্রিড ট্রেডিং",

  // Payout cycle, lower case: used inside sentences ("then weekly")
  "payoutFreq.weekly": "সাপ্তাহিক",
  "payoutFreq.biWeekly": "প্রতি 2 সপ্তাহে",
  "payoutFreq.monthly": "মাসিক",
  "payoutFreq.onDemand": "চাহিদা অনুযায়ী",

  // Errors (messages for the prop service's error codes)
  "errorLink.deposit": "জমা করুন",
  "errorLink.verify": "পরিচয় যাচাই করুন",
  "error.insufficientFunds": "এই ফি-এর জন্য আপনার USDT ওয়ালেটে যথেষ্ট ব্যালেন্স নেই। USDT জমা করে আবার চেষ্টা করুন।",
  "error.kycRequired": "পেআউটের অনুরোধ করার আগে আপনার পরিচয় যাচাই করুন।",
  "error.paymentPending": "ওয়ালেট পেমেন্ট এখনো নিশ্চিত করা যায়নি। এক মিনিট পরে আবার চেষ্টা করুন: আপনার কাছ থেকে দুবার চার্জ কাটা হবে না।",
  "error.paymentFailed": "ওয়ালেট পেমেন্ট সম্পন্ন হয়নি। আপনার কাছ থেকে কোনো চার্জ কাটা হয়নি।",
  "error.walletPending": "ওয়ালেট এখনো নিশ্চিত করেনি। এক মিনিট পরে আবার চেষ্টা করুন।",
  "error.walletRejected": "ওয়ালেট এই পেমেন্ট প্রত্যাখ্যান করেছে। সাপোর্টে যোগাযোগ করুন।",
  "error.provisioning": "পেমেন্ট পাওয়া গেছে। আপনার ট্রেডিং অ্যাকাউন্ট এখনো খোলা হচ্ছে: এক মিনিটের মধ্যে এটি আপনার চ্যালেঞ্জে দেখা যাবে।",
  "error.planUnavailable": "এই প্ল্যান বা সাইজ আর উপলব্ধ নেই। অন্য একটি বেছে নিন।",
  "error.notYetEligible": "এই অ্যাকাউন্ট এখনো পেআউটের জন্য যোগ্য নয়।",
  "error.belowMinimum": "মুনাফা ন্যূনতম পেআউটের চেয়ে কম।",
  "error.positionsOpen": "পেআউটের অনুরোধ করার আগে সব খোলা পজিশন ক্লোজ করুন।",
  "error.payoutPending": "এই অ্যাকাউন্টের একটি পেআউট ইতিমধ্যে পর্যালোচনায় আছে।",
  "error.consistency": "কনসিস্টেন্সি নিয়ম এখনো পূরণ হয়নি: মোট মুনাফায় আপনার সেরা দিনের অংশ অনেক বেশি।",
  "error.notFunded": "পেআউট শুধু ফান্ডেড অ্যাকাউন্টে উপলব্ধ।",
  "error.accountUnavailable": "এই চ্যালেঞ্জের ট্রেডিং অ্যাকাউন্ট খোলা যায়নি, তাই ফি আপনার USDT ওয়ালেটে রিফান্ড করা হয়েছে। এমন বারবার হলে সাপোর্টে যোগাযোগ করুন।",
  "error.idempotencyConflict": "এই চেকআউট ইতিমধ্যে অন্য একটি কেনাকাটায় ব্যবহৃত হয়েছে। এটি বন্ধ করে আবার শুরু করুন।",
  "error.notActive": "এই চ্যালেঞ্জটি সক্রিয় নয়।",
  "error.accountLimit": "আপনি সর্বোচ্চ সংখ্যক প্রপ অ্যাকাউন্টে পৌঁছে গেছেন। সীমা বাড়াতে সাপোর্টে যোগাযোগ করুন।",
  "error.staffReadOnly": "এটি একটি শুধু দেখার স্টাফ সেশন। কোনো পরিবর্তনের অনুমতি নেই।",
  "error.engine": "ট্রেডিং সার্ভার সাড়া দেয়নি। একটু পরে আবার চেষ্টা করুন।",
  "error.generic": "কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।",
  "load.title": "প্রপ উপলব্ধ নয়", // display
  "load.body": "প্রপ সার্ভিসে সংযোগ করা যায়নি। আপনার অ্যাকাউন্ট নিরাপদ আছে; একটু পরে আবার চেষ্টা করুন।",
};
export default mobileProp;
