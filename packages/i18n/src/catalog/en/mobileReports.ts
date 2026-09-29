// Keys for this namespace. English is the source; translations live in ../<lang>/mobileReports.ts.
// Kalks mobile app (apps/mobile), Reports: Statements (/reports/statements) and Analytics (/reports/analytics).
// Most labels reuse the Client Area's portfolio.st.* / portfolio.an.* keys; only mobile-specific text is here.
const mobileReports = {
  eyebrow: "Reports",
  "eyebrow.analytics": "Reports · USD · server time",

  // Account picker (a card that opens a sheet)
  "account.title": "Account",
  "account.choose": "Choose an account",
  "account.allHint": { one: "{count} live account", other: "{count} live accounts" },
  "account.change": "Change account",

  // Statements
  "st.day": "Day",
  "st.pickDay": "Choose a day",
  "st.pickFrom": "Start date",
  "st.pickTo": "End date",
  "st.include": "Include",
  "st.summary": "#{login} · {period} · {format}",
  "st.preparing": "Preparing…",
  "st.ready": "Statement ready",
  "st.saved": "Saved as {file}",
  "st.shareTitle": "Share statement",
  "st.failed": "The statement couldn't be downloaded",
  "st.offline": "You're offline. Connect to download statements.",
  "st.monthly.empty": "No statement months yet.",
  "st.monthly.a11y": "{month}: net {net}, {trades}. Opens the downloads.",
  "st.month.title": "{month} statement",
  "st.month.formats": "Download as",
  "st.prevMonth": "Previous month",
  "st.nextMonth": "Next month",

  // Analytics: hero and stat tiles
  "an.hero.label": "Net P&L · {period}",
  "an.hero.return": "Return",
  "an.hero.trades": "Trades",
  "an.hero.lots": "Lots",
  "an.tile.sharpe": "Sharpe ratio",
  "an.tile.expectancy": "Expectancy",
  "an.tile.sortino": "Sortino {value}",
  "an.tile.avgWinLoss": "Avg win / loss",
  "an.tile.rr": "Reward : risk 1 : {value}",
  "an.tile.holdSplit": "Winners {win} · losers {loss}",
  "an.tile.streaks": "Streaks",
  "an.tile.streaksSub": "Wins / losses in a row",
  "an.tile.trade": "{side} {volume} · #{ticket}",
  "an.tile.none": "No trade yet",

  // Analytics: curves
  "an.curve.hint": "Touch and hold the chart to see each day",
  "an.curve.drawdown": "Drawdown",
  "an.curve.a11y": "Equity {equity}, balance {balance} on {date}. Maximum drawdown {drawdown}.",

  // Analytics: P&L calendar (net of closed trades per server day)
  "an.cal.title": "P&L calendar",
  "an.cal.subtitle": "Net result of closed trades per server day",
  "an.cal.subtitleEstimated": "Daily balance change, deposits and withdrawals removed",
  "an.cal.days": { one: "{count} trading day", other: "{count} trading days" },
  "an.cal.green": "{count} green",
  "an.cal.red": "{count} red",
  "an.cal.noTrades": "No closed trades",
  "an.cal.select": "Tap a day for its result",
  "an.cal.a11yDay": "{date}: {net}, {trades}",

  // Analytics: breakdowns
  "an.hour.byHour": "Net P&L by hour",
  "an.hour.byDayHour": "Weekday × hour",
  "an.hour.tap": "Tap a bar or a cell for details",
  "an.tapBar": "Tap a bar for details",
  "an.session.best": "Best",
  "an.session.asia": "Asia",
  "an.session.london": "London",
  "an.session.overlap": "London / New York",
  "an.session.newYork": "New York",
  "an.session.lateNewYork": "Late New York",
  "an.side.split": "{long} · {short}",
  "an.flow.equityNow": "Equity now",
  "an.charges.total": "Charges paid",

  // Behaviour insights (the numbers come from the reports service)
  "insight.overtrading.title": { one: "Overtrading on {count} day", other: "Overtrading on {count} days" },
  "insight.overtrading.text": "On these days you placed more than {limit} trades (your typical day is {median}). Net result on those days: {net}.",
  "insight.overtrading.tip": "Set a daily cap of {cap} trades.",
  "insight.revenge.title": { one: "{count} possible revenge trade", other: "{count} possible revenge trades" },
  "insight.revenge.text": "Trades opened within 15 minutes of a losing close, at the same size or larger. They won {rate}% of the time for {net} in total.",
  "insight.revenge.tip": "Pause for 15 minutes after a loss before the next trade.",
  "insight.risk.title": "Risk per losing trade",
  "insight.risk.text": { one: "A losing trade cost {avg}% of your balance on average, {max}% at most. {count} loss exceeded 2%.", other: "A losing trade cost {avg}% of your balance on average, {max}% at most. {count} losses exceeded 2%." },
  "insight.risk.tip": "Size positions so a stop-loss costs at most 1–2% of the balance.",
  "insight.holdLosers.title": "Losers are held longer than winners",
  "insight.holdLosers.text": "Losing trades stay open {loss} on average, winners {win}.",
  "insight.holdLosers.tip": "Place a stop-loss when you open the trade and leave it in place.",
  "insight.stopOut.title": { one: "{count} stop-out close", other: "{count} stop-out closes" },
  "insight.stopOut.text": "Positions were closed by the margin stop-out, not by your own stop-loss.",
  "insight.stopOut.tip": "Keep the margin level above the margin call level with smaller positions.",
  "insight.slTp.title": "Trades closed by stop-loss or take-profit",
  "insight.slTp.text": "{tp} by take-profit, {sl} by stop-loss, the rest closed by hand or by the desk.",
  "insight.slTp.tip": "Planned exits keep results consistent.",
  "insight.session.title": "Best session: {session}",
  "insight.session.text": "{trades} trades with a {rate}% win rate. Weakest: {worst} ({net}).",
  "insight.session.tip": "Focus on the {session} session.",
  "insight.tip": "Tip",

  // States
  "state.updating": "Updating…",
  "state.stale": "Showing saved data. Pull down to refresh.",
  "state.notShared.title": "Not shared with you",
  "state.footer": "All amounts in USD (cent accounts converted). Times are server time, GMT+2 / GMT+3.",
  "state.footerStatements": "Statements are in the account's currency (USC for cent accounts). Times are server time, GMT+2 / GMT+3.",
};
export default mobileReports;
