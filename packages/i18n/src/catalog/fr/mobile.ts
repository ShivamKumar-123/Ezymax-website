import type { NsMessages } from "../../core";

// Kalks mobile app (apps/mobile): app shell, onboarding and the states every screen shares.
const mobile: NsMessages<"mobile"> = {
  // Tab bar (short: one word each)
  "tab.home": "Accueil",
  "tab.markets": "Marchés",
  "tab.trade": "Trading",
  "tab.portfolio": "Portfolio",
  "tab.more": "Plus",

  // Onboarding (3 slides). Titles are shown in tall uppercase display type: keep them short.
  "onboarding.skip": "Passer",
  "onboarding.next": "Suivant",
  "onboarding.getStarted": "Commencer",
  "onboarding.haveAccount": "J'ai déjà un compte",
  "onboarding.welcome.title": "Entrez sur les marchés",
  "onboarding.welcome.body": "Forex, métaux, indices, énergies, crypto et actions sur un seul compte, avec un financement instantané en USDT.",
  "onboarding.markets.title": "Chaque tick, en direct",
  "onboarding.markets.body": "Prix bid et ask réels, vos propres graphiques, achat et vente d'une seule touche : pensé pour le mobile.",
  "onboarding.security.title": "Sous bonne garde",
  "onboarding.security.body": "Codes par e-mail sur les nouveaux appareils, codes de confirmation pour les retraits et coffre-fort sécurisé pour votre session.",
  // Slide counter, e.g. "1 sur 3"
  "onboarding.step": "{n} sur {total}",

  // Shared states
  "state.offline.title": "Connexion perdue",
  "state.offline.body": "Vérifiez votre connexion Internet. Les prix et votre compte se reconnectent automatiquement.",
  "state.reconnecting": "Reconnexion…",
  "state.error.title": "Une erreur s'est produite",
  "state.error.body": "Nous n'avons pas pu charger ce contenu. Tirez vers le bas ou touchez pour réessayer.",
  "state.maintenance.title": "Maintenance en cours",
  "state.maintenance.body": "Nous mettons Kalks à niveau. Vos positions et vos fonds sont en sécurité. Revenez dans quelques instants.",
  "state.sessionExpired": "Votre session a pris fin. Veuillez vous reconnecter.",
  "state.updated": "Mis à jour {time}",
  "state.pullToRefresh": "Tirez pour actualiser",

  viewOnly: "Accès en lecture seule",
  viewOnlyBody: "Cet identifiant permet de consulter les comptes partagés, mais pas de les modifier.",

  // Common short labels
  "action.retry": "Réessayer",
  "action.openWeb": "Ouvrir dans l'espace client",
  "action.signOut": "Se déconnecter",
  "action.seeAll": "Tout voir",
  "a11y.close": "Fermer",
  "a11y.back": "Retour",
};
export default mobile;
