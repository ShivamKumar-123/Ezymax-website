import type { NsMessages } from "../../core";

// Kalks mobile app (apps/mobile): app shell, onboarding and the states every screen shares.
const mobile: NsMessages<"mobile"> = {
  // Tab bar (short: one word each)
  "tab.home": "ホーム",
  "tab.markets": "マーケット",
  "tab.trade": "取引",
  "tab.portfolio": "ポートフォリオ",
  "tab.more": "その他",

  // Onboarding (3 slides). Titles are shown in tall display type: keep them short.
  "onboarding.skip": "スキップ",
  "onboarding.next": "次へ",
  "onboarding.getStarted": "はじめる",
  "onboarding.haveAccount": "アカウントをお持ちの方",
  "onboarding.welcome.title": "市場への第一歩",
  "onboarding.welcome.body": "FX、貴金属、株価指数、エネルギー、暗号資産、株式をひとつの口座で。USDTで即時入金。",
  "onboarding.markets.title": "全ティックをリアルタイムで",
  "onboarding.markets.body": "実際のBid/Ask価格、自分だけのチャート、ワンタップの買い・売り。スマートフォン向けに設計。",
  "onboarding.security.title": "万全のセキュリティ",
  "onboarding.security.body": "新しいデバイスではメールコード、出金には確認コード、セッションは安全な保管領域で保護。",
  "onboarding.step": "{n} / {total}", // slide counter, e.g. "1 / 3"

  // Shared states
  "state.offline.title": "接続が切断されました",
  "state.offline.body": "インターネット接続を確認してください。価格と口座は自動的に再接続されます。",
  "state.reconnecting": "再接続中…",
  "state.error.title": "エラーが発生しました",
  "state.error.body": "読み込めませんでした。下に引くか、タップして再試行してください。",
  "state.maintenance.title": "メンテナンス中",
  "state.maintenance.body": "Kalksをアップグレードしています。ポジションと資金は安全です。しばらくしてから再度ご確認ください。",
  "state.sessionExpired": "セッションが終了しました。もう一度ログインしてください。",
  "state.updated": "更新：{time}",
  "state.pullToRefresh": "下に引いて更新",

  "viewOnly": "閲覧専用アクセス",
  "viewOnlyBody": "このログインでは共有された口座を閲覧できますが、変更はできません。",

  // Common short labels
  "action.retry": "再試行",
  "action.openWeb": "クライアントエリアで開く",
  "action.signOut": "ログアウト",
  "action.seeAll": "すべて表示",
  "a11y.close": "閉じる",
  "a11y.back": "戻る",
};
export default mobile;
