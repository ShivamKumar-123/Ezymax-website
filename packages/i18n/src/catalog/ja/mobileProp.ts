import type { NsMessages } from "../../core";

// Kalks mobile app: Prop (challenge catalogue and checkout, live rule dashboard, payouts, certificates).
// Kalks, Kalks Prop, Kalks Trader, Kalks-Live, USDT and 17:00 stay as they are.
// Titles marked "display" are shown in tall display type: keep them short.
const mobileProp: NsMessages<"mobileProp"> = {
  // Prop home
  "home.eyebrow": "Kalks Prop",
  "home.title": "資金を獲得", // display
  "home.subtitle": "チャレンジに合格してファンデッド口座を獲得し、利益の最大{split}%を受け取りましょう。プロップ口座はすべてシミュレーション口座です。",
  "home.subtitleNoSplit": "チャレンジに合格してファンデッド口座を獲得し、利益の一部を受け取りましょう。プロップ口座はすべてシミュレーション口座です。",
  "home.payouts": "報酬出金",
  "home.payoutsReady": "{amount} 出金可能",
  "home.payoutsNone": "出金可能額なし",
  "home.certificates": "証明書",
  "home.certCount": { other: "{count}件獲得" },
  "home.mine": "マイチャレンジ",
  "home.past": "過去のチャレンジ",
  "home.showAll": "{count}件すべて表示",
  "home.yourCertificates": "あなたの証明書",
  "home.plans": "チャレンジを選択",
  "home.newChallenge": "新しいチャレンジを開始",
  "home.emptyTitle": "提供中のチャレンジなし", // display
  "home.emptyBody": "新しいチャレンジプランを準備中です。しばらくしてから再度ご確認ください。",
  "home.mineError": "マイチャレンジを読み込めませんでした。",
  "home.plansError": "チャレンジプランを読み込めませんでした。",

  // How it works (numbered 01–04 on the Prop home)
  "how.title": "仕組み",
  "how.1.title": "プランを選ぶ",
  "how.1.body": "モデルと口座サイズを選択します。料金はUSDTウォレットから1回だけ支払われます。",
  "how.2.title": "目標を達成",
  "how.2.body": "1日の損失上限とドローダウン上限を守りながら、最低取引日数以上をかけて利益目標を達成します。",
  "how.3.title": "ファンデッド口座へ",
  "how.3.body": "合格するとファンデッド口座が自動的に開設され、共有できる証明書が発行されます。",
  "how.4.title": "報酬を受け取る",
  "how.4.body": "出金サイクルごとに、利益の取り分をUSDTウォレットへ出金リクエストできます。",
  "how.enforce": "制限はサーバー上で毎秒、有効証拠金で確認されます。1日の損失上限の50%、75%、90%で警告が届き、違反するとすべてのポジションが決済されてチャレンジは終了します。",

  // Plan models
  "type.oneStep": "1ステップ",
  "type.twoStep": "2ステップ",
  "type.instant": "インスタント",
  "typeText.oneStep": "評価フェーズは1回。目標を達成し、制限を守れば、ファンデッド口座を獲得できます。",
  "typeText.twoStep": "目標が低く制限が緩やかな、2回の評価フェーズ。",
  "typeText.instant": "評価なし。より厳しい制限のもと、すぐにファンデッド口座で取引を開始できます。",

  // Plan card
  "plan.refundable": "料金返金あり",
  "plan.fee": "料金",
  "plan.account": "口座",
  "plan.leverage": "レバレッジ1:{n}",
  "plan.target": "目標",
  "plan.dailyLoss": "1日の損失",
  "plan.maxDD": "最大ドローダウン",
  "plan.static": "固定",
  "plan.trailing": "トレーリング",
  "plan.start": "開始 · {fee}",

  // Checkout
  "checkout.eyebrow": "購入手続き",
  "checkout.fee": "1回限りの料金",
  "checkout.chargedRefund": "USDTウォレットから支払われます。初回報酬出金時に返金されます。",
  "checkout.chargedNoRefund": "USDTウォレットから支払われます。返金はできません。",
  "checkout.walletBalance": "ウォレット残高：{balance} USDT",
  "checkout.shortTitle": "ウォレット残高が料金に足りません",
  "checkout.short": "ウォレット残高は{balance} USDTです。このチャレンジを購入するには、あと{missing} USDTを入金してください。",
  "checkout.rules": "ルール",
  "checkout.limitsNote": "制限は初期残高に対する割合です。1日の損失上限または最大ドローダウンに違反すると口座は不合格となり、すべてのポジションが成行で決済されます。取引日はニューヨーク時間17:00にリセットされます。",
  "checkout.agree": "ルールを読み、口座がシミュレーションであること、損失上限に違反すると自動的に不合格となることを理解しました。",
  "checkout.pay": "{fee}を支払う",
  "checkout.retry": "再試行 · {fee}",
  "checkout.paying": "支払い中…",
  "checkout.goToMine": "マイチャレンジを見る",
  "checkout.readyTitle": "準備完了", // display
  "checkout.readyBody": "USDTウォレットから{fee}が支払われ、{size}の{phase}口座が開設されました。ルールは今から適用されます。",
  "checkout.savePasswords": "これらのパスワードを今すぐ保存してください。表示されるのは一度だけで、当社では保存していません。パスワードがなくても、アプリからいつでもこの口座で取引できます。",
  "checkout.passwordsShown": "取引パスワードは、この購入が最初に確定した際に表示されました。パスワードがなくても、アプリからこの口座で取引できます。",
  "checkout.viewChallenge": "チャレンジを表示",
  "checkout.readOnly": "このセッションではチャレンジを購入できません。",

  // Account credentials
  "cred.login": "ログインID",
  "cred.server": "サーバー",
  "cred.password": "取引パスワード",
  "cred.investorPassword": "投資家パスワード（閲覧専用）",
  "cred.show": "パスワードを表示",
  "cred.hide": "パスワードを非表示",
  copied: "{what}をコピーしました",
  "a11y.copy": "{what}をコピー",

  // Challenge statuses
  "status.pendingPayment": "支払い待ち",
  "status.provisioning": "口座開設中",
  "status.active": "有効",
  "status.funded": "ファンデッド",
  "status.failed": "不合格",
  "status.closed": "終了",
  "status.paymentFailed": "支払い失敗",
  // {phase} is the phase name from the plan, e.g. "Phase 2"
  "stage.active": "{phase} · 有効",
  "stage.failed": "{phase} · 不合格",
  "phaseStatus.provisioning": "開設中",
  "phaseStatus.active": "取引中",
  "phaseStatus.passed": "合格",
  "phaseStatus.failed": "不合格",
  "phaseStatus.closed": "終了",

  // Challenge cards (Prop home)
  "card.target": "利益目標",
  "card.profit": "利益",
  "card.equity": "有効証拠金 {amount}",
  "card.dailyLeft": "本日の損失余力 {amount}",
  "card.opening": "取引口座を開設中です。数秒で完了します。",

  // Dashboard
  "dash.equity": "有効証拠金",
  "dash.balance": "残高",
  "dash.floating": "含み損益",
  "dash.open": "保有",
  "dash.sinceStart": "フェーズ開始以降",
  "dash.rules": "ルール",
  "dash.rulesTitle": "このチャレンジのルール",
  "dash.notFound": "チャレンジが見つかりません", // display
  "dash.notFoundBody": "別のログインで開設された可能性があります。",
  "dash.backToProp": "プロップに戻る",
  "live.live": "ライブ",
  "live.connecting": "接続中…",
  "live.offline": "オフライン",
  // {time}: date and time of the last rule check
  "live.updated": "{time}に確認",
  // {time}: when the phase ended
  "live.final": "確定 · {time}",

  // Rule names (gauges, the rule log)
  "rule.dailyLoss": "1日の損失",
  "rule.maxDrawdown": "最大ドローダウン",
  "rule.profitTarget": "利益目標",
  "rule.tradingDays": "取引日数",
  "rule.timeLimit": "期間制限",
  "rule.weekendHolding": "週末の持ち越し",
  "rule.newsWindow": "指標発表時間帯",
  "rule.bannedStrategy": "禁止戦略",
  "rule.consistency": "一貫性",
  "rule.riskDesk": "リスク管理部門の判断",
  "ruleState.ok": "進行中",
  "ruleState.passed": "達成",
  "ruleState.failed": "違反",
  "ruleState.off": "オフ",

  // Gauges
  "target.ofTarget": "目標に対して",
  "target.of": "目標 {amount}（{pct}%）",
  "target.left": "残り{amount}",
  "target.reachedBy": "達成、{amount}超過",
  "limit.left": "残り{amount}",
  "limit.breachAt": "違反水準 {amount}",
  days: { other: "{count}日" },
  "days.of": "{v} / {min}",
  "days.count": { other: "{count}日" },
  "days.met": "最低日数を達成",
  "days.toGo": { other: "あと{count}日" },
  "days.noMinimum": "最低日数なし",
  "time.left": "残り{d}日{h}時間",
  "time.deadline": "{date}に終了",
  "consistency.rule": "最も利益の大きい日 ≤ 利益の{pct}%",
  "consistency.noProfit": "まだ利益はありません",
  "reset.title": "1日の損失のリセットまで",
  "reset.note": "取引日ごと、ニューヨーク時間17:00",

  // Funded account: payout window ring
  "payoutHero.title": "次回の報酬出金",
  "payoutHero.share": "現在までの取り分",
  "payoutHero.open": "受付中", // display
  "payoutHero.ready": "出金可能", // display
  "payoutHero.days": { other: "{count}日" }, // display
  "payoutHero.eligible": "分配率{split}%で現在出金可能です。",
  "payoutHero.opens": "出金期間は{date}から始まります。",
  "payoutHero.later": "対象となる利益が発生したら、報酬出金をリクエストしてください。",

  // Big states
  "hero.opening.title": "口座を開設中", // display
  "hero.opening.body": "お支払いが確認され、取引口座を準備しています。このページは自動的に更新されます。",
  "hero.closed.title": "チャレンジ終了", // display
  "hero.closed.body": "このチャレンジの取引口座を開設できなかったため、チャレンジは終了し、料金はUSDTウォレットに返金されました。ご不明な点はサポートにお問い合わせください。",
  // {reason} is the prop service's reason, in English
  "hero.closed.reason": "{reason}。料金はUSDTウォレットに返金されました。",
  "hero.failed.title": "{phase}不合格", // display
  "hero.failed.on": "{date}に終了",
  // {reason} is the breach reason from the risk engine
  "hero.failed.body": "{reason}。すべてのポジションが決済され、口座は無効になりました。",
  "hero.failed.ruleBreached": "ルール違反が発生しました",
  // {rule} is a rule name, e.g. "Daily loss"
  "hero.failed.rule": "{rule}：上限に違反",
  "hero.failed.new": "新しいチャレンジを開始",
  "hero.passed.title": "{phase}合格", // display
  "hero.passed.on": "{date}に合格。",
  "hero.passed.next": "{phase}の口座が開設されました。",
  "hero.passed.nextLogin": "{phase}の口座が開設されました（#{login}）。",
  "hero.passed.opening": "次の口座を開設中です。",
  "hero.passed.certificate": "証明書を表示",
  "hero.passed.goNext": "{phase}へ進む",
  "hero.funded.title": "ファンデッド", // display
  "hero.funded.body": "ファンデッド口座で取引し、利益の{split}%を報酬として受け取りましょう。",
  "hero.funded.certificate": "ファンデッド証明書を表示",

  // Warnings while trading
  "warn.lossUsed": "本日の損失上限の{pct}%を使用",
  "warn.lossUsedBody": "有効証拠金が{floor}以下になると口座は不合格となり、すべてのポジションが決済されます。本日の残り：{left}。",
  "warn.weekend": "週末の決済",
  "warn.weekendBody": "このプランでは週末の持ち越しができません。保有ポジションはニューヨーク時間金曜16:45に決済されます。",

  // Actions
  "action.openTrade": "取引画面で開く",
  "action.trade": "取引",
  "action.tradeBlocked": "取引できるのは、有効なチャレンジの取引中の口座のみです。",
  "action.payouts": "報酬出金",
  "action.support": "サポートに問い合わせ",

  // Equity chart
  "chart.title": "有効証拠金の推移",
  "chart.start": "開始",
  "chart.target": "目標",
  "chart.ddFloor": "最大ドローダウン",
  "chart.dailyFloor": "1日の損失",
  "chart.now": "現在",
  "chart.empty": "有効証拠金の推移は、取引開始から数分後に表示されます。",

  // Trading stats
  "stats.title": "取引統計",
  "stats.trades": "取引数",
  "stats.winRate": "勝率",
  "stats.profitFactor": "プロフィットファクター",
  "stats.avgWin": "平均利益",
  "stats.avgLoss": "平均損失",
  "stats.lots": "ロット",
  "stats.bestDay": "最も利益の大きい日 {date}：{amount}",

  // Rule log
  "events.title": "ルールログ",
  "events.empty": "警告や違反はありません。この調子で続けましょう。",
  "events.equity": "有効証拠金 {amount}",
  "events.limit": "上限 {amount}",
  "severity.breach": "違反",
  "severity.violation": "規約違反",
  "severity.warning": "警告",
  "severity.info": "情報",

  // Closed trades
  "trades.title": "決済済み取引",
  "trades.all": "すべて {count}",
  "trades.count": { other: "決済済み取引{count}件" },
  "trades.empty": "決済済みの取引はまだありません。",
  "trades.buy": "買い",
  "trades.sell": "売り",
  // compact durations
  "duration.s": "{s}秒",
  "duration.ms": "{m}分{s}秒",
  "duration.hm": "{h}時間{m}分",
  "duration.dh": "{d}日{h}時間",

  // Account details
  "account.title": "口座",
  "account.split": "あなたの分配率",
  "account.initial": "初期残高",
  "account.started": "フェーズ開始日",
  "account.ended": "終了日",
  "account.deadline": "期限",
  "account.passwordNote": "取引パスワードは購入時に一度だけ表示されました。「取引画面で開く」を使えば、パスワードなしでこの口座にログインできます。",

  // Payouts
  "payouts.title": "報酬出金", // display
  "payouts.available": "現在出金可能",
  "payouts.eligibleCount": { other: "ファンデッド口座{count}件中{eligible}件が対象" },
  "payouts.requests": { other: "{count}件のリクエスト" },
  "payouts.count": { other: "{count}件の報酬出金" },
  "payouts.paidToDate": "これまでの支払額",
  "payouts.funded": "ファンデッド口座",
  "payouts.account": "{size}ファンデッド", // display
  "payouts.quote": "出金見積もり",
  "payouts.eligibleNow": "出金可能",
  "payouts.notYet": "まだ出金できません",
  "payouts.toWallet": "ウォレットへ",
  "payouts.yourSplit": "あなたの分配率",
  "payouts.firmShare": "当社の取り分",
  "payouts.alreadyRefunded": "返金済み",
  "payouts.withFirst": "初回出金時",
  "payouts.opens": "{date}から可能。",
  "payouts.minimum": "最低{amount}。",
  "payouts.kycNote": "この報酬出金をリクエストするには本人確認を行ってください。",
  "payouts.kycPendingNote": "本人確認が承認されると、この報酬出金をリクエストできます。",
  "payouts.readOnly": "このセッションでは報酬出金をリクエストできません。",
  "payouts.request": "報酬出金をリクエスト",
  // opens the account's live rule dashboard; short: it shares a row with Trade
  "payouts.dashboard": "ルール",
  "payouts.history": "履歴",
  "payouts.historyEmpty": "報酬出金はまだありません。",
  "payouts.emptyTitle": "ファンデッド口座なし", // display
  "payouts.emptyBody": "チャレンジに合格するとファンデッド口座を獲得できます。対象となる利益が発生したら、ここから報酬出金をリクエストできます。",
  "payouts.emptyAction": "資金を獲得",
  "payoutStatus.pending": "審査中",
  "payoutStatus.approved": "承認済み",
  "payoutStatus.paid": "支払い済み",
  "payoutStatus.rejected": "却下",
  "payoutStatus.failed": "失敗",
  "split.title": "利益分配とスケーリング",
  "split.upTo": "スケーリングで最大{pct}%",
  "split.cycle": "報酬出金",
  // {days} e.g. "14 days"
  "split.first": "初回は{days}後",
  "split.firstNow": "初日から",
  // {months} e.g. "4 months"; {cap} e.g. "$2,000,000"
  "scaling.text": "{months}で{profit}%の利益を上げると、口座サイズが{increase}%増加します（上限{cap}）。",
  "scaling.none": "このプランには口座のスケーリングはありません。",
  months: { other: "{count}か月" },

  // Payout request sheet
  "request.eyebrow": "報酬出金をリクエスト",
  "request.profit": "口座の利益",
  "request.share": "あなたの取り分（{pct}%）",
  "request.feeRefund": "チャレンジ料金の返金",
  "request.total": "ウォレットへの入金合計",
  "request.note": "審査中に取引で失われることのないよう、現在の利益の全額が今すぐ取引口座から差し引かれます。承認されるとあなたの取り分がUSDTウォレットに入金され、却下された場合は利益が口座に戻されます。",
  "request.submit": "{amount}をリクエスト",
  "request.done": "報酬出金をリクエストしました",
  "request.doneBody": "承認されると、{amount}がUSDTウォレットに入金されます。",

  // Identity verification (payouts)
  "kyc.verified": "本人確認済み：報酬出金の承認が可能です。",
  "kyc.pendingTitle": "本人確認の審査中",
  "kyc.pendingText": "本人確認を審査中です。本人確認の完了後に報酬出金をリクエストできます。",
  "kyc.requiredTitle": "本人確認を行ってください",
  "kyc.requiredText": "報酬は本人確認済みのトレーダーにのみ支払われます。初回の報酬出金の前に本人確認を完了してください。",
  "kyc.rejectedText": "本人確認が却下されました。報酬を受け取るには、再度提出してください。",

  // Why a payout can't be requested yet
  "blocker.notYetEligible": "出金期間はまだ始まっていません。",
  "blocker.belowMinimum": "利益が最低出金額に達していません。",
  "blocker.positionsOpen": "報酬出金をリクエストするには、すべての保有ポジションを決済してください。",
  "blocker.payoutPending": "報酬出金はすでに審査中です。",
  "blocker.consistency": "一貫性ルール未達：最も利益の大きい日が利益全体に占める割合が大きすぎます。",

  // Certificates
  "certs.title": "証明書", // display
  "certs.subtitle": "合格したフェーズ、ファンデッド口座、報酬出金ごとに、誰でも検証できる証明書が発行されます。",
  "certs.kind.pass": "フェーズ合格",
  "certs.kind.funded": "ファンデッドトレーダー",
  "certs.kind.payout": "報酬出金",
  "certs.revoked": "取り消し済み",
  "certs.revokedBody": "この証明書はKalksにより取り消され、現在は無効のため共有できません。",
  "certs.meta": "{plan} · {size} · {date}",
  "certs.number": "No. {code}",
  "certs.shareImage": "画像を共有",
  "certs.shareLink": "リンクを共有",
  "certs.copyLink": "リンクをコピー",
  "certs.linkCopied": "検証リンクをコピーしました",
  "certs.shareTitle": "私のKalks Prop証明書",
  "certs.shareMessage": "私のKalks Prop証明書です。こちらで検証できます：",
  "certs.shareFailed": "証明書を共有できませんでした。もう一度お試しください。",
  "certs.shareUnavailable": "このデバイスでは共有をご利用いただけません。",
  "certs.emptyTitle": "証明書はまだありません", // display
  "certs.emptyBody": "チャレンジのフェーズに合格すると、最初の証明書を獲得できます。誰でも検証できる公開リンク付きです。",
  "certs.emptyAction": "チャレンジを見る",

  // Rule words shared by the checkout and the rules sheet
  accountSize: "口座サイズ",
  profitSplit: "利益分配率",
  feeRefund: "料金の返金",
  nonRefundable: "返金不可",
  leverage: "レバレッジ",
  none: "なし",
  allowed: "可",
  notAllowed: "不可",
  noTimeLimit: "期間制限なし",
  // {phase} is the phase name, e.g. "Phase 1"
  "rules.phaseTarget": "{phase}の目標",
  "rules.phaseMinDays": "{phase}の最低日数",
  "rules.phaseTimeLimit": "{phase}の期間制限",
  "rules.evaluation": "評価",
  "rules.evaluationNone": "なし、初日からファンデッド",
  "rules.dailyLoss": "1日の損失上限",
  "rules.dailyLossBalance": "{pct}% · {amount} · ニューヨーク時間17:00の残高を基準",
  "rules.dailyLossEquity": "{pct}% · {amount} · ニューヨーク時間17:00の残高と有効証拠金の高い方を基準",
  "rules.ddStatic": "{pct}% 固定",
  "rules.ddTrailing": "{pct}% トレーリング",
  "rules.ddLocks": "{dd}、開始時の水準で固定",
  // ≤ = at most
  "rules.consistencyValue": "最も利益の大きい日 ≤ 総利益の{pct}%",
  "rules.news": "指標発表時の取引",
  "rules.newsBlocked": "重要指標発表の前後{min}分間は不可",
  "rules.newsBlockedFails": "重要指標発表の前後{min}分間は不可（違反すると不合格）",
  "rules.weekendClosed": "ニューヨーク時間金曜16:45にポジションを決済",
  "rules.ea": "エキスパートアドバイザ",
  "rules.banned": "禁止戦略",
  "rules.splitScaling": "{split}%、最大{max}%まで引き上げ",
  "rules.firstPayout": "初回報酬出金",
  // {freq} is a lower-case payout cycle, e.g. "weekly"
  "rules.firstPayoutValue": "{days}後、以降は{freq} · 最低{min}",
  "rules.refunded": "初回報酬出金時に返金",

  // Banned trading strategies
  "banned.hft": "高頻度取引",
  "banned.latencyArbitrage": "レイテンシー・アービトラージ",
  "banned.tickScalping": "ティックスキャルピング",
  "banned.crossAccountCopying": "口座間のコピー取引",
  "banned.crossAccountHedging": "口座間の両建て",
  "banned.martingale": "マーチンゲール",
  "banned.grid": "グリッドトレード",

  // Payout cycle: used inside sentences ("then weekly")
  "payoutFreq.weekly": "毎週",
  "payoutFreq.biWeekly": "2週間ごと",
  "payoutFreq.monthly": "毎月",
  "payoutFreq.onDemand": "随時",

  // Errors (messages for the prop service's error codes)
  "errorLink.deposit": "入金",
  "errorLink.verify": "本人確認を行う",
  "error.insufficientFunds": "USDTウォレットの残高がこの料金に足りません。USDTを入金して、もう一度お試しください。",
  "error.kycRequired": "報酬出金をリクエストする前に本人確認を完了してください。",
  "error.paymentPending": "ウォレットでの支払いをまだ確認できていません。1分後にもう一度お試しください。二重に請求されることはありません。",
  "error.paymentFailed": "ウォレットでの支払いが完了しませんでした。料金は請求されていません。",
  "error.walletPending": "ウォレットの確認がまだ完了していません。1分後にもう一度お試しください。",
  "error.walletRejected": "ウォレットがこの支払いを拒否しました。サポートまでお問い合わせください。",
  "error.provisioning": "お支払いを受け付けました。取引口座を開設中です。1分以内にマイチャレンジに表示されます。",
  "error.planUnavailable": "このプランまたは口座サイズは現在ご利用いただけません。別のものをお選びください。",
  "error.notYetEligible": "この口座はまだ報酬出金の対象ではありません。",
  "error.belowMinimum": "利益が最低出金額に達していません。",
  "error.positionsOpen": "報酬出金をリクエストする前に、すべての保有ポジションを決済してください。",
  "error.payoutPending": "この口座の報酬出金はすでに審査中です。",
  "error.consistency": "一貫性ルールをまだ満たしていません。最も利益の大きい日が利益全体に占める割合が大きすぎます。",
  "error.notFunded": "報酬出金はファンデッド口座でのみご利用いただけます。",
  "error.accountUnavailable": "このチャレンジの取引口座を開設できなかったため、料金はUSDTウォレットに返金されました。この問題が続く場合はサポートにお問い合わせください。",
  "error.idempotencyConflict": "この購入手続きはすでに別の購入で使用されています。閉じて、最初からやり直してください。",
  "error.notActive": "このチャレンジは有効ではありません。",
  "error.accountLimit": "プロップ口座の上限数に達しました。上限の引き上げについてはサポートまでお問い合わせください。",
  "error.staffReadOnly": "閲覧専用のスタッフセッションです。変更はできません。",
  "error.engine": "取引サーバーから応答がありませんでした。しばらくしてからもう一度お試しください。",
  "error.generic": "問題が発生しました。もう一度お試しください。",
  "load.title": "プロップを利用できません", // display
  "load.body": "プロップサービスに接続できませんでした。お客様の口座は安全です。しばらくしてからもう一度お試しください。",
};
export default mobileProp;
