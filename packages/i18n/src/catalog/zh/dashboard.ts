import type { NsMessages } from "../../core";

const dashboard: NsMessages<"dashboard"> = {
  // Page header (Client Area home)
  "greeting.morning": "早上好，{name}",
  "greeting.afternoon": "下午好，{name}",
  "greeting.evening": "晚上好，{name}",
  "greeting.welcome": "欢迎，{name}",
  "subtitle.live": "欢迎来到 Kalks。以下是您的账户和今日市场概况。",
  "subtitle.demo": "以下是您的账户今日表现。",
  launchTrader: "启动 Kalks Trader",
  openTerminal: "打开交易终端",

  // Getting started checklist
  "steps.title": "快速入门",
  "steps.subtitle": "您的真实交易准备进度",
  "steps.progress": "{done} / {total}",
  "steps.account.title": "创建您的账户",
  "steps.account.text": "注册于 {date}。",
  "steps.email.title": "验证您的邮箱",
  "steps.email.verified": "{email} 已验证。",
  "steps.email.confirm": "请使用我们发送的验证码确认 {email}。",
  "steps.kyc.title": "验证您的身份",
  "steps.kyc.verified": "您的身份已验证，出金功能已解锁。",
  "steps.kyc.moreInfo": "我们的团队还需要您提供一份文件。",
  "steps.kyc.review": "您的文件正在由我们的验证团队审核。",
  "steps.kyc.draft": "从上次中断处继续，大约需要 3 分钟。",
  "steps.kyc.rejected": "我们无法验证您的文件。您可以重新开始。",
  "steps.kyc.todo": "大约需要 3 分钟，完成后解锁出金。",
  "steps.accountOpen.title": "开立交易账户",
  "steps.accountOpen.opened": { other: "已开立 {live} 个真实账户和 {demo} 个模拟账户。" },
  "steps.accountOpen.todo": "开立真实或模拟账户，交易账号即时发放。",
  "steps.wallet.title": "为钱包入金",
  "steps.wallet.text": "TRC20 网络 USDT 入金正在接入中。",
  // Step status chips
  "steps.state.done": "已完成",
  "steps.state.todo": "待完成",
  "steps.state.review": "审核中",
  "steps.state.rejected": "已拒绝",
  "steps.state.soon": "未开始",

  // Trading accounts card
  "accounts.title": "交易账户",
  "accounts.summary": "真实账户净值 <b>{equity}</b> · {live} 个真实 · {demo} 个模拟 · {positions} 个持仓",
  "accounts.subtitle": "您的真实账户和模拟账户",
  "accounts.all": "全部账户",
  "accounts.open": "开立账户",
  "accounts.unavailable": "交易账户暂时不可用。您的资金是安全的。",
  "accounts.openLive.title": "开立真实账户",
  "accounts.openLive.text": "真实市场。初始余额为零；可通过钱包入金。",
  "accounts.openDemo.title": "开立模拟账户",
  "accounts.openDemo.text": "使用虚拟资金按实时价格交易，每天均可充值。",
  "accounts.more": { other: "另有 {count} 个账户" },
  "accounts.myTitle": "我的交易账户",

  // Your account card
  "account.title": "您的账户",
  "account.clientId": "客户 ID",
  "account.emailStatus": "邮箱状态",
  "account.notVerified": "未验证",
  "account.identity": "身份",
  "account.memberSince": "注册时间",
  "account.profile": "个人资料",

  // Kalks Trader banner
  "trader.chip": "实时价格",
  "trader.text": "涵盖外汇、贵金属、指数、能源、加密货币和股票的 {count} 个交易品种的实时报价和图表。在浏览器中运行，无需安装。",

  // Market clock / heatmap
  "sessions.title": "市场时钟",
  "sessions.open": "{total} 个市场中 {open} 个开市",
  "heatmap.title": "市场热力图",
  "heatmap.subtitle": "基于实时价格的今日涨跌 · 空心点：休市",
  "heatmap.up": "{count} 个上涨",
  "heatmap.down": "{count} 个下跌",
  "heatmap.allMarkets": "全部市场",
  "heatmap.tipOpen": "{symbol} · 开市中",
  "heatmap.tipClosed": "{symbol} · 休市，显示上一交易时段涨跌",

  // Support card
  "support.title": "需要帮助？",
  "support.text": "请使用您的注册邮箱发送邮件至 <mail>{email}</mail>，并注明您的客户 ID。",
  "support.emailSupport": "邮件联系客服",
  "support.copied": "邮箱地址已复制",
  "support.copyFailed": "复制失败，请手动选择地址",

  // Demo dashboard: onboarding strip
  "onboarding.title": "完成账户设置",
  "onboarding.text": "完成 KYC 以解锁出金和更高限额。",
  "onboarding.progress": "进度",
  "onboarding.dismiss": "关闭",

  // Margin health
  "margin.title": "保证金健康度",
  "margin.subtitle": "所有真实账户合计",
  "margin.healthy": "健康",
  "margin.level": "预付款比例",
  "margin.used": "已用预付款",
  "margin.free": "可用预付款",

  // Equity / P&L
  "equity.title": "总净值",
  "equity.changeOver": "{range} 变化",
  "pnl.title": "盈亏 · 本月",
  "pnl.lowRisk": "低风险",
  "pnl.winRate": "胜率（30天）",
  "pnl.trades": "交易次数（30天）",
  "pnl.avgWin": "平均盈利交易",
  "pnl.avgLoss": "平均亏损交易",
  "pnl.charges": "已付费用",

  // KPI cards
  "kpi.wallet": "钱包",
  "kpi.today": "今日 +{pct}%",
  "kpi.monthPnl": "本月盈亏",
  "kpi.vsLastMonth": "较上月 +{pct}%",
  "kpi.partnerEarnings": "合作伙伴收益",
  "kpi.copy": "跟单 {amount}",

  // Top movers
  "movers.title": "涨跌榜",
  "movers.gainers": "领涨",
  "movers.losers": "领跌",

  // Economic calendar. A = Actual, F = Forecast, P = Previous
  "calendar.title": "财经日历",
  "calendar.subtitle": "今天 · 服务器时间 GMT+3",
  "calendar.actual": "实际 {value} · ",
  "calendar.forecastPrevious": "预测 {forecast} · 前值 {previous}",

  // News / world
  "news.title": "市场新闻",
  "news.all": "全部新闻",
  "news.pinned": "置顶",
  "world.title": "全球市场与新闻",
  "world.subtitle": "按国家/地区划分的实时头条与货币情绪",
  "world.stories": { other: "今日 {count} 条新闻" },

  // Open positions
  "positions.title": "持仓",
  "positions.summary": { other: "{count} 个持仓 · 浮动盈亏" },
  "positions.terminal": "终端",

  // Partner banner
  "partner.chip": "合作伙伴计划",
  "partner.title": "邀请交易者，每手最高赚取 $15——终身有效。",
  "partner.text": "多级佣金、CPA 奖金和实时追踪。您的链接：<link>{url}</link>",
  "partner.open": "打开合作伙伴仪表板",

  // Short relative times
  "time.justNow": "刚刚",
  "time.minutesAgo": "{count}分钟前",
  "time.hoursAgo": "{count}小时前",
  "time.daysAgo": "{count}天前",
  "time.ago": "{time}前",

  // Notifications bell / panel
  "notifications.title": "通知",
  "notifications.ariaUnread": "通知，{count} 条未读",
  "notifications.markAll": "全部标为已读",
  "notifications.clear": "清除",
  "notifications.emptyTitle": "暂无通知",
  "notifications.emptyText": "入金、出金、身份验证、交易提醒和客服回复将显示在此处。",
  "notifications.settings": "通知设置",
};
export default dashboard;
