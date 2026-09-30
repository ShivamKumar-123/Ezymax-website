import type { NsMessages } from "../../core";

// Kalks mobile app: Markets tab (watchlist). Segment names, Bid / Ask and search reuse the `market` namespace.
const mobileMarkets: NsMessages<"mobileMarkets"> = {
  eyebrow: "Prix en direct",
  "empty.favourites.title": "Aucun favori",
  "empty.favourites.body": "Appuyez longuement sur un symbole pour l'épingler ici.",
  "empty.favourites.action": "Parcourir le forex",
  "fav.added": "{symbol} ajouté aux favoris",
  "fav.removed": "{symbol} retiré des favoris",
  "a11y.row": "{symbol}, {name}. Ouvre le graphique ; appuyez longuement pour ajouter ou retirer un favori.",
  "a11y.search": "Rechercher des symboles",
  cancel: "Annuler",
  "status.connecting": "Connexion aux prix…",
  "status.offline": "Prix en pause : pas de connexion",
};
export default mobileMarkets;
