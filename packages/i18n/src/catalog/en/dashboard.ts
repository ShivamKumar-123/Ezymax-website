// Keys for this namespace. English is the source; translations live in ../<lang>/dashboard.ts.
const dashboard = {
  // Page header (Client Area home). {name} = client's first name
  "greeting.morning": "Good morning, {name}",
  "greeting.afternoon": "Good afternoon, {name}",
  "greeting.evening": "Good evening, {name}",
  "greeting.welcome": "Welcome, {name}",
  "subtitle.live": "Welcome to Ezymex. Here's your account and today's markets.",
  "subtitle.demo": "Here's how your accounts are performing today.",
  launchTrader: "Launch Ezymex Trader",
  openTerminal: "Open trading terminal",

  // Getting started checklist
  "steps.title": "Getting started",
  "steps.subtitle": "Your progress towards live trading",
  "steps.progress": "{done} of {total}",
  "steps.account.title": "Create your account",
  "steps.account.text": "Registered on {date}.",
  "steps.email.title": "Verify your email",
  "steps.email.verified": "{email} is verified.",
  "steps.email.confirm": "Confirm {email} with the code we sent you.",
  "steps.kyc.title": "Verify your identity",
  "steps.kyc.verified": "Your identity is verified. Withdrawals are unlocked.",
  "steps.kyc.moreInfo": "Our team needs one more document from you.",
  "steps.kyc.review": "Your documents are with our verification team.",
  "steps.kyc.draft": "Continue where you left off. Takes about 3 minutes.",
  "steps.kyc.rejected": "We couldn't verify your documents. You can start again.",
  "steps.kyc.todo": "Takes about 3 minutes. Unlocks withdrawals.",
  "steps.accountOpen.title": "Open a trading account",
  // {count} = live + demo accounts in total
  "steps.accountOpen.opened": { one: "{live} live and {demo} demo account open.", other: "{live} live and {demo} demo accounts open." },
  "steps.accountOpen.todo": "Open a live or demo account; your login is issued instantly.",
  "steps.wallet.title": "Fund your wallet",
  "steps.wallet.text": "USDT deposits on TRC20 are being connected.",
  // Step status chips
  "steps.state.done": "Done",
  "steps.state.todo": "To do",
  "steps.state.review": "In review",
  "steps.state.rejected": "Rejected",
  "steps.state.soon": "Not started",

  // Trading accounts card. <b> wraps the equity amount
  "accounts.title": "Trading accounts",
  "accounts.summary": "Live equity <b>{equity}</b> · {live} live · {demo} demo · {positions} open positions",
  "accounts.subtitle": "Your live and demo accounts",
  "accounts.all": "All accounts",
  "accounts.open": "Open account",
  "accounts.unavailable": "Trading accounts are unavailable right now. Your balances are safe.",
  "accounts.openLive.title": "Open a live account",
  "accounts.openLive.text": "Real markets. Starts at a zero balance; fund it from your wallet.",
  "accounts.openDemo.title": "Open a demo account",
  "accounts.openDemo.text": "Virtual funds on real-time prices, refillable every day.",
  "accounts.more": { one: "{count} more account", other: "{count} more accounts" },
  "accounts.myTitle": "My trading accounts",

  // Your account card
  "account.title": "Your account",
  "account.clientId": "Client ID",
  "account.emailStatus": "Email status",
  "account.notVerified": "Not verified",
  "account.identity": "Identity",
  "account.memberSince": "Member since",
  "account.profile": "Profile",

  // Ezymex Trader banner
  "trader.chip": "Live prices",
  "trader.text": "Real-time quotes and charts for {count} instruments across forex, metals, indices, energies, crypto and stocks. Runs in your browser, nothing to install.",

  // Market clock / heatmap
  "sessions.title": "Market clock",
  "sessions.open": "{open} of {total} markets open",
  "heatmap.title": "Market heatmap",
  "heatmap.subtitle": "Today's move from live prices · hollow dot: market closed",
  "heatmap.up": "{count} up",
  "heatmap.down": "{count} down",
  "heatmap.allMarkets": "All markets",
  "heatmap.tipOpen": "{symbol} · market open",
  "heatmap.tipClosed": "{symbol} · market closed, last session's move",

  // Support card. <mail> wraps the support email address
  "support.title": "Need help?",
  "support.text": "Write to <mail>{email}</mail> from your registered address and include your client ID.",
  "support.emailSupport": "Email support",
  "support.copied": "Email address copied",
  "support.copyFailed": "Couldn't copy, please select the address instead",

  // Demo dashboard: onboarding strip
  "onboarding.title": "Finish setting up your account",
  "onboarding.text": "Complete KYC to unlock withdrawals and higher limits.",
  "onboarding.progress": "Progress",
  "onboarding.dismiss": "Dismiss",

  // Margin health
  "margin.title": "Margin health",
  "margin.subtitle": "Across all live accounts",
  "margin.healthy": "Healthy",
  "margin.level": "Margin level",
  "margin.used": "Used margin",
  "margin.free": "Free margin",

  // Equity / P&L. {range} = 1W, 1M, 3M, YTD, 1Y, ALL (keep as-is)
  "equity.title": "Total equity",
  "equity.changeOver": "Change over {range}",
  "pnl.title": "Profit / loss · month",
  "pnl.lowRisk": "Low risk",
  "pnl.winRate": "Win rate (30d)",
  "pnl.trades": "Trades (30d)",
  "pnl.avgWin": "Avg. winning trade",
  "pnl.avgLoss": "Avg. losing trade",
  "pnl.charges": "Charges paid",

  // KPI cards
  "kpi.wallet": "Wallet",
  "kpi.today": "+{pct}% today",
  "kpi.monthPnl": "Month P&L",
  "kpi.vsLastMonth": "+{pct}% vs last month",
  "kpi.partnerEarnings": "Partner earnings",
  // Copy = copy-trading earnings
  "kpi.copy": "Copy {amount}",

  // Top movers
  "movers.title": "Top movers",
  "movers.gainers": "Gainers",
  "movers.losers": "Losers",

  // Economic calendar. A = Actual, F = Forecast, P = Previous
  "calendar.title": "Economic calendar",
  "calendar.subtitle": "Today · server time GMT+3",
  "calendar.actual": "A {value} · ",
  "calendar.forecastPrevious": "F {forecast} · P {previous}",

  // News / world
  "news.title": "Market news",
  "news.all": "All news",
  "news.pinned": "Pinned",
  "world.title": "Markets & news around the world",
  "world.subtitle": "Live headlines by country and currency sentiment",
  "world.stories": { one: "{count} story today", other: "{count} stories today" },

  // Open positions
  "positions.title": "Open positions",
  "positions.summary": { one: "{count} position · floating", other: "{count} positions · floating" },
  "positions.terminal": "Terminal",

  // Partner banner. <link> wraps the referral link
  "partner.chip": "Partner programme",
  "partner.title": "Invite traders. Earn up to $15 per lot — for life.",
  "partner.text": "Multi-tier commissions, CPA bonuses and real-time tracking. Your link: <link>{url}</link>",
  "partner.open": "Open partner dashboard",

  // Short relative times (m = minutes, h = hours, d = days)
  "time.justNow": "Just now",
  "time.minutesAgo": "{count}m ago",
  "time.hoursAgo": "{count}h ago",
  "time.daysAgo": "{count}d ago",
  // {time} = sample value like "5m"
  "time.ago": "{time} ago",

  // Notifications bell / panel
  // The dashboard's set-up prompts. Notifications themselves are in the bell, not on the dashboard.
  "home.setUpTitle": "Get set up",
  "notifications.title": "Notifications",
  "notifications.ariaUnread": "Notifications, {count} unread",
  "notifications.markAll": "Mark all read",
  "notifications.clear": "Clear",
  "notifications.emptyTitle": "No notifications yet",
  "notifications.emptyText": "Deposits, withdrawals, verification, trading alerts and replies from support appear here.",
  "notifications.settings": "Notification settings",

  // Client Area chrome: the slim side menu (rail) and the phone menu drawer
  "chrome.expand": "Expand menu",
  "chrome.collapse": "Collapse menu",
  "chrome.menu": "Menu",

  // Dashboard overview (title is shell.nav.overview; the greeting is greeting.*)
  "home.todayPnl": "Today's P&L",
  "home.walletBalance": "Wallet balance",
  "home.rewardsEarnings": "Rewards & IB earnings",
  // KPI chip. {pct} is a number like +2.52 (sign included)
  "home.todayPct": "{pct}% today",
  "home.floating": "Floating P&L",
  "home.rewards": "Rewards",
  // {live} = live accounts, {positions} = open positions
  "home.accountsChip": "{live} live · {positions} open positions",
  // Statistics card: segmented Equity | P&L, tabs Weekly · Monthly · Last year
  "home.statistics": "Statistics",
  "home.pnl": "P&L",
  "home.weekly": "Weekly",
  "home.monthly": "Monthly",
  "home.lastYear": "Last year",
  "home.noHistory": "Your equity history appears here once your live accounts have some activity.",
  "home.thisPeriod": "This period",
  "home.previousPeriod": "Previous period",
  // Account cards carousel and details
  "home.yourAccounts": "Your accounts",
  "home.tradingAccount": "Trading account",
  "home.accountInfo": "Account information",
  "home.accountName": "Account name",
  "home.leverage": "Leverage",
  "home.previous": "Previous account",
  "home.next": "Next account",
  "home.showBalances": "Show balances",
  "home.hideBalances": "Hide balances",
  "home.trade": "Trade",
  // Activity tabs
  "home.history": "History",
  "home.funding": "Funding",
  "home.linked": "Linked",
  "home.connected": "Connected",
  "home.subscriptions": { one: "{count} active subscription", other: "{count} active subscriptions" },
  "home.points": "{points} points",
  "home.redeem": "Redeem",
  "home.networkUnavailable": "Paused",
  // Right column: total balance, money actions, quick actions, notifications
  "home.totalBalance": "Total balance",
  "home.totalBalanceSub": "Live accounts and wallet",
  "home.transferFunds": "Transfer funds",
  "home.quickActions": "Quick actions",
  "home.later": "Later",
  "home.viewDetails": "View details",
  "home.verifyNow": "Verify now",
  "home.fundTitle": "Fund your wallet",
  "home.fundText": "Deposit USDT to start trading on a live account.",
  "home.depositNow": "Deposit now",
  // Sections below the overview
  "home.tradingTitle": "Trading",
  "home.marketsTitle": "Markets",
  "home.moreTitle": "More for you",

  // Ask Ezymex AI on the Overview (the support bot). {name} = the assistant's name, e.g. "Ezymex AI"
  "ai.title": "Ask {name}",
  "ai.subtitle": "Instant answers about your account, deposits and trading.",
  "ai.placeholder": "Ask anything about your account or trading…",
  "ai.followUp": "Ask a follow-up question…",
  "ai.openChat": "Open chat",
  "ai.continueChat": "Continue in chat",
  "ai.newQuestion": "New question",
  // screen-reader label of the typing dots
  "ai.thinking": "{name} is writing an answer",
  "ai.slow": "This is taking longer than usual. Your question is saved in your support chat, and the answer will appear there.",
  // a request for a person is open: the bot doesn't answer there (one open conversation per client)
  "ai.openRequest": "Your request for a person is still open.",
  "ai.view": "View",
  "ai.blocked": "{name} can't answer here while your request for a person is open. Close that request to ask {name}, or send this to our team.",
  "ai.closeAndAsk": "Close it and ask {name}",
  "ai.sendToTeam": "Send to our team",
  "ai.passed": "Passed to our support team. They'll reply in your chat.",
  // {name} = the support agent's name
  "ai.withAgent": "You're chatting with {name}. Replies appear in your support chat.",
  "ai.connecting": "Connecting you to a support specialist…",
  "ai.yourAccounts": "Your live accounts",
  // Suggestion chips (sent as the question)
  "ai.chip.deposit": "How do I deposit?",
  "ai.chip.freeMargin": "What's my free margin?",
  "ai.chip.marginLevel": "Explain margin level",
  "ai.chip.openAccount": "Open a new account",
  // the question sent for the "Open a new account" chip
  "ai.q.openAccount": "How do I open a new trading account?",
};
export default dashboard;
