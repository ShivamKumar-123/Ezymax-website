import type { NsMessages } from "../../core";

// Kalks mobile app: Markets tab (watchlist). Segment names, Bid / Ask and search reuse the `market` namespace.
const mobileMarkets: NsMessages<"mobileMarkets"> = {
  eyebrow: "Harga live",
  "empty.favourites.title": "Belum ada favorit",
  "empty.favourites.body": "Tekan lama simbol mana pun untuk menyematkannya di sini.",
  "empty.favourites.action": "Jelajahi forex",
  "fav.added": "{symbol} ditambahkan ke favorit",
  "fav.removed": "{symbol} dihapus dari favorit",
  "a11y.row": "{symbol}, {name}. Membuka grafik; tekan lama untuk menambah atau menghapus favorit.",
  "a11y.search": "Cari simbol",
  cancel: "Batal",
  "status.connecting": "Menghubungkan ke harga…",
  "status.offline": "Harga dijeda: tidak ada koneksi",
};
export default mobileMarkets;
