import type { NsMessages } from "../../core";

// Kalks mobile app: Prop (challenge catalogue and checkout, live rule dashboard, payouts, certificates).
// "Kalks", "Kalks Prop", "Kalks Trader", "Kalks-Live", "USDT", "New York" and "17:00" stay as they are.
// Titles shown in tall display type are marked "display": keep them short. Terms follow the `prop` namespace.
const mobileProp: NsMessages<"mobileProp"> = {
  // Prop home
  "home.eyebrow": "Kalks Prop",
  "home.title": "فاندد شوید", // display
  "home.subtitle": "در یک چالش قبول شوید، حساب فاندد بگیرید و تا {split}% از سود را نگه دارید. همه حساب‌های پراپ شبیه‌سازی‌شده هستند.",
  "home.subtitleNoSplit": "در یک چالش قبول شوید، حساب فاندد بگیرید و سهمی از سود را نگه دارید. همه حساب‌های پراپ شبیه‌سازی‌شده هستند.",
  "home.payouts": "برداشت سود",
  "home.payoutsReady": "{amount} آماده",
  "home.payoutsNone": "هنوز آماده نیست",
  "home.certificates": "گواهینامه‌ها",
  "home.certCount": { one: "{count} کسب‌شده", other: "{count} کسب‌شده" },
  "home.mine": "چالش‌های شما",
  "home.past": "چالش‌های گذشته",
  "home.showAll": "نمایش هر {count} مورد",
  "home.yourCertificates": "گواهینامه‌های شما",
  "home.plans": "چالش خود را انتخاب کنید",
  "home.newChallenge": "شروع چالش جدید",
  "home.emptyTitle": "چالشی ارائه نمی‌شود", // display
  "home.emptyBody": "پلن‌های جدید چالش در حال آماده‌سازی هستند. لطفاً به‌زودی دوباره سر بزنید.",
  "home.mineError": "چالش‌های شما بارگذاری نشدند.",
  "home.plansError": "پلن‌های چالش بارگذاری نشدند.",

  // How it works (numbered 01–04 on the Prop home)
  "how.title": "چگونه کار می‌کند",
  "how.1.title": "یک پلن انتخاب کنید",
  "how.1.body": "مدل و اندازه حساب را انتخاب کنید. هزینه یک بار از کیف پول USDT شما کسر می‌شود.",
  "how.2.title": "به هدف برسید",
  "how.2.body": "در حداقل روزهای معاملاتی و در محدوده سقف ضرر روزانه و افت سرمایه، به هدف سود برسید.",
  "how.3.title": "فاندد شوید",
  "how.3.body": "قبول شوید تا حساب فاندد شما همراه با گواهینامه‌ای قابل اشتراک، خودکار باز شود.",
  "how.4.title": "سود بگیرید",
  "how.4.body": "در هر دوره پرداخت، سهم سود خود را به کیف پول USDT درخواست کنید.",
  "how.enforce": "محدودیت‌ها هر ثانیه روی سرور و بر اساس اکوئیتی بررسی می‌شوند. در 50، 75 و 90% سقف ضرر روزانه هشدار می‌گیرید؛ نقض قانون همه پوزیشن‌ها را می‌بندد و چالش را پایان می‌دهد.",

  // Plan models
  "type.oneStep": "1 مرحله‌ای",
  "type.twoStep": "2 مرحله‌ای",
  "type.instant": "فوری",
  "typeText.oneStep": "یک مرحله ارزیابی. به هدف برسید، محدودیت‌ها را رعایت کنید و فاندد شوید.",
  "typeText.twoStep": "دو مرحله ارزیابی با اهداف کمتر و محدودیت‌های گسترده‌تر.",
  "typeText.instant": "بدون ارزیابی. بلافاصله روی حساب فاندد با محدودیت‌های سخت‌تر شروع کنید.",

  // Plan card
  "plan.refundable": "هزینه بازپرداخت می‌شود",
  "plan.fee": "هزینه",
  "plan.account": "حساب",
  "plan.leverage": "اهرم 1:{n}",
  "plan.target": "هدف",
  "plan.dailyLoss": "ضرر روزانه",
  "plan.maxDD": "حداکثر افت",
  "plan.static": "ثابت",
  "plan.trailing": "متحرک",
  "plan.start": "شروع · {fee}",

  // Checkout
  "checkout.eyebrow": "پرداخت",
  "checkout.fee": "هزینه یک‌باره",
  "checkout.chargedRefund": "از کیف پول USDT شما پرداخت می‌شود. همراه با اولین برداشت سود بازپرداخت می‌شود.",
  "checkout.chargedNoRefund": "از کیف پول USDT شما پرداخت می‌شود. غیرقابل بازپرداخت.",
  "checkout.walletBalance": "موجودی کیف پول: {balance} USDT",
  "checkout.shortTitle": "موجودی کیف پول برای هزینه کافی نیست",
  "checkout.short": "شما {balance} USDT دارید. برای پرداخت این چالش {missing} USDT دیگر واریز کنید.",
  "checkout.rules": "قوانین",
  "checkout.limitsNote": "محدودیت‌ها درصدی از موجودی اولیه هستند. نقض ضرر روزانه یا حداکثر افت سرمایه موجب رد حساب و بستن همه پوزیشن‌ها به قیمت بازار می‌شود. روز معاملاتی ساعت 17:00 New York بازنشانی می‌شود.",
  "checkout.agree": "قوانین را خوانده‌ام و می‌دانم که حساب شبیه‌سازی‌شده است و در صورت نقض سقف ضرر به‌طور خودکار رد می‌شود.",
  "checkout.pay": "پرداخت {fee}",
  "checkout.retry": "تلاش مجدد · {fee}",
  "checkout.paying": "در حال پرداخت…",
  "checkout.goToMine": "مشاهده چالش‌های من",
  "checkout.readyTitle": "شروع کردید", // display
  "checkout.readyBody": "{fee} از کیف پول USDT شما پرداخت شد و حساب {size} {phase} شما باز است. قوانین از هم‌اکنون فعال هستند.",
  "checkout.savePasswords": "این رمزها را همین حالا ذخیره کنید: فقط یک بار نمایش داده می‌شوند و ما آن‌ها را نگهداری نمی‌کنیم. همیشه می‌توانید بدون آن‌ها از داخل برنامه با این حساب معامله کنید.",
  "checkout.passwordsShown": "رمزهای معاملاتی هنگام اولین تأیید این خرید نمایش داده شدند. می‌توانید بدون آن‌ها از داخل برنامه با این حساب معامله کنید.",
  "checkout.viewChallenge": "مشاهده چالش",
  "checkout.readOnly": "این نشست نمی‌تواند چالش خریداری کند.",

  // Account credentials
  "cred.login": "لاگین",
  "cred.server": "سرور",
  "cred.password": "رمز معاملاتی",
  "cred.investorPassword": "رمز سرمایه‌گذار (فقط‌خواندنی)",
  "cred.show": "نمایش رمز عبور",
  "cred.hide": "پنهان کردن رمز عبور",
  copied: "{what} کپی شد",
  "a11y.copy": "کپی {what}",

  // Challenge statuses
  "status.pendingPayment": "در انتظار پرداخت",
  "status.provisioning": "در حال افتتاح حساب",
  "status.active": "فعال",
  "status.funded": "فاندد",
  "status.failed": "ناموفق",
  "status.closed": "بسته‌شده",
  "status.paymentFailed": "پرداخت ناموفق",
  // {phase} is the phase name from the plan, e.g. "Phase 2"
  "stage.active": "{phase} · فعال",
  "stage.failed": "{phase} · ناموفق",
  "phaseStatus.provisioning": "در حال افتتاح",
  "phaseStatus.active": "فعال",
  "phaseStatus.passed": "قبول",
  "phaseStatus.failed": "ناموفق",
  "phaseStatus.closed": "بسته",

  // Challenge cards (Prop home)
  "card.target": "هدف سود",
  "card.profit": "سود",
  "card.equity": "اکوئیتی {amount}",
  "card.dailyLeft": "ضرر روزانه باقی‌مانده {amount}",
  "card.opening": "حساب معاملاتی شما در حال افتتاح است. چند ثانیه طول می‌کشد.",

  // Dashboard
  "dash.equity": "اکوئیتی",
  "dash.balance": "موجودی",
  "dash.floating": "شناور",
  "dash.open": "باز",
  "dash.sinceStart": "از شروع مرحله",
  "dash.rules": "قوانین",
  "dash.rulesTitle": "قوانین این چالش",
  "dash.notFound": "چالش یافت نشد", // display
  "dash.notFoundBody": "ممکن است با ورود دیگری باز شده باشد.",
  "dash.backToProp": "بازگشت به پراپ",
  "live.live": "زنده",
  "live.connecting": "در حال اتصال…",
  "live.offline": "آفلاین",
  // {time}: date and time of the last rule check
  "live.updated": "بررسی {time}",
  // {time}: when the phase ended
  "live.final": "نهایی · {time}",

  // Rule names (gauges, the rule log)
  "rule.dailyLoss": "ضرر روزانه",
  "rule.maxDrawdown": "حداکثر افت سرمایه",
  "rule.profitTarget": "هدف سود",
  "rule.tradingDays": "روزهای معاملاتی",
  "rule.timeLimit": "محدودیت زمانی",
  "rule.weekendHolding": "نگهداری در آخر هفته",
  "rule.newsWindow": "بازه اخبار",
  "rule.bannedStrategy": "استراتژی ممنوع",
  "rule.consistency": "ثبات",
  "rule.riskDesk": "تصمیم واحد ریسک",
  "ruleState.ok": "در جریان",
  "ruleState.passed": "محقق شد",
  "ruleState.failed": "نقض شد",
  "ruleState.off": "خاموش",

  // Gauges
  "target.ofTarget": "از هدف",
  "target.of": "هدف {amount} ({pct}%)",
  "target.left": "{amount} باقی‌مانده",
  "target.reachedBy": "محقق شد، {amount} بیشتر",
  "limit.left": "{amount} باقی‌مانده",
  "limit.breachAt": "نقض در {amount}",
  days: { one: "{count} روز", other: "{count} روز" },
  "days.of": "{v} از {min}",
  "days.count": { one: "{count} روز", other: "{count} روز" },
  "days.met": "حداقل محقق شد",
  "days.toGo": { one: "{count} روز دیگر", other: "{count} روز دیگر" },
  "days.noMinimum": "بدون حداقل",
  "time.left": "{d} روز {h} ساعت باقی‌مانده",
  "time.deadline": "پایان {date}",
  "consistency.rule": "بهترین روز ≤ {pct}% از سود",
  "consistency.noProfit": "هنوز سودی نیست",
  "reset.title": "بازنشانی ضرر روزانه در",
  "reset.note": "17:00 New York، هر روز معاملاتی",

  // Funded account: payout window ring
  "payoutHero.title": "برداشت سود بعدی",
  "payoutHero.share": "سهم شما تاکنون",
  "payoutHero.open": "باز", // display
  "payoutHero.ready": "آماده", // display
  "payoutHero.days": { one: "{count} روز", other: "{count} روز" }, // display
  "payoutHero.eligible": "هم‌اکنون با سهم {split}% شما واجد شرایط است.",
  "payoutHero.opens": "بازه برداشت سود از {date} باز می‌شود.",
  "payoutHero.later": "پس از کسب سود قابل برداشت، درخواست برداشت دهید.",

  // Big states
  "hero.opening.title": "در حال افتتاح حساب", // display
  "hero.opening.body": "پرداخت تأیید شد و حساب معاملاتی شما در حال راه‌اندازی است. این صفحه خودکار به‌روز می‌شود.",
  "hero.closed.title": "چالش بسته شد", // display
  "hero.closed.body": "حساب معاملاتی این چالش افتتاح نشد، بنابراین چالش بسته شد و هزینه به کیف پول USDT شما بازگشت. در صورت داشتن سؤال با پشتیبانی تماس بگیرید.",
  // {reason} is the prop service's reason, in English
  "hero.closed.reason": "{reason}. هزینه به کیف پول USDT شما بازگشت.",
  "hero.failed.title": "{phase} ناموفق", // display
  "hero.failed.on": "پایان {date}",
  // {reason} is the breach reason from the risk engine
  "hero.failed.body": "{reason}. همه پوزیشن‌ها بسته شدند و حساب غیرفعال است.",
  "hero.failed.ruleBreached": "یک قانون نقض شد",
  // {rule} is a rule name, e.g. "Daily loss"
  "hero.failed.rule": "{rule}: سقف نقض شد",
  "hero.failed.new": "شروع چالش جدید",
  "hero.passed.title": "{phase} قبول", // display
  "hero.passed.on": "قبولی در {date}.",
  "hero.passed.next": "حساب {phase} شما باز است.",
  "hero.passed.nextLogin": "حساب {phase} شما باز است (#{login}).",
  "hero.passed.opening": "حساب بعدی شما در حال افتتاح است.",
  "hero.passed.certificate": "مشاهده گواهینامه",
  "hero.passed.goNext": "رفتن به {phase}",
  "hero.funded.title": "فاندد", // display
  "hero.funded.body": "با حساب فاندد معامله کنید و {split}% از سود را به‌صورت برداشت سود دریافت کنید.",
  "hero.funded.certificate": "مشاهده گواهینامه فاندد",

  // Warnings while trading
  "warn.lossUsed": "{pct}% از سقف ضرر امروز استفاده شده",
  "warn.lossUsedBody": "رسیدن اکوئیتی به {floor} یا کمتر موجب رد حساب و بستن همه پوزیشن‌ها می‌شود. باقی‌مانده امروز: {left}.",
  "warn.weekend": "بستن آخر هفته",
  "warn.weekendBody": "این پلن نگهداری پوزیشن در آخر هفته را مجاز نمی‌داند: پوزیشن‌های باز جمعه ساعت 16:45 New York بسته می‌شوند.",

  // Actions
  "action.openTrade": "باز کردن در معامله",
  "action.trade": "معامله",
  "action.tradeBlocked": "فقط با حساب فعال یک چالش جاری می‌توان معامله کرد.",
  "action.payouts": "برداشت سود",
  "action.support": "تماس با پشتیبانی",

  // Equity chart
  "chart.title": "منحنی اکوئیتی",
  "chart.start": "شروع",
  "chart.target": "هدف",
  "chart.ddFloor": "حداکثر افت",
  "chart.dailyFloor": "ضرر روزانه",
  "chart.now": "اکنون",
  "chart.empty": "منحنی پس از اولین دقایق معامله نمایش داده می‌شود.",

  // Trading stats
  "stats.title": "آمار معاملات",
  "stats.trades": "معاملات",
  "stats.winRate": "نرخ برد",
  "stats.profitFactor": "فاکتور سود",
  "stats.avgWin": "میانگین سود",
  "stats.avgLoss": "میانگین زیان",
  "stats.lots": "لات",
  "stats.bestDay": "بهترین روز {date}: {amount}",

  // Rule log
  "events.title": "گزارش قوانین",
  "events.empty": "هیچ هشدار یا نقضی وجود ندارد. همین‌طور ادامه دهید.",
  "events.equity": "اکوئیتی {amount}",
  "events.limit": "سقف {amount}",
  "severity.breach": "نقض",
  "severity.violation": "تخلف",
  "severity.warning": "هشدار",
  "severity.info": "اطلاع",

  // Closed trades
  "trades.title": "معاملات بسته‌شده",
  "trades.all": "همه {count}",
  "trades.count": { one: "{count} معامله بسته‌شده", other: "{count} معامله بسته‌شده" },
  "trades.empty": "هنوز معامله بسته‌شده‌ای وجود ندارد.",
  "trades.buy": "خرید",
  "trades.sell": "فروش",
  // compact durations: s = seconds, m = minutes, h = hours, d = days
  "duration.s": "{s} ث",
  "duration.ms": "{m} د {s} ث",
  "duration.hm": "{h} س {m} د",
  "duration.dh": "{d} روز {h} س",

  // Account details
  "account.title": "حساب",
  "account.split": "سهم شما",
  "account.initial": "موجودی اولیه",
  "account.started": "شروع مرحله",
  "account.ended": "پایان",
  "account.deadline": "مهلت",
  "account.passwordNote": "رمزهای معاملاتی یک بار هنگام خرید نمایش داده شدند. «باز کردن در معامله» شما را بدون آن‌ها وارد این حساب می‌کند.",

  // Payouts
  "payouts.title": "برداشت سود", // display
  "payouts.available": "قابل برداشت",
  "payouts.eligibleCount": { one: "{eligible} از {count} حساب فاندد واجد شرایط", other: "{eligible} از {count} حساب فاندد واجد شرایط" },
  "payouts.requests": { one: "{count} درخواست", other: "{count} درخواست" },
  "payouts.count": { one: "{count} برداشت", other: "{count} برداشت" },
  "payouts.paidToDate": "پرداخت‌شده تاکنون",
  "payouts.funded": "حساب‌های فاندد",
  "payouts.account": "{size} فاندد", // display
  "payouts.quote": "برآورد برداشت",
  "payouts.eligibleNow": "هم‌اکنون واجد شرایط",
  "payouts.notYet": "هنوز نه",
  "payouts.toWallet": "به کیف پول شما",
  "payouts.yourSplit": "سهم شما",
  "payouts.firmShare": "سهم شرکت",
  "payouts.alreadyRefunded": "قبلاً بازپرداخت شده",
  "payouts.withFirst": "با اولین برداشت سود",
  "payouts.opens": "از {date} باز می‌شود.",
  "payouts.minimum": "حداقل {amount}.",
  "payouts.kycNote": "برای درخواست این برداشت، هویت خود را تأیید کنید.",
  "payouts.kycPendingNote": "پس از تأیید احراز هویت می‌توانید این برداشت را درخواست کنید.",
  "payouts.readOnly": "این نشست نمی‌تواند درخواست برداشت سود دهد.",
  "payouts.request": "درخواست برداشت",
  // opens the account's live rule dashboard; short: it shares a row with Trade
  "payouts.dashboard": "قوانین",
  "payouts.history": "تاریخچه",
  "payouts.historyEmpty": "هنوز برداشت سودی ندارید.",
  "payouts.emptyTitle": "هنوز حساب فاندد ندارید", // display
  "payouts.emptyBody": "برای دریافت حساب فاندد در یک چالش قبول شوید. پس از کسب سود قابل برداشت، از اینجا درخواست دهید.",
  "payouts.emptyAction": "فاندد شوید",
  "payoutStatus.pending": "در حال بررسی",
  "payoutStatus.approved": "تأییدشده",
  "payoutStatus.paid": "پرداخت‌شده",
  "payoutStatus.rejected": "ردشده",
  "payoutStatus.failed": "ناموفق",
  "split.title": "تقسیم سود و افزایش سرمایه",
  "split.upTo": "تا {pct}% با افزایش سرمایه",
  "split.cycle": "برداشت سود",
  // {days} e.g. "14 days"
  "split.first": "اولین پس از {days}",
  "split.firstNow": "از روز اول",
  // {months} e.g. "4 months"; {cap} e.g. "$2,000,000"
  "scaling.text": "در {months} {profit}% سود کسب کنید تا حساب {increase}% و حداکثر تا {cap} بزرگ‌تر شود.",
  "scaling.none": "این پلن افزایش سرمایه حساب ندارد.",
  months: { one: "{count} ماه", other: "{count} ماه" },

  // Payout request sheet
  "request.eyebrow": "درخواست برداشت سود",
  "request.profit": "سود حساب",
  "request.share": "سهم شما ({pct}%)",
  "request.feeRefund": "بازپرداخت هزینه چالش",
  "request.total": "مجموع واریزی به کیف پول",
  "request.note": "کل سود فعلی هم‌اکنون از حساب معاملاتی برداشته می‌شود تا در زمان بررسی از دست نرود. پس از تأیید، سهم شما به کیف پول USDT واریز می‌شود؛ در صورت رد درخواست، سود به حساب بازگردانده می‌شود.",
  "request.submit": "درخواست {amount}",
  "request.done": "درخواست برداشت ثبت شد",
  "request.doneBody": "پس از تأیید، {amount} به کیف پول USDT شما واریز می‌شود.",

  // Identity verification (payouts)
  "kyc.verified": "هویت تأیید شد: برداشت‌ها قابل تأیید هستند.",
  "kyc.pendingTitle": "احراز هویت در حال بررسی",
  "kyc.pendingText": "احراز هویت شما در حال بررسی است. پس از تأیید هویت می‌توانید درخواست برداشت سود دهید.",
  "kyc.requiredTitle": "هویت خود را تأیید کنید",
  "kyc.requiredText": "برداشت سود فقط به معامله‌گران تأییدشده پرداخت می‌شود. پیش از اولین برداشت، هویت خود را تأیید کنید.",
  "kyc.rejectedText": "احراز هویت شما رد شد. برای دریافت برداشت سود، دوباره ارسال کنید.",

  // Why a payout can't be requested yet
  "blocker.notYetEligible": "بازه برداشت سود هنوز باز نشده است.",
  "blocker.belowMinimum": "سود کمتر از حداقل مبلغ برداشت است.",
  "blocker.positionsOpen": "برای درخواست برداشت سود، همه پوزیشن‌های باز را ببندید.",
  "blocker.payoutPending": "یک درخواست برداشت سود در حال بررسی است.",
  "blocker.consistency": "قانون ثبات رعایت نشده: سهم بهترین روز شما از کل سود بیش از حد است.",

  // Certificates
  "certs.title": "گواهینامه‌ها", // display
  "certs.subtitle": "برای هر مرحله‌ای که قبول می‌شوید، هر حساب فاندد و هر برداشت سود، گواهینامه‌ای صادر می‌شود که همه می‌توانند تأیید کنند.",
  "certs.kind.pass": "قبولی در مرحله",
  "certs.kind.funded": "معامله‌گر فاندد",
  "certs.kind.payout": "برداشت سود",
  "certs.revoked": "باطل‌شده",
  "certs.revokedBody": "این گواهینامه توسط Kalks باطل شده و دیگر معتبر نیست، بنابراین قابل اشتراک‌گذاری نیست.",
  "certs.meta": "{plan} · {size} · {date}",
  "certs.number": "شماره {code}",
  "certs.shareImage": "اشتراک تصویر",
  "certs.shareLink": "اشتراک لینک",
  "certs.copyLink": "کپی لینک",
  "certs.linkCopied": "لینک تأیید کپی شد",
  "certs.shareTitle": "گواهینامه Kalks Prop من",
  "certs.shareMessage": "گواهینامه Kalks Prop من. اینجا تأیید کنید:",
  "certs.shareFailed": "اشتراک‌گذاری گواهینامه انجام نشد. لطفاً دوباره تلاش کنید.",
  "certs.shareUnavailable": "اشتراک‌گذاری در این دستگاه در دسترس نیست.",
  "certs.emptyTitle": "هنوز گواهینامه‌ای ندارید", // display
  "certs.emptyBody": "برای دریافت اولین گواهینامه، با لینکی عمومی که همه می‌توانند تأیید کنند، در یک مرحله چالش قبول شوید.",
  "certs.emptyAction": "مشاهده چالش‌ها",

  // Rule words shared by the checkout and the rules sheet
  accountSize: "اندازه حساب",
  profitSplit: "تقسیم سود",
  feeRefund: "بازپرداخت هزینه",
  nonRefundable: "غیرقابل بازپرداخت",
  leverage: "اهرم",
  none: "ندارد",
  allowed: "مجاز",
  notAllowed: "غیرمجاز",
  noTimeLimit: "بدون محدودیت زمانی",
  // {phase} is the phase name, e.g. "Phase 1"
  "rules.phaseTarget": "هدف {phase}",
  "rules.phaseMinDays": "حداقل روزهای {phase}",
  "rules.phaseTimeLimit": "محدودیت زمانی {phase}",
  "rules.evaluation": "ارزیابی",
  "rules.evaluationNone": "ندارد، فاندد از روز اول",
  "rules.dailyLoss": "سقف ضرر روزانه",
  "rules.dailyLossBalance": "{pct}% · {amount} · از موجودی ساعت 17:00 New York",
  "rules.dailyLossEquity": "{pct}% · {amount} · از بیشترین مقدار موجودی و اکوئیتی ساعت 17:00 New York",
  "rules.ddStatic": "{pct}% ثابت",
  "rules.ddTrailing": "{pct}% متحرک",
  "rules.ddLocks": "{dd}، در سطح شروع قفل می‌شود",
  // ≤ = at most
  "rules.consistencyValue": "بهترین روز ≤ {pct}% از کل سود",
  "rules.news": "معامله در زمان اخبار",
  "rules.newsBlocked": "نه در بازه ±{min} دقیقه از اخبار مهم",
  "rules.newsBlockedFails": "نه در بازه ±{min} دقیقه از اخبار مهم (موجب رد حساب می‌شود)",
  "rules.weekendClosed": "بستن پوزیشن‌ها جمعه ساعت 16:45 New York",
  "rules.ea": "اکسپرت‌ها",
  "rules.banned": "استراتژی‌های ممنوع",
  "rules.splitScaling": "{split}%، قابل افزایش تا {max}%",
  "rules.firstPayout": "اولین برداشت سود",
  // {freq} is a lower-case payout cycle, e.g. "weekly"
  "rules.firstPayoutValue": "پس از {days}، سپس {freq} · حداقل {min}",
  "rules.refunded": "همراه با اولین برداشت سود بازپرداخت می‌شود",

  // Banned trading strategies
  "banned.hft": "معاملات فرکانس بالا",
  "banned.latencyArbitrage": "آربیتراژ تأخیری",
  "banned.tickScalping": "اسکالپینگ تیکی",
  "banned.crossAccountCopying": "کپی بین حساب‌ها",
  "banned.crossAccountHedging": "هج بین حساب‌ها",
  "banned.martingale": "مارتینگل",
  "banned.grid": "معاملات گرید",

  // Payout cycle, used inside sentences ("then weekly")
  "payoutFreq.weekly": "هفتگی",
  "payoutFreq.biWeekly": "هر 2 هفته",
  "payoutFreq.monthly": "ماهانه",
  "payoutFreq.onDemand": "در صورت درخواست",

  // Errors (messages for the prop service's error codes)
  "errorLink.deposit": "واریز",
  "errorLink.verify": "احراز هویت",
  "error.insufficientFunds": "موجودی کیف پول USDT شما برای این هزینه کافی نیست. USDT واریز کنید و دوباره تلاش کنید.",
  "error.kycRequired": "پیش از درخواست برداشت سود، هویت خود را تأیید کنید.",
  "error.paymentPending": "هنوز نتوانستیم پرداخت کیف پول را تأیید کنیم. یک دقیقه دیگر دوباره تلاش کنید: مبلغ دو بار کسر نمی‌شود.",
  "error.paymentFailed": "پرداخت از کیف پول انجام نشد. مبلغی از شما کسر نشده است.",
  "error.walletPending": "کیف پول هنوز تأیید نکرده است. لطفاً یک دقیقه دیگر دوباره تلاش کنید.",
  "error.walletRejected": "کیف پول این پرداخت را رد کرد. لطفاً با پشتیبانی تماس بگیرید.",
  "error.provisioning": "پرداخت دریافت شد. حساب معاملاتی شما هنوز در حال افتتاح است: ظرف یک دقیقه در بخش چالش‌های شما نمایش داده می‌شود.",
  "error.planUnavailable": "این پلن یا اندازه دیگر در دسترس نیست. لطفاً گزینه دیگری انتخاب کنید.",
  "error.notYetEligible": "این حساب هنوز واجد شرایط برداشت سود نیست.",
  "error.belowMinimum": "سود کمتر از حداقل مبلغ برداشت است.",
  "error.positionsOpen": "پیش از درخواست برداشت سود، همه پوزیشن‌های باز را ببندید.",
  "error.payoutPending": "یک درخواست برداشت سود برای این حساب در حال بررسی است.",
  "error.consistency": "قانون ثبات هنوز رعایت نشده است: سهم بهترین روز شما از کل سود بیش از حد است.",
  "error.notFunded": "برداشت سود فقط برای حساب‌های فاندد امکان‌پذیر است.",
  "error.accountUnavailable": "حساب معاملاتی این چالش افتتاح نشد، بنابراین هزینه به کیف پول USDT شما بازگشت. اگر این مشکل تکرار شد با پشتیبانی تماس بگیرید.",
  "error.idempotencyConflict": "این پرداخت قبلاً برای خرید دیگری استفاده شده است. آن را ببندید و از نو شروع کنید.",
  "error.notActive": "این چالش فعال نیست.",
  "error.accountLimit": "به حداکثر تعداد حساب‌های پراپ رسیده‌اید. برای افزایش سقف با پشتیبانی تماس بگیرید.",
  "error.staffReadOnly": "این یک نشست فقط‌خواندنی کارکنان است. ایجاد تغییر مجاز نیست.",
  "error.engine": "سرور معاملاتی پاسخ نداد. لطفاً کمی بعد دوباره تلاش کنید.",
  "error.generic": "مشکلی پیش آمد. لطفاً دوباره تلاش کنید.",
  "load.title": "پراپ در دسترس نیست", // display
  "load.body": "اتصال به سرویس پراپ برقرار نشد. حساب‌های شما امن هستند؛ لطفاً کمی بعد دوباره تلاش کنید.",
};
export default mobileProp;
