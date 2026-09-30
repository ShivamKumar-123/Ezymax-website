import type { NsMessages } from "../../core";

// Kalks mobile app: Prop (challenge catalogue and checkout, live rule dashboard, payouts, certificates).
// "Kalks", "Kalks Prop", "Kalks Trader", "Kalks-Live", "USDT" and "17:00" stay as they are; New York is 纽约 as in
// the `prop` namespace. Titles shown in tall display type are marked "display": keep them short.
const mobileProp: NsMessages<"mobileProp"> = {
  // Prop home
  "home.eyebrow": "Kalks Prop",
  "home.title": "获得资金", // display
  "home.subtitle": "通过挑战，获得资金账户，并保留最高 {split}% 的利润。所有自营账户均为模拟账户。",
  "home.subtitleNoSplit": "通过挑战，获得资金账户，并获得利润分成。所有自营账户均为模拟账户。",
  "home.payouts": "支付",
  "home.payoutsReady": "{amount} 可申请",
  "home.payoutsNone": "暂无可申请",
  "home.certificates": "证书",
  "home.certCount": { other: "已获得 {count} 份" },
  "home.mine": "您的挑战",
  "home.past": "以往挑战",
  "home.showAll": "显示全部 {count} 个",
  "home.yourCertificates": "您的证书",
  "home.plans": "选择您的挑战",
  "home.newChallenge": "开始新挑战",
  "home.emptyTitle": "暂无可选挑战", // display
  "home.emptyBody": "新的挑战方案正在准备中。请稍后再来查看。",
  "home.mineError": "无法加载您的挑战。",
  "home.plansError": "无法加载挑战方案。",

  // How it works (numbered 01–04 on the Prop home)
  "how.title": "运作方式",
  "how.1.title": "选择方案",
  "how.1.body": "选择模式和账户规模。费用从您的 USDT 钱包一次性扣除。",
  "how.2.title": "达成目标",
  "how.2.body": "在不超过每日亏损和回撤限额的前提下达到盈利目标，并满足最少交易天数。",
  "how.3.title": "获得资金",
  "how.3.body": "通过后，您的资金账户将自动开立，并附带一份可分享的证书。",
  "how.4.title": "获得支付",
  "how.4.body": "每个支付周期均可申请将您的利润分成支付到 USDT 钱包。",
  "how.enforce": "服务器每秒按净值检查各项限额。达到每日亏损限额的 50%、75% 和 90% 时会向您发出警告；一旦违规，所有持仓将被平仓，挑战随即结束。",

  // Plan models
  "type.oneStep": "一阶段",
  "type.twoStep": "两阶段",
  "type.instant": "即时",
  "typeText.oneStep": "一个评估阶段。达成目标、遵守限制，即可获得资金。",
  "typeText.twoStep": "两个评估阶段，目标更低、限制更宽松。",
  "typeText.instant": "无需评估。直接从资金账户开始，限制更严格。",

  // Plan card
  "plan.refundable": "费用可退还",
  "plan.fee": "费用",
  "plan.account": "账户",
  "plan.leverage": "杠杆 1:{n}",
  "plan.target": "目标",
  "plan.dailyLoss": "每日亏损",
  "plan.maxDD": "最大回撤",
  "plan.static": "静态",
  "plan.trailing": "追踪",
  "plan.start": "开始 · {fee}",

  // Checkout
  "checkout.eyebrow": "结账",
  "checkout.fee": "一次性费用",
  "checkout.chargedRefund": "从您的 USDT 钱包支付。随首次支付退还。",
  "checkout.chargedNoRefund": "从您的 USDT 钱包支付。不可退还。",
  "checkout.walletBalance": "钱包余额：{balance} USDT",
  "checkout.shortTitle": "钱包余额不足以支付费用",
  "checkout.short": "您的余额为 {balance} USDT。请再入金 {missing} USDT 以购买此挑战。",
  "checkout.rules": "规则",
  "checkout.limitsNote": "限额为起始余额的百分比。违反每日亏损或最大回撤限制将导致账户失败，所有持仓按市价平仓。交易日于纽约时间 17:00 重置。",
  "checkout.agree": "我已阅读规则，并理解该账户为模拟账户，违反亏损限额时将自动失败。",
  "checkout.pay": "支付 {fee}",
  "checkout.retry": "重试 · {fee}",
  "checkout.paying": "正在支付…",
  "checkout.goToMine": "查看我的挑战",
  "checkout.readyTitle": "挑战已开启", // display
  "checkout.readyBody": "已从您的 USDT 钱包支付 {fee}，您的 {size} {phase} 账户已开立。规则即刻生效。",
  "checkout.savePasswords": "请立即保存这些密码：它们只显示一次，我们不会存储。即使没有密码，您也可以随时在应用中交易此账户。",
  "checkout.passwordsShown": "交易密码已在首次完成此购买时显示。您无需密码即可在应用中交易此账户。",
  "checkout.viewChallenge": "查看挑战",
  "checkout.readOnly": "此会话无法购买挑战。",

  // Account credentials
  "cred.login": "登录账号",
  "cred.server": "服务器",
  "cred.password": "交易密码",
  "cred.investorPassword": "投资者密码（只读）",
  "cred.show": "显示密码",
  "cred.hide": "隐藏密码",
  "copied": "已复制{what}",
  "a11y.copy": "复制{what}",

  // Challenge statuses
  "status.pendingPayment": "等待付款",
  "status.provisioning": "正在开户",
  "status.active": "进行中",
  "status.funded": "已获资金",
  "status.failed": "未通过",
  "status.closed": "已关闭",
  "status.paymentFailed": "付款失败",
  // {phase} is the phase name from the plan, e.g. "Phase 2"
  "stage.active": "{phase} · 进行中",
  "stage.failed": "{phase} · 未通过",
  "phaseStatus.provisioning": "开户中",
  "phaseStatus.active": "进行中",
  "phaseStatus.passed": "已通过",
  "phaseStatus.failed": "未通过",
  "phaseStatus.closed": "已关闭",

  // Challenge cards (Prop home)
  "card.target": "盈利目标",
  "card.profit": "盈利",
  "card.equity": "净值 {amount}",
  "card.dailyLeft": "当日剩余亏损额度 {amount}",
  "card.opening": "您的交易账户正在开立，只需几秒钟。",

  // Dashboard
  "dash.equity": "净值",
  "dash.balance": "余额",
  "dash.floating": "浮动盈亏",
  "dash.open": "持仓",
  "dash.sinceStart": "自本阶段开始以来",
  "dash.rules": "规则",
  "dash.rulesTitle": "本挑战规则",
  "dash.notFound": "未找到挑战", // display
  "dash.notFoundBody": "它可能是使用其他登录开立的。",
  "dash.backToProp": "返回自营交易",
  "live.live": "实时",
  "live.connecting": "连接中…",
  "live.offline": "离线",
  // {time}: date and time of the last rule check
  "live.updated": "检查于 {time}",
  // {time}: when the phase ended
  "live.final": "最终 · {time}",

  // Rule names (gauges, the rule log)
  "rule.dailyLoss": "每日亏损",
  "rule.maxDrawdown": "最大回撤",
  "rule.profitTarget": "盈利目标",
  "rule.tradingDays": "交易天数",
  "rule.timeLimit": "时间限制",
  "rule.weekendHolding": "周末持仓",
  "rule.newsWindow": "新闻时段",
  "rule.bannedStrategy": "禁用策略",
  "rule.consistency": "一致性",
  "rule.riskDesk": "风控部门决定",
  "ruleState.ok": "进行中",
  "ruleState.passed": "已达成",
  "ruleState.failed": "已违反",
  "ruleState.off": "关闭",

  // Gauges
  "target.ofTarget": "目标进度",
  "target.of": "目标 {amount}（{pct}%）",
  "target.left": "还差 {amount}",
  "target.reachedBy": "已达成，超出 {amount}",
  "limit.left": "剩余 {amount}",
  "limit.breachAt": "违规水平 {amount}",
  "days": { other: "{count} 天" },
  "days.of": "{v} / {min}",
  "days.count": { other: "{count} 天" },
  "days.met": "已达最少天数",
  "days.toGo": { other: "还差 {count} 天" },
  "days.noMinimum": "无最少天数要求",
  "time.left": "剩余 {d}天 {h}小时",
  "time.deadline": "{date} 结束",
  "consistency.rule": "最佳单日 ≤ 盈利的 {pct}%",
  "consistency.noProfit": "暂无盈利",
  "reset.title": "每日亏损重置倒计时",
  "reset.note": "每个交易日纽约时间 17:00",

  // Funded account: payout window ring
  "payoutHero.title": "下次支付",
  "payoutHero.share": "您目前的分成",
  "payoutHero.open": "已开放", // display
  "payoutHero.ready": "可申请", // display
  "payoutHero.days": { other: "{count} 天" }, // display
  "payoutHero.eligible": "现已符合条件，分成比例 {split}%。",
  "payoutHero.opens": "支付窗口将于 {date} 开放。",
  "payoutHero.later": "产生符合条件的盈利后即可申请支付。",

  // Big states
  "hero.opening.title": "正在开立账户", // display
  "hero.opening.body": "付款已确认，您的交易账户正在设置中。本页面将自动更新。",
  "hero.closed.title": "挑战已关闭", // display
  "hero.closed.body": "此挑战的交易账户无法开立，因此挑战已关闭，费用已退回您的 USDT 钱包。如有疑问，请联系客服。",
  // {reason} is the prop service's reason, in English
  "hero.closed.reason": "{reason}。费用已退回您的 USDT 钱包。",
  "hero.failed.title": "{phase} 未通过", // display
  "hero.failed.on": "结束于 {date}",
  // {reason} is the breach reason from the risk engine
  "hero.failed.body": "{reason}。所有持仓已平仓，账户已停用。",
  "hero.failed.ruleBreached": "违反了一项规则",
  // {rule} is a rule name, e.g. "Daily loss"
  "hero.failed.rule": "{rule}：已超出限额",
  "hero.failed.new": "开始新挑战",
  "hero.passed.title": "{phase} 已通过", // display
  "hero.passed.on": "通过于 {date}。",
  "hero.passed.next": "您的 {phase} 账户已开立。",
  "hero.passed.nextLogin": "您的 {phase} 账户已开立（#{login}）。",
  "hero.passed.opening": "下一个账户正在开立。",
  "hero.passed.certificate": "查看证书",
  "hero.passed.goNext": "前往 {phase}",
  "hero.funded.title": "已获资金", // display
  "hero.funded.body": "交易资金账户，并以支付形式获得 {split}% 的利润。",
  "hero.funded.certificate": "查看您的资金交易者证书",

  // Warnings while trading
  "warn.lossUsed": "已使用当日亏损限额的 {pct}%",
  "warn.lossUsedBody": "净值等于或低于 {floor} 将导致账户失败并平掉所有持仓。今日剩余：{left}。",
  "warn.weekend": "周末平仓",
  "warn.weekendBody": "此方案不允许周末持仓：持仓将于纽约时间周五 16:45 平仓。",

  // Actions
  "action.openTrade": "前往交易",
  "action.trade": "交易",
  "action.tradeBlocked": "仅进行中挑战的当前账户可以交易。",
  "action.payouts": "支付",
  "action.support": "联系客服",

  // Equity chart
  "chart.title": "净值曲线",
  "chart.start": "起始",
  "chart.target": "目标",
  "chart.ddFloor": "最大回撤",
  "chart.dailyFloor": "每日亏损",
  "chart.now": "当前",
  "chart.empty": "开始交易几分钟后将显示曲线。",

  // Trading stats
  "stats.title": "交易统计",
  "stats.trades": "交易",
  "stats.winRate": "胜率",
  "stats.profitFactor": "盈利因子",
  "stats.avgWin": "平均盈利",
  "stats.avgLoss": "平均亏损",
  "stats.lots": "手数",
  "stats.bestDay": "最佳单日 {date}：{amount}",

  // Rule log
  "events.title": "规则日志",
  "events.empty": "暂无警告或违规。请继续保持。",
  "events.equity": "净值 {amount}",
  "events.limit": "限额 {amount}",
  "severity.breach": "违规",
  "severity.violation": "违例",
  "severity.warning": "警告",
  "severity.info": "信息",

  // Closed trades
  "trades.title": "已平仓交易",
  "trades.all": "全部 {count}",
  "trades.count": { other: "{count} 笔已平仓交易" },
  "trades.empty": "暂无已平仓交易。",
  "trades.buy": "买入",
  "trades.sell": "卖出",
  // compact durations
  "duration.s": "{s}秒",
  "duration.ms": "{m}分 {s}秒",
  "duration.hm": "{h}小时 {m}分",
  "duration.dh": "{d}天 {h}小时",

  // Account details
  "account.title": "账户",
  "account.split": "您的分成",
  "account.initial": "起始余额",
  "account.started": "阶段开始",
  "account.ended": "已结束",
  "account.deadline": "截止时间",
  "account.passwordNote": "交易密码已在购买时显示过一次。点击“前往交易”即可无需密码登录此账户。",

  // Payouts
  "payouts.title": "支付", // display
  "payouts.available": "当前可用",
  "payouts.eligibleCount": { other: "{count} 个资金账户中有 {eligible} 个符合条件" },
  "payouts.requests": { other: "{count} 笔申请" },
  "payouts.count": { other: "{count} 笔支付" },
  "payouts.paidToDate": "累计已支付",
  "payouts.funded": "资金账户",
  "payouts.account": "{size} 资金账户", // display
  "payouts.quote": "支付估算",
  "payouts.eligibleNow": "现已符合条件",
  "payouts.notYet": "尚不符合条件",
  "payouts.toWallet": "存入您的钱包",
  "payouts.yourSplit": "您的分成",
  "payouts.firmShare": "公司分成",
  "payouts.alreadyRefunded": "已退还",
  "payouts.withFirst": "随首次支付",
  "payouts.opens": "{date} 开放。",
  "payouts.minimum": "最低 {amount}。",
  "payouts.kycNote": "请验证您的身份以申请此笔支付。",
  "payouts.kycPendingNote": "身份验证通过后，您即可申请此笔支付。",
  "payouts.readOnly": "此会话无法申请支付。",
  "payouts.request": "申请支付",
  // opens the account's live rule dashboard; short: it shares a row with Trade
  "payouts.dashboard": "规则",
  "payouts.history": "历史",
  "payouts.historyEmpty": "暂无支付。",
  "payouts.emptyTitle": "暂无资金账户", // display
  "payouts.emptyBody": "通过挑战即可获得资金账户。账户产生符合条件的盈利后，即可在此申请支付。",
  "payouts.emptyAction": "获取资金账户",
  "payoutStatus.pending": "审核中",
  "payoutStatus.approved": "已批准",
  "payoutStatus.paid": "已支付",
  "payoutStatus.rejected": "已拒绝",
  "payoutStatus.failed": "失败",
  "split.title": "利润分成与扩展",
  "split.upTo": "扩展后最高 {pct}%",
  "split.cycle": "支付周期",
  // {days} e.g. "14 days"
  "split.first": "{days}后首次支付",
  "split.firstNow": "首日起即可",
  // {months} e.g. "4 months"; {cap} e.g. "$2,000,000"
  "scaling.text": "在 {months}内实现 {profit}% 的盈利，账户将增加 {increase}%，最高至 {cap}。",
  "scaling.none": "此方案不提供账户扩展。",
  "months": { other: "{count} 个月" },

  // Payout request sheet
  "request.eyebrow": "申请支付",
  "request.profit": "账户盈利",
  "request.share": "您的分成（{pct}%）",
  "request.feeRefund": "挑战费用退还",
  "request.total": "存入钱包合计",
  "request.note": "当前全部盈利将立即从交易账户中扣除，以免在审核期间因交易而损失。批准后，您的分成将存入您的 USDT 钱包；如申请被拒绝，盈利将退回账户。",
  "request.submit": "申请 {amount}",
  "request.done": "已申请支付",
  "request.doneBody": "批准后，{amount} 将存入您的 USDT 钱包。",

  // Identity verification (payouts)
  "kyc.verified": "身份已验证：支付可被批准。",
  "kyc.pendingTitle": "验证审核中",
  "kyc.pendingText": "您的验证正在审核中。身份验证通过后即可申请支付。",
  "kyc.requiredTitle": "验证您的身份",
  "kyc.requiredText": "支付仅发放给已验证的交易者。请在首次支付前完成验证。",
  "kyc.rejectedText": "您的验证被拒绝。请重新提交以接收支付。",

  // Why a payout can't be requested yet
  "blocker.notYetEligible": "支付窗口尚未开放。",
  "blocker.belowMinimum": "盈利低于最低支付金额。",
  "blocker.positionsOpen": "请平掉所有持仓后再申请支付。",
  "blocker.payoutPending": "已有一笔支付正在审核中。",
  "blocker.consistency": "未满足一致性规则：您的最佳单日盈利占总盈利的比例过高。",

  // Certificates
  "certs.title": "证书", // display
  "certs.subtitle": "您通过的每个阶段、每个资金账户和每笔支付，都会获得一份任何人都可以验证的证书。",
  "certs.kind.pass": "阶段已通过",
  "certs.kind.funded": "资金交易者",
  "certs.kind.payout": "支付",
  "certs.revoked": "已撤销",
  "certs.revokedBody": "此证书已被 Kalks 撤销，不再有效，因此无法分享。",
  "certs.meta": "{plan} · {size} · {date}",
  "certs.number": "编号 {code}",
  "certs.shareImage": "分享图片",
  "certs.shareLink": "分享链接",
  "certs.copyLink": "复制链接",
  "certs.linkCopied": "验证链接已复制",
  "certs.shareTitle": "我的 Kalks Prop 证书",
  "certs.shareMessage": "我的 Kalks Prop 证书。在此验证：",
  "certs.shareFailed": "无法分享证书。请重试。",
  "certs.shareUnavailable": "此设备不支持分享。",
  "certs.emptyTitle": "暂无证书", // display
  "certs.emptyBody": "通过一个挑战阶段即可获得您的第一份证书，并附带任何人都能验证的公开链接。",
  "certs.emptyAction": "浏览挑战",

  // Rule words shared by the checkout and the rules sheet
  "accountSize": "账户规模",
  "profitSplit": "利润分成",
  "feeRefund": "费用退还",
  "nonRefundable": "不可退还",
  "leverage": "杠杆",
  "none": "无",
  "allowed": "允许",
  "notAllowed": "不允许",
  "noTimeLimit": "无时间限制",
  // {phase} is the phase name, e.g. "Phase 1"
  "rules.phaseTarget": "{phase} 目标",
  "rules.phaseMinDays": "{phase} 最少天数",
  "rules.phaseTimeLimit": "{phase} 时间限制",
  "rules.evaluation": "评估",
  "rules.evaluationNone": "无，首日即获资金",
  "rules.dailyLoss": "每日亏损限额",
  "rules.dailyLossBalance": "{pct}% · {amount} · 以纽约时间 17:00 的余额为基准",
  "rules.dailyLossEquity": "{pct}% · {amount} · 以纽约时间 17:00 余额与净值中的较高者为基准",
  "rules.ddStatic": "{pct}% 静态",
  "rules.ddTrailing": "{pct}% 追踪",
  "rules.ddLocks": "{dd}，达到起始值后锁定",
  // ≤ = at most
  "rules.consistencyValue": "最佳单日 ≤ 总盈利的 {pct}%",
  "rules.news": "新闻交易",
  "rules.newsBlocked": "高影响新闻前后 ±{min} 分钟内禁止交易",
  "rules.newsBlockedFails": "高影响新闻前后 ±{min} 分钟内禁止交易（违反将导致账户失败）",
  "rules.weekendClosed": "持仓于纽约时间周五 16:45 平仓",
  "rules.ea": "EA 交易",
  "rules.banned": "禁用策略",
  "rules.splitScaling": "{split}%，可提升至 {max}%",
  "rules.firstPayout": "首次支付",
  // {freq} is a lower-case payout cycle, e.g. "weekly"
  "rules.firstPayoutValue": "{days}后，之后{freq} · 最低 {min}",
  "rules.refunded": "随首次支付退还",

  // Banned trading strategies
  "banned.hft": "高频交易",
  "banned.latencyArbitrage": "延迟套利",
  "banned.tickScalping": "Tick 剥头皮",
  "banned.crossAccountCopying": "跨账户复制交易",
  "banned.crossAccountHedging": "跨账户对冲",
  "banned.martingale": "马丁格尔",
  "banned.grid": "网格交易",

  // Payout cycle, used inside sentences ("then weekly")
  "payoutFreq.weekly": "每周",
  "payoutFreq.biWeekly": "每 2 周",
  "payoutFreq.monthly": "每月",
  "payoutFreq.onDemand": "按需",

  // Errors (messages for the prop service's error codes)
  "errorLink.deposit": "入金",
  "errorLink.verify": "验证身份",
  "error.insufficientFunds": "您的 USDT 钱包余额不足以支付此费用。请入金 USDT 后重试。",
  "error.kycRequired": "申请支付前请先验证您的身份。",
  "error.paymentPending": "我们暂时无法确认钱包付款。请一分钟后重试：您不会被重复扣款。",
  "error.paymentFailed": "钱包付款未成功。您未被扣款。",
  "error.walletPending": "钱包尚未确认。请一分钟后重试。",
  "error.walletRejected": "钱包拒绝了此付款。请联系客服。",
  "error.provisioning": "已收到付款。您的交易账户仍在开立中：一分钟内将显示在您的挑战中。",
  "error.planUnavailable": "此方案或规模已不再提供。请选择其他方案。",
  "error.notYetEligible": "此账户尚不符合支付条件。",
  "error.belowMinimum": "盈利低于最低支付金额。",
  "error.positionsOpen": "申请支付前请先平掉所有持仓。",
  "error.payoutPending": "此账户已有一笔支付正在审核中。",
  "error.consistency": "尚未满足一致性规则：您的最佳单日盈利占总盈利的比例过高。",
  "error.notFunded": "仅资金账户可申请支付。",
  "error.accountUnavailable": "我们无法为此挑战开立交易账户，因此费用已退回您的 USDT 钱包。如果此问题反复出现，请联系客服。",
  "error.idempotencyConflict": "此结账已用于另一笔购买。请关闭后重新开始。",
  "error.notActive": "此挑战未在进行中。",
  "error.accountLimit": "您的自营账户数量已达上限。请联系客服提高上限。",
  "error.staffReadOnly": "这是只读的员工会话，不允许进行更改。",
  "error.engine": "交易服务器无响应。请稍后重试。",
  "error.generic": "出错了。请重试。",
  "load.title": "自营交易不可用", // display
  "load.body": "无法连接到自营交易服务。您的账户是安全的，请稍后重试。",
};
export default mobileProp;
