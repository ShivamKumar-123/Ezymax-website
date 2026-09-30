import type { NsMessages } from "../../core";

// Kalks mobile app: Trade tab (chart, Sell / Buy bar, order ticket) and trade notifications.
// Trading terms follow the MetaTrader 5 localisation (see the `order` namespace).
const mobileTrade: NsMessages<"mobileTrade"> = {
  // Header
  pickSymbol: "选择交易品种",
  searchSymbol: "搜索交易品种",
  depth: "市场深度",
  alert: "价格警报",
  news: "{symbol} 相关新闻", // a header button's accessibility label
  calendar: "{currency} 财经日历", // a header button's accessibility label, e.g. "EUR economic calendar"
  "account.chip": "{type} · #{login}",
  "account.manage": "管理账户",
  "account.open": "开立账户",

  // Chart
  "chart.indicators": "指标",
  "chart.type.candles": "蜡烛图",
  "chart.type.line": "折线图",
  "ind.ma": "移动平均线 20",
  "ind.ema": "指数移动平均线 50",
  "ind.bb": "布林带 20, 2",
  "ind.rsi": "RSI 14",
  "chart.noData": "该交易品种暂无图表历史数据",
  "chart.hint": "双指缩放 · 拖动滚动 · 长按显示十字光标 · 双击重置",

  // Sell / Buy bar and ticket
  "bar.volume": "手数",
  "ticket.title": "新订单",
  "ticket.confirmBuy": "买入 {volume} {symbol}",
  "ticket.confirmSell": "卖出 {volume} {symbol}",
  "ticket.atMarket": "按市价",
  "ticket.at": "价格 {price}",
  "ticket.addSl": "添加止损",
  "ticket.addTp": "添加止盈",
  "ticket.ifHit": "触发时 {money}",
  "ticket.required": "预付款",
  "ticket.pip": "点值",
  "ticket.after": "下单后可用预付款",
  "ticket.notEnough": "可用预付款不足以支持此交易量。",
  "ticket.noSpecs": "正在加载合约详情…",
  "ticket.distance": "距离 {n} 点",
  "ticket.price": "价格",

  // Rejections: a plain-language line under the reason (order.reject.<code>)
  "reject.no_money": "您的可用预付款不足以支付此订单。请降低交易量，或为此账户入金。",
  "reject.insufficient_funds": "您的可用预付款不足以支付此订单。请降低交易量，或为此账户入金。",
  "reject.market_closed": "该市场目前休市。请在开市后重试。",
  "reject.invalid_volume": "请使用符合该交易品种限制和手数步长的交易量。",
  "reject.max_lot": "此交易量超过您账户的单笔订单上限。",
  "reject.close_only": "您的账户目前只能平仓，无法开立新仓位。",
  "reject.symbol_close_only": "该交易品种目前只能平仓，无法开仓。",
  "reject.trading_disabled": "此账户的交易已关闭。详情请联系客服。",
  "reject.symbol_halted": "该交易品种已暂停交易。请稍后重试。",
  "reject.requote.title": "价格已变动",
  "reject.requote": "您的订单发送期间市场价格发生了变动。请查看新价格后再次确认。",
  "reject.invalid_sl": "止损位于价格的错误一侧，或距离价格过近。",
  "reject.invalid_tp": "止盈位于价格的错误一侧，或距离价格过近。",
  "reject.invalid_price": "对于此订单类型，该价格位于市价的错误一侧。",
  "reject.off_market": "该价格偏离市价过远。请检查数值。",
  "reject.stale_price": "该交易品种的报价暂时中断。请稍后重试。",
  "reject.no_price": "该交易品种目前没有实时报价。",
  "reject.read_only": "此登录可查看账户，但无法交易。",
  "reject.uncertain.title": "交易服务器无响应",
  "reject.uncertain": "订单可能已执行。请先查看“投资组合”，再决定是否重试。",
  "reject.uncertain.ticket": "可以放心再次确认：同一订单不会被重复下达。",

  // States
  "state.noAccount.title": "暂无交易账户",
  "state.noAccount.body": "开立模拟账户进行练习，或开立真实账户进行真实交易。",
  "state.noAccount.action": "开立账户",
  "state.connecting": "正在连接交易服务器…",
  "state.readOnly": "此账户在此处为只读：价格和图表实时更新，交易已关闭。",
  "state.marketClosed.title": "休市",
  "state.marketClosed.body": "{symbol} 将在下一交易时段重新开市。开市后即可下单。",
  "state.streamError": "无法连接交易服务器",
  "state.streamErrorBody": "您的持仓和订单在服务器上安全无虞。我们会持续尝试重新连接。",

  // Results
  "toast.filled": "{side} {volume} {symbol} 已成交",
  "toast.at": "价格 {price}",
  "toast.placed": "{symbol} 挂单已下达",
  "toast.duplicate": "已下单，订单号 #{ticket}",
  "toast.duplicateBody": "此订单此前已送达服务器，未重复开仓。",
  "toast.closed": "持仓 #{ticket} 已平仓",
  "toast.partial": "已平仓 #{ticket} 的 {volume} 手",
  "toast.modified": "#{ticket} 已更新",
  "toast.cancelled": "订单 #{ticket} 已取消",

  // Engine notifications while the app is open
  "notify.sl": "触发止损",
  "notify.tp": "触发止盈",
  "notify.order_filled": "挂单已成交",
  "notify.order_triggered": "订单已触发",
  "notify.margin_call": "追加保证金",
  "notify.stop_out": "强制平仓",
  "notify.order_rejected": "订单被拒绝",
  "notify.order_expired": "订单已过期",
  "notify.order_cancelled": "订单已取消",
};
export default mobileTrade;
