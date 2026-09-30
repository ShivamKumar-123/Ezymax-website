import type { NsMessages } from "../../core";

// Kalks mobile app: app shell, onboarding and the states every screen shares.
const mobile: NsMessages<"mobile"> = {
  // Tab bar (short: one word each)
  "tab.home": "首页",
  "tab.markets": "市场",
  "tab.trade": "交易",
  "tab.portfolio": "投资组合",
  "tab.more": "更多",

  // Onboarding (3 slides). Titles are shown in tall display type: keep them short.
  "onboarding.skip": "跳过",
  "onboarding.next": "下一步",
  "onboarding.getStarted": "开始使用",
  "onboarding.haveAccount": "我已有账户",
  "onboarding.welcome.title": "走进全球市场",
  "onboarding.welcome.body": "外汇、贵金属、指数、能源、加密货币和股票尽在一个账户，USDT 即时入金。",
  "onboarding.markets.title": "逐笔实时报价",
  "onboarding.markets.body": "真实的买卖价、您专属的图表，一键买入和卖出，专为手机打造。",
  "onboarding.security.title": "严密防护",
  "onboarding.security.body": "新设备登录需邮箱验证码，出金需确认码，您的会话保存在安全存储区中。",
  "onboarding.step": "{n} / {total}", // slide counter, e.g. "1 of 3"

  // Shared states
  "state.offline.title": "连接已断开",
  "state.offline.body": "请检查您的网络连接。价格和账户将自动重新连接。",
  "state.reconnecting": "正在重新连接…",
  "state.error.title": "出错了",
  "state.error.body": "无法加载此内容。请下拉或点击重试。",
  "state.maintenance.title": "系统维护中",
  "state.maintenance.body": "Kalks 正在升级。您的持仓和资金是安全的，请稍后再来查看。",
  "state.sessionExpired": "您的会话已结束。请重新登录。",
  "state.updated": "更新于 {time}",
  "state.pullToRefresh": "下拉刷新",

  "viewOnly": "只读访问",
  "viewOnlyBody": "此登录可查看共享的账户，但无法进行更改。",

  // Common short labels
  "action.retry": "重试",
  "action.openWeb": "在客户专区中打开",
  "action.signOut": "退出登录",
  "action.seeAll": "查看全部",
  "a11y.close": "关闭",
  "a11y.back": "返回",
};
export default mobile;
