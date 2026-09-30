// Keys for this namespace. English is the source; translations live in ../<lang>/mobileAlgo.ts.
// Kalks mobile app: Algo (/algo): strategies running 24/7 on the server (deployments), the kill switch, backtest
// reports, the strategy marketplace, API keys and webhooks.
// Keep as they are: Kalks, Algo, API, USDT, USD, indicator names (EMA, RSI, MACD, ATR, CCI, ADX, DI…), symbols
// (EURUSD, XAUUSD), timeframes (M15, H1, H4), "R" (a multiple of the stop distance), pips, points, P&L, DD, SL / TP.
// Titles marked (display) are shown in tall uppercase display type: keep them short.
// "Deployment" = one strategy version running on one trading account. "Kill switch" = an emergency stop.
const mobileAlgo = {
  never: "never",
  // {n} days, compact
  days: "{n} d",
  lot: "lot",
  // How long a trade was held: m = minutes, h = hours, d = days (compact)
  "dur.m": "{m}m",
  "dur.h": "{h}h",
  "dur.hm": "{h}h {m}m",
  "dur.d": "{d}d",
  "dur.dh": "{d}d {h}h",
  nTrades: { one: "{count} trade", other: "{count} trades" },
  readOnly: "This login can view strategies but can't change anything.",

  /* ---------------------------------------------------------------- */
  /* Screen states                                                     */
  /* ---------------------------------------------------------------- */
  "state.unavailable.title": "Algo is unavailable", // (display)
  "state.unavailable.text": "We couldn't reach the strategy service. Your strategies keep running on the server; please try again in a moment.",
  "state.disabled.title": "Not available", // (display)
  "state.disabled.text": "This feature isn't available on your account.",
  "state.notFound.title": "Not found", // (display)
  "state.notFound.text": "It may have been removed, or the link is incorrect.",
  "state.back": "Back to Algo",

  /* ---------------------------------------------------------------- */
  /* Server errors (codes of the strategy service)                     */
  /* ---------------------------------------------------------------- */
  "error.haltedMine": "Your kill switch is on. Release it on the Algo screen before starting strategies again.",
  "error.haltedPlatform": "Automated trading is paused by the broker right now. Please try again later.",
  // {n} = the most strategies that can run at once
  "error.limitRunning": "You can run up to {n} strategies at a time. Stop one first.",
  "error.accountStatus": "This account can't trade right now.",
  "error.alreadyRunning": "This version is already running on that account.",
  "error.invalidStrategy": "Fix the strategy's errors first (in the Client Area or with the AI Trader).",
  "error.state": "It has already changed. Pull down to see its current state.",
  "error.queueFull": "You already have 3 backtests queued or running. Wait for one to finish.",
  "error.dailyLimit": "You've reached today's limit of {n} backtests.",
  "error.ownListing": "You can't subscribe to your own strategy.",
  "error.subscribed": "You already subscribe to this strategy.",
  "error.cloneNotAllowed": "The author doesn't allow cloning; copy it to your account instead.",
  // {amount} in USDT
  "error.insufficientFunds": "Your wallet balance is below {amount} USDT. Deposit USDT to subscribe.",
  "error.insufficientFundsPlain": "Your wallet balance is too low. Deposit USDT to subscribe.",
  "error.inactive": "This subscription is no longer active.",
  "error.archiveRunning": "Stop this strategy's deployments before archiving it.",
  "error.archived": "This strategy is archived.",
  "error.finished": "This backtest has already finished.",
  "error.revoked": "This key is already revoked.",
  "error.notFound": "It isn't there any more.",
  // {tf} = timeframe (H1), {days} = number of days
  "error.rangeTooLong": "{tf} backtests can cover at most {days} days. Choose a shorter period.",
  "error.balanceRange": "The starting balance must be between 100 and 10,000,000.",
  "error.dates": "The start date must be before the end date.",

  /* ---------------------------------------------------------------- */
  /* Home                                                              */
  /* ---------------------------------------------------------------- */
  "home.eyebrow": "Automated trading",
  "home.title": "Algo", // (display)
  "home.heroEyebrow": "Running now",
  "home.heroRunning": { zero: "strategies trading 24/7 on the server", one: "strategy trading 24/7 on the server", other: "strategies trading 24/7 on the server" },
  "home.heroRealized": "Realized P&L",
  "home.heroOpen": "Open now",
  // closed trades so far
  "home.heroTrades": "Trades",
  "home.qaAi": "Create with AI",
  "home.qaAiHint": "Describe an idea, get exact rules",
  "home.qaMarket": "Marketplace",
  "home.qaMarketHint": "Copy verified strategies",
  "home.qaKeys": "API keys & webhooks",
  "home.qaKeysHint": "Usage, revoke, recent alerts",
  "home.running": "Deployments", // (display)
  "home.runningSub": { zero: "Nothing running right now", one: "{count} running", other: "{count} running" },
  // {n} = count shown on the filter pill
  "home.filterActive": "Active · {n}",
  "home.filterAll": "All · {n}",
  "home.strategies": "My strategies", // (display)
  "home.strategiesSub": { zero: "None saved yet", one: "{count} saved", other: "{count} saved" },
  "home.newWithAi": "New with AI",
  "home.backtests": "Backtests", // (display)
  "home.backtestsSub": "The latest runs, newest first",
  "home.emptyDeps": "Nothing has run yet. Open one of your strategies below and deploy it on a demo account first.",
  "home.emptyActive": "Nothing is running right now. Stopped strategies are under All.",
  "home.showAll": "Show all",
  "home.emptyStrats": "No strategy of your own yet. Describe your idea to the AI Trader and it becomes exact rules you can test.",
  "home.browseMarket": "Browse the marketplace",
  "home.emptyBts": "No backtests yet. Open a strategy and run one on real price history.",
  "home.startEyebrow": "Get started",
  "home.startTitle": "Put a strategy to work", // (display)
  "home.step1": "Describe your idea to the AI Trader: it becomes exact rules you can read and change.",
  "home.step2": "Backtest the rules on real price history, with your account's costs.",
  "home.step3": "Run it 24/7 on a demo account first. Pause, stop or kill it at any time.",
  "home.footnote": "Strategies run on Kalks servers around the clock, on closed bars, with the same order checks as manual trading: margin, market hours, your limits. Build and edit strategies with the AI Trader or in the Client Area.",
  "home.openWeb": "Open the strategy builder on the web",

  /* ---------------------------------------------------------------- */
  /* Kill switch (account-wide)                                        */
  /* ---------------------------------------------------------------- */
  "kill.cardTitle": "Kill switch",
  "kill.cardBody": "Stop every strategy at once and block webhook and API orders.",
  "kill.stopAll": "Stop all",
  "kill.onTitle": "Kill switch is on",
  // {at} = date and time
  "kill.onSince": "Since {at}. Strategies are stopped; webhook and API orders are blocked.",
  "kill.onBody": "Strategies are stopped; webhook and API orders are blocked.",
  "kill.release": "Release",
  "kill.title": "Stop everything?", // (display)
  "kill.body": {
    zero: "Every strategy stops at once, and webhook and API orders are blocked until you release the switch.",
    one: "The running strategy stops at once, and webhook and API orders are blocked until you release the switch.",
    other: "All {count} running strategies stop at once, and webhook and API orders are blocked until you release the switch.",
  },
  "kill.alsoClose": "Also close their positions",
  "kill.alsoCloseHint": "Closes, at market, every position opened by a strategy, a webhook or the API on all your accounts. Your own manual trades stay open.",
  "kill.confirm": "Stop all now",
  "kill.doneTitle": "Everything stopped", // (display)
  "kill.stopped": "Strategies stopped",
  "kill.doneBody": "The kill switch stays on until you release it. Stopped strategies don't restart by themselves.",
  "kill.releaseTitle": "Release the kill switch?", // (display)
  "kill.releaseBody": "Webhook and API orders are allowed again. Stopped strategies stay stopped: deploy them again when you're ready.",
  "kill.releasedTitle": "Switch released", // (display)
  "kill.releasedBody": "Webhook and API orders are allowed again. Deploy a strategy to start it.",
  "kill.globalTitle": "Automated trading is paused",
  "kill.globalBody": "The broker has paused every strategy, webhook and API order for now. Open positions keep their stops.",

  /* ---------------------------------------------------------------- */
  /* Deployment statuses, controls                                     */
  /* ---------------------------------------------------------------- */
  "dep.status.running": "Running",
  "dep.status.paused": "Paused",
  "dep.status.stopped": "Stopped",
  "dep.status.killed": "Killed",
  "dep.status.error": "Error",
  "dep.realized": "Realized P&L",
  "dep.trades": "Trades",
  "dep.winRate": "Win rate",
  "dep.open": "Open",
  "dep.orders": "Orders",
  "dep.openNow": "Open",
  // {ago} = "5 minutes ago"
  "dep.lastCheck": "Last bar checked {ago}",
  // {since} = start date
  "dep.lastCheckSince": "Last bar checked {ago} · running since {since}",
  // {reason} = the service's reason, e.g. "stopped by the owner"
  "dep.stoppedWhy": "Stopped: {reason}",
  "dep.stoppedTitle": "Stopped {at}",
  "dep.errorTitle": "The strategy hit an error",
  // {account} = "Demo 50000083"
  "dep.eyebrow": "Deployment · {account}",
  "dep.marketplaceCopy": "Marketplace copy",
  "dep.openStrategy": "Open the strategy",
  // {pct} = return %, {amount} = starting balance
  "dep.onStart": "{pct} on {amount}",
  "dep.curveA11y": "Balance by day over {days} days, realized {pnl}",
  "dep.tabLog": "Log · {n}",
  "dep.tabTrades": "Trades · {n}",
  "dep.tabSetup": "Setup",
  "dep.noLogs": "Nothing logged yet: the first closed bar is a warm-up.",
  "dep.noTrades": "No trades yet.",
  "dep.older": "Load older entries",
  "dep.logStart": "That's the first entry.",
  "dep.rules": "Rules",
  "dep.rulesHidden": "The author keeps the rules private: the strategy runs on your account as published.",
  "dep.lotMultiplier": "Lot multiplier",
  "dep.maxLots": "Max lots per order",
  "dep.maxOpen": "Max open positions",
  "dep.dailyLoss": "Daily loss limit",
  "dep.started": "Started",
  "dep.startBalance": "Starting balance",
  "dep.setupNote": "A deployment runs one exact version: saving a new version doesn't change it. Deploy the new version to switch.",

  "ctl.pause": "Pause",
  "ctl.resume": "Resume",
  "ctl.stop": "Stop",
  "ctl.kill": "Kill",
  "ctl.killNow": "Kill now",
  "ctl.closePositions": "Close positions",
  "ctl.pauseTitle": "Pause it?", // (display)
  "ctl.pauseBody": "No new trades. Open positions keep their stop, target and breakeven. Resume whenever you like.",
  "ctl.resumeTitle": "Resume it?", // (display)
  "ctl.resumeBody": "It trades again from the next closed bar.",
  "ctl.stopTitle": "Stop it?", // (display)
  "ctl.stopBody": "It stops for good: no new trades. To run it again, deploy it again.",
  "ctl.keepTitle": "Keep the positions open",
  "ctl.keepText": { one: "The open position keeps its stop and target; manage it yourself.", other: "The {count} open positions keep their stops and targets; manage them yourself." },
  "ctl.closeAllTitle": "Close them now",
  "ctl.closeAllText": { one: "The open position is closed at market.", other: "The {count} open positions are closed at market." },
  "ctl.killTitle": "Kill it now?", // (display)
  "ctl.killBody": "The kill switch stops this strategy at once, and by default closes the positions it opened at market.",
  "ctl.killClose": "Close its positions",
  "ctl.killCloseHint": "At market, now. Turn off to keep them open with their stops.",
  "ctl.closeTitle": "Close its positions?", // (display)
  "ctl.closeBody": { one: "The position this strategy opened is closed at market. The strategy keeps running.", other: "The {count} positions this strategy opened are closed at market. The strategy keeps running." },
  "ctl.done.pause": "Paused", // (display)
  "ctl.done.resume": "Running again", // (display)
  "ctl.done.stop": "Stopped", // (display)
  "ctl.done.kill": "Killed", // (display)
  "ctl.done.close": "Positions closed", // (display)
  "ctl.donePause": "No new trades until you resume it.",
  "ctl.doneResume": "It trades again from the next closed bar.",
  "ctl.doneClosed": { one: "{count} position was closed.", other: "{count} positions were closed." },
  "ctl.doneKept": "Its open positions, if any, stay open with their stops and targets.",
  "ctl.doneNothing": "There was nothing open to close.",
  "ctl.closedLabel": "Closed",
  "ctl.failedLabel": "Couldn't close",
  "ctl.failedTitle": { one: "{count} position couldn't be closed", other: "{count} positions couldn't be closed" },
  "ctl.failedBody": "The market may be closed. Close it from Portfolio when trading reopens.",

  /* ---------------------------------------------------------------- */
  /* Strategy                                                          */
  /* ---------------------------------------------------------------- */
  // {version} = version number
  "strat.eyebrow": "Strategy · v{version}",
  "strat.runningN": { one: "Running", other: "{count} running" },
  "strat.draft": "Draft",
  "strat.ready": "Ready",
  "strat.errors": { one: "{count} error", other: "{count} errors" },
  "strat.archivedTag": "Archived",
  "strat.lastBacktest": "Last backtest",
  "strat.backtested": "backtest",
  "strat.notTested": "Not backtested yet", // (display)
  "strat.notTestedBody": "Test the rules on real price history, with your account's costs, before you run them.",
  "strat.runFirst": "Run a backtest",
  "strat.openReport": "Open the full report",
  "strat.deployV": "Deploy v{version}",
  "strat.backtest": "Backtest",
  "strat.fixFirst": "Fix these before testing or deploying",
  "strat.line": "Line {n}:",
  "strat.rules": "Rules", // (display)
  "strat.rulesSub": "Checked on every closed bar",
  "strat.rulesCodeSub": "The code's signals, checked on every closed bar",
  "strat.showCode": "Show as code",
  "strat.risk": "Risk", // (display)
  "strat.riskSub": "Size, stops, hours and limits",
  "strat.editVisual": "To change the rules, ask the AI Trader or edit them in the Client Area; every change is saved as a new version.",
  "strat.editCode": "Code strategies are edited in the Client Area on the web; every change is saved as a new version.",
  "strat.openWeb": "Edit the code on the web",
  "strat.deployments": "Deployments", // (display)
  "strat.deploymentsSub": { zero: "Not running anywhere", one: "{count} deployment", other: "{count} deployments" },
  "strat.notRunning": "Not running. Deploy it on a demo account first to see how it trades live.",
  "strat.backtests": "Backtests", // (display)
  "strat.backtestsSub": { zero: "None yet", one: "{count} run", other: "{count} runs" },
  "strat.runNew": "Run new",
  "strat.noBacktests": "No backtests yet.",
  "strat.versions": "Versions", // (display)
  "strat.versionsSub": { one: "{count} version", other: "{count} versions" },
  "strat.current": "Current",
  "strat.archive": "Archive",
  "strat.archiveTitle": "Archive it?", // (display)
  "strat.archiveBody": "“{name}” leaves your list. Its backtests and past deployments stay in your history.",
  "strat.archived": "“{name}” archived",

  "kind.visual": "Visual rules",
  "kind.code": "Code",
  // Where a strategy came from
  "origin.ai": "AI Trader",
  "origin.template": "Template",
  "origin.manual": "Built by hand",
  "origin.marketplace": "Marketplace",

  /* ---------------------------------------------------------------- */
  /* Rules in words                                                    */
  /* ---------------------------------------------------------------- */
  "rules.buy": "Buy when",
  "rules.sell": "Sell when",
  "rules.exitBuy": "Close buys when",
  "rules.exitSell": "Close sells when",
  "rules.and": "and",
  "rules.or": "or",
  // {tf} = timeframe, e.g. "on H4"
  "rules.onTf": "on {tf}",
  "rules.noRules": "No entry rules yet.",
  "rules.size": "Size",
  "rules.stop": "Stop loss",
  "rules.target": "Take profit",
  "rules.trailing": "Trailing",
  "rules.window": "Trading hours",
  "rules.limits": "Limits",
  "rules.none": "None",
  "rules.lots": "{lots} lot",
  "rules.riskPct": "{pct}% risk per trade",
  "rules.maxLots": "max {lots} lot",
  // points: move the stop to entry + {o} after {v} points in profit
  "rules.breakeven": "breakeven at {v} points (+{o})",
  "rules.allDay": "Around the clock",
  "rules.perDay": { one: "{count} trade a day", other: "{count} trades a day" },
  "rules.dailyLoss": "Stops for the day at a {amount} loss",
  "rules.oneAtATime": "One position at a time",
  "rules.closeOutside": "Closes outside the hours",
  "rules.noLimits": "No daily limits",
  "op.crossesAbove": "crosses above",
  "op.crossesBelow": "crosses below",
  "dist.pips": "{v} pips",
  "dist.points": "{v} points",
  "dist.price": "at {v}",
  "dist.percent": "{v}% of price",
  // {v} × ATR({p})
  "dist.atr": "{v} × ATR({p})",
  "dist.level": "level {v}",
  // a multiple of the stop distance
  "dist.rr": "{v}R",
  "field.close": "Close",
  "field.open": "Open",
  "field.high": "High",
  "field.low": "Low",
  "field.hl2": "Median price",
  "field.hlc3": "Typical price",
  "field.ohlc4": "Average price",
  "field.volume": "Volume",
  "pattern.bullish": "Bullish candle",
  "pattern.bearish": "Bearish candle",
  "pattern.bullish_engulfing": "Bullish engulfing",
  "pattern.bearish_engulfing": "Bearish engulfing",
  "pattern.hammer": "Hammer",
  "pattern.shooting_star": "Shooting star",
  "pattern.doji": "Doji",
  "pattern.inside_bar": "Inside bar",
  "ind.sma": "SMA",
  "ind.ema": "EMA",
  "ind.wma": "WMA",
  "ind.rsi": "RSI",
  "ind.macd": "MACD",
  "ind.macd_signal": "MACD signal",
  "ind.macd_hist": "MACD histogram",
  "ind.bb_upper": "Upper Bollinger",
  "ind.bb_middle": "Middle Bollinger",
  "ind.bb_lower": "Lower Bollinger",
  "ind.atr": "ATR",
  "ind.stoch_k": "Stochastic %K",
  "ind.stoch_d": "Stochastic %D",
  "ind.highest": "Highest high",
  "ind.lowest": "Lowest low",
  "ind.cci": "CCI",
  "ind.willr": "Williams %R",
  "ind.adx": "ADX",
  "ind.plus_di": "+DI",
  "ind.minus_di": "−DI",
  "ind.momentum": "Momentum",
  "ind.roc": "ROC",
  "ind.stddev": "Std deviation",
  "note.noDailyLimit": "No daily trade limit",
  "note.noStop": "No stop loss: positions are unprotected",
  "note.riskNeedsStop": "Risk-based sizing needs a stop loss",
  "note.rrNeedsStop": "A take profit in R needs a stop loss",
  "note.noEntry": "No entry rule: add a buy or sell condition",

  /* ---------------------------------------------------------------- */
  /* Deploy (form)                                                     */
  /* ---------------------------------------------------------------- */
  "deploy.eyebrow": "Deploy · v{version}",
  "deploy.title": "Run it 24/7", // (display)
  "deploy.body": "“{name}” v{version} trades {symbol} on every closed {tf} bar, on Kalks servers, even when your phone is off. Pause, stop or kill it at any time.",
  "deploy.account": "Account",
  "deploy.equity": "{amount} equity",
  "deploy.noAccounts": "You need an active trading account. Open a demo account to try strategies without risk.",
  "deploy.openAccount": "Open an account",
  "deploy.multiplier": "Lot multiplier",
  "deploy.multiplierHint": "Scales every order's size. 1× trades the strategy's own size.",
  "deploy.maxOpen": "Max open positions",
  "deploy.maxOpenHint": "A cap on top of the strategy's own rules.",
  "deploy.strategyDefault": "Strategy's rule",
  "deploy.dailyLoss": "Daily loss limit",
  "deploy.dailyLossHint": "When the day's closed and open loss reaches it, no new trades until tomorrow (server time).",
  "deploy.off": "Off",
  "deploy.custom": "Custom",
  "deploy.dailyLossAmount": "Daily loss limit",
  "deploy.lossInvalid": "Enter an amount above 0.",
  "deploy.liveTitle": "Real money",
  "deploy.liveBody": "This is a live account. The strategy places real orders with real money, and can lose it.",
  "deploy.ack": "I understand the strategy trades real money on my live account and I'm responsible for it.",
  "deploy.note": "Automated trading can lose money. Backtests are simulations and don't predict future results. This isn't financial advice.",
  // {account} = "Demo 50000083"
  "deploy.confirm": "Deploy on {account}",
  "deploy.doneTitle": "Running", // (display)
  "deploy.doneBody": "“{name}” v{version} is running on {account}.",
  "deploy.warmup": "The first closed {tf} bar is a warm-up; orders can start from the next one.",
  "deploy.open": "Open deployment",

  /* ---------------------------------------------------------------- */
  /* Backtests                                                         */
  /* ---------------------------------------------------------------- */
  "bt.status.queued": "Queued",
  "bt.status.running": "Running",
  "bt.status.done": "Done",
  "bt.status.failed": "Failed",
  "bt.status.cancelled": "Cancelled",
  "bt.stage.queued": "Waiting for a free worker",
  "bt.stage.loading": "Loading price history",
  "bt.stage.m1": "Loading minute bars",
  "bt.stage.simulating": "Simulating trades",
  "bt.stage.running": "Running",
  // {id} = backtest number, {version} = strategy version
  "bt.eyebrow": "Backtest #{id} · v{version}",
  "bt.title": "Backtest", // (display)
  "bt.start": "Start {amount}",
  "bt.runningNote": "It runs on the server: you can leave this screen and come back.",
  "bt.failed": "The backtest failed",
  "bt.cancelled": "Cancelled", // (display)
  "bt.runAgain": "Run again",
  "bt.net": "Net profit",
  // {pct} = return, {amount} = starting balance
  "bt.returnOf": "{pct} on {amount}",
  "bt.pf": "Profit factor",
  "bt.winRate": "Win rate",
  "bt.winsOf": "{wins} of {trades}",
  "bt.maxDd": "Max drawdown",
  "bt.maxDdShort": "Max DD",
  "bt.sharpe": "Sharpe",
  "bt.sortino": "Sortino {v}",
  "bt.trades": "Trades",
  "bt.longShort": "{long} long · {short} short",
  "bt.expectancy": "Expectancy",
  "bt.perTrade": "per trade",
  "bt.equity": "Equity", // (display)
  "bt.drawdown": "Drawdown",
  "bt.legendEquity": "Equity",
  "bt.legendBalance": "Balance",
  "bt.legendStart": "Start",
  "bt.noCurve": "Not enough bars for a curve.",
  "bt.scrubHint": "Drag across the chart, or touch and hold, to read any point.",
  "bt.curveA11y": "Equity from {from} to {to}; maximum drawdown {dd}",
  "bt.monthly": "Monthly", // (display)
  "bt.monthlySub": "Return of each month, % of the balance",
  "bt.noTradesMonth": "no trades",
  "bt.statistics": "Statistics", // (display)
  "bt.tradeList": "Trades", // (display)
  "bt.tradeListSub": "Newest first, net of costs",
  "bt.truncated": "The first {n} trades, newest first",
  "bt.fAll": "All · {n}",
  "bt.fWins": "Wins · {n}",
  "bt.fLosses": "Losses · {n}",
  "bt.noTrades": "The rules didn't trade in this period.",
  "bt.data": "Data & costs", // (display)
  "bt.m1Bars": "Minute bars (intrabar)",
  "bt.since": "since {date}",
  "bt.signals": "Signals",
  "bt.signalsValue": "{buy} buy · {sell} sell · {exits} exit",
  "bt.skipped": "Skipped: {reason}",
  "bt.model": "Model",
  "bt.group": "Account type",
  "bt.spread": "Spread",
  "bt.spreadValue": "{points} points ({source})",
  "bt.commission": "Commission",
  "bt.perLot": "{amount} per lot",
  "bt.swaps": "Swaps",
  "bt.swapsOn": "Charged at each rollover",
  "bt.swapsOff": "Not charged (swap-free)",
  "bt.conversion": "P&L conversion",
  "bt.usdBase": "USD base: at the exit price",
  "bt.usdQuoted": "Quoted in USD",
  "bt.currentRate": "At the current rate ({rate})",
  "bt.simNote": "Backtest #{id} is a simulation on past prices: fills at the next bar's open, stops and targets on an OHLC path (minute bars where they exist), your account type's spread, commission and swaps. Past results don't predict future results.",
  // History sources and skip reasons from the service
  "source.native": "native",
  "source.built_from_M1": "built from M1",
  "source.built_from_M5": "built from M5",
  "source.built_from_M15": "built from M15",
  "source.built_from_M30": "built from M30",
  "source.built_from_H1": "built from H1",
  "skip.outside_trading_window": "outside trading hours",
  "skip.position_already_open": "a position was already open",
  "skip.daily_trade_limit": "daily trade limit",
  "skip.max_daily_loss": "daily loss limit",
  "skip.market_closed": "market closed",
  "skip.20_open_positions": "20 positions already open",
  "skip.buy_and_sell_on_the_same_bar": "buy and sell on the same bar",
  "skip.stop_distance_not_ready": "stop distance not ready yet",
  "skip.SL_level_on_the_wrong_side": "stop level on the wrong side",
  "skip.volume_below_the_minimum_lot": "size below the minimum lot",
  "spreadSource.group_quote": "your account type's live quote",
  "spreadSource.catalogue": "catalogue spread",
  "spreadSource.fixed": "fixed",

  "btNew.title": "Run a backtest", // (display)
  "btNew.period": "Period",
  "btNew.balance": "Starting balance",
  "btNew.other": "Other",
  "btNew.amount": "Amount",
  "btNew.costs": "Costs from",
  "btNew.accountType": "Account type",
  "btNew.myAccount": "My account",
  "btNew.costsGroupHint": "That account type's spread, commission and swaps.",
  "btNew.costsAccountHint": "The spread, commission and swaps of that account's group.",
  "btNew.noAccounts": "You don't have an active trading account yet.",
  "btNew.run": "Run backtest",
  "btNew.note": "The longest period depends on the timeframe. Up to 3 backtests can run at once.",

  "period.p1m": "1M",
  "period.p3m": "3M",
  "period.p6m": "6M",
  "period.p1y": "1Y",
  "period.p2y": "2Y",
  "period.p5y": "5Y",

  // Trade exit reasons (server codes)
  "exit.sl": "Stop loss",
  "exit.tp": "Take profit",
  "exit.trailing": "Trailing stop",
  "exit.breakeven": "Breakeven",
  "exit.signal": "Signal",
  "exit.exit_rule": "Exit rule",
  "exit.session": "Out of hours",
  "exit.end_of_test": "End of test",
  "exit.stop_out": "Stop-out",
  "exit.kill": "Kill switch",
  "exit.stopped": "Stopped",
  "exit.client": "Closed",
  "exit.close": "Closed",

  "stat.balance": "Balance",
  "stat.gross": "Gross profit / loss",
  "stat.cagr": "Yearly growth (CAGR)",
  "stat.avgWinLoss": "Average win / loss",
  "stat.largest": "Largest win / loss",
  "stat.payoff": "Payoff ratio",
  "stat.long": "Long trades · win rate",
  "stat.short": "Short trades · win rate",
  "stat.streaks": "Most wins / losses in a row",
  "stat.maxDd": "Max drawdown",
  "stat.recovery": "Recovery factor",
  "stat.sharpeSortino": "Sharpe / Sortino",
  "stat.avgBars": "Average bars held",
  "stat.exposure": "Time in the market",
  "stat.costs": "Commission / swap / spread",
  "stat.bars": "Bars tested",
  "stat.cpu": "Computed in",
  "stat.seconds": "{s} s",

  /* ---------------------------------------------------------------- */
  /* Log kinds (runtime)                                               */
  /* ---------------------------------------------------------------- */
  "log.eval": "Bar",
  "log.signal": "Signal",
  "log.order": "Order",
  "log.close": "Close",
  "log.manage": "Manage",
  "log.error": "Error",
  "log.info": "Info",

  /* ---------------------------------------------------------------- */
  /* Marketplace                                                       */
  /* ---------------------------------------------------------------- */
  "house.badge": "House strategy · Operated by Kalks",
  "house.disclosure":
    "House strategy operated by Kalks: a broker-owned live account running this strategy. The track record is only its own live trades since it started; nothing is simulated or backfilled.",
  "market.eyebrow": "Strategy marketplace",
  "market.title": "Market", // (display)
  "market.subtitle": "Strategies with verified track records from real Kalks accounts. Copy one onto your account, or clone its rules when the author allows it.",
  "market.browse": "Browse",
  "market.subs": "Subscriptions",
  "market.subsN": "Subscriptions · {n}",
  "market.mine": "Your listings",
  "market.search": "Search strategies, authors…",
  "market.clear": "Clear the search",
  "market.all": "All",
  "market.free": "Free",
  "market.paid": "Paid",
  "market.newest": "Newest",
  "market.topRated": "Top rated",
  "market.popular": "Popular",
  // {price} in USDT
  "market.perMonth": "{price} USDT/mo",
  "market.by": "by {author}",
  "market.return": "Return",
  "market.winRate": "Win rate",
  "market.maxDd": "Max DD",
  "market.trades": "Trades",
  // {type} = live / demo
  "market.verified": "Verified {type}",
  "market.verifiedDays": "verified {type} · {days} days",
  // a track record younger than a day
  "market.verifiedNew": "verified {type} · under a day",
  "market.subscribed": "Subscribed",
  "market.ratings": { zero: "No ratings", one: "{count} rating", other: "{count} ratings" },
  "market.subscribers": { one: "{count} subscriber", other: "{count} subscribers" },
  "market.emptyTitle": "Nothing listed yet", // (display)
  "market.emptyText": "Strategies appear here once their authors publish them with a verified track record.",
  "market.noMatchTitle": "No matches", // (display)
  "market.noMatchText": "Try another search or filter.",
  "market.noSubsTitle": "No subscriptions", // (display)
  "market.noSubsText": "Strategies you copy or clone from the marketplace appear here.",
  "market.disclaimer": "Past performance doesn't guarantee future results. Track records come from live or demo accounts on Kalks and are labelled that way. Platform fee on paid subscriptions: {pct}%.",
  "market.houseFootnote": "House strategies run on broker-owned live accounts; their track records are their own live trades only.",
  "market.earned": "Earned",
  "market.fees": "Platform fees",
  "market.payments": "Payments",
  "market.publishWeb": "Publishing a strategy (with its verified track record) and editing a listing happen in the Client Area on the web.",
  "market.openWeb": "Open the marketplace on the web",

  // Listing statuses (server values)
  "listing.pending": "In review",
  "listing.approved": "Listed",
  "listing.rejected": "Rejected",
  "listing.suspended": "Suspended",
  "listing.unlisted": "Unlisted",
  "listing.eyebrow": "Marketplace · {symbol} {tf}",
  "listing.verified": "Verified {type} track record",
  "listing.cloneAllowed": "Cloning allowed",
  "listing.trackReturn": "Verified return",
  "listing.net": "Net",
  "listing.noCurve": "The day-by-day curve appears after two days of trading.",
  "listing.curveA11y": "Equity by day over {days} days, return {ret}",
  "listing.trackNote": "From the author's own deployment on Kalks since {since}, computed from closed deals on the trading engine: never entered by the author.",
  "listing.btSimulated": "Backtest · simulated",
  "listing.btNote": "How the rules would have traded past prices with this account type's costs. It isn't part of the live track record above.",
  "listing.btA11y": "Backtest equity curve (simulated)",
  "listing.about": "About", // (display)
  "listing.risk": "Risk", // (display)
  "listing.rules": "Rules", // (display)
  "listing.rulesPrivate": "The rules are private: copy the strategy to run it on your account.",
  "listing.reviews": "Reviews · {n}", // (display)
  "listing.noReviews": "No reviews yet.",
  "listing.subscribeFree": "Subscribe for free",
  "listing.subscribePaid": "Subscribe · {price} USDT / month",
  "listing.copying": "Copying on {login}",
  "listing.clonedTo": "Cloned to your strategies",
  "listing.openDeployment": "Open deployment",
  "listing.openStrategy": "Open strategy",
  "listing.cancel": "Cancel",
  "listing.cancelConfirm": "Cancel the subscription",
  "listing.keep": "Keep it",
  "listing.cancelTitle": "Cancel it?", // (display)
  "listing.cancelCopy": "The strategy stops on your account now. Its open positions stay open with their stops and targets.",
  "listing.cancelClone": "The subscription ends. The cloned strategy stays in your list.",
  // {date} = end of the paid period
  "listing.cancelPaid": "It keeps running until {date} and won't renew. Nothing is refunded for the current period.",
  "listing.cancelled": "Subscription cancelled",
  "listing.cancelledPaid": "It won't renew",
  "listing.yours": "Your listing",
  "listing.manageWeb": "Manage on the web",

  /* ---------------------------------------------------------------- */
  /* Subscribe (form), subscriptions                                   */
  /* ---------------------------------------------------------------- */
  "sub.eyebrow": "Subscribe",
  "sub.title": "Subscribe",
  "sub.body": "by {author} · {symbol} {tf}",
  "sub.how": "How",
  "sub.copyTitle": "Copy to my account",
  "sub.copyText": "The author's exact version runs on your account, 24/7. The rules stay private.",
  "sub.copyTextOpen": "The author's exact version runs on your account, 24/7.",
  "sub.cloneTitle": "Clone the rules",
  "sub.cloneText": "The rules become one of your strategies: test, change and deploy them yourself.",
  "sub.multiplierHint": "Scales the strategy's order sizes on your account.",
  "sub.price": "Price",
  "sub.dueNow": "Due now",
  "sub.wallet": "Wallet (available)",
  "sub.renewal": "Renewal",
  "sub.noCharge": "Free, nothing is charged",
  "sub.shortTitle": "Not enough USDT",
  "sub.shortBody": "Your wallet needs at least {amount} USDT available.",
  "sub.deposit": "Deposit",
  "sub.liveBody": "The strategy places real orders with real money on this account, and can lose it.",
  "sub.ackPay": "Charge {price} USDT from my Kalks wallet now and every 30 days until I cancel.",
  "sub.doneTitle": "Subscribed", // (display)
  // {title} = strategy, {account} = "Demo 50000083"
  "sub.doneCopy": "“{title}” is running on {account}.",
  "sub.doneClone": "“{title}” is now one of your strategies.",
  "sub.charged": "{amount} USDT was charged from your wallet.",
  "sub.free": "Free subscription: nothing was charged.",
  "sub.copyOn": "copy on {login}",
  "sub.cloned": "cloned",
  "sub.renews": "renews {date}",
  "sub.ends": "ends {date}",
  "sub.status.active": "Active",
  "sub.status.cancelled": "Cancelled",
  "sub.status.expired": "Expired",
  "sub.status.past_due": "Payment due",

  "review.title": "Rate it", // (display)
  "review.rating": "Your rating",
  "review.stars": { one: "{count} star", other: "{count} stars" },
  "review.comment": "Comment (optional)",
  "review.placeholder": "How did it trade for you?",
  "review.post": "Post review",
  "review.saved": "Review saved",
  "review.rate": "Rate it",
  "review.edit": "Edit review",
  "review.you": "You",

  /* ---------------------------------------------------------------- */
  /* API keys and webhooks                                             */
  /* ---------------------------------------------------------------- */
  "keys.eyebrow": "Developers",
  "keys.title": "API", // (display)
  "keys.subtitle": "Keys for your own trading programs and webhook URLs for alerts (TradingView and others).",
  "keys.requests24h": "Requests · last 24 h",
  "keys.errors": "Errors",
  // requests refused by the rate limit
  "keys.limited": "Limited",
  "keys.p50": "Median",
  "keys.writes": "Orders",
  "keys.keys": "API keys", // (display)
  "keys.keysSub": "{n} active · up to 20",
  "keys.none": "No API keys. Create one in the Client Area on the web.",
  "keys.status.active": "Active",
  "keys.status.revoked": "Revoked",
  "keys.status.expired": "Expired",
  "keys.scope.read": "Read",
  "keys.scope.trade": "Trade",
  // {ips} = list of IP addresses
  "keys.ips": "Only from {ips}",
  "keys.anyIp": "From any IP address",
  "keys.expires": "Expires {date}",
  "keys.noExpiry": "Never expires",
  "keys.lastUsed": "last used {ago}",
  "keys.revoke": "Revoke",
  "keys.revokeTitle": "Revoke this key?", // (display)
  "keys.revokeBody": "“{name}” ({id}) stops working at once for every program that uses it. This can't be undone.",
  "keys.revoked": "“{name}” revoked",
  "keys.webTitle": "Create on the web",
  "keys.webBody": "New keys and webhooks are created in the Client Area: a key's secret and a webhook's URL are shown once, where you can copy them into your trading tools.",
  "keys.openWeb": "Open the Client Area",
  "keys.killHint": "Need to stop everything? The kill switch on the Algo screen stops every strategy and blocks webhook and API orders.",

  "hooks.title": "Webhooks", // (display)
  "hooks.sub": "{n} of up to 20",
  "hooks.none": "No webhooks. Create one in the Client Area on the web.",
  // {hint} = the URL's last characters
  "hooks.hint": "URL …{hint}",
  "hooks.accounts": { one: "{count} account", other: "{count} accounts" },
  "hooks.today": { zero: "no alerts today", one: "{count} alert today", other: "{count} alerts today" },
  "hooks.used": "used {ago}",
  "hooks.on": "On",
  "hooks.off": "Off",
  "hooks.switch": "Webhook “{name}” on",
  "hooks.passphrase": "Passphrase required",
  "hooks.noPassphrase": "No passphrase",
  "hooks.delete": "Delete",
  "hooks.deleteTitle": "Delete this webhook?", // (display)
  "hooks.deleteBody": "“{name}” and its secret URL stop working at once; alerts sent to it are refused. This can't be undone.",
  "hooks.deleted": "“{name}” deleted",
  "hooks.alerts": "Recent alerts", // (display)
  "hooks.alertsSub": "Each alert with every account's result",
  // Alert statuses (server values)
  "hooks.status.accepted": "Accepted",
  "hooks.status.partial": "Partly done",
  "hooks.status.failed": "Failed",
  "hooks.status.received": "Received",
  "hooks.status.rejected": "Rejected",
  "hooks.status.blocked": "Blocked (kill switch)",
  // Each account's result of an alert (server values)
  "hooks.result.filled": "filled",
  "hooks.result.pending": "order placed",
  "hooks.result.closed": "closed",
  "hooks.result.nothing_to_close": "nothing to close",
  "hooks.result.rejected": "rejected",
};
export default mobileAlgo;
