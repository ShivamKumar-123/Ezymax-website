import type { NsMessages } from "../../core";

// Kalks mobile app: Home tab. Headings are shown in tall display type: keep them short.
const mobileHome: NsMessages<"mobileHome"> = {
  "greet.morning": "早上好，{name}",
  "greet.afternoon": "下午好，{name}",
  "greet.evening": "晚上好，{name}",
  equity: "净值",
  closedToday: "今日平仓盈亏",
  openPnl: "持仓盈亏",
  allLive: "所有真实账户 {amount}",
  "quick.deposit": "入金",
  "quick.withdraw": "出金",
  "quick.transfer": "转账",
  "quick.trade": "交易",
  movers: "涨跌榜",
  news: "要闻",
  allNews: "全部新闻",
  notifications: "通知",
  "kyc.title": "验证您的身份",
  "kyc.body": "完成验证即可解锁真实交易和出金，只需几分钟。",
  "kyc.pending": "验证审核中",
  "kyc.pendingBody": "我们正在审核您的文件。完成后您将收到通知。",
  "kyc.action": "继续",
  "noAccount.title": "开立您的第一个账户",
  "noAccount.body": "模拟账户几秒钟即可就绪，并配有虚拟资金。准备好后即可转为真实交易。",
  "noAccount.action": "开立账户",
  "news.empty": "暂无要闻。",
  "a11y.bell": "通知，{count} 条未读",

  // Explore: one colour block per module (title in display type on two short lines at most, hint on two lines)
  "explore.title": "探索",
  "explore.copy": "跟单交易",
  "explore.copyHint": "跟随优秀交易者",
  "explore.prop": "自营交易挑战",
  "explore.propHint": "获取资金进行交易",
  "explore.academy": "学院",
  "explore.academyHint": "循序渐进学交易",
  "explore.ai": "AI 交易员",
  "explore.aiHint": "将想法转化为策略",
  "explore.invite": "邀请好友",
  "explore.inviteHint": "好友交易，您赚收益",
};
export default mobileHome;
