import type { NsMessages } from "../../core";

// Kalks mobile app: Markets tab (watchlist). Segment names, Bid / Ask and search reuse the `market` namespace.
const mobileMarkets: NsMessages<"mobileMarkets"> = {
  eyebrow: "Harga langsung",
  "empty.favourites.title": "Belum ada kegemaran",
  "empty.favourites.body": "Tekan dan tahan mana-mana simbol untuk menyematkannya di sini.",
  "empty.favourites.action": "Layari forex",
  "fav.added": "{symbol} ditambah ke kegemaran",
  "fav.removed": "{symbol} dialih keluar daripada kegemaran",
  "a11y.row": "{symbol}, {name}. Membuka carta; tekan dan tahan untuk menambah atau mengalih keluar kegemaran.",
  "a11y.search": "Cari simbol",
  cancel: "Batal",
  "status.connecting": "Menyambung ke harga…",
  "status.offline": "Harga dijeda: tiada sambungan",
};
export default mobileMarkets;
