import type { NsMessages } from "../../core";

// Kalks Trader left panels: Market Watch (quotes list), segment chips and Navigator.
const market: NsMessages<"market"> = {
  // Market Watch header and tabs
  title: "市场报价",
  collapse: "收起",
  "tab.symbols": "交易品种",
  "tab.details": "详细信息",
  "tab.favourites": "收藏",
  segmentAria: "市场报价分类",
  searchPlaceholder: "搜索交易品种",
  searchAria: "搜索市场报价",
  clear: "清除",

  // Market Watch columns
  "col.symbol": "交易品种",
  "col.bid": "卖价",
  "col.ask": "买价",
  "col.spread": "点差",
  "col.spreadTitle": "点差（点）",
  "col.change": "涨跌%",

  // Row / hover card
  "row.title": "{name} · 点差 {spread}",
  "tip.low": "低",
  "tip.high": "高",
  "tip.spread": "点差",
  "tip.range": "区间",
  bid: "卖价",
  ask: "买价",

  // Empty states and footer
  "empty.favourites": "暂无收藏。右键点击交易品种即可添加。",
  "empty.favouritesTitle": "暂无收藏",
  "empty.noMatch": "没有匹配的交易品种。",
  "footer.count": "{shown} / {total} 个交易品种",
  "footer.hint": "双击：图表",

  // Context menu
  "menu.newOrder": "新订单",
  "menu.chartWindow": "图表窗口",
  "menu.openInActive": "在当前图表中打开",
  "menu.depth": "市场深度",
  "menu.specification": "规格",
  "menu.removeFavourite": "从收藏中移除",
  "menu.addFavourite": "添加到收藏",
  "menu.hide": "隐藏",
  "menu.showAll": "全部显示",

  // Toasts
  "toast.hidden": "{symbol} 已从市场报价中隐藏",
  "toast.hiddenDesc": "可通过右键菜单显示全部交易品种。",
  "toast.opened": "{symbol} 已在当前图表中打开",

  // Segment chips (asset classes)
  "segment.favourites": "收藏",
  "segment.forex": "外汇",
  "segment.metals": "贵金属",
  "segment.indices": "指数",
  "segment.energies": "能源",
  "segment.crypto": "加密货币",
  "segment.stocks": "股票",
  "segment.aria": "资产类别",
  "segment.title": { other: "{label} · {count} 个交易品种" },

  // Navigator tree
  "nav.title": "导航",
  "nav.indicators": "指标",
  "nav.strategies": "策略",
  "nav.scripts": "脚本",
  "nav.guest": "访客",
  "nav.noAccount": "暂无交易账户",
  "nav.openAccount": "开立账户",
  "nav.openAccountTitle": "创建您的 Kalks 账户（将打开客户专区）",
  "nav.signIn": "登录",
  "nav.signInTitle": "登录客户专区",
  "nav.accountType.live": "真实",
  "nav.accountType.demo": "模拟",
  "nav.category.trend": "趋势",
  "nav.category.oscillators": "震荡指标",
  "nav.category.volatility": "波动率",
  "nav.category.volume": "成交量",
  "nav.category.billWilliams": "比尔·威廉姆斯",
  "nav.indicatorTitle": "{description} · 双击或按 Enter 添加到 {symbol}，{tf}",
  "nav.strategyTitle": { other: "{server} · {login} · {count} 笔交易" },
  "nav.strategyRunning": "{name} 已在运行",
  "nav.strategyAttached": "{name} 已加载",
  "nav.strategyDesc": "{login} · {server} · 今日盈亏 {pnl}",
  "nav.script.closeAll": "平掉所有持仓",
  "nav.script.closeProfitable": "平掉盈利持仓",
  "nav.script.closeLosing": "平掉亏损持仓",
  "nav.script.deletePendings": "删除所有挂单",
  "nav.script.breakevenAll": "全部保本（SL → 开仓价）",
  "nav.scriptTitle": "双击以在当前账户上运行",
  "nav.scriptsReadOnly": "只读模式下脚本已禁用",
};
export default market;
