import type { NsMessages } from "../../core";

// Kalks mobile app: Home tab. Headings are shown in tall uppercase display type: keep them short.
const mobileHome: NsMessages<"mobileHome"> = {
  "greet.morning": "Bonjour, {name}",
  "greet.afternoon": "Bon après-midi, {name}",
  "greet.evening": "Bonsoir, {name}",
  equity: "Fonds propres",
  closedToday: "Clôturé aujourd'hui",
  openPnl: "P&L flottant",
  allLive: "Tous les comptes réels {amount}",
  "quick.deposit": "Déposer",
  "quick.withdraw": "Retirer",
  "quick.transfer": "Transférer",
  "quick.trade": "Trader",
  movers: "Palmarès",
  news: "À la une",
  allNews: "Tout voir",
  notifications: "Notifications",
  "kyc.title": "Vérifiez votre identité",
  "kyc.body": "La vérification débloque le trading réel et les retraits. Elle ne prend que quelques minutes.",
  "kyc.pending": "Vérification en cours d'examen",
  "kyc.pendingBody": "Nous vérifions vos documents. Vous recevrez une notification dès que ce sera terminé.",
  "kyc.action": "Continuer",
  "noAccount.title": "Ouvrez votre premier compte",
  "noAccount.body": "Un compte démo est prêt en quelques secondes avec des fonds virtuels. Passez en réel quand vous le souhaitez.",
  "noAccount.action": "Ouvrir un compte",
  "news.empty": "Aucun titre pour le moment.",
  "a11y.bell": "Notifications, {count} non lues",

  // Explore: one colour block per module (title in display type on two short lines at most, hint on two lines)
  "explore.title": "Explorer",
  "explore.copy": "Copy trading",
  "explore.copyHint": "Suivez des traders confirmés",
  "explore.prop": "Challenge prop",
  "explore.propHint": "Faites-vous financer pour trader",
  "explore.academy": "Académie",
  "explore.academyHint": "Apprenez à trader, étape par étape",
  "explore.ai": "Trader IA",
  "explore.aiHint": "Transformez une idée en stratégie",
  "explore.invite": "Inviter des amis",
  "explore.inviteHint": "Gagnez quand ils tradent",
};
export default mobileHome;
