import type { NsMessages } from "../../core";

// Kalks mobile app (src/features/platform): the notifications inbox, push notifications, the app lock
// (Face ID / fingerprint / the phone's passcode), "Continue with Google" and links that open the app.
// Keep brand and product names as they are: Kalks, Face ID, Touch ID, Google.
const mobilePlatform: NsMessages<"mobilePlatform"> = {
  // Notifications inbox (/notifications). Day headers above each group: Today, Yesterday, then the date.
  "inbox.eyebrow": "Boîte de réception",
  "inbox.unread": { one: "{count} non lue", many: "{count} non lues", other: "{count} non lues" },
  "inbox.caughtUp": "Vous êtes à jour",
  "inbox.filter.unread": "Non lues",
  "inbox.markedAll": "Tout est marqué comme lu",
  "inbox.emptyUnread.title": "Vous êtes à jour",
  "inbox.emptyUnread.body": "Vous avez lu toutes les notifications. Les nouvelles apparaîtront ici dès leur arrivée.",
  "inbox.loadMoreFailed": "Impossible de charger les notifications plus anciennes. Touchez pour réessayer.",
  // Under the title while the phone is offline and the inbox shows what it saved earlier
  "inbox.offlineCached": "Vous êtes hors ligne. Voici les notifications enregistrées sur ce téléphone.",
  // Row accessibility: "Non lue. Dépôt crédité. …"
  "inbox.a11y.unread": "Non lue",
  "inbox.a11y.settings": "Paramètres des notifications",
  // Detail sheet of a notification without a screen to open
  "inbox.detail.openWeb": "Ouvrir le lien",
  "inbox.detail.received": "Reçue le {time}",

  // Asking for push permission (never on the first launch): a sheet on Home and a card in the inbox
  "push.ask.eyebrow": "Notifications",
  "push.ask.title": "Soyez informé en temps réel",
  "push.ask.body": "Dépôts crédités, retraits payés, appels de marge, stop outs et réponses de l'assistance, directement sur votre écran de verrouillage.",
  "push.ask.point.money": "Dépôts et retraits",
  "push.ask.point.risk": "Appels de marge et stop outs",
  "push.ask.point.support": "Réponses de l'assistance",
  "push.ask.allow": "Activer les notifications",
  "push.ask.later": "Plus tard",
  "push.ask.note": "Vous choisissez les sujets dans Profil › Notifications. Les offres ne sont envoyées que si vous les activez.",
  // The sample notification drawn in the ask, as it would look on the lock screen ("maintenant" = its time label)
  "push.ask.now": "maintenant",
  "push.ask.sampleTitle": "Dépôt crédité",
  "push.ask.sampleBody": "250,00 USDT ont été crédités sur votre portefeuille.",
  "push.card.title": "Activez les notifications push",
  "push.card.body": "Recevez les dépôts, exécutions et appels de marge sur votre écran de verrouillage.",
  "push.card.action": "Activer",
  "push.card.deniedTitle": "Les notifications push sont désactivées",
  "push.card.deniedBody": "Autorisez les notifications de Kalks dans les réglages de votre téléphone pour les recevoir sur l'écran de verrouillage.",
  "push.card.deniedAction": "Ouvrir les réglages",
  "push.card.dismiss": "Masquer",
  "push.enabled": "Notifications push activées",
  // Android notification channels (shown in the phone's settings for the app)
  "push.channel.alerts": "Appels de marge et sécurité",
  "push.channel.alertsHint": "Alertes d'appel de marge et de stop out, vos alertes de prix, nouvelles connexions",
  "push.channel.activity": "Activité du compte",
  "push.channel.activityHint": "Dépôts, retraits, exécutions, vérification et réponses de l'assistance",
  "push.channel.news": "Actualités et offres",
  "push.channel.newsHint": "Promotions et nouveautés produit auxquelles vous avez souscrit",
  // In-app banner for a push that arrives while the app is open
  "push.banner.a11y": "Nouvelle notification : {title}. Touchez deux fois pour ouvrir.",

  // App lock screen (cold start, after the chosen time in the background, and /lock)
  "lock.eyebrow": "Verrouillé",
  "lock.title": "Bon retour parmi nous",
  "lock.subtitle": "Déverrouillez pour voir vos comptes et vos soldes.",
  // {method}: Face ID, Touch ID, empreinte digitale, reconnaissance faciale or code (used after "par")
  "lock.unlockWith": "Déverrouiller par {method}",
  "lock.unlock": "Déverrouiller",
  "lock.prompt": "Déverrouiller Kalks",
  "lock.promptSubtitle": "Confirmez qu'il s'agit bien de vous",
  "lock.failed": "Cela n'a pas fonctionné. Réessayez.",
  "lock.lockout": "Trop de tentatives. Déverrouillez votre téléphone avec son code, puis réessayez.",
  "lock.noScreenLock": "Votre téléphone n'a plus de verrouillage d'écran : Kalks ne peut donc pas confirmer qu'il s'agit bien de vous. Déconnectez-vous, puis reconnectez-vous avec votre mot de passe.",
  "lock.notYou": "Ce n'est pas vous, ou impossible de déverrouiller ?",
  "lock.signOut": "Se déconnecter",
  "lock.signOutTitle": "Se déconnecter de Kalks ?",
  "lock.signOutBody": "Vous vous reconnecterez avec votre e-mail et votre mot de passe. Vos positions et vos fonds ne sont pas affectés.",
  "lock.method.faceId": "Face ID",
  "lock.method.touchId": "Touch ID",
  "lock.method.fingerprint": "empreinte digitale",
  "lock.method.face": "reconnaissance faciale",
  "lock.method.iris": "iris",
  "lock.method.passcode": "code",

  // Settings › App lock (/settings/app-lock)
  "settings.eyebrow": "Sécurité",
  "settings.title": "Verrouillage",
  "settings.subtitle": "Protégez Kalks par {method} à l'ouverture et après un passage en arrière-plan.",
  "settings.toggle": "Verrouiller Kalks",
  "settings.toggleHint": "Par {method}, avec le code du téléphone en secours",
  "settings.on": "Verrouillage de l'app activé",
  "settings.off": "Verrouillage de l'app désactivé",
  "settings.after": "Reverrouiller après",
  "settings.afterHint": "Durée pendant laquelle Kalks peut rester en arrière-plan avant de redemander. Il le demande toujours au démarrage.",
  "settings.timeout.0": "Immédiatement",
  "settings.timeout.60": "1 minute",
  "settings.timeout.300": "5 minutes",
  "settings.timeout.900": "15 minutes",
  "settings.timeout.3600": "1 heure",
  "settings.privacy": "Lorsque le verrouillage est activé, le sélecteur d'apps affiche un écran de protection au lieu de vos soldes.",
  "settings.lockNow": "Verrouiller maintenant",
  "settings.confirmOn": "Confirmez pour activer le verrouillage de l'app",
  "settings.confirmOff": "Confirmez pour désactiver le verrouillage de l'app",
  // System prompt when the reader picks a longer "Reverrouiller après" time
  "settings.confirmTimeout": "Confirmez pour modifier le délai de verrouillage de Kalks",
  // Toast body after a password sign-in on a phone whose screen lock was removed (the app lock can't work without it)
  "settings.turnedOffNoScreenLock": "Ce téléphone n'a pas de verrouillage d'écran : Kalks ne peut donc pas confirmer qu'il s'agit bien de vous. Configurez-en un dans les réglages du téléphone pour réutiliser le verrouillage de l'app.",
  "settings.notConfirmed": "Non confirmé, rien n'a été modifié",
  "settings.unavailableTitle": "Configurez d'abord un verrouillage d'écran",
  "settings.unavailableBody": "Le verrouillage de l'app utilise Face ID, l'empreinte digitale ou le code de votre téléphone. Activez l'un d'eux dans les réglages du téléphone, puis revenez.",
  "settings.webTitle": "Disponible dans l'app",
  "settings.webBody": "Le verrouillage de l'app fonctionne dans l'app Kalks pour iPhone et Android.",
  "settings.thisPhone": "S'applique à ce téléphone uniquement",

  // Links that open the app (kalks://…, notification taps) but match no screen
  "link.notFound.title": "Rien à ouvrir ici",
  "link.notFound.body": "Ce lien ne correspond à aucun écran de l'app. Il est peut-être ancien, ou destiné à l'espace client sur le web.",
  "link.notFound.home": "Aller à l'accueil",
  "link.openFailed": "Impossible d'ouvrir ce lien.",
};
export default mobilePlatform;
