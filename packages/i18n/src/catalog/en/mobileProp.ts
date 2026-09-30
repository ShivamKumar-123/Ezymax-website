// Keys for this namespace. English is the source; translations live in ../<lang>/mobileProp.ts.
// Kalks mobile app: Prop (challenge catalogue and checkout, live rule dashboard, payouts, certificates).
// "Kalks", "Kalks Prop", "Kalks Trader", "Kalks-Live", "USDT", "New York" and "17:00" stay as they are.
// Titles shown in tall uppercase display type are marked "display": keep them short.
const mobileProp = {
  // Prop home
  "home.eyebrow": "Kalks Prop",
  "home.title": "Get funded", // display
  "home.subtitle": "Pass a challenge, get a funded account and keep up to {split}% of the profit. Every prop account is simulated.",
  "home.subtitleNoSplit": "Pass a challenge, get a funded account and keep a share of the profit. Every prop account is simulated.",
  "home.payouts": "Payouts",
  "home.payoutsReady": "{amount} ready",
  "home.payoutsNone": "None ready yet",
  "home.certificates": "Certificates",
  "home.certCount": { one: "{count} earned", other: "{count} earned" },
  "home.mine": "Your challenges",
  "home.past": "Past challenges",
  "home.showAll": "Show all {count}",
  "home.yourCertificates": "Your certificates",
  "home.plans": "Choose your challenge",
  "home.newChallenge": "Start a new challenge",
  "home.emptyTitle": "No challenges on offer", // display
  "home.emptyBody": "New challenge plans are being prepared. Please check back soon.",
  "home.mineError": "Your challenges couldn't be loaded.",
  "home.plansError": "The challenge plans couldn't be loaded.",

  // How it works (numbered 01–04 on the Prop home)
  "how.title": "How it works",
  "how.1.title": "Pick a plan",
  "how.1.body": "Choose the model and the account size. The fee comes from your USDT wallet, once.",
  "how.2.title": "Hit the target",
  "how.2.body": "Reach the profit target within the daily loss and drawdown limits, over the minimum trading days.",
  "how.3.title": "Get funded",
  "how.3.body": "Pass, and your funded account opens automatically with a certificate to share.",
  "how.4.title": "Get paid",
  "how.4.body": "Request your share of the profit to your USDT wallet every payout cycle.",
  "how.enforce": "Limits are checked on the server every second, on equity. You're warned at 50, 75 and 90% of the daily loss; a breach closes every position and ends the challenge.",

  // Plan models
  "type.oneStep": "1-Step",
  "type.twoStep": "2-Step",
  "type.instant": "Instant",
  "typeText.oneStep": "One evaluation phase. Hit the target, respect the limits, get funded.",
  "typeText.twoStep": "Two evaluation phases with lower targets and wider limits.",
  "typeText.instant": "No evaluation. Start on a funded account straight away, with tighter limits.",

  // Plan card
  "plan.refundable": "Fee refunded",
  "plan.fee": "Fee",
  "plan.account": "Account",
  "plan.leverage": "Leverage 1:{n}",
  "plan.target": "Target",
  "plan.dailyLoss": "Daily loss",
  "plan.maxDD": "Max drawdown",
  "plan.static": "static",
  "plan.trailing": "trailing",
  "plan.start": "Start · {fee}",

  // Checkout
  "checkout.eyebrow": "Checkout",
  "checkout.fee": "One-time fee",
  "checkout.chargedRefund": "Paid from your USDT wallet. Refunded with your first payout.",
  "checkout.chargedNoRefund": "Paid from your USDT wallet. Non-refundable.",
  "checkout.walletBalance": "Wallet balance: {balance} USDT",
  "checkout.shortTitle": "Your wallet is short of the fee",
  "checkout.short": "You have {balance} USDT. Deposit {missing} USDT more to pay for this challenge.",
  "checkout.rules": "The rules",
  "checkout.limitsNote": "Limits are a percentage of the starting balance. Breaching the daily loss or max drawdown fails the account and closes every position at market. The trading day resets at 17:00 New York.",
  "checkout.agree": "I've read the rules and understand the account is simulated and fails automatically when a loss limit is breached.",
  "checkout.pay": "Pay {fee}",
  "checkout.retry": "Try again · {fee}",
  "checkout.paying": "Paying…",
  "checkout.goToMine": "See my challenges",
  "checkout.readyTitle": "You're in", // display
  "checkout.readyBody": "{fee} was paid from your USDT wallet and your {size} {phase} account is open. The rules are live from now on.",
  "checkout.savePasswords": "Save these passwords now: they're shown only once and we don't store them. You can always trade this account from the app without them.",
  "checkout.passwordsShown": "The trading passwords were shown when this purchase first went through. You can trade this account from the app without them.",
  "checkout.viewChallenge": "View challenge",
  "checkout.readOnly": "This session can't buy challenges.",

  // Account credentials
  "cred.login": "Login",
  "cred.server": "Server",
  "cred.password": "Trading password",
  "cred.investorPassword": "Investor password (read-only)",
  "cred.show": "Show password",
  "cred.hide": "Hide password",
  "copied": "{what} copied",
  "a11y.copy": "Copy {what}",

  // Challenge statuses
  "status.pendingPayment": "Awaiting payment",
  "status.provisioning": "Opening account",
  "status.active": "Active",
  "status.funded": "Funded",
  "status.failed": "Failed",
  "status.closed": "Closed",
  "status.paymentFailed": "Payment failed",
  // {phase} is the phase name from the plan, e.g. "Phase 2"
  "stage.active": "{phase} · Active",
  "stage.failed": "{phase} · Failed",
  "phaseStatus.provisioning": "Opening",
  "phaseStatus.active": "Live",
  "phaseStatus.passed": "Passed",
  "phaseStatus.failed": "Failed",
  "phaseStatus.closed": "Closed",

  // Challenge cards (Prop home)
  "card.target": "Profit target",
  "card.profit": "Profit",
  "card.equity": "Equity {amount}",
  "card.dailyLeft": "Daily loss left {amount}",
  "card.opening": "Your trading account is being opened. This takes a few seconds.",

  // Dashboard
  "dash.equity": "Equity",
  "dash.balance": "Balance",
  "dash.floating": "Floating",
  "dash.open": "Open",
  "dash.sinceStart": "since the phase started",
  "dash.rules": "Rules",
  "dash.rulesTitle": "Rules of this challenge",
  "dash.notFound": "Challenge not found", // display
  "dash.notFoundBody": "It may have been opened with another login.",
  "dash.backToProp": "Back to Prop",
  "live.live": "Live",
  "live.connecting": "Connecting…",
  "live.offline": "Offline",
  // {time}: date and time of the last rule check
  "live.updated": "Checked {time}",
  // {time}: when the phase ended
  "live.final": "Final · {time}",

  // Rule names (gauges, the rule log)
  "rule.dailyLoss": "Daily loss",
  "rule.maxDrawdown": "Max drawdown",
  "rule.profitTarget": "Profit target",
  "rule.tradingDays": "Trading days",
  "rule.timeLimit": "Time limit",
  "rule.weekendHolding": "Weekend holding",
  "rule.newsWindow": "News window",
  "rule.bannedStrategy": "Banned strategy",
  "rule.consistency": "Consistency",
  "rule.riskDesk": "Risk desk decision",
  "ruleState.ok": "In progress",
  "ruleState.passed": "Met",
  "ruleState.failed": "Breached",
  "ruleState.off": "Off",

  // Gauges
  "target.ofTarget": "of target",
  "target.of": "Target {amount} ({pct}%)",
  "target.left": "{amount} to go",
  "target.reachedBy": "Reached, {amount} over",
  "limit.left": "{amount} left",
  "limit.breachAt": "Breach at {amount}",
  "days": { one: "{count} day", other: "{count} days" },
  "days.of": "{v} of {min}",
  "days.count": { one: "{count} day", other: "{count} days" },
  "days.met": "Minimum met",
  "days.toGo": { one: "{count} more to go", other: "{count} more to go" },
  "days.noMinimum": "No minimum",
  "time.left": "{d}d {h}h left",
  "time.deadline": "Ends {date}",
  "consistency.rule": "Best day ≤ {pct}% of the profit",
  "consistency.noProfit": "No profit yet",
  "reset.title": "Daily loss resets in",
  "reset.note": "17:00 New York, every trading day",

  // Funded account: payout window ring
  "payoutHero.title": "Next payout",
  "payoutHero.share": "Your share so far",
  "payoutHero.open": "Open", // display
  "payoutHero.ready": "Ready", // display
  "payoutHero.days": { one: "{count} day", other: "{count} days" }, // display
  "payoutHero.eligible": "Eligible now at your {split}% split.",
  "payoutHero.opens": "The payout window opens {date}.",
  "payoutHero.later": "Request a payout once you have eligible profit.",

  // Big states
  "hero.opening.title": "Opening your account", // display
  "hero.opening.body": "The payment is confirmed and your trading account is being set up. This page updates on its own.",
  "hero.closed.title": "Challenge closed", // display
  "hero.closed.body": "The trading account for this challenge couldn't be opened, so the challenge was closed and the fee was refunded to your USDT wallet. Contact support if you have questions.",
  // {reason} is the prop service's reason, in English
  "hero.closed.reason": "{reason}. The fee was refunded to your USDT wallet.",
  "hero.failed.title": "{phase} failed", // display
  "hero.failed.on": "Ended {date}",
  // {reason} is the breach reason from the risk engine
  "hero.failed.body": "{reason}. Every position was closed and the account is disabled.",
  "hero.failed.ruleBreached": "A rule was breached",
  // {rule} is a rule name, e.g. "Daily loss"
  "hero.failed.rule": "{rule}: limit breached",
  "hero.failed.new": "Start a new challenge",
  "hero.passed.title": "{phase} passed", // display
  "hero.passed.on": "Passed {date}.",
  "hero.passed.next": "Your {phase} account is open.",
  "hero.passed.nextLogin": "Your {phase} account is open (#{login}).",
  "hero.passed.opening": "Your next account is being opened.",
  "hero.passed.certificate": "View certificate",
  "hero.passed.goNext": "Go to {phase}",
  "hero.funded.title": "Funded", // display
  "hero.funded.body": "Trade the funded account and take {split}% of the profit as payouts.",
  "hero.funded.certificate": "View your funded certificate",

  // Warnings while trading
  "warn.lossUsed": "{pct}% of today's loss limit used",
  "warn.lossUsedBody": "Equity at or below {floor} fails the account and closes every position. {left} left today.",
  "warn.weekend": "Weekend close",
  "warn.weekendBody": "This plan doesn't allow holding over the weekend: open positions close at Friday 16:45 New York.",

  // Actions
  "action.openTrade": "Open in Trade",
  "action.trade": "Trade",
  "action.tradeBlocked": "Only the live account of an active challenge can be traded.",
  "action.payouts": "Payouts",
  "action.support": "Contact support",

  // Equity chart
  "chart.title": "Equity curve",
  "chart.start": "Start",
  "chart.target": "Target",
  "chart.ddFloor": "Max drawdown",
  "chart.dailyFloor": "Daily loss",
  "chart.now": "Now",
  "chart.empty": "The curve appears after the first minutes of trading.",

  // Trading stats
  "stats.title": "Trading stats",
  "stats.trades": "Trades",
  "stats.winRate": "Win rate",
  "stats.profitFactor": "Profit factor",
  "stats.avgWin": "Avg win",
  "stats.avgLoss": "Avg loss",
  "stats.lots": "Lots",
  "stats.bestDay": "Best day {date}: {amount}",

  // Rule log
  "events.title": "Rule log",
  "events.empty": "No warnings or breaches. Keep it that way.",
  "events.equity": "equity {amount}",
  "events.limit": "limit {amount}",
  "severity.breach": "Breach",
  "severity.violation": "Violation",
  "severity.warning": "Warning",
  "severity.info": "Info",

  // Closed trades
  "trades.title": "Closed trades",
  "trades.all": "All {count}",
  "trades.count": { one: "{count} closed trade", other: "{count} closed trades" },
  "trades.empty": "No closed trades yet.",
  "trades.buy": "Buy",
  "trades.sell": "Sell",
  // compact durations: s = seconds, m = minutes, h = hours, d = days
  "duration.s": "{s}s",
  "duration.ms": "{m}m {s}s",
  "duration.hm": "{h}h {m}m",
  "duration.dh": "{d}d {h}h",

  // Account details
  "account.title": "Account",
  "account.split": "Your split",
  "account.initial": "Starting balance",
  "account.started": "Phase started",
  "account.ended": "Ended",
  "account.deadline": "Deadline",
  "account.passwordNote": "The trading passwords were shown once, at purchase. Open in Trade signs you in to this account without them.",

  // Payouts
  "payouts.title": "Payouts", // display
  "payouts.available": "Available now",
  "payouts.eligibleCount": { one: "{eligible} of {count} funded account eligible", other: "{eligible} of {count} funded accounts eligible" },
  "payouts.requests": { one: "{count} request", other: "{count} requests" },
  "payouts.count": { one: "{count} payout", other: "{count} payouts" },
  "payouts.paidToDate": "Paid to date",
  "payouts.funded": "Funded accounts",
  "payouts.account": "{size} funded", // display
  "payouts.quote": "Payout quote",
  "payouts.eligibleNow": "Eligible now",
  "payouts.notYet": "Not yet",
  "payouts.toWallet": "to your wallet",
  "payouts.yourSplit": "Your split",
  "payouts.firmShare": "Firm share",
  "payouts.alreadyRefunded": "Already refunded",
  "payouts.withFirst": "With the first payout",
  "payouts.opens": "Opens {date}.",
  "payouts.minimum": "Minimum {amount}.",
  "payouts.kycNote": "Verify your identity to request this payout.",
  "payouts.kycPendingNote": "You can request this payout once your identity verification is approved.",
  "payouts.readOnly": "This session can't request payouts.",
  "payouts.request": "Request payout",
  // opens the account's live rule dashboard (the web calls it "Rules dashboard"); short: it shares a row with Trade
  "payouts.dashboard": "Rules",
  "payouts.history": "History",
  "payouts.historyEmpty": "No payouts yet.",
  "payouts.emptyTitle": "No funded account yet", // display
  "payouts.emptyBody": "Pass a challenge to get a funded account. Request payouts here once it has eligible profit.",
  "payouts.emptyAction": "Get funded",
  "payoutStatus.pending": "In review",
  "payoutStatus.approved": "Approved",
  "payoutStatus.paid": "Paid",
  "payoutStatus.rejected": "Rejected",
  "payoutStatus.failed": "Failed",
  "split.title": "Profit split and scaling",
  "split.upTo": "Up to {pct}% with scaling",
  "split.cycle": "Payouts",
  // {days} e.g. "14 days"
  "split.first": "First after {days}",
  "split.firstNow": "From day one",
  // {months} e.g. "4 months"; {cap} e.g. "$2,000,000"
  "scaling.text": "Make {profit}% profit over {months} and the account grows by {increase}%, up to {cap}.",
  "scaling.none": "This plan doesn't scale the account.",
  "months": { one: "{count} month", other: "{count} months" },

  // Payout request sheet
  "request.eyebrow": "Request payout",
  "request.profit": "Profit on the account",
  "request.share": "Your share ({pct}%)",
  "request.feeRefund": "Challenge fee refund",
  "request.total": "Total to your wallet",
  "request.note": "The whole current profit comes off the trading account now, so it can't be traded away while in review. Once approved, your share is credited to your USDT wallet; if the request is rejected, the profit goes back on the account.",
  "request.submit": "Request {amount}",
  "request.done": "Payout requested",
  "request.doneBody": "{amount} goes to your USDT wallet once approved.",

  // Identity verification (payouts)
  "kyc.verified": "Identity verified: payouts can be approved.",
  "kyc.pendingTitle": "Verification in review",
  "kyc.pendingText": "Your verification is in review. You can request payouts once your identity is verified.",
  "kyc.requiredTitle": "Verify your identity",
  "kyc.requiredText": "Payouts are paid only to verified traders. Verify before your first payout.",
  "kyc.rejectedText": "Your verification was rejected. Submit it again to receive payouts.",

  // Why a payout can't be requested yet
  "blocker.notYetEligible": "The payout window isn't open yet.",
  "blocker.belowMinimum": "Profit is below the minimum payout.",
  "blocker.positionsOpen": "Close every open position to request a payout.",
  "blocker.payoutPending": "A payout is already in review.",
  "blocker.consistency": "Consistency rule not met: your best day is too large a share of the profit.",

  // Certificates
  "certs.title": "Certificates", // display
  "certs.subtitle": "Every phase you pass, every funded account and every payout earns a certificate anyone can verify.",
  "certs.kind.pass": "Phase passed",
  "certs.kind.funded": "Funded trader",
  "certs.kind.payout": "Payout",
  "certs.revoked": "Revoked",
  "certs.revokedBody": "This certificate was revoked by Kalks and is no longer valid, so it can't be shared.",
  "certs.meta": "{plan} · {size} · {date}",
  "certs.number": "No. {code}",
  "certs.shareImage": "Share image",
  "certs.shareLink": "Share link",
  "certs.copyLink": "Copy link",
  "certs.linkCopied": "Verify link copied",
  "certs.shareTitle": "My Kalks Prop certificate",
  "certs.shareMessage": "My Kalks Prop certificate. Verify it here:",
  "certs.shareFailed": "Couldn't share the certificate. Please try again.",
  "certs.shareUnavailable": "Sharing isn't available on this device.",
  "certs.emptyTitle": "No certificates yet", // display
  "certs.emptyBody": "Pass a challenge phase to earn your first certificate, with a public link anyone can verify.",
  "certs.emptyAction": "Browse challenges",

  // Rule words shared by the checkout and the rules sheet
  "accountSize": "Account size",
  "profitSplit": "Profit split",
  "feeRefund": "Fee refund",
  "nonRefundable": "Non-refundable",
  "leverage": "Leverage",
  "none": "None",
  "allowed": "Allowed",
  "notAllowed": "Not allowed",
  "noTimeLimit": "No time limit",
  // {phase} is the phase name, e.g. "Phase 1"
  "rules.phaseTarget": "{phase} target",
  "rules.phaseMinDays": "{phase} minimum days",
  "rules.phaseTimeLimit": "{phase} time limit",
  "rules.evaluation": "Evaluation",
  "rules.evaluationNone": "None, funded from day one",
  "rules.dailyLoss": "Daily loss limit",
  "rules.dailyLossBalance": "{pct}% · {amount} · from the balance at 17:00 New York",
  "rules.dailyLossEquity": "{pct}% · {amount} · from the higher of balance and equity at 17:00 New York",
  "rules.ddStatic": "{pct}% static",
  "rules.ddTrailing": "{pct}% trailing",
  "rules.ddLocks": "{dd}, locks at the start",
  // ≤ = at most
  "rules.consistencyValue": "Best day ≤ {pct}% of total profit",
  "rules.news": "News trading",
  "rules.newsBlocked": "Not within ±{min} min of high-impact news",
  "rules.newsBlockedFails": "Not within ±{min} min of high-impact news (fails the account)",
  "rules.weekendClosed": "Positions closed Friday 16:45 New York",
  "rules.ea": "Expert Advisors",
  "rules.banned": "Banned strategies",
  "rules.splitScaling": "{split}%, scaling to {max}%",
  "rules.firstPayout": "First payout",
  // {freq} is a lower-case payout cycle, e.g. "weekly"
  "rules.firstPayoutValue": "After {days}, then {freq} · min {min}",
  "rules.refunded": "Refunded with the first payout",

  // Banned trading strategies
  "banned.hft": "High-frequency trading",
  "banned.latencyArbitrage": "Latency arbitrage",
  "banned.tickScalping": "Tick scalping",
  "banned.crossAccountCopying": "Copying between accounts",
  "banned.crossAccountHedging": "Hedging between accounts",
  "banned.martingale": "Martingale",
  "banned.grid": "Grid trading",

  // Payout cycle, lower case: used inside sentences ("then weekly")
  "payoutFreq.weekly": "weekly",
  "payoutFreq.biWeekly": "every 2 weeks",
  "payoutFreq.monthly": "monthly",
  "payoutFreq.onDemand": "on demand",

  // Errors (messages for the prop service's error codes)
  "errorLink.deposit": "Deposit",
  "errorLink.verify": "Verify identity",
  "error.insufficientFunds": "Your USDT wallet balance is too low for this fee. Deposit USDT and try again.",
  "error.kycRequired": "Verify your identity before requesting a payout.",
  "error.paymentPending": "We couldn't confirm the wallet payment yet. Try again in a minute: you won't be charged twice.",
  "error.paymentFailed": "The wallet payment didn't go through. You haven't been charged.",
  "error.walletPending": "The wallet hasn't confirmed yet. Please try again in a minute.",
  "error.walletRejected": "The wallet refused this payment. Please contact support.",
  "error.provisioning": "Payment received. Your trading account is still opening: it appears under your challenges within a minute.",
  "error.planUnavailable": "This plan or size isn't available any more. Please pick another one.",
  "error.notYetEligible": "This account isn't eligible for a payout yet.",
  "error.belowMinimum": "The profit is below the minimum payout.",
  "error.positionsOpen": "Close every open position before requesting a payout.",
  "error.payoutPending": "A payout for this account is already in review.",
  "error.consistency": "The consistency rule isn't met yet: your best day is too large a share of the profit.",
  "error.notFunded": "Payouts are available on funded accounts only.",
  "error.accountUnavailable": "We couldn't open the trading account for this challenge, so the fee was refunded to your USDT wallet. Contact support if this keeps happening.",
  "error.idempotencyConflict": "This checkout was already used for a different purchase. Close it and start again.",
  "error.notActive": "This challenge isn't active.",
  "error.accountLimit": "You've reached the maximum number of prop accounts. Contact support to raise the limit.",
  "error.staffReadOnly": "This is a read-only staff session. Changes aren't allowed.",
  "error.engine": "The trading server didn't respond. Please try again shortly.",
  "error.generic": "Something went wrong. Please try again.",
  "load.title": "Prop is unavailable", // display
  "load.body": "We couldn't reach the prop service. Your accounts are safe; please try again in a moment.",
};
export default mobileProp;
