import type { NsMessages } from "../../core";

// Kalks mobile app: Markets tab (watchlist). Segment names, Bid / Ask and search reuse the `market` namespace.
const mobileMarkets: NsMessages<"mobileMarkets"> = {
  eyebrow: "リアルタイム価格",
  "empty.favourites.title": "お気に入りはまだありません",
  "empty.favourites.body": "銘柄を長押しすると、ここに固定されます。",
  "empty.favourites.action": "FXを見る",
  "fav.added": "{symbol}をお気に入りに追加しました",
  "fav.removed": "{symbol}をお気に入りから削除しました",
  "a11y.row": "{symbol}、{name}。チャートを開きます。長押しでお気に入りに追加または削除します。",
  "a11y.search": "銘柄を検索",
  cancel: "キャンセル",
  "status.connecting": "価格に接続中…",
  "status.offline": "価格を一時停止中：接続なし",
};
export default mobileMarkets;
