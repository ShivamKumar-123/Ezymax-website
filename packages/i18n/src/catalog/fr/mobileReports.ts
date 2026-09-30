import type { NsMessages } from "../../core";

// Kalks mobile app (apps/mobile), Reports: Statements (/reports/statements) and Analytics (/reports/analytics).
// Most labels reuse the Client Area's portfolio.st.* / portfolio.an.* keys; only mobile-specific text is here.
const mobileReports: NsMessages<"mobileReports"> = {
  eyebrow: "Rapports",
  "eyebrow.analytics": "Rapports · USD · heure du serveur",

  // Account picker (a card that opens a sheet)
  "account.title": "Compte",
  "account.choose": "Choisir un compte",
  "account.allHint": { one: "{count} compte réel", many: "{count} comptes réels", other: "{count} comptes réels" },
  "account.change": "Changer de compte",

  // Statements
  "st.day": "Jour",
  "st.pickDay": "Choisir un jour",
  "st.pickFrom": "Date de début",
  "st.pickTo": "Date de fin",
  "st.include": "Inclure",
  "st.summary": "#{login} · {period} · {format}",
  "st.preparing": "Préparation…",
  "st.ready": "Relevé prêt",
  "st.saved": "Enregistré sous {file}",
  "st.shareTitle": "Partager le relevé",
  "st.failed": "Le relevé n'a pas pu être téléchargé",
  "st.offline": "Vous êtes hors ligne. Connectez-vous pour télécharger les relevés.",
  "st.monthly.empty": "Aucun relevé mensuel pour le moment.",
  "st.monthly.offline": "Vous êtes hors ligne. Connectez-vous pour voir les relevés mensuels.",
  "st.monthly.a11y": "{month} : net {net}, {trades}. Ouvre les téléchargements.",
  "st.month.title": "Relevé · {month}",
  "st.month.formats": "Télécharger au format",
  "st.prevMonth": "Mois précédent",
  "st.nextMonth": "Mois suivant",

  // Analytics: hero and stat tiles
  "an.hero.label": "P&L net · {period}",
  "an.hero.return": "Rendement",
  "an.hero.trades": "Trades",
  "an.hero.lots": "Lots",
  "an.tile.sharpe": "Ratio de Sharpe",
  "an.tile.expectancy": "Espérance",
  "an.tile.sortino": "Sortino {value}",
  "an.tile.avgWinLoss": "Gain / perte moyens",
  "an.tile.rr": "Gain/risque 1:{value}",
  "an.tile.holdSplit": "Gagnants {win} · perdants {loss}",
  "an.tile.streaks": "Séries",
  "an.tile.streaksSub": "Gains / pertes consécutifs",
  "an.tile.trade": "{side} {volume} · #{ticket}",
  "an.tile.none": "Aucun trade",

  // Analytics: curves
  "an.curve.hint": "Maintenez le doigt sur le graphique pour voir chaque jour",
  "an.curve.drawdown": "Drawdown",
  "an.curve.a11y": "Fonds propres {equity}, solde {balance} le {date}. Drawdown maximal {drawdown}.",

  // Analytics: P&L calendar (net of closed trades per server day)
  "an.cal.title": "Calendrier P&L",
  "an.cal.subtitle": "Résultat net des trades clôturés par jour serveur",
  "an.cal.subtitleEstimated": "Variation quotidienne du solde, hors dépôts et retraits",
  "an.cal.days": { one: "{count} jour de trading", many: "{count} jours de trading", other: "{count} jours de trading" },
  "an.cal.green": "{count} positifs",
  "an.cal.red": "{count} négatifs",
  "an.cal.noTrades": "Aucun trade clôturé",
  "an.cal.select": "Touchez un jour pour voir son résultat",
  "an.cal.a11yDay": "{date} : {net}, {trades}",

  // Analytics: breakdowns
  "an.hour.byHour": "P&L net par heure",
  "an.hour.byDayHour": "Jour × heure",
  "an.hour.tap": "Touchez une barre ou une cellule pour les détails",
  "an.tapBar": "Touchez une barre pour les détails",
  "an.session.best": "Meilleure",
  "an.session.asia": "Asie",
  "an.session.london": "Londres",
  "an.session.overlap": "Londres / New York",
  "an.session.newYork": "New York",
  "an.session.lateNewYork": "New York (fin)",
  "an.side.split": "{long} · {short}",
  "an.flow.equityNow": "Fonds propres actuels",
  "an.charges.total": "Frais payés",

  // Behaviour insights (the numbers come from the reports service)
  "insight.overtrading.title": { one: "Surtrading sur {count} jour", many: "Surtrading sur {count} jours", other: "Surtrading sur {count} jours" },
  "insight.overtrading.text": "Ces jours-là, vous avez passé plus de {limit} trades (contre {median} lors d'une journée type). Résultat net sur ces jours : {net}.",
  "insight.overtrading.tip": "Fixez-vous un plafond de {cap} trades par jour.",
  "insight.revenge.title": { one: "{count} trade de revanche possible", many: "{count} trades de revanche possibles", other: "{count} trades de revanche possibles" },
  "insight.revenge.text": "Trades ouverts dans les 15 minutes suivant une clôture perdante, avec une taille égale ou supérieure. Ils ont été gagnants {rate} % du temps, pour {net} au total.",
  "insight.revenge.tip": "Faites une pause de 15 minutes après une perte avant le trade suivant.",
  "insight.risk.title": "Risque par trade perdant",
  "insight.risk.text": {
    one: "Un trade perdant vous a coûté en moyenne {avg} % de votre solde, {max} % au maximum. {count} perte a dépassé 2 %.",
    many: "Un trade perdant vous a coûté en moyenne {avg} % de votre solde, {max} % au maximum. {count} pertes ont dépassé 2 %.",
    other: "Un trade perdant vous a coûté en moyenne {avg} % de votre solde, {max} % au maximum. {count} pertes ont dépassé 2 %.",
  },
  "insight.risk.tip": "Dimensionnez vos positions pour qu'un Stop Loss coûte au maximum 1 à 2 % du solde.",
  "insight.holdLosers.title": "Les perdants sont conservés plus longtemps que les gagnants",
  "insight.holdLosers.text": "Les trades perdants restent ouverts {loss} en moyenne, les gagnants {win}.",
  "insight.holdLosers.tip": "Placez un Stop Loss à l'ouverture du trade et laissez-le en place.",
  "insight.stopOut.title": { one: "{count} clôture par stop out", many: "{count} clôtures par stop out", other: "{count} clôtures par stop out" },
  "insight.stopOut.text": "Des positions ont été clôturées par le stop out de marge, et non par votre propre Stop Loss.",
  "insight.stopOut.tip": "Maintenez le niveau de marge au-dessus du seuil d'appel de marge avec des positions plus petites.",
  "insight.slTp.title": "Trades clôturés par Stop Loss ou Take Profit",
  "insight.slTp.text": "{tp} par Take Profit, {sl} par Stop Loss, le reste clôturé manuellement ou par le desk.",
  "insight.slTp.tip": "Des sorties planifiées rendent les résultats plus réguliers.",
  "insight.session.title": "Meilleure session : {session}",
  "insight.session.text": "{trades} trades avec un taux de réussite de {rate} %. La plus faible : {worst} ({net}).",
  "insight.session.tip": "Concentrez-vous sur la session {session}.",
  "insight.tip": "Conseil",

  // States
  "state.updating": "Mise à jour…",
  "state.stale": "Données enregistrées affichées. Tirez vers le bas pour actualiser.",
  "state.notShared.title": "Non partagé avec vous",
  "state.footer": "Tous les montants sont en USD (comptes cent convertis). Les heures sont en heure du serveur, GMT+2 / GMT+3.",
  "state.footerStatements": "Les relevés sont dans la devise du compte (USC pour les comptes cent). Les heures sont en heure du serveur, GMT+2 / GMT+3.",
};
export default mobileReports;
