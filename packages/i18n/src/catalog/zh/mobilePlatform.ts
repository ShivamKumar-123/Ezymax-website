import type { NsMessages } from "../../core";

// Kalks mobile app: the notifications inbox, push notifications, the app lock (Face ID / fingerprint / the phone's
// passcode), "Continue with Google" and links that open the app.
// Keep brand and product names as they are: Kalks, Face ID, Touch ID, Google.
const mobilePlatform: NsMessages<"mobilePlatform"> = {
  // Notifications inbox. Day headers above each group: Today, Yesterday, then the date.
  "inbox.eyebrow": "消息中心",
  "inbox.unread": { other: "{count} 条未读" },
  "inbox.caughtUp": "已全部读完",
  "inbox.filter.unread": "未读",
  "inbox.markedAll": "已全部标为已读",
  "inbox.emptyUnread.title": "已全部读完",
  "inbox.emptyUnread.body": "您已阅读所有通知。新通知到达后将显示在此处。",
  "inbox.loadMoreFailed": "无法加载更早的通知。请点击重试。",
  // Under the title while the phone is offline and the inbox shows what it saved earlier
  "inbox.offlineCached": "您已离线。以下是保存在本机上的通知。",
  // Row accessibility
  "inbox.a11y.unread": "未读",
  "inbox.a11y.settings": "通知设置",
  // Detail sheet of a notification without a screen to open
  "inbox.detail.openWeb": "打开链接",
  "inbox.detail.received": "接收于 {time}",

  // Asking for push permission (never on the first launch): a sheet on Home and a card in the inbox
  "push.ask.eyebrow": "通知",
  "push.ask.title": "第一时间掌握动态",
  "push.ask.body": "入金到账、出金支付、追加保证金、强制平仓和客服回复，直接推送到您的锁屏。",
  "push.ask.point.money": "入金与出金",
  "push.ask.point.risk": "追加保证金与强制平仓",
  "push.ask.point.support": "客服回复",
  "push.ask.allow": "开启通知",
  "push.ask.later": "暂不",
  "push.ask.note": "您可在“个人资料 › 通知”中选择主题。仅在您开启后才会发送优惠信息。",
  // The sample notification drawn in the ask, as it would look on the lock screen ("now" = its time label)
  "push.ask.now": "现在",
  "push.ask.sampleTitle": "入金已到账",
  "push.ask.sampleBody": "250.00 USDT 已存入您的钱包。",
  "push.card.title": "开启推送通知",
  "push.card.body": "在锁屏上接收入金、成交和追加保证金通知。",
  "push.card.action": "开启",
  "push.card.deniedTitle": "推送通知已关闭",
  "push.card.deniedBody": "请在手机设置中允许 Kalks 发送通知，以便在锁屏上接收。",
  "push.card.deniedAction": "打开设置",
  "push.card.dismiss": "隐藏",
  "push.enabled": "推送通知已开启",
  // Android notification channels (shown in the phone's settings for the app)
  "push.channel.alerts": "追加保证金与安全",
  "push.channel.alertsHint": "追加保证金和强制平仓警告、您的价格警报、新登录",
  "push.channel.activity": "账户动态",
  "push.channel.activityHint": "入金、出金、成交、身份验证和客服回复",
  "push.channel.news": "新闻与优惠",
  "push.channel.newsHint": "您已订阅的促销活动和产品资讯",
  // In-app banner for a push that arrives while the app is open
  "push.banner.a11y": "新通知：{title}。双击打开。",

  // App lock screen
  "lock.eyebrow": "已锁定",
  "lock.title": "欢迎回来",
  "lock.subtitle": "解锁即可查看您的账户和余额。",
  // {method}: Face ID, Touch ID, fingerprint, face unlock or passcode
  "lock.unlockWith": "使用{method}解锁",
  "lock.unlock": "解锁",
  "lock.prompt": "解锁 Kalks",
  "lock.promptSubtitle": "确认是您本人",
  "lock.failed": "验证失败，请重试。",
  "lock.lockout": "尝试次数过多。请先使用锁屏密码解锁手机，然后重试。",
  "lock.noScreenLock": "您的手机已不再设置屏幕锁定，因此 Kalks 无法确认是您本人。请退出登录，然后使用密码重新登录。",
  "lock.notYou": "不是您本人，或无法解锁？",
  "lock.signOut": "退出登录",
  "lock.signOutTitle": "退出 Kalks？",
  "lock.signOutBody": "您需要使用邮箱和密码重新登录。您的持仓和资金不受影响。",
  "lock.method.faceId": "Face ID",
  "lock.method.touchId": "Touch ID",
  "lock.method.fingerprint": "指纹",
  "lock.method.face": "面部识别",
  "lock.method.iris": "虹膜",
  "lock.method.passcode": "锁屏密码",

  // Settings › App lock
  "settings.eyebrow": "安全",
  "settings.title": "应用锁",
  "settings.subtitle": "在打开 Kalks 时以及应用在后台停留一段时间后，使用{method}锁定 Kalks。",
  "settings.toggle": "锁定 Kalks",
  "settings.toggleHint": "使用{method}，并以手机锁屏密码作为备用方式",
  "settings.on": "应用锁已开启",
  "settings.off": "应用锁已关闭",
  "settings.after": "重新锁定时间",
  "settings.afterHint": "Kalks 在后台停留多久后需要再次验证。每次启动时都会要求验证。",
  "settings.timeout.0": "立即",
  "settings.timeout.60": "1 分钟",
  "settings.timeout.300": "5 分钟",
  "settings.timeout.900": "15 分钟",
  "settings.timeout.3600": "1 小时",
  "settings.privacy": "开启应用锁后，应用切换器中将显示遮罩，而不是您的余额。",
  "settings.lockNow": "立即锁定",
  "settings.confirmOn": "确认以开启应用锁",
  "settings.confirmOff": "确认以关闭应用锁",
  // System prompt when the reader picks a longer "Lock again after" time
  "settings.confirmTimeout": "确认以更改 Kalks 的锁定时间",
  // Toast body after a password sign-in on a phone whose screen lock was removed
  "settings.turnedOffNoScreenLock": "此手机未设置屏幕锁定，因此 Kalks 无法确认是您本人。请在手机设置中设置屏幕锁定，以重新使用应用锁。",
  "settings.notConfirmed": "未确认，未作任何更改",
  "settings.unavailableTitle": "请先设置屏幕锁定",
  "settings.unavailableBody": "应用锁使用手机的 Face ID、指纹或锁屏密码。请在手机设置中开启其中一项，然后返回此处。",
  "settings.webTitle": "仅在应用中可用",
  "settings.webBody": "应用锁适用于 iPhone 和 Android 版 Kalks 应用。",
  "settings.thisPhone": "仅适用于此手机",

  // Links that open the app but match no screen
  "link.notFound.title": "没有可打开的内容",
  "link.notFound.body": "此链接与应用中的任何页面都不匹配。它可能已过时，或适用于网页版客户专区。",
  "link.notFound.home": "前往首页",
  "link.openFailed": "无法打开此链接。",
};
export default mobilePlatform;
