import type { NsMessages } from "../../core";

// Kalks mobile app: Markets tab (watchlist). Segment names, Bid / Ask and search reuse the `market` namespace.
const mobileMarkets: NsMessages<"mobileMarkets"> = {
  eyebrow: "Live-Kurse",
  "empty.favourites.title": "Noch keine Favoriten",
  "empty.favourites.body": "Halten Sie ein Symbol gedrückt, um es hier anzuheften.",
  "empty.favourites.action": "Forex ansehen",
  "fav.added": "{symbol} zu Favoriten hinzugefügt",
  "fav.removed": "{symbol} aus Favoriten entfernt",
  "a11y.row": "{symbol}, {name}. Öffnet den Chart; gedrückt halten, um einen Favoriten hinzuzufügen oder zu entfernen.",
  "a11y.search": "Symbole suchen",
  cancel: "Abbrechen",
  "status.connecting": "Verbindung zum Kursfeed…",
  "status.offline": "Kurse pausiert: keine Verbindung",
};
export default mobileMarkets;
