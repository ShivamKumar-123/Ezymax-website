import type { NsMessages } from "../../core";

// Kalks mobile app: Markets tab (watchlist). Segment names, Bid / Ask and search reuse the `market` namespace.
const mobileMarkets: NsMessages<"mobileMarkets"> = {
  eyebrow: "Bei za moja kwa moja",
  "empty.favourites.title": "Bado hakuna vipendwa",
  "empty.favourites.body": "Bonyeza na ushikilie alama yoyote ili uibandike hapa.",
  "empty.favourites.action": "Vinjari forex",
  "fav.added": "{symbol} imeongezwa kwenye vipendwa",
  "fav.removed": "{symbol} imeondolewa kwenye vipendwa",
  "a11y.row": "{symbol}, {name}. Hufungua chati; bonyeza na ushikilie ili kuongeza au kuondoa kipendwa.",
  "a11y.search": "Tafuta alama",
  cancel: "Ghairi",
  "status.connecting": "Inaunganisha na bei…",
  "status.offline": "Bei zimesitishwa: hakuna muunganisho",
};
export default mobileMarkets;
