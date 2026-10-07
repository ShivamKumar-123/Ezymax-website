import type { NsMessages } from "../../core";

const dashboard: NsMessages<"dashboard"> = {
  // Page header (Client Area home). {name} = client's first name
  "greeting.morning": "おはようございます、{name}様",
  "greeting.afternoon": "こんにちは、{name}様",
  "greeting.evening": "こんばんは、{name}様",
  "greeting.welcome": "ようこそ、{name}様",
  "subtitle.live": "Kalksへようこそ。お客様のアカウントと本日の市場です。",
  "subtitle.demo": "本日の口座のパフォーマンスです。",
  launchTrader: "Kalks Traderを起動",
  openTerminal: "取引ターミナルを開く",

  // Getting started checklist
  "steps.title": "はじめに",
  "steps.subtitle": "リアル取引までの進捗",
  "steps.progress": "{done} / {total}",
  "steps.account.title": "アカウントを作成",
  "steps.account.text": "{date}に登録しました。",
  "steps.email.title": "メールアドレスを認証",
  "steps.email.verified": "{email} は認証済みです。",
  "steps.email.confirm": "お送りしたコードで {email} を確認してください。",
  "steps.kyc.title": "本人確認",
  "steps.kyc.verified": "本人確認が完了しました。出金が可能になりました。",
  "steps.kyc.moreInfo": "追加の書類が1点必要です。",
  "steps.kyc.review": "書類は本人確認チームが審査中です。",
  "steps.kyc.draft": "中断したところから再開できます。所要時間は約3分です。",
  "steps.kyc.rejected": "書類を確認できませんでした。もう一度やり直すことができます。",
  "steps.kyc.todo": "所要時間は約3分です。出金が可能になります。",
  "steps.accountOpen.title": "取引口座を開設",
  "steps.accountOpen.opened": { other: "リアル口座{live}件、デモ口座{demo}件を開設済みです。" },
  "steps.accountOpen.todo": "リアル口座またはデモ口座を開設してください。ログインIDはすぐに発行されます。",
  "steps.wallet.title": "ウォレットに入金",
  "steps.wallet.text": "TRC20でのUSDT入金は現在接続中です。",
  // Step status chips
  "steps.state.done": "完了",
  "steps.state.todo": "未完了",
  "steps.state.review": "審査中",
  "steps.state.rejected": "却下",
  "steps.state.soon": "未開始",

  // Trading accounts card. <b> wraps the equity amount
  "accounts.title": "取引口座",
  "accounts.summary": "リアル有効証拠金 <b>{equity}</b> · リアル{live}件 · デモ{demo}件 · 保有ポジション{positions}件",
  "accounts.subtitle": "リアル口座とデモ口座",
  "accounts.all": "すべての口座",
  "accounts.open": "口座開設",
  "accounts.unavailable": "現在、取引口座をご利用いただけません。残高は安全に保管されています。",
  "accounts.openLive.title": "リアル口座を開設",
  "accounts.openLive.text": "実際の市場で取引。残高ゼロから開始し、ウォレットから入金できます。",
  "accounts.openDemo.title": "デモ口座を開設",
  "accounts.openDemo.text": "リアルタイム価格で仮想資金を使用。毎日補充できます。",
  "accounts.more": { other: "他{count}口座" },
  "accounts.myTitle": "マイ取引口座",

  // Your account card
  "account.title": "お客様のアカウント",
  "account.clientId": "顧客ID",
  "account.emailStatus": "メール認証状況",
  "account.notVerified": "未認証",
  "account.identity": "本人確認",
  "account.memberSince": "登録日",
  "account.profile": "プロフィール",

  // Kalks Trader banner
  "trader.chip": "リアルタイム価格",
  "trader.text": "FX、貴金属、株価指数、エネルギー、暗号資産、株式の{count}銘柄のリアルタイムレートとチャート。ブラウザで動作し、インストールは不要です。",

  // Market clock / heatmap
  "sessions.title": "マーケットクロック",
  "sessions.open": "{total}市場中{open}市場がオープン",
  "heatmap.title": "マーケットヒートマップ",
  "heatmap.subtitle": "リアルタイム価格による本日の値動き · 白抜きの点：市場クローズ",
  "heatmap.up": "上昇 {count}",
  "heatmap.down": "下落 {count}",
  "heatmap.allMarkets": "すべての市場",
  "heatmap.tipOpen": "{symbol} · 市場オープン",
  "heatmap.tipClosed": "{symbol} · 市場クローズ、前回セッションの値動き",

  // Support card. <mail> wraps the support email address
  "support.title": "お困りですか？",
  "support.text": "ご登録のメールアドレスから <mail>{email}</mail> まで、顧客IDを添えてご連絡ください。",
  "support.emailSupport": "メールでサポートに連絡",
  "support.copied": "メールアドレスをコピーしました",
  "support.copyFailed": "コピーできませんでした。アドレスを選択してください",

  // Demo dashboard: onboarding strip
  "onboarding.title": "アカウントの設定を完了してください",
  "onboarding.text": "本人確認を完了すると、出金とより高い上限が利用可能になります。",
  "onboarding.progress": "進捗",
  "onboarding.dismiss": "閉じる",

  // Margin health
  "margin.title": "証拠金の状態",
  "margin.subtitle": "すべてのリアル口座",
  "margin.healthy": "良好",
  "margin.level": "証拠金維持率",
  "margin.used": "必要証拠金",
  "margin.free": "余剰証拠金",

  // Equity / P&L. {range} = 1W, 1M, 3M, YTD, 1Y, ALL (keep as-is)
  "equity.title": "有効証拠金合計",
  "equity.changeOver": "{range}の変動",
  "pnl.title": "損益 · 月間",
  "pnl.lowRisk": "低リスク",
  "pnl.winRate": "勝率 (30日)",
  "pnl.trades": "取引数 (30日)",
  "pnl.avgWin": "平均利益",
  "pnl.avgLoss": "平均損失",
  "pnl.charges": "支払手数料",

  // KPI cards
  "kpi.wallet": "ウォレット",
  "kpi.today": "本日 +{pct}%",
  "kpi.monthPnl": "月間損益",
  "kpi.vsLastMonth": "前月比 +{pct}%",
  "kpi.partnerEarnings": "パートナー収益",
  "kpi.copy": "コピー {amount}",

  // Top movers
  "movers.title": "値動きランキング",
  "movers.gainers": "値上がり",
  "movers.losers": "値下がり",

  // Economic calendar. A = Actual, F = Forecast, P = Previous
  "calendar.title": "経済指標カレンダー",
  "calendar.subtitle": "本日 · サーバー時間 GMT+3",
  "calendar.actual": "結果 {value} · ",
  "calendar.forecastPrevious": "予想 {forecast} · 前回 {previous}",

  // News / world
  "news.title": "マーケットニュース",
  "news.all": "すべてのニュース",
  "news.pinned": "固定",
  "world.title": "世界の市場とニュース",
  "world.subtitle": "国別のリアルタイムヘッドラインと通貨センチメント",
  "world.stories": { other: "本日のニュース {count}件" },

  // Open positions
  "positions.title": "保有ポジション",
  "positions.summary": { other: "{count}ポジション · 含み損益" },
  "positions.terminal": "ターミナル",

  // Partner banner. <link> wraps the referral link
  "partner.chip": "パートナープログラム",
  "partner.title": "トレーダーを紹介して、1ロットあたり最大$15を生涯獲得。",
  "partner.text": "多階層コミッション、CPAボーナス、リアルタイムのトラッキング。お客様のリンク：<link>{url}</link>",
  "partner.open": "パートナーダッシュボードを開く",

  // Short relative times (m = minutes, h = hours, d = days)
  "time.justNow": "たった今",
  "time.minutesAgo": "{count}分前",
  "time.hoursAgo": "{count}時間前",
  "time.daysAgo": "{count}日前",
  "time.ago": "{time}前",

  // Notifications bell / panel
  "notifications.title": "通知",
  "notifications.ariaUnread": "通知、未読{count}件",
  "notifications.markAll": "すべて既読にする",
  "notifications.clear": "クリア",
  "notifications.emptyTitle": "通知はまだありません",
  "notifications.emptyText": "入金、出金、本人確認、取引アラート、サポートからの返信がここに表示されます。",
  "notifications.settings": "通知設定",

  // Client Area redesign: side menu, dashboard overview
  "chrome.expand": "メニューを展開",
  "chrome.collapse": "メニューを折りたたむ",
  "chrome.menu": "メニュー",
  "home.todayPnl": "本日の損益",
  "home.walletBalance": "ウォレット残高",
  "home.rewardsEarnings": "リワードとIB報酬",
  "home.todayPct": "本日 {pct}%",
  "home.floating": "含み損益",
  "home.rewards": "リワード",
  "home.accountsChip": "リアル{live}口座 · 保有ポジション{positions}件",
  "home.statistics": "統計",
  "home.pnl": "損益",
  "home.weekly": "週間",
  "home.monthly": "月間",
  "home.lastYear": "過去1年",
  "home.noHistory": "リアル口座で取引が始まると、ここに資産推移が表示されます。",
  "home.thisPeriod": "今期",
  "home.previousPeriod": "前期",
  "home.yourAccounts": "あなたの口座",
  "home.tradingAccount": "取引口座",
  "home.accountInfo": "口座情報",
  "home.accountName": "口座名",
  "home.leverage": "レバレッジ",
  "home.previous": "前の口座",
  "home.next": "次の口座",
  "home.showBalances": "残高を表示",
  "home.hideBalances": "残高を隠す",
  "home.trade": "取引する",
  "home.history": "履歴",
  "home.funding": "入金",
  "home.linked": "連携",
  "home.connected": "接続済み",
  "home.subscriptions": { other: "有効なサブスクリプション{count}件" },
  "home.points": "{points}ポイント",
  "home.redeem": "交換する",
  "home.networkUnavailable": "一時停止中",
  "home.totalBalance": "総残高",
  "home.totalBalanceSub": "リアル口座とウォレット",
  "home.transferFunds": "資金を振替",
  "home.quickActions": "クイック操作",
  "home.later": "後で",
  "home.viewDetails": "詳細を見る",
  "home.verifyNow": "今すぐ本人確認",
  "home.fundTitle": "ウォレットに入金",
  "home.fundText": "USDTを入金してリアル口座で取引を始めましょう。",
  "home.depositNow": "今すぐ入金",
  "home.tradingTitle": "取引",
  "home.marketsTitle": "マーケット",
  "home.moreTitle": "おすすめ",
};
export default dashboard;
