import type { NsMessages } from "../../core";

// Kalks mobile app, Reports: Statements and Analytics. Most labels reuse portfolio.st.* / portfolio.an.*.
const mobileReports: NsMessages<"mobileReports"> = {
  eyebrow: "报告",
  "eyebrow.analytics": "报告 · USD · 服务器时间",

  // Account picker (a card that opens a sheet)
  "account.title": "账户",
  "account.choose": "选择账户",
  "account.allHint": { other: "{count} 个真实账户" },
  "account.change": "更换账户",

  // Statements
  "st.day": "日",
  "st.pickDay": "选择日期",
  "st.pickFrom": "开始日期",
  "st.pickTo": "结束日期",
  "st.include": "包含",
  "st.summary": "#{login} · {period} · {format}",
  "st.preparing": "正在准备…",
  "st.ready": "对账单已就绪",
  "st.saved": "已保存为 {file}",
  "st.shareTitle": "分享对账单",
  "st.failed": "无法下载对账单",
  "st.offline": "您已离线。请连接网络后下载对账单。",
  "st.monthly.empty": "暂无月度对账单。",
  "st.monthly.offline": "您已离线。请连接网络后查看月度对账单。",
  "st.monthly.a11y": "{month}：净额 {net}，{trades}。打开下载选项。",
  "st.month.title": "{month} 对账单",
  "st.month.formats": "下载格式",
  "st.prevMonth": "上个月",
  "st.nextMonth": "下个月",

  // Analytics: hero and stat tiles
  "an.hero.label": "净盈亏 · {period}",
  "an.hero.return": "收益率",
  "an.hero.trades": "交易",
  "an.hero.lots": "手数",
  "an.tile.sharpe": "夏普比率",
  "an.tile.expectancy": "期望收益",
  "an.tile.sortino": "索提诺 {value}",
  "an.tile.avgWinLoss": "平均盈利 / 亏损",
  "an.tile.rr": "收益风险比 1 : {value}",
  "an.tile.holdSplit": "盈利单 {win} · 亏损单 {loss}",
  "an.tile.streaks": "连续盈亏",
  "an.tile.streaksSub": "连续盈利 / 亏损次数",
  "an.tile.trade": "{side} {volume} · #{ticket}",
  "an.tile.none": "暂无交易",

  // Analytics: curves
  "an.curve.hint": "长按图表查看每日数据",
  "an.curve.drawdown": "回撤",
  "an.curve.a11y": "{date} 净值 {equity}，余额 {balance}。最大回撤 {drawdown}。",

  // Analytics: P&L calendar (net of closed trades per server day)
  "an.cal.title": "盈亏日历",
  "an.cal.subtitle": "每个服务器日的已平仓交易净结果",
  "an.cal.subtitleEstimated": "每日余额变化，已剔除入金和出金",
  "an.cal.days": { other: "{count} 个交易日" },
  "an.cal.green": "{count} 天盈利",
  "an.cal.red": "{count} 天亏损",
  "an.cal.noTrades": "无已平仓交易",
  "an.cal.select": "点击某天查看结果",
  "an.cal.a11yDay": "{date}：{net}，{trades}",

  // Analytics: breakdowns
  "an.hour.byHour": "按小时统计净盈亏",
  "an.hour.byDayHour": "星期 × 小时",
  "an.hour.tap": "点击柱形或单元格查看详情",
  "an.tapBar": "点击柱形查看详情",
  "an.session.best": "最佳",
  "an.session.asia": "亚洲",
  "an.session.london": "伦敦",
  "an.session.overlap": "伦敦 / 纽约",
  "an.session.newYork": "纽约",
  "an.session.lateNewYork": "纽约尾盘",
  "an.side.split": "{long} · {short}",
  "an.flow.equityNow": "当前净值",
  "an.charges.total": "已付费用",

  // Behaviour insights (the numbers come from the reports service)
  "insight.overtrading.title": { other: "{count} 天过度交易" },
  "insight.overtrading.text": "在这些日子里，您的交易超过 {limit} 笔（您通常每天 {median} 笔）。这些日子的净结果：{net}。",
  "insight.overtrading.tip": "设置每日最多 {cap} 笔交易的上限。",
  "insight.revenge.title": { other: "{count} 笔可能的报复性交易" },
  "insight.revenge.text": "在亏损平仓后 15 分钟内以相同或更大仓位开立的交易。其胜率为 {rate}%，合计 {net}。",
  "insight.revenge.tip": "亏损后请暂停 15 分钟，再进行下一笔交易。",
  "insight.risk.title": "每笔亏损交易的风险",
  "insight.risk.text": { other: "亏损交易平均损失余额的 {avg}%，最多 {max}%。有 {count} 笔亏损超过 2%。" },
  "insight.risk.tip": "控制仓位，使每次止损最多损失余额的 1–2%。",
  "insight.holdLosers.title": "亏损单持仓时间长于盈利单",
  "insight.holdLosers.text": "亏损交易平均持仓 {loss}，盈利交易平均持仓 {win}。",
  "insight.holdLosers.tip": "开仓时即设置止损，并保持不动。",
  "insight.stopOut.title": { other: "{count} 次强制平仓" },
  "insight.stopOut.text": "持仓因预付款不足被强制平仓，而非由您自己的止损平仓。",
  "insight.stopOut.tip": "减小仓位，使预付款比例保持在追加保证金水平之上。",
  "insight.slTp.title": "由止损或止盈平仓的交易",
  "insight.slTp.text": "{tp} 笔由止盈平仓，{sl} 笔由止损平仓，其余由您手动或交易部门平仓。",
  "insight.slTp.tip": "有计划的离场能让结果更稳定。",
  "insight.session.title": "最佳交易时段：{session}",
  "insight.session.text": "{trades} 笔交易，胜率 {rate}%。表现最弱：{worst}（{net}）。",
  "insight.session.tip": "专注于{session}时段。",
  "insight.tip": "建议",

  // States
  "state.updating": "正在更新…",
  "state.stale": "正在显示已保存的数据。下拉即可刷新。",
  "state.notShared.title": "未与您共享",
  "state.footer": "所有金额均以 USD 计（美分账户已换算）。时间为服务器时间 GMT+2 / GMT+3。",
  "state.footerStatements": "对账单以账户货币计（美分账户为 USC）。时间为服务器时间 GMT+2 / GMT+3。",
};
export default mobileReports;
