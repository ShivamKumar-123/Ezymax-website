import type { NsMessages } from "../../core";

// Kalks mobile app: Trade tab (chart, Sell / Buy bar, order ticket) and trade notifications.
// Trading terms follow the MetaTrader 5 Japanese localisation (see the `order` namespace).
const mobileTrade: NsMessages<"mobileTrade"> = {
  // Header
  pickSymbol: "銘柄を選択",
  searchSymbol: "銘柄を検索",
  depth: "板情報",
  alert: "価格アラート",
  news: "{symbol}のニュース", // a header button's accessibility label
  calendar: "{currency}の経済指標カレンダー", // a header button's accessibility label
  "account.chip": "{type} · #{login}",
  "account.manage": "口座を管理",
  "account.open": "口座開設",

  // Chart
  "chart.indicators": "インディケータ",
  "chart.type.candles": "ローソク足",
  "chart.type.line": "ライン",
  "ind.ma": "移動平均線 20",
  "ind.ema": "指数移動平均線 50",
  "ind.bb": "ボリンジャーバンド 20, 2",
  "ind.rsi": "RSI 14",
  "chart.noData": "この銘柄のチャート履歴はまだありません",
  "chart.hint": "ピンチで拡大 · ドラッグでスクロール · 長押しで十字カーソル · ダブルタップでリセット",

  // Sell / Buy bar and ticket
  "bar.volume": "ロット",
  "ticket.title": "新規注文",
  "ticket.confirmBuy": "買い {volume} {symbol}",
  "ticket.confirmSell": "売り {volume} {symbol}",
  "ticket.atMarket": "成行",
  "ticket.at": "@ {price}",
  "ticket.addSl": "ストップロスを追加",
  "ticket.addTp": "テイクプロフィットを追加",
  "ticket.ifHit": "到達時 {money}",
  "ticket.required": "証拠金",
  "ticket.pip": "pip値",
  "ticket.after": "注文後の余剰証拠金",
  "ticket.notEnough": "この数量には余剰証拠金が不足しています。",
  "ticket.noSpecs": "契約仕様を読み込み中…",
  "ticket.distance": "現在値から{n} pips",
  "ticket.price": "価格",

  // Rejections: a plain-language line under the reason (order.reject.<code>); the engine's own detail follows it
  "reject.no_money": "余剰証拠金がこの注文に足りません。数量を減らすか、この口座に入金してください。",
  "reject.insufficient_funds": "余剰証拠金がこの注文に足りません。数量を減らすか、この口座に入金してください。",
  "reject.market_closed": "この市場は現在クローズしています。オープン後にもう一度お試しください。",
  "reject.invalid_volume": "この銘柄の上限とロットステップの範囲内で数量を指定してください。",
  "reject.max_lot": "この数量は、お客様の口座の1注文あたりの上限を超えています。",
  "reject.close_only": "現在、この口座ではポジションの決済のみ可能で、新規ポジションは建てられません。",
  "reject.symbol_close_only": "現在、この銘柄は決済のみ可能で、新規注文はできません。",
  "reject.trading_disabled": "この口座では取引が無効になっています。詳しくはサポートまでお問い合わせください。",
  "reject.symbol_halted": "この銘柄の取引は一時停止中です。後ほどもう一度お試しください。",
  "reject.requote.title": "価格が変動しました",
  "reject.requote": "注文の送信中に相場が動きました。新しい価格を確認して、もう一度確定してください。",
  "reject.invalid_sl": "ストップロスが価格の反対側にあるか、価格に近すぎます。",
  "reject.invalid_tp": "テイクプロフィットが価格の反対側にあるか、価格に近すぎます。",
  "reject.invalid_price": "この価格は、この注文タイプでは市場価格の反対側にあります。",
  "reject.off_market": "この価格は市場価格から離れすぎています。値を確認してください。",
  "reject.stale_price": "この銘柄の価格配信が一時的に止まっています。しばらくしてからもう一度お試しください。",
  "reject.no_price": "現在、この銘柄のリアルタイム価格がありません。",
  "reject.read_only": "このログインでは口座を閲覧できますが、取引はできません。",
  "reject.uncertain.title": "取引サーバーから応答がありません",
  "reject.uncertain": "注文が通っている可能性があります。再試行する前にポートフォリオを確認してください。",
  "reject.uncertain.ticket": "もう一度確定しても安全です。同じ注文が二重に発注されることはありません。",

  // States
  "state.noAccount.title": "取引口座はまだありません",
  "state.noAccount.body": "デモ口座で練習するか、リアル口座を開設して実際に取引しましょう。",
  "state.noAccount.action": "口座開設",
  "state.connecting": "取引サーバーに接続中…",
  "state.readOnly": "この口座はここでは閲覧専用です。価格とチャートはリアルタイムですが、取引はできません。",
  "state.marketClosed.title": "市場クローズ",
  "state.marketClosed.body": "{symbol}は次のセッションで再開します。オープン後に注文できます。",
  "state.streamError": "取引サーバーに接続できません",
  "state.streamErrorBody": "ポジションと注文はサーバー上で安全に保たれています。再接続を試み続けています。",

  // Results
  "toast.filled": "{side} {volume} {symbol} 約定",
  "toast.at": "@ {price}",
  "toast.placed": "{symbol}の待機注文を発注しました",
  "toast.duplicate": "#{ticket}として発注済みです",
  "toast.duplicateBody": "この注文はすでにサーバーに届いていました。新たな注文は発注されていません。",
  "toast.closed": "ポジション #{ticket} を決済しました",
  "toast.partial": "#{ticket}を{volume}ロット決済しました",
  "toast.modified": "#{ticket}を更新しました",
  "toast.cancelled": "注文 #{ticket} を取り消しました",

  // Engine notifications while the app is open
  "notify.sl": "ストップロス到達",
  "notify.tp": "テイクプロフィット到達",
  "notify.order_filled": "待機注文が約定しました",
  "notify.order_triggered": "注文が発動しました",
  "notify.margin_call": "マージンコール",
  "notify.stop_out": "ストップアウト",
  "notify.order_rejected": "注文が拒否されました",
  "notify.order_expired": "注文の有効期限が切れました",
  "notify.order_cancelled": "注文が取り消されました",
};
export default mobileTrade;
