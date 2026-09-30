import type { NsMessages } from "../../core";

// Kalks mobile app: Markets tab (watchlist). Segment names, Bid / Ask and search reuse the `market` namespace.
const mobileMarkets: NsMessages<"mobileMarkets"> = {
  eyebrow: "Canlı fiyatlar",
  "empty.favourites.title": "Henüz favori yok",
  "empty.favourites.body": "Buraya sabitlemek için herhangi bir sembole basılı tutun.",
  "empty.favourites.action": "Forex'e göz at",
  "fav.added": "{symbol} favorilere eklendi",
  "fav.removed": "{symbol} favorilerden kaldırıldı",
  "a11y.row": "{symbol}, {name}. Grafiği açar; favorilere eklemek veya çıkarmak için basılı tutun.",
  "a11y.search": "Sembol ara",
  cancel: "İptal",
  "status.connecting": "Fiyatlara bağlanılıyor…",
  "status.offline": "Fiyatlar duraklatıldı: bağlantı yok",
};
export default mobileMarkets;
