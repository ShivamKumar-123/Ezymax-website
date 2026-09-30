import type { NsMessages } from "../../core";

// Kalks mobile app (apps/mobile, src/features/platform): the notifications inbox, push notifications, the app lock
// (Face ID / fingerprint / the phone's passcode), "Continue with Google" and links that open the app.
// Brand and product names stay as they are: Kalks, Face ID, Touch ID, Google.
const mobilePlatform: NsMessages<"mobilePlatform"> = {
  // Notifications inbox (/notifications). Day headers above each group: Today, Yesterday, then the date.
  "inbox.eyebrow": "受信トレイ",
  "inbox.unread": { other: "未読{count}件" },
  "inbox.caughtUp": "すべて既読",
  "inbox.filter.unread": "未読",
  "inbox.markedAll": "すべて既読にしました",
  "inbox.emptyUnread.title": "すべて既読です",
  "inbox.emptyUnread.body": "すべての通知を確認しました。新しい通知は届き次第ここに表示されます。",
  "inbox.loadMoreFailed": "過去の通知を読み込めませんでした。タップして再試行してください。",
  // Under the title while the phone is offline and the inbox shows what it saved earlier
  "inbox.offlineCached": "オフラインです。この端末に保存されている通知を表示しています。",
  // Row accessibility
  "inbox.a11y.unread": "未読",
  "inbox.a11y.settings": "通知設定",
  // Detail sheet of a notification without a screen to open
  "inbox.detail.openWeb": "リンクを開く",
  "inbox.detail.received": "{time}受信",

  // Asking for push permission (never on the first launch): a sheet on Home and a card in the inbox
  "push.ask.eyebrow": "通知",
  "push.ask.title": "その瞬間にお知らせ",
  "push.ask.body": "入金の反映、出金の完了、マージンコール、ストップアウト、サポートからの返信を、ロック画面に直接お届けします。",
  "push.ask.point.money": "入金と出金",
  "push.ask.point.risk": "マージンコールとストップアウト",
  "push.ask.point.support": "サポートからの返信",
  "push.ask.allow": "通知をオンにする",
  "push.ask.later": "後で",
  "push.ask.note": "通知するトピックは「プロフィール › 通知」で選択できます。特典のお知らせは、オンにした場合のみ送信されます。",
  // The sample notification drawn in the ask, as it would look on the lock screen ("now" = its time label)
  "push.ask.now": "今",
  "push.ask.sampleTitle": "入金が反映されました",
  "push.ask.sampleBody": "250.00 USDTがウォレットに反映されました。",
  "push.card.title": "プッシュ通知をオンにする",
  "push.card.body": "入金、約定、マージンコールをロック画面で受け取れます。",
  "push.card.action": "オンにする",
  "push.card.deniedTitle": "プッシュ通知はオフです",
  "push.card.deniedBody": "ロック画面で通知を受け取るには、端末の設定でKalksの通知を許可してください。",
  "push.card.deniedAction": "設定を開く",
  "push.card.dismiss": "非表示",
  "push.enabled": "プッシュ通知がオンになりました",
  // Android notification channels (shown in the phone's settings for the app)
  "push.channel.alerts": "マージンコールとセキュリティ",
  "push.channel.alertsHint": "マージンコールとストップアウトの警告、価格アラート、新しいログイン",
  "push.channel.activity": "アカウントのアクティビティ",
  "push.channel.activityHint": "入金、出金、約定、本人確認、サポートからの返信",
  "push.channel.news": "ニュースと特典",
  "push.channel.newsHint": "受信を選択したキャンペーンと製品ニュース",
  // In-app banner for a push that arrives while the app is open
  "push.banner.a11y": "新しい通知：{title}。ダブルタップで開きます。",

  // App lock screen (cold start, after the chosen time in the background, and /lock)
  "lock.eyebrow": "ロック中",
  "lock.title": "おかえりなさい",
  "lock.subtitle": "ロックを解除して、口座と残高を確認してください。",
  // {method}: Face ID, Touch ID, fingerprint, face unlock or passcode
  "lock.unlockWith": "{method}でロック解除",
  "lock.unlock": "ロック解除",
  "lock.prompt": "Kalksのロックを解除",
  "lock.promptSubtitle": "ご本人確認",
  "lock.failed": "認証できませんでした。もう一度お試しください。",
  "lock.lockout": "試行回数が多すぎます。端末のパスコードでロックを解除してから、もう一度お試しください。",
  "lock.noScreenLock": "端末の画面ロックが解除されたため、Kalksでご本人確認ができません。ログアウトして、パスワードでログインし直してください。",
  "lock.notYou": "ご本人ではない、またはロックを解除できない場合",
  "lock.signOut": "ログアウト",
  "lock.signOutTitle": "Kalksからログアウトしますか？",
  "lock.signOutBody": "次回はメールアドレスとパスワードでログインします。ポジションと資金には影響しません。",
  "lock.method.faceId": "Face ID",
  "lock.method.touchId": "Touch ID",
  "lock.method.fingerprint": "指紋認証",
  "lock.method.face": "顔認証",
  "lock.method.iris": "虹彩認証",
  "lock.method.passcode": "パスコード",

  // Settings › App lock (/settings/app-lock)
  "settings.eyebrow": "セキュリティ",
  "settings.title": "アプリのロック",
  "settings.subtitle": "起動時とバックグラウンドから戻ったときに、{method}でKalksをロックします。",
  "settings.toggle": "Kalksをロック",
  "settings.toggleHint": "{method}を使用し、使えない場合は端末のパスコードで解除します",
  "settings.on": "アプリのロックはオンです",
  "settings.off": "アプリのロックはオフです",
  "settings.after": "再ロックまでの時間",
  "settings.afterHint": "Kalksがバックグラウンドにある間、再び認証を求めるまでの時間です。起動時には常に認証を求めます。",
  "settings.timeout.0": "すぐに",
  "settings.timeout.60": "1分",
  "settings.timeout.300": "5分",
  "settings.timeout.900": "15分",
  "settings.timeout.3600": "1時間",
  "settings.privacy": "アプリのロックがオンの間、アプリスイッチャーには残高の代わりにカバー画面が表示されます。",
  "settings.lockNow": "今すぐロック",
  "settings.confirmOn": "アプリのロックをオンにするには認証してください",
  "settings.confirmOff": "アプリのロックをオフにするには認証してください",
  // System prompt when the reader picks a longer "Lock again after" time
  "settings.confirmTimeout": "Kalksのロック時間を変更するには認証してください",
  // Toast body after a password sign-in on a phone whose screen lock was removed (the app lock can't work without it)
  "settings.turnedOffNoScreenLock": "この端末には画面ロックが設定されていないため、Kalksでご本人確認ができません。アプリのロックを再び使うには、端末の設定で画面ロックを設定してください。",
  "settings.notConfirmed": "認証されなかったため、変更されていません",
  "settings.unavailableTitle": "先に画面ロックを設定してください",
  "settings.unavailableBody": "アプリのロックには、端末のFace ID、指紋認証、またはパスコードを使用します。端末の設定でいずれかをオンにしてから、もう一度お試しください。",
  "settings.webTitle": "アプリでご利用いただけます",
  "settings.webBody": "アプリのロックは、iPhone版とAndroid版のKalksアプリでご利用いただけます。",
  "settings.thisPhone": "この端末にのみ適用されます",

  // Links that open the app (kalks://…, notification taps) but match no screen
  "link.notFound.title": "開けるページがありません",
  "link.notFound.body": "このリンクに対応する画面がアプリにありません。古いリンクか、ウェブ版クライアントエリア向けのリンクの可能性があります。",
  "link.notFound.home": "ホームへ",
  "link.openFailed": "このリンクを開けませんでした。",
};
export default mobilePlatform;
