import type { NsMessages } from "../../core";

const dashboard: NsMessages<"dashboard"> = {
  // Page header (Client Area home)
  "greeting.morning": "Bonjour, {name}",
  "greeting.afternoon": "Bon après-midi, {name}",
  "greeting.evening": "Bonsoir, {name}",
  "greeting.welcome": "Bienvenue, {name}",
  "subtitle.live": "Bienvenue chez Kalks. Voici votre compte et les marchés du jour.",
  "subtitle.demo": "Voici la performance de vos comptes aujourd'hui.",
  launchTrader: "Lancer Kalks Trader",
  openTerminal: "Ouvrir le terminal de trading",

  // Getting started checklist
  "steps.title": "Premiers pas",
  "steps.subtitle": "Votre progression vers le trading réel",
  "steps.progress": "{done} sur {total}",
  "steps.account.title": "Créez votre compte",
  "steps.account.text": "Inscrit le {date}.",
  "steps.email.title": "Vérifiez votre e-mail",
  "steps.email.verified": "{email} est vérifié.",
  "steps.email.confirm": "Confirmez {email} avec le code que nous vous avons envoyé.",
  "steps.kyc.title": "Vérifiez votre identité",
  "steps.kyc.verified": "Votre identité est vérifiée. Les retraits sont débloqués.",
  "steps.kyc.moreInfo": "Notre équipe a besoin d'un document supplémentaire.",
  "steps.kyc.review": "Vos documents sont entre les mains de notre équipe de vérification.",
  "steps.kyc.draft": "Reprenez là où vous en étiez. Cela prend environ 3 minutes.",
  "steps.kyc.rejected": "Nous n'avons pas pu vérifier vos documents. Vous pouvez recommencer.",
  "steps.kyc.todo": "Environ 3 minutes. Débloque les retraits.",
  "steps.accountOpen.title": "Ouvrez un compte de trading",
  "steps.accountOpen.opened": { one: "{live} compte réel et {demo} compte démo ouverts.", other: "{live} comptes réels et {demo} comptes démo ouverts." },
  "steps.accountOpen.todo": "Ouvrez un compte réel ou démo ; votre identifiant est délivré instantanément.",
  "steps.wallet.title": "Alimentez votre portefeuille",
  "steps.wallet.text": "Les dépôts USDT sur TRC20 sont en cours de mise en service.",
  // Step status chips
  "steps.state.done": "Terminé",
  "steps.state.todo": "À faire",
  "steps.state.review": "En examen",
  "steps.state.rejected": "Refusé",
  "steps.state.soon": "Non commencé",

  // Trading accounts card
  "accounts.title": "Comptes de trading",
  "accounts.summary": "Fonds propres réels <b>{equity}</b> · {live} réel(s) · {demo} démo · {positions} positions ouvertes",
  "accounts.subtitle": "Vos comptes réels et démo",
  "accounts.all": "Tous les comptes",
  "accounts.open": "Ouvrir un compte",
  "accounts.unavailable": "Les comptes de trading sont indisponibles pour le moment. Vos soldes sont en sécurité.",
  "accounts.openLive.title": "Ouvrir un compte réel",
  "accounts.openLive.text": "Marchés réels. Démarre avec un solde nul ; approvisionnez-le depuis votre portefeuille.",
  "accounts.openDemo.title": "Ouvrir un compte démo",
  "accounts.openDemo.text": "Fonds virtuels sur des prix en temps réel, rechargeables chaque jour.",
  "accounts.more": { one: "{count} compte de plus", other: "{count} comptes de plus" },
  "accounts.myTitle": "Mes comptes de trading",

  // Your account card
  "account.title": "Votre compte",
  "account.clientId": "ID client",
  "account.emailStatus": "Statut de l'e-mail",
  "account.notVerified": "Non vérifié",
  "account.identity": "Identité",
  "account.memberSince": "Membre depuis",
  "account.profile": "Profil",

  // Kalks Trader banner
  "trader.chip": "Prix en direct",
  "trader.text": "Cotations et graphiques en temps réel pour {count} instruments : forex, métaux, indices, énergies, crypto et actions. Fonctionne dans votre navigateur, rien à installer.",

  // Market clock / heatmap
  "sessions.title": "Horloge des marchés",
  "sessions.open": "{open} marchés ouverts sur {total}",
  "heatmap.title": "Carte thermique des marchés",
  "heatmap.subtitle": "Variation du jour selon les prix en direct · point creux : marché fermé",
  "heatmap.up": "{count} en hausse",
  "heatmap.down": "{count} en baisse",
  "heatmap.allMarkets": "Tous les marchés",
  "heatmap.tipOpen": "{symbol} · marché ouvert",
  "heatmap.tipClosed": "{symbol} · marché fermé, variation de la dernière séance",

  // Support card
  "support.title": "Besoin d'aide ?",
  "support.text": "Écrivez à <mail>{email}</mail> depuis votre adresse enregistrée en indiquant votre ID client.",
  "support.emailSupport": "Écrire à l'assistance",
  "support.copied": "Adresse e-mail copiée",
  "support.copyFailed": "Copie impossible, veuillez sélectionner l'adresse",

  // Demo dashboard: onboarding strip
  "onboarding.title": "Terminez la configuration de votre compte",
  "onboarding.text": "Complétez le KYC pour débloquer les retraits et des limites plus élevées.",
  "onboarding.progress": "Progression",
  "onboarding.dismiss": "Ignorer",

  // Margin health
  "margin.title": "Santé de la marge",
  "margin.subtitle": "Sur l'ensemble des comptes réels",
  "margin.healthy": "Saine",
  "margin.level": "Niveau de marge",
  "margin.used": "Marge utilisée",
  "margin.free": "Marge libre",

  // Equity / P&L
  "equity.title": "Fonds propres totaux",
  "equity.changeOver": "Variation sur {range}",
  "pnl.title": "Profit / perte · mois",
  "pnl.lowRisk": "Risque faible",
  "pnl.winRate": "Taux de réussite (30 j)",
  "pnl.trades": "Transactions (30 j)",
  "pnl.avgWin": "Gain moyen",
  "pnl.avgLoss": "Perte moyenne",
  "pnl.charges": "Frais payés",

  // KPI cards
  "kpi.wallet": "Portefeuille",
  "kpi.today": "+{pct} % aujourd'hui",
  "kpi.monthPnl": "P&L du mois",
  "kpi.vsLastMonth": "+{pct} % vs mois dernier",
  "kpi.partnerEarnings": "Gains partenaire",
  "kpi.copy": "Copy {amount}",

  // Top movers
  "movers.title": "Plus fortes variations",
  "movers.gainers": "Hausses",
  "movers.losers": "Baisses",

  // Economic calendar. R = Réel, P = Prévision, Pr = Précédent
  "calendar.title": "Calendrier économique",
  "calendar.subtitle": "Aujourd'hui · heure du serveur GMT+3",
  "calendar.actual": "R {value} · ",
  "calendar.forecastPrevious": "P {forecast} · Pr {previous}",

  // News / world
  "news.title": "Actualités des marchés",
  "news.all": "Toutes les actualités",
  "news.pinned": "Épinglé",
  "world.title": "Marchés et actualités dans le monde",
  "world.subtitle": "Titres en direct par pays et sentiment par devise",
  "world.stories": { one: "{count} article aujourd'hui", other: "{count} articles aujourd'hui" },

  // Open positions
  "positions.title": "Positions ouvertes",
  "positions.summary": { one: "{count} position · flottant", other: "{count} positions · flottant" },
  "positions.terminal": "Terminal",

  // Partner banner
  "partner.chip": "Programme partenaire",
  "partner.title": "Parrainez des traders. Gagnez jusqu'à 15 $ par lot, à vie.",
  "partner.text": "Commissions multi-niveaux, bonus CPA et suivi en temps réel. Votre lien : <link>{url}</link>",
  "partner.open": "Ouvrir le tableau de bord partenaire",

  // Short relative times
  "time.justNow": "À l'instant",
  "time.minutesAgo": "il y a {count} min",
  "time.hoursAgo": "il y a {count} h",
  "time.daysAgo": "il y a {count} j",
  "time.ago": "il y a {time}",

  // Notifications bell / panel
  "notifications.title": "Notifications",
  "notifications.ariaUnread": "Notifications, {count} non lues",
  "notifications.markAll": "Tout marquer comme lu",
  "notifications.clear": "Effacer",
  "notifications.emptyTitle": "Aucune notification pour le moment",
  "notifications.emptyText": "Les dépôts, retraits, vérifications, alertes de trading et réponses de l'assistance apparaissent ici.",
  "notifications.settings": "Paramètres des notifications",

  // Client Area redesign: side menu, dashboard overview
  "chrome.expand": "Déplier le menu",
  "chrome.collapse": "Replier le menu",
  "chrome.menu": "Menu",
  "home.todayPnl": "P&L du jour",
  "home.walletBalance": "Solde du portefeuille",
  "home.rewardsEarnings": "Récompenses et gains IB",
  "home.todayPct": "{pct} % aujourd’hui",
  "home.floating": "P&L latent",
  "home.rewards": "Récompenses",
  "home.accountsChip": "{live} réels · {positions} positions ouvertes",
  "home.statistics": "Statistiques",
  "home.pnl": "P&L",
  "home.weekly": "Semaine",
  "home.monthly": "Mois",
  "home.lastYear": "Année passée",
  "home.noHistory": "L’historique de vos fonds propres apparaîtra ici dès que vos comptes réels auront de l’activité.",
  "home.thisPeriod": "Cette période",
  "home.previousPeriod": "Période précédente",
  "home.yourAccounts": "Vos comptes",
  "home.tradingAccount": "Compte de trading",
  "home.accountInfo": "Informations du compte",
  "home.accountName": "Nom du compte",
  "home.leverage": "Effet de levier",
  "home.previous": "Compte précédent",
  "home.next": "Compte suivant",
  "home.showBalances": "Afficher les soldes",
  "home.hideBalances": "Masquer les soldes",
  "home.trade": "Trader",
  "home.history": "Historique",
  "home.funding": "Financement",
  "home.linked": "Associés",
  "home.connected": "Connecté",
  "home.subscriptions": { one: "{count} abonnement actif", other: "{count} abonnements actifs" },
  "home.points": "{points} points",
  "home.redeem": "Échanger",
  "home.networkUnavailable": "En pause",
  "home.totalBalance": "Solde total",
  "home.totalBalanceSub": "Comptes réels et portefeuille",
  "home.transferFunds": "Transférer des fonds",
  "home.quickActions": "Actions rapides",
  "home.later": "Plus tard",
  "home.viewDetails": "Voir les détails",
  "home.verifyNow": "Vérifier maintenant",
  "home.fundTitle": "Alimentez votre portefeuille",
  "home.fundText": "Déposez des USDT pour commencer à trader sur un compte réel.",
  "home.depositNow": "Déposer maintenant",
  "home.tradingTitle": "Trading",
  "home.marketsTitle": "Marchés",
  "home.moreTitle": "Plus pour vous",
};
export default dashboard;
