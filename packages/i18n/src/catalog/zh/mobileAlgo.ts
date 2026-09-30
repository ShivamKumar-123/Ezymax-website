import type { NsMessages } from "../../core";

// Kalks mobile app: Algo: strategies running 24/7 on the server (deployments), the kill switch, backtest reports,
// the strategy marketplace, API keys and webhooks.
// Keep as they are: Kalks, Algo, API, USDT, USD, indicator names (EMA, RSI, MACD, ATR, CCI, ADX, DI…), symbols
// (EURUSD, XAUUSD), timeframes (M15, H1, H4), "R" (a multiple of the stop distance), pips, P&L, DD, SL / TP.
// Points are "点". Titles marked (display) are shown in tall display type: keep them short.
// "Deployment" = 部署 (one strategy version on one account). "Kill switch" = 紧急停止开关; "kill" = 强制停止.
const mobileAlgo: NsMessages<"mobileAlgo"> = {
  never: "从未",
  // {n} days, compact
  days: "{n} 天",
  lot: "手",
  // How long a trade was held (compact)
  "dur.m": "{m}分",
  "dur.h": "{h}小时",
  "dur.hm": "{h}小时 {m}分",
  "dur.d": "{d}天",
  "dur.dh": "{d}天 {h}小时",
  nTrades: { other: "{count} 笔交易" },
  readOnly: "此登录可查看策略，但无法进行任何更改。",

  /* ---------------------------------------------------------------- */
  /* Screen states                                                     */
  /* ---------------------------------------------------------------- */
  "state.unavailable.title": "Algo 不可用", // (display)
  "state.unavailable.text": "无法连接到策略服务。您的策略仍在服务器上运行，请稍后重试。",
  "state.disabled.title": "不可用", // (display)
  "state.disabled.text": "您的账户未开通此功能。",
  "state.notFound.title": "未找到", // (display)
  "state.notFound.text": "它可能已被删除，或链接不正确。",
  "state.back": "返回 Algo",

  /* ---------------------------------------------------------------- */
  /* Server errors (codes of the strategy service)                     */
  /* ---------------------------------------------------------------- */
  "error.haltedMine": "您的紧急停止开关已开启。请先在 Algo 页面将其解除，再重新启动策略。",
  "error.haltedPlatform": "经纪商目前已暂停自动交易。请稍后重试。",
  // {n} = the most strategies that can run at once
  "error.limitRunning": "您最多可同时运行 {n} 个策略。请先停止一个。",
  "error.accountStatus": "此账户目前无法交易。",
  "error.alreadyRunning": "此版本已在该账户上运行。",
  "error.invalidStrategy": "请先修复策略中的错误（在客户专区或使用 AI 交易员）。",
  "error.state": "状态已发生变化。请下拉查看当前状态。",
  "error.queueFull": "您已有 3 个回测正在排队或运行。请等待其中一个完成。",
  "error.dailyLimit": "您已达到今日 {n} 次回测的上限。",
  "error.ownListing": "您无法订阅自己的策略。",
  "error.subscribed": "您已订阅此策略。",
  "error.cloneNotAllowed": "作者不允许克隆；请改为将其复制到您的账户。",
  // {amount} in USDT
  "error.insufficientFunds": "您的钱包余额低于 {amount} USDT。请入金 USDT 后再订阅。",
  "error.insufficientFundsPlain": "您的钱包余额不足。请入金 USDT 后再订阅。",
  "error.inactive": "此订阅已失效。",
  "error.archiveRunning": "归档前请先停止此策略的所有部署。",
  "error.archived": "此策略已归档。",
  "error.finished": "此回测已完成。",
  "error.revoked": "此密钥已被撤销。",
  "error.notFound": "该项已不存在。",
  // {tf} = timeframe (H1), {days} = number of days
  "error.rangeTooLong": "{tf} 回测最多可覆盖 {days} 天。请选择更短的期间。",
  "error.balanceRange": "初始余额必须介于 100 至 10,000,000 之间。",
  "error.dates": "开始日期必须早于结束日期。",

  /* ---------------------------------------------------------------- */
  /* Home                                                              */
  /* ---------------------------------------------------------------- */
  "home.eyebrow": "自动交易",
  "home.title": "Algo", // (display)
  "home.heroEyebrow": "正在运行",
  "home.heroRunning": { other: "个策略在服务器上全天候交易" },
  "home.heroRealized": "已实现盈亏",
  "home.heroOpen": "当前持仓",
  // closed trades so far
  "home.heroTrades": "交易",
  "home.qaAi": "用 AI 创建",
  "home.qaAiHint": "描述想法，获得精确规则",
  "home.qaMarket": "策略市场",
  "home.qaMarketHint": "复制经过验证的策略",
  "home.qaKeys": "API 密钥与 Webhook",
  "home.qaKeysHint": "用量、撤销、最近警报",
  "home.running": "部署", // (display)
  "home.runningSub": { zero: "目前没有运行中的部署", other: "{count} 个运行中" },
  // {n} = count shown on the filter pill
  "home.filterActive": "活跃 · {n}",
  "home.filterAll": "全部 · {n}",
  "home.strategies": "我的策略", // (display)
  "home.strategiesSub": { zero: "尚未保存任何策略", other: "已保存 {count} 个" },
  "home.newWithAi": "用 AI 新建",
  "home.backtests": "回测", // (display)
  "home.backtestsSub": "最近的运行，按时间倒序",
  "home.emptyDeps": "尚未运行过任何策略。请打开下方的某个策略，先将其部署到模拟账户上。",
  "home.emptyActive": "目前没有运行中的策略。已停止的策略位于“全部”中。",
  "home.showAll": "显示全部",
  "home.emptyStrats": "您还没有自己的策略。向 AI 交易员描述您的想法，它将变成可供测试的精确规则。",
  "home.browseMarket": "浏览策略市场",
  "home.emptyBts": "暂无回测。打开一个策略，基于真实历史价格运行回测。",
  "home.startEyebrow": "快速入门",
  "home.startTitle": "让策略为您工作", // (display)
  "home.step1": "向 AI 交易员描述您的想法：它将变成可阅读、可修改的精确规则。",
  "home.step2": "基于真实历史价格，按您账户的成本对规则进行回测。",
  "home.step3": "先在模拟账户上全天候运行。可随时暂停、停止或强制停止。",
  "home.footnote": "策略在 Kalks 服务器上全天候运行，基于已收盘K线，并执行与手动交易相同的订单检查：预付款、交易时间和您的限制。您可以使用 AI 交易员或在客户专区中构建和编辑策略。",
  "home.openWeb": "在网页版中打开策略构建器",

  /* ---------------------------------------------------------------- */
  /* Kill switch (account-wide)                                        */
  /* ---------------------------------------------------------------- */
  "kill.cardTitle": "紧急停止开关",
  "kill.cardBody": "立即停止所有策略，并阻止 Webhook 和 API 订单。",
  "kill.stopAll": "全部停止",
  "kill.onTitle": "紧急停止已开启",
  // {at} = date and time
  "kill.onSince": "自 {at} 起。策略已停止；Webhook 和 API 订单已被阻止。",
  "kill.onBody": "策略已停止；Webhook 和 API 订单已被阻止。",
  "kill.release": "解除",
  "kill.title": "全部停止？", // (display)
  "kill.body": {
    zero: "所有策略将立即停止，在您解除开关之前，Webhook 和 API 订单将被阻止。",
    other: "{count} 个运行中的策略将立即停止，在您解除开关之前，Webhook 和 API 订单将被阻止。",
  },
  "kill.alsoClose": "同时平掉其持仓",
  "kill.alsoCloseHint": "按市价平掉您所有账户上由策略、Webhook 或 API 开立的全部持仓。您自己手动开立的交易不受影响。",
  "kill.confirm": "立即全部停止",
  "kill.doneTitle": "已全部停止", // (display)
  "kill.stopped": "策略已停止",
  "kill.doneBody": "紧急停止开关将保持开启，直至您将其解除。已停止的策略不会自行重启。",
  "kill.releaseTitle": "解除紧急停止？", // (display)
  "kill.releaseBody": "Webhook 和 API 订单将再次被允许。已停止的策略仍保持停止：准备就绪后请重新部署。",
  "kill.releasedTitle": "已解除", // (display)
  "kill.releasedBody": "Webhook 和 API 订单已再次被允许。部署策略即可启动。",
  "kill.globalTitle": "自动交易已暂停",
  "kill.globalBody": "经纪商已暂时暂停所有策略、Webhook 和 API 订单。持仓仍保留其止损。",

  /* ---------------------------------------------------------------- */
  /* Deployment statuses, controls                                     */
  /* ---------------------------------------------------------------- */
  "dep.status.running": "运行中",
  "dep.status.paused": "已暂停",
  "dep.status.stopped": "已停止",
  "dep.status.killed": "已强制停止",
  "dep.status.error": "错误",
  "dep.realized": "已实现盈亏",
  "dep.trades": "交易",
  "dep.winRate": "胜率",
  "dep.open": "持仓",
  "dep.orders": "订单",
  "dep.openNow": "持仓中",
  // {ago} = "5 minutes ago"
  "dep.lastCheck": "最后检查K线 {ago}",
  // {since} = start date
  "dep.lastCheckSince": "最后检查K线 {ago} · 自 {since} 起运行",
  // {reason} = the service's reason, e.g. "stopped by the owner"
  "dep.stoppedWhy": "已停止：{reason}",
  "dep.stoppedTitle": "停止于 {at}",
  "dep.errorTitle": "策略遇到错误",
  // {account} = "Demo 50000083"
  "dep.eyebrow": "部署 · {account}",
  "dep.marketplaceCopy": "策略市场副本",
  "dep.openStrategy": "打开策略",
  "dep.openSubscription": "打开我的订阅",
  // {pct} = return %, {amount} = starting balance
  "dep.onStart": "{pct}（初始 {amount}）",
  "dep.curveA11y": "{days} 天内的每日余额，已实现 {pnl}",
  "dep.tabLog": "日志 · {n}",
  "dep.tabTrades": "交易 · {n}",
  "dep.tabSetup": "设置",
  "dep.noLogs": "暂无日志：第一根已收盘K线用于预热。",
  "dep.noTrades": "暂无交易。",
  "dep.older": "加载更早的记录",
  "dep.logStart": "这是第一条记录。",
  "dep.rules": "规则",
  "dep.rulesHidden": "作者对规则保密：策略将按发布时的版本在您的账户上运行。",
  "dep.lotMultiplier": "手数倍数",
  "dep.maxLots": "每笔订单最大手数",
  "dep.maxOpen": "最大持仓数",
  "dep.dailyLoss": "每日亏损限额",
  "dep.started": "开始时间",
  "dep.startBalance": "初始余额",
  "dep.setupNote": "每个部署运行一个确定的版本：保存新版本不会改变它。如需切换，请部署新版本。",

  "ctl.pause": "暂停",
  "ctl.resume": "恢复",
  "ctl.stop": "停止",
  "ctl.kill": "强制停止",
  "ctl.killNow": "立即强制停止",
  "ctl.closePositions": "平仓",
  "ctl.pauseTitle": "暂停策略？", // (display)
  "ctl.pauseBody": "不再开立新交易。持仓保留其止损、目标和保本设置。您可随时恢复。",
  "ctl.resumeTitle": "恢复策略？", // (display)
  "ctl.resumeBody": "将从下一根已收盘K线起恢复交易。",
  "ctl.stopTitle": "停止策略？", // (display)
  "ctl.stopBody": "策略将永久停止，不再开立新交易。如需再次运行，请重新部署。",
  "ctl.keepTitle": "保留持仓",
  "ctl.keepText": { other: "{count} 个持仓将保留其止损和目标；请自行管理。" },
  "ctl.closeAllTitle": "立即平仓",
  "ctl.closeAllText": { other: "{count} 个持仓将按市价平仓。" },
  "ctl.killTitle": "立即强制停止？", // (display)
  "ctl.killBody": "紧急停止将立即停止此策略，并默认按市价平掉其开立的持仓。",
  "ctl.killClose": "平掉其持仓",
  "ctl.killCloseHint": "立即按市价平仓。关闭此项可保留持仓及其止损。",
  "ctl.closeTitle": "平掉其持仓？", // (display)
  "ctl.closeBody": { other: "此策略开立的 {count} 个持仓将按市价平仓。策略将继续运行。" },
  "ctl.done.pause": "已暂停", // (display)
  "ctl.done.resume": "已恢复运行", // (display)
  "ctl.done.stop": "已停止", // (display)
  "ctl.done.kill": "已强制停止", // (display)
  "ctl.done.close": "已平仓", // (display)
  "ctl.donePause": "在您恢复之前不会开立新交易。",
  "ctl.doneResume": "将从下一根已收盘K线起恢复交易。",
  "ctl.doneClosed": { other: "已平仓 {count} 个持仓。" },
  "ctl.doneKept": "其持仓（如有）将保持开仓，并保留止损和目标。",
  "ctl.doneNothing": "没有可平仓的持仓。",
  "ctl.closedLabel": "已平仓",
  "ctl.failedLabel": "无法平仓",
  "ctl.failedTitle": { other: "{count} 个持仓无法平仓" },
  "ctl.failedBody": "市场可能已休市。请在恢复交易后从“投资组合”中平仓。",
  // stopping or killing a marketplace copy leaves its subscription (and a paid one's renewals) running
  "ctl.copyNote": "这是策略市场副本：停止它不会终止订阅。如需停止付费，请在“策略市场 › 订阅”中取消。",

  /* ---------------------------------------------------------------- */
  /* Strategy                                                          */
  /* ---------------------------------------------------------------- */
  // {version} = version number
  "strat.eyebrow": "策略 · v{version}",
  "strat.runningN": { other: "{count} 个运行中" },
  "strat.draft": "草稿",
  "strat.ready": "就绪",
  "strat.errors": { other: "{count} 个错误" },
  "strat.archivedTag": "已归档",
  "strat.lastBacktest": "最近回测",
  "strat.backtested": "回测",
  "strat.notTested": "尚未回测", // (display)
  "strat.notTestedBody": "运行前，请基于真实历史价格并按您账户的成本测试规则。",
  "strat.runFirst": "运行回测",
  "strat.openReport": "打开完整报告",
  "strat.deployV": "部署 v{version}",
  "strat.backtest": "回测",
  "strat.fixFirst": "测试或部署前请修复以下问题",
  "strat.line": "第 {n} 行：",
  "strat.rules": "规则", // (display)
  "strat.rulesSub": "在每根已收盘K线上检查",
  "strat.rulesCodeSub": "代码中的信号，在每根已收盘K线上检查",
  "strat.showCode": "以代码显示",
  "strat.risk": "风险", // (display)
  "strat.riskSub": "仓位、止损、时段和限制",
  "strat.editVisual": "如需更改规则，请询问 AI 交易员或在客户专区中编辑；每次更改都会保存为新版本。",
  "strat.editCode": "代码策略需在网页版客户专区中编辑；每次更改都会保存为新版本。",
  "strat.openWeb": "在网页版中编辑代码",
  "strat.deployments": "部署", // (display)
  "strat.deploymentsSub": { zero: "未在任何账户上运行", other: "{count} 个部署" },
  "strat.notRunning": "未运行。请先将其部署到模拟账户上，观察其实时交易表现。",
  "strat.backtests": "回测", // (display)
  "strat.backtestsSub": { zero: "暂无", other: "{count} 次运行" },
  "strat.runNew": "新建回测",
  "strat.noBacktests": "暂无回测。",
  "strat.versions": "版本", // (display)
  "strat.versionsSub": { other: "{count} 个版本" },
  "strat.current": "当前",
  "strat.archive": "归档",
  "strat.archiveTitle": "归档策略？", // (display)
  "strat.archiveBody": "“{name}”将从您的列表中移除。其回测和以往的部署仍保留在您的历史记录中。",
  "strat.archived": "“{name}”已归档",

  "kind.visual": "可视化规则",
  "kind.code": "代码",
  // Where a strategy came from
  "origin.ai": "AI 交易员",
  "origin.template": "模板",
  "origin.manual": "手动构建",
  "origin.marketplace": "策略市场",

  /* ---------------------------------------------------------------- */
  /* Rules in words                                                    */
  /* ---------------------------------------------------------------- */
  "rules.buy": "买入条件",
  "rules.sell": "卖出条件",
  "rules.exitBuy": "平买单条件",
  "rules.exitSell": "平卖单条件",
  "rules.and": "且",
  "rules.or": "或",
  // {tf} = timeframe, e.g. "on H4"
  "rules.onTf": "在 {tf} 上",
  "rules.noRules": "尚无入场规则。",
  "rules.size": "仓位",
  "rules.stop": "止损",
  "rules.target": "止盈",
  "rules.trailing": "追踪止损",
  "rules.window": "交易时段",
  "rules.limits": "限制",
  "rules.none": "无",
  "rules.lots": "{lots} 手",
  "rules.riskPct": "每笔交易风险 {pct}%",
  "rules.maxLots": "最多 {lots} 手",
  // points: move the stop to entry + {o} after {v} points in profit
  "rules.breakeven": "盈利 {v} 点时保本（+{o}）",
  "rules.allDay": "全天候",
  "rules.perDay": { other: "每天 {count} 笔交易" },
  "rules.dailyLoss": "当日亏损达 {amount} 时停止",
  "rules.oneAtATime": "同一时间仅一个持仓",
  "rules.closeOutside": "在交易时段外平仓",
  "rules.noLimits": "无每日限制",
  "op.crossesAbove": "上穿",
  "op.crossesBelow": "下穿",
  "dist.pips": "{v} pips",
  "dist.points": "{v} 点",
  "dist.price": "价格距离 {v}",
  "dist.percent": "价格的 {v}%",
  // {v} × ATR({p})
  "dist.atr": "{v} × ATR({p})",
  "dist.level": "价位 {v}",
  // a multiple of the stop distance
  "dist.rr": "{v}R",
  "field.close": "收盘价",
  "field.open": "开盘价",
  "field.high": "最高价",
  "field.low": "最低价",
  "field.hl2": "中间价",
  "field.hlc3": "典型价格",
  "field.ohlc4": "平均价格",
  "field.volume": "成交量",
  "pattern.bullish": "阳线",
  "pattern.bearish": "阴线",
  "pattern.bullish_engulfing": "看涨吞没",
  "pattern.bearish_engulfing": "看跌吞没",
  "pattern.hammer": "锤子线",
  "pattern.shooting_star": "流星线",
  "pattern.doji": "十字星",
  "pattern.inside_bar": "内包线",
  "ind.sma": "SMA",
  "ind.ema": "EMA",
  "ind.wma": "WMA",
  "ind.rsi": "RSI",
  "ind.macd": "MACD",
  "ind.macd_signal": "MACD 信号线",
  "ind.macd_hist": "MACD 柱状图",
  "ind.bb_upper": "布林带上轨",
  "ind.bb_middle": "布林带中轨",
  "ind.bb_lower": "布林带下轨",
  "ind.atr": "ATR",
  "ind.stoch_k": "随机指标 %K",
  "ind.stoch_d": "随机指标 %D",
  "ind.highest": "区间最高价",
  "ind.lowest": "区间最低价",
  "ind.cci": "CCI",
  "ind.willr": "威廉 %R",
  "ind.adx": "ADX",
  "ind.plus_di": "+DI",
  "ind.minus_di": "−DI",
  "ind.momentum": "动量",
  "ind.roc": "ROC",
  "ind.stddev": "标准差",
  "note.noDailyLimit": "无每日交易次数限制",
  "note.noStop": "未设置止损：持仓不受保护",
  "note.riskNeedsStop": "按风险计算仓位需要设置止损",
  "note.rrNeedsStop": "以 R 为单位的止盈需要设置止损",
  "note.noEntry": "无入场规则：请添加买入或卖出条件",

  /* ---------------------------------------------------------------- */
  /* Deploy (form)                                                     */
  /* ---------------------------------------------------------------- */
  "deploy.eyebrow": "部署 · v{version}",
  "deploy.title": "全天候运行", // (display)
  "deploy.body": "“{name}” v{version} 将在 Kalks 服务器上，于每根已收盘的 {tf} K线交易 {symbol}，即使您的手机关机也不受影响。可随时暂停、停止或强制停止。",
  "deploy.account": "账户",
  "deploy.equity": "净值 {amount}",
  "deploy.noAccounts": "您需要一个活跃的交易账户。开立模拟账户即可无风险试用策略。",
  "deploy.openAccount": "开立账户",
  "deploy.multiplier": "手数倍数",
  "deploy.multiplierHint": "按比例调整每笔订单的仓位。1× 即按策略自身的仓位交易。",
  "deploy.maxOpen": "最大持仓数",
  "deploy.maxOpenHint": "在策略自身规则之上的额外上限。",
  "deploy.strategyDefault": "按策略规则",
  "deploy.dailyLoss": "每日亏损限额",
  "deploy.dailyLossHint": "当日已平仓和持仓亏损合计达到此限额后，次日（服务器时间）之前不再开立新交易。",
  "deploy.off": "关闭",
  "deploy.custom": "自定义",
  "deploy.dailyLossAmount": "每日亏损",
  "deploy.lossInvalid": "请输入大于 0 的金额。",
  "deploy.liveTitle": "真实资金",
  "deploy.liveBody": "这是真实账户。策略将使用真实资金下达真实订单，并可能造成亏损。",
  "deploy.ack": "我了解该策略将在我的真实账户上使用真实资金交易，并由我本人承担责任。",
  "deploy.note": "自动交易可能造成亏损。回测仅为模拟，无法预测未来结果。本内容不构成投资建议。",
  // {account} = "Demo 50000083"
  "deploy.confirm": "部署至 {account}",
  "deploy.doneTitle": "运行中", // (display)
  "deploy.doneBody": "“{name}” v{version} 正在 {account} 上运行。",
  "deploy.warmup": "第一根已收盘的 {tf} K线用于预热；从下一根K线起即可下单。",
  "deploy.open": "打开部署",

  /* ---------------------------------------------------------------- */
  /* Backtests                                                         */
  /* ---------------------------------------------------------------- */
  "bt.status.queued": "排队中",
  "bt.status.running": "运行中",
  "bt.status.done": "已完成",
  "bt.status.failed": "失败",
  "bt.status.cancelled": "已取消",
  "bt.stage.queued": "等待空闲的计算节点",
  "bt.stage.loading": "正在加载历史价格",
  "bt.stage.m1": "正在加载分钟K线",
  "bt.stage.simulating": "正在模拟交易",
  "bt.stage.running": "运行中",
  // {id} = backtest number, {version} = strategy version
  "bt.eyebrow": "回测 #{id} · v{version}",
  "bt.title": "回测", // (display)
  "bt.start": "初始 {amount}",
  "bt.runningNote": "回测在服务器上运行：您可以离开此页面，稍后再回来查看。",
  "bt.failed": "回测失败",
  "bt.cancelled": "已取消", // (display)
  "bt.runAgain": "再次运行",
  "bt.net": "净利润",
  // {pct} = return, {amount} = starting balance
  "bt.returnOf": "{pct}（初始 {amount}）",
  "bt.pf": "盈利因子",
  "bt.winRate": "胜率",
  "bt.winsOf": "{wins} / {trades}",
  "bt.maxDd": "最大回撤",
  "bt.maxDdShort": "最大 DD",
  "bt.sharpe": "夏普比率",
  "bt.sortino": "索提诺 {v}",
  "bt.trades": "交易",
  "bt.longShort": "{long} 多 · {short} 空",
  "bt.expectancy": "期望收益",
  "bt.perTrade": "每笔交易",
  "bt.equity": "净值", // (display)
  "bt.drawdown": "回撤",
  "bt.legendEquity": "净值",
  "bt.legendBalance": "余额",
  "bt.legendStart": "初始",
  "bt.noCurve": "K线数量不足，无法绘制曲线。",
  "bt.scrubHint": "在图表上拖动或长按，即可查看任意数据点。",
  "bt.curveA11y": "净值从 {from} 到 {to}；最大回撤 {dd}",
  "bt.monthly": "月度", // (display)
  "bt.monthlySub": "每月收益率，占余额的百分比",
  "bt.noTradesMonth": "无交易",
  "bt.statistics": "统计", // (display)
  "bt.tradeList": "交易", // (display)
  "bt.tradeListSub": "按时间倒序，已扣除成本",
  "bt.truncated": "显示前 {n} 笔交易，按时间倒序",
  "bt.fAll": "全部 · {n}",
  "bt.fWins": "盈利 · {n}",
  "bt.fLosses": "亏损 · {n}",
  "bt.noTrades": "规则在此期间未产生交易。",
  "bt.data": "数据与成本", // (display)
  "bt.m1Bars": "分钟K线（K线内）",
  "bt.since": "自 {date} 起",
  "bt.signals": "信号",
  "bt.signalsValue": "{buy} 买入 · {sell} 卖出 · {exits} 离场",
  "bt.skipped": "已跳过：{reason}",
  "bt.model": "模型",
  "bt.group": "账户类型",
  "bt.spread": "点差",
  "bt.spreadValue": "{points} 点（{source}）",
  "bt.commission": "手续费",
  "bt.perLot": "每手 {amount}",
  "bt.swaps": "库存费",
  "bt.swapsOn": "每次隔夜结算时收取",
  "bt.swapsOff": "不收取（免库存费）",
  "bt.conversion": "盈亏换算",
  "bt.usdBase": "USD 为基础货币：按离场价格",
  "bt.usdQuoted": "以 USD 报价",
  "bt.currentRate": "按当前汇率（{rate}）",
  "bt.simNote": "回测 #{id} 是基于历史价格的模拟：在下一根K线开盘时成交，止损和目标按 OHLC 路径计算（有分钟K线时使用分钟K线），并计入您账户类型的点差、手续费和库存费。过往结果无法预测未来结果。",
  // History sources and skip reasons from the service
  "source.native": "原生",
  "source.built_from_M1": "由 M1 生成",
  "source.built_from_M5": "由 M5 生成",
  "source.built_from_M15": "由 M15 生成",
  "source.built_from_M30": "由 M30 生成",
  "source.built_from_H1": "由 H1 生成",
  "skip.outside_trading_window": "不在交易时段内",
  "skip.position_already_open": "已有持仓",
  "skip.daily_trade_limit": "每日交易次数限制",
  "skip.max_daily_loss": "每日亏损限额",
  "skip.market_closed": "休市",
  "skip.20_open_positions": "已有 20 个持仓",
  "skip.buy_and_sell_on_the_same_bar": "同一根K线上同时出现买入和卖出",
  "skip.stop_distance_not_ready": "止损距离尚未就绪",
  "skip.SL_level_on_the_wrong_side": "止损价位在错误一侧",
  "skip.volume_below_the_minimum_lot": "仓位低于最小手数",
  "spreadSource.group_quote": "您账户类型的实时报价",
  "spreadSource.catalogue": "产品目录点差",
  "spreadSource.fixed": "固定",

  "btNew.title": "运行回测", // (display)
  "btNew.period": "期间",
  "btNew.balance": "初始余额",
  "btNew.other": "其他",
  "btNew.amount": "金额",
  "btNew.costs": "成本来源",
  "btNew.accountType": "账户类型",
  "btNew.myAccount": "我的账户",
  "btNew.costsGroupHint": "该账户类型的点差、手续费和库存费。",
  "btNew.costsAccountHint": "该账户所属组的点差、手续费和库存费。",
  "btNew.noAccounts": "您还没有活跃的交易账户。",
  "btNew.run": "运行回测",
  "btNew.note": "最长期间取决于时间周期。最多可同时运行 3 个回测。",

  "period.p1m": "1个月",
  "period.p3m": "3个月",
  "period.p6m": "6个月",
  "period.p1y": "1年",
  "period.p2y": "2年",
  "period.p5y": "5年",

  // Trade exit reasons (server codes)
  "exit.sl": "止损",
  "exit.tp": "止盈",
  "exit.trailing": "追踪止损",
  "exit.breakeven": "保本",
  "exit.signal": "信号",
  "exit.exit_rule": "离场规则",
  "exit.session": "时段外",
  "exit.end_of_test": "测试结束",
  "exit.stop_out": "强制平仓",
  "exit.kill": "紧急停止",
  "exit.stopped": "已停止",
  "exit.client": "已平仓",
  "exit.close": "已平仓",

  "stat.balance": "余额",
  "stat.gross": "总盈利 / 总亏损",
  "stat.cagr": "年化增长率（CAGR）",
  "stat.avgWinLoss": "平均盈利 / 亏损",
  "stat.largest": "最大盈利 / 亏损",
  "stat.payoff": "盈亏比",
  "stat.long": "多头交易 · 胜率",
  "stat.short": "空头交易 · 胜率",
  "stat.streaks": "最大连续盈利 / 亏损",
  "stat.maxDd": "最大回撤",
  "stat.recovery": "恢复因子",
  "stat.sharpeSortino": "夏普 / 索提诺",
  "stat.avgBars": "平均持仓K线数",
  "stat.exposure": "持仓时间占比",
  "stat.costs": "手续费 / 库存费 / 点差",
  "stat.bars": "测试K线数",
  "stat.cpu": "计算耗时",
  "stat.seconds": "{s} 秒",

  /* ---------------------------------------------------------------- */
  /* Log kinds (runtime)                                               */
  /* ---------------------------------------------------------------- */
  "log.eval": "K线",
  "log.signal": "信号",
  "log.order": "订单",
  "log.close": "平仓",
  "log.manage": "管理",
  "log.error": "错误",
  "log.info": "信息",

  /* ---------------------------------------------------------------- */
  /* Marketplace                                                       */
  /* ---------------------------------------------------------------- */
  "house.badge": "自营策略 · 由 Kalks 运营",
  "house.disclosure":
    "由 Kalks 运营的自营策略：一个运行此策略的经纪商自有真实账户。业绩记录仅为其开始运行以来自身的真实交易，没有任何模拟或回填数据。",
  "market.eyebrow": "策略市场",
  "market.title": "市场", // (display)
  "market.subtitle": "来自真实 Kalks 账户、具有经过验证业绩记录的策略。将其复制到您的账户，或在作者允许时克隆其规则。",
  "market.browse": "浏览",
  "market.subs": "订阅",
  "market.subsN": "订阅 · {n}",
  "market.mine": "我的上架",
  "market.search": "搜索策略、作者…",
  "market.clear": "清除搜索",
  "market.all": "全部",
  "market.free": "免费",
  "market.paid": "付费",
  "market.newest": "最新",
  "market.topRated": "评分最高",
  "market.popular": "热门",
  // {price} in USDT
  "market.perMonth": "{price} USDT/月",
  "market.by": "作者 {author}",
  "market.return": "收益率",
  "market.winRate": "胜率",
  "market.maxDd": "最大 DD",
  "market.trades": "交易",
  // {type} = live / demo
  "market.verified": "已验证{type}账户",
  "market.verifiedDays": "已验证{type}账户 · {days} 天",
  // a track record younger than a day
  "market.verifiedNew": "已验证{type}账户 · 不足一天",
  "market.subscribed": "已订阅",
  "market.ratings": { zero: "暂无评分", other: "{count} 个评分" },
  "market.subscribers": { other: "{count} 位订阅者" },
  "market.emptyTitle": "暂无上架策略", // (display)
  "market.emptyText": "作者连同经过验证的业绩记录发布策略后，策略将显示在此处。",
  "market.noMatchTitle": "无匹配结果", // (display)
  "market.noMatchText": "请尝试其他搜索词或筛选条件。",
  "market.noSubsTitle": "暂无订阅", // (display)
  "market.noSubsText": "您从策略市场复制或克隆的策略将显示在此处。",
  "market.disclaimer": "过往业绩不代表未来结果。业绩记录来自 Kalks 上的真实或模拟账户，并相应标注。付费订阅的平台费用：{pct}%。",
  "market.houseFootnote": "自营策略在经纪商自有的真实账户上运行；其业绩记录仅为自身的真实交易。",
  "market.earned": "已赚取",
  "market.fees": "平台费用",
  "market.payments": "付款",
  "market.publishWeb": "发布策略（连同其经过验证的业绩记录）和编辑上架信息需在网页版客户专区中进行。",
  "market.openWeb": "在网页版中打开策略市场",

  // Listing statuses (server values)
  "listing.pending": "审核中",
  "listing.approved": "已上架",
  "listing.rejected": "已拒绝",
  "listing.suspended": "已暂停",
  "listing.unlisted": "已下架",
  "listing.eyebrow": "策略市场 · {symbol} {tf}",
  "listing.verified": "已验证的{type}业绩记录",
  "listing.cloneAllowed": "允许克隆",
  "listing.trackReturn": "经验证的收益率",
  "listing.net": "净额",
  "listing.noCurve": "交易满两天后将显示每日曲线。",
  "listing.curveA11y": "{days} 天内的每日净值，收益率 {ret}",
  "listing.trackNote": "来自作者自 {since} 起在 Kalks 上的自有部署，根据交易引擎上的已平仓成交计算，绝非作者手动输入。",
  "listing.btSimulated": "回测 · 模拟",
  "listing.btNote": "展示这些规则在该账户类型的成本下对历史价格的交易表现；不属于上方的真实业绩记录。",
  "listing.btA11y": "回测净值曲线（模拟）",
  "listing.about": "简介", // (display)
  "listing.risk": "风险", // (display)
  "listing.rules": "规则", // (display)
  "listing.rulesPrivate": "规则保密：复制策略即可在您的账户上运行。",
  "listing.reviews": "评价 · {n}", // (display)
  "listing.noReviews": "暂无评价。",
  "listing.subscribeFree": "免费订阅",
  "listing.subscribePaid": "订阅 · {price} USDT / 月",
  "listing.copying": "正在 {login} 上复制",
  "listing.clonedTo": "已克隆到您的策略",
  "listing.openDeployment": "打开部署",
  "listing.openStrategy": "打开策略",
  "listing.cancel": "取消",
  "listing.cancelConfirm": "取消订阅",
  "listing.keep": "保留",
  "listing.cancelTitle": "取消订阅？", // (display)
  "listing.cancelCopy": "策略将立即在您的账户上停止。其持仓将保持开仓，并保留止损和目标。",
  "listing.cancelClone": "订阅将终止。克隆的策略仍保留在您的列表中。",
  // {date} = end of the paid period
  "listing.cancelPaid": "将持续运行至 {date}，且不会续订。当期费用不予退还。",
  "listing.cancelled": "订阅已取消",
  "listing.cancelledPaid": "将不再续订",
  "listing.yours": "您的上架策略",
  "listing.manageWeb": "在网页版中管理",

  /* ---------------------------------------------------------------- */
  /* Subscribe (form), subscriptions                                   */
  /* ---------------------------------------------------------------- */
  "sub.eyebrow": "订阅",
  "sub.title": "订阅",
  "sub.body": "作者 {author} · {symbol} {tf}",
  "sub.how": "方式",
  "sub.copyTitle": "复制到我的账户",
  "sub.copyText": "作者的确切版本将在您的账户上全天候运行。规则保持保密。",
  "sub.copyTextOpen": "作者的确切版本将在您的账户上全天候运行。",
  "sub.cloneTitle": "克隆规则",
  "sub.cloneText": "规则将成为您的策略之一：由您自行测试、修改和部署。",
  "sub.multiplierHint": "按比例调整策略在您账户上的订单仓位。",
  "sub.price": "价格",
  "sub.dueNow": "当前应付",
  "sub.wallet": "钱包（可用）",
  "sub.renewal": "续订",
  "sub.noCharge": "免费，不收取任何费用",
  "sub.shortTitle": "USDT 不足",
  "sub.shortBody": "您的钱包需要至少 {amount} USDT 可用余额。",
  "sub.deposit": "入金",
  "sub.liveBody": "策略将在此账户上使用真实资金下达真实订单，并可能造成亏损。",
  "sub.ackPay": "立即从我的 Kalks 钱包扣除 {price} USDT，此后每 30 天扣款一次，直至我取消。",
  "sub.doneTitle": "已订阅", // (display)
  // {title} = strategy, {account} = "Demo 50000083"
  "sub.doneCopy": "“{title}”正在 {account} 上运行。",
  "sub.doneClone": "“{title}”现已成为您的策略之一。",
  "sub.charged": "已从您的钱包扣除 {amount} USDT。",
  // the answer to a subscribe request was lost: the app re-reads the listing before a retry
  "sub.noAnswer": "我们未收到回复。订阅可能已成功。",
  "sub.checkingTitle": "正在核查您的订阅",
  "sub.checkingBody": "回复在传输中丢失。在您重试之前，我们正在与服务器核对，确保您不会被重复扣款。",
  "sub.noAnswerRetry": "仍未收到回复，且您的账户中没有新订阅。您可以重试。",
  "sub.notThrough": "订阅未成功，也不会保留任何扣款（已扣款项将退回您的钱包）。您可以重试。",
  "sub.unfinished": "服务器仍在设置中。重试前请查看“策略市场 › 订阅”和钱包历史，或联系客服。",
  "sub.free": "免费订阅：未扣除任何费用。",
  "sub.copyOn": "在 {login} 上复制",
  "sub.cloned": "已克隆",
  "sub.renews": "{date} 续订",
  "sub.ends": "{date} 到期",
  "sub.status.active": "有效",
  "sub.status.cancelled": "已取消",
  "sub.status.expired": "已过期",
  "sub.status.past_due": "待付款",

  "review.title": "评分", // (display)
  "review.rating": "您的评分",
  "review.stars": { other: "{count} 星" },
  "review.comment": "评论（可选）",
  "review.placeholder": "它在您账户上的交易表现如何？",
  "review.post": "发表评价",
  "review.saved": "评价已保存",
  "review.rate": "评分",
  "review.edit": "编辑评价",
  "review.you": "您",

  /* ---------------------------------------------------------------- */
  /* API keys and webhooks                                             */
  /* ---------------------------------------------------------------- */
  "keys.eyebrow": "开发者",
  "keys.title": "API", // (display)
  "keys.subtitle": "用于您自己交易程序的密钥，以及用于警报（TradingView 等）的 Webhook URL。",
  "keys.requests24h": "请求 · 最近 24 小时",
  "keys.errors": "错误",
  // requests refused by the rate limit
  "keys.limited": "被限流",
  "keys.p50": "中位延迟",
  "keys.writes": "订单",
  "keys.keys": "API 密钥", // (display)
  "keys.keysSub": "{n} 个有效 · 最多 20 个",
  "keys.none": "暂无 API 密钥。请在网页版客户专区中创建。",
  "keys.status.active": "有效",
  "keys.status.revoked": "已撤销",
  "keys.status.expired": "已过期",
  "keys.scope.read": "读取",
  "keys.scope.trade": "交易",
  // {ips} = list of IP addresses
  "keys.ips": "仅限 {ips}",
  "keys.anyIp": "任意 IP 地址",
  "keys.expires": "{date} 到期",
  "keys.noExpiry": "永不过期",
  "keys.lastUsed": "最后使用 {ago}",
  "keys.revoke": "撤销",
  "keys.revokeTitle": "撤销此密钥？", // (display)
  "keys.revokeBody": "“{name}”（{id}）将立即对所有使用它的程序失效。此操作无法撤销。",
  "keys.revoked": "“{name}”已撤销",
  "keys.webTitle": "在网页版中创建",
  "keys.webBody": "新的密钥和 Webhook 需在客户专区中创建：密钥的 Secret 和 Webhook 的 URL 仅在那里显示一次，您可将其复制到您的交易工具中。",
  "keys.openWeb": "打开客户专区",
  "keys.killHint": "需要一次性停止所有操作？Algo 页面上的紧急停止开关可停止所有策略，并阻止 Webhook 和 API 订单。",

  "hooks.title": "Webhook", // (display)
  "hooks.sub": "{n} / 最多 20 个",
  "hooks.none": "暂无 Webhook。请在网页版客户专区中创建。",
  // {hint} = the URL's last characters
  "hooks.hint": "URL …{hint}",
  "hooks.accounts": { other: "{count} 个账户" },
  "hooks.today": { zero: "今日无警报", other: "今日 {count} 条警报" },
  "hooks.used": "使用于 {ago}",
  "hooks.on": "开",
  "hooks.off": "关",
  "hooks.switch": "启用 Webhook“{name}”",
  "hooks.passphrase": "需要口令",
  "hooks.noPassphrase": "无口令",
  "hooks.delete": "删除",
  "hooks.deleteTitle": "删除此 Webhook？", // (display)
  "hooks.deleteBody": "“{name}”及其秘密 URL 将立即失效；发送至该地址的警报将被拒绝。此操作无法撤销。",
  "hooks.deleted": "“{name}”已删除",
  "hooks.alerts": "最近警报", // (display)
  "hooks.alertsSub": "每条警报及每个账户的结果",
  // Alert statuses (server values)
  "hooks.status.accepted": "已接受",
  "hooks.status.partial": "部分完成",
  "hooks.status.failed": "失败",
  "hooks.status.received": "已接收",
  "hooks.status.rejected": "已拒绝",
  "hooks.status.blocked": "已阻止（紧急停止）",
  // Each account's result of an alert (server values)
  "hooks.result.filled": "已成交",
  "hooks.result.pending": "已下单",
  "hooks.result.closed": "已平仓",
  "hooks.result.nothing_to_close": "无可平仓",
  "hooks.result.rejected": "已拒绝",
};
export default mobileAlgo;
