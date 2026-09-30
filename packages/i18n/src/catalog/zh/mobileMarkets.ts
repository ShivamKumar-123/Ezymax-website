import type { NsMessages } from "../../core";

// Kalks mobile app: Markets tab (watchlist). Segment names, Bid / Ask and search reuse the `market` namespace.
const mobileMarkets: NsMessages<"mobileMarkets"> = {
  eyebrow: "实时价格",
  "empty.favourites.title": "暂无收藏",
  "empty.favourites.body": "长按任意交易品种，即可将其固定在此处。",
  "empty.favourites.action": "浏览外汇",
  "fav.added": "已将 {symbol} 添加到收藏",
  "fav.removed": "已将 {symbol} 从收藏中移除",
  "a11y.row": "{symbol}，{name}。点击打开图表；长按可添加或移除收藏。",
  "a11y.search": "搜索交易品种",
  cancel: "取消",
  "status.connecting": "正在连接报价…",
  "status.offline": "报价已暂停：无网络连接",
};
export default mobileMarkets;
