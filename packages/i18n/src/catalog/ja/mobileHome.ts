import type { NsMessages } from "../../core";

// Kalks mobile app: Home tab. Headings are shown in tall display type: keep them short.
const mobileHome: NsMessages<"mobileHome"> = {
  "greet.morning": "おはようございます、{name}様",
  "greet.afternoon": "こんにちは、{name}様",
  "greet.evening": "こんばんは、{name}様",
  equity: "有効証拠金",
  closedToday: "本日の確定損益",
  openPnl: "含み損益",
  allLive: "全リアル口座 {amount}",
  "quick.deposit": "入金",
  "quick.withdraw": "出金",
  "quick.transfer": "振替",
  "quick.trade": "取引",
  movers: "値動きランキング",
  news: "ヘッドライン",
  allNews: "すべてのニュース",
  notifications: "通知",
  "kyc.title": "本人確認を行ってください",
  "kyc.body": "本人確認を完了すると、リアル取引と出金が可能になります。所要時間は数分です。",
  "kyc.pending": "本人確認の審査中",
  "kyc.pendingBody": "書類を確認しています。完了したら通知でお知らせします。",
  "kyc.action": "続行",
  "noAccount.title": "最初の口座を開設",
  "noAccount.body": "デモ口座なら仮想資金ですぐに始められます。準備ができたらリアル口座へ。",
  "noAccount.action": "口座開設",
  "news.empty": "現在ヘッドラインはありません。",
  "a11y.bell": "通知、未読{count}件",

  // Explore: one colour block per module (title in display type on two short lines at most, hint on two lines)
  "explore.title": "探す",
  "explore.copy": "コピートレード",
  "explore.copyHint": "実績あるトレーダーをフォロー",
  "explore.prop": "プロップチャレンジ",
  "explore.propHint": "資金提供を受けて取引",
  "explore.academy": "アカデミー",
  "explore.academyHint": "取引をステップごとに学ぶ",
  "explore.ai": "AIトレーダー",
  "explore.aiHint": "アイデアをストラテジーに",
  "explore.invite": "友達を招待",
  "explore.inviteHint": "友達の取引で報酬を獲得",
};
export default mobileHome;
