import type { NsMessages } from "../../core";

// Kalks Trader left panels: Market Watch (quotes list), segment chips and Navigator.
const market: NsMessages<"market"> = {
  // Market Watch header and tabs
  title: "気配値表示",
  collapse: "折りたたむ",
  "tab.symbols": "銘柄",
  "tab.details": "詳細",
  "tab.favourites": "お気に入り",
  segmentAria: "気配値表示のセグメント",
  searchPlaceholder: "銘柄を検索",
  searchAria: "気配値表示を検索",
  clear: "クリア",

  // Market Watch columns (shown uppercase)
  "col.symbol": "銘柄",
  "col.bid": "Bid",
  "col.ask": "Ask",
  "col.spread": "Sp",
  "col.spreadTitle": "スプレッド（ポイント）",
  "col.change": "変動%",

  // Row / hover card
  "row.title": "{name} · スプレッド {spread}",
  "tip.low": "安",
  "tip.high": "高",
  "tip.spread": "Sp",
  "tip.range": "幅",
  bid: "Bid",
  ask: "Ask",

  // Empty states and footer
  "empty.favourites": "お気に入りはまだありません。銘柄を右クリックして追加してください。",
  "empty.favouritesTitle": "お気に入りはまだありません",
  "empty.noMatch": "一致する銘柄はありません。",
  "footer.count": "{shown} / {total} 銘柄",
  "footer.hint": "ダブルクリック：チャート",

  // Context menu
  "menu.newOrder": "新規注文",
  "menu.chartWindow": "チャートウィンドウ",
  "menu.openInActive": "アクティブなチャートで開く",
  "menu.depth": "板情報",
  "menu.specification": "仕様",
  "menu.removeFavourite": "お気に入りから削除",
  "menu.addFavourite": "お気に入りに追加",
  "menu.hide": "非表示",
  "menu.showAll": "すべて表示",

  // Toasts
  "toast.hidden": "{symbol}を気配値表示から非表示にしました",
  "toast.hiddenDesc": "コンテキストメニューからすべての銘柄を表示できます。",
  "toast.opened": "{symbol}をアクティブなチャートで開きました",

  // Segment chips (asset classes)
  "segment.favourites": "お気に入り",
  "segment.forex": "FX",
  "segment.metals": "貴金属",
  "segment.indices": "株価指数",
  "segment.energies": "エネルギー",
  "segment.crypto": "暗号資産",
  "segment.stocks": "株式",
  "segment.aria": "資産クラス",
  "segment.title": { other: "{label} · {count}銘柄" },

  // Navigator tree
  "nav.title": "ナビゲーター",
  "nav.indicators": "インディケータ",
  "nav.strategies": "ストラテジー",
  "nav.scripts": "スクリプト",
  "nav.guest": "ゲスト",
  "nav.noAccount": "取引口座はまだありません",
  "nav.openAccount": "口座開設",
  "nav.openAccountTitle": "Kalksアカウントを作成（クライアントエリアが開きます）",
  "nav.signIn": "ログイン",
  "nav.signInTitle": "クライアントエリアにログイン",
  "nav.accountType.live": "リアル",
  "nav.accountType.demo": "デモ",
  "nav.category.trend": "トレンド",
  "nav.category.oscillators": "オシレーター",
  "nav.category.volatility": "ボラティリティ",
  "nav.category.volume": "ボリューム",
  "nav.category.billWilliams": "ビル・ウィリアムズ",
  "nav.indicatorTitle": "{description} · ダブルクリックまたはEnterで{symbol}, {tf}に適用",
  "nav.strategyTitle": { other: "{server} · {login} · {count}取引" },
  "nav.strategyRunning": "{name}はすでに稼働中です",
  "nav.strategyAttached": "{name}を適用しました",
  "nav.strategyDesc": "{login} · {server} · 本日の損益 {pnl}",
  "nav.script.closeAll": "全ポジションを決済",
  "nav.script.closeProfitable": "利益のポジションを決済",
  "nav.script.closeLosing": "損失のポジションを決済",
  "nav.script.deletePendings": "待機注文をすべて削除",
  "nav.script.breakevenAll": "すべて建値に (SL → エントリー)",
  "nav.scriptTitle": "ダブルクリックで現在の口座で実行",
  "nav.scriptsReadOnly": "閲覧専用モードではスクリプトは無効です",
};
export default market;
