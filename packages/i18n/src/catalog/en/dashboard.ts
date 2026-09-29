// Keys for this namespace. English is the source; translations live in ../<lang>/dashboard.ts.
const dashboard = {
  // Page header (Client Area home). {name} = client's first name
  "greeting.morning": "Good morning, {name}",
  "greeting.afternoon": "Good afternoon, {name}",
  "greeting.evening": "Good evening, {name}",
  "greeting.welcome": "Welcome, {name}",
  "subtitle.live": "Welcome to Kalks. Here's your account and today's markets.",
  "subtitle.demo": "Here's how your accounts are performing today.",
  launchTrader: "Launch Kalks Trader",
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
  "accounts.openLive.text": "Real markets. Starts at a zero balance; funding opens with the wallet.",
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

  // Kalks Trader banner
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
  "notifications.title": "Notifications",
  "notifications.ariaUnread": "Notifications, {count} unread",
  "notifications.markAll": "Mark all read",
  "notifications.clear": "Clear",
  "notifications.emptyTitle": "No notifications yet",
  "notifications.emptyText": "Deposits, withdrawals, verification, trading alerts and replies from support appear here.",
  "notifications.settings": "Notification settings",
};
export default dashboard;
