import type { NsMessages } from "../../core";

// Kalks mobile app: Prop (challenge catalogue and checkout, live rule dashboard, payouts, certificates).
// "Kalks", "Kalks Prop", "Kalks Trader", "Kalks-Live", "USDT", "New York" and "17:00" are not translated.
// Titles shown in tall uppercase display type are marked "display": keep them short.
const mobileProp: NsMessages<"mobileProp"> = {
  // Prop home
  "home.eyebrow": "Kalks Prop",
  // display
  "home.title": "Soyez financé",
  "home.subtitle": "Réussissez un challenge, obtenez un compte financé et conservez jusqu'à {split} % du profit. Tous les comptes prop sont simulés.",
  "home.subtitleNoSplit": "Réussissez un challenge, obtenez un compte financé et conservez une part du profit. Tous les comptes prop sont simulés.",
  "home.payouts": "Paiements",
  "home.payoutsReady": "{amount} disponibles",
  "home.payoutsNone": "Aucun disponible",
  "home.certificates": "Certificats",
  "home.certCount": { one: "{count} obtenu", many: "{count} obtenus", other: "{count} obtenus" },
  "home.mine": "Vos challenges",
  "home.past": "Challenges passés",
  "home.showAll": "Tout afficher ({count})",
  "home.yourCertificates": "Vos certificats",
  "home.plans": "Choisissez votre challenge",
  "home.newChallenge": "Commencer un nouveau challenge",
  // display
  "home.emptyTitle": "Aucun challenge proposé",
  "home.emptyBody": "De nouveaux plans de challenge sont en préparation. Revenez bientôt.",
  "home.mineError": "Impossible de charger vos challenges.",
  "home.plansError": "Impossible de charger les plans de challenge.",

  // How it works (numbered 01–04 on the Prop home)
  "how.title": "Comment ça marche",
  "how.1.title": "Choisissez un plan",
  "how.1.body": "Choisissez le modèle et la taille du compte. Les frais sont prélevés une seule fois sur votre portefeuille USDT.",
  "how.2.title": "Atteignez l'objectif",
  "how.2.body": "Atteignez l'objectif de profit en respectant les limites de perte journalière et de drawdown, sur le nombre minimal de jours de trading.",
  "how.3.title": "Soyez financé",
  "how.3.body": "Réussissez, et votre compte financé s'ouvre automatiquement, avec un certificat à partager.",
  "how.4.title": "Soyez payé",
  "how.4.body": "Demandez votre part du profit sur votre portefeuille USDT à chaque cycle de paiement.",
  "how.enforce": "Les limites sont vérifiées sur le serveur chaque seconde, sur les fonds propres. Vous êtes averti à 50, 75 et 90 % de la perte journalière ; une infraction clôture toutes les positions et met fin au challenge.",

  // Plan models
  "type.oneStep": "1 étape",
  "type.twoStep": "2 étapes",
  "type.instant": "Instantané",
  "typeText.oneStep": "Une seule phase d'évaluation. Atteignez l'objectif, respectez les limites, obtenez votre financement.",
  "typeText.twoStep": "Deux phases d'évaluation avec des objectifs plus bas et des limites plus larges.",
  "typeText.instant": "Aucune évaluation. Démarrez directement sur un compte financé, avec des limites plus strictes.",

  // Plan card
  "plan.refundable": "Frais remboursés",
  "plan.fee": "Frais",
  "plan.account": "Compte",
  "plan.leverage": "Levier 1:{n}",
  "plan.target": "Objectif",
  "plan.dailyLoss": "Perte journalière",
  "plan.maxDD": "Drawdown max",
  "plan.static": "statique",
  "plan.trailing": "suiveur",
  "plan.start": "Commencer · {fee}",

  // Checkout
  "checkout.eyebrow": "Paiement",
  "checkout.fee": "Frais uniques",
  "checkout.chargedRefund": "Payés depuis votre portefeuille USDT. Remboursés avec votre premier paiement.",
  "checkout.chargedNoRefund": "Payés depuis votre portefeuille USDT. Non remboursables.",
  "checkout.walletBalance": "Solde du portefeuille : {balance} USDT",
  "checkout.shortTitle": "Votre portefeuille ne couvre pas les frais",
  "checkout.short": "Vous avez {balance} USDT. Déposez {missing} USDT de plus pour payer ce challenge.",
  "checkout.rules": "Les règles",
  "checkout.limitsNote": "Les limites sont exprimées en pourcentage du solde de départ. Enfreindre la perte journalière ou le drawdown max entraîne l'échec du compte et la clôture de toutes les positions au marché. La journée de trading est réinitialisée à 17:00 New York.",
  "checkout.agree": "J'ai lu les règles et je comprends que le compte est simulé et échoue automatiquement en cas de dépassement d'une limite de perte.",
  "checkout.pay": "Payer {fee}",
  "checkout.retry": "Réessayer · {fee}",
  "checkout.paying": "Paiement…",
  "checkout.goToMine": "Voir mes challenges",
  // display
  "checkout.readyTitle": "C'est parti",
  "checkout.readyBody": "{fee} ont été payés depuis votre portefeuille USDT et votre compte {phase} de {size} est ouvert. Les règles s'appliquent dès maintenant.",
  "checkout.savePasswords": "Enregistrez ces mots de passe maintenant : ils ne sont affichés qu'une seule fois et nous ne les conservons pas. Vous pouvez toujours trader ce compte depuis l'app sans eux.",
  "checkout.passwordsShown": "Les mots de passe de trading ont été affichés lors de la première confirmation de cet achat. Vous pouvez trader ce compte depuis l'app sans eux.",
  "checkout.viewChallenge": "Voir le challenge",
  "checkout.readOnly": "Cette session ne permet pas d'acheter des challenges.",

  // Account credentials
  "cred.login": "Identifiant",
  "cred.server": "Serveur",
  "cred.password": "Mot de passe de trading",
  "cred.investorPassword": "Mot de passe investisseur (lecture seule)",
  "cred.show": "Afficher le mot de passe",
  "cred.hide": "Masquer le mot de passe",
  // {what} is a field label (Identifiant, Serveur, Mot de passe…)
  copied: "{what} copié",
  "a11y.copy": "Copier {what}",

  // Challenge statuses
  "status.pendingPayment": "En attente de paiement",
  "status.provisioning": "Ouverture du compte",
  "status.active": "Actif",
  "status.funded": "Financé",
  "status.failed": "Échoué",
  "status.closed": "Clôturé",
  "status.paymentFailed": "Paiement échoué",
  // {phase} is the phase name from the plan, e.g. "Phase 2"
  "stage.active": "{phase} · Active",
  "stage.failed": "{phase} · Échouée",
  "phaseStatus.provisioning": "Ouverture",
  "phaseStatus.active": "En cours",
  "phaseStatus.passed": "Réussie",
  "phaseStatus.failed": "Échouée",
  "phaseStatus.closed": "Clôturée",

  // Challenge cards (Prop home)
  "card.target": "Objectif de profit",
  "card.profit": "Profit",
  "card.equity": "Fonds propres {amount}",
  "card.dailyLeft": "Perte journalière restante {amount}",
  "card.opening": "Votre compte de trading est en cours d'ouverture. Cela prend quelques secondes.",

  // Dashboard
  "dash.equity": "Fonds propres",
  "dash.balance": "Solde",
  "dash.floating": "Flottant",
  "dash.open": "Ouvertes",
  "dash.sinceStart": "depuis le début de la phase",
  "dash.rules": "Règles",
  "dash.rulesTitle": "Règles de ce challenge",
  // display
  "dash.notFound": "Challenge introuvable",
  "dash.notFoundBody": "Il a peut-être été ouvert avec un autre identifiant.",
  "dash.backToProp": "Retour à Prop",
  "live.live": "En direct",
  "live.connecting": "Connexion…",
  "live.offline": "Hors ligne",
  // {time}: date and time of the last rule check
  "live.updated": "Vérifié : {time}",
  // {time}: when the phase ended
  "live.final": "Définitif · {time}",

  // Rule names (gauges, the rule log)
  "rule.dailyLoss": "Perte journalière",
  "rule.maxDrawdown": "Drawdown max",
  "rule.profitTarget": "Objectif de profit",
  "rule.tradingDays": "Jours de trading",
  "rule.timeLimit": "Limite de temps",
  "rule.weekendHolding": "Détention le week-end",
  "rule.newsWindow": "Fenêtre des annonces",
  "rule.bannedStrategy": "Stratégie interdite",
  "rule.consistency": "Régularité",
  "rule.riskDesk": "Décision du service des risques",
  "ruleState.ok": "En cours",
  "ruleState.passed": "Atteint",
  "ruleState.failed": "Enfreint",
  "ruleState.off": "Désactivé",

  // Gauges
  "target.ofTarget": "de l'objectif",
  "target.of": "Objectif {amount} ({pct} %)",
  "target.left": "Encore {amount}",
  "target.reachedBy": "Atteint, {amount} au-delà",
  "limit.left": "{amount} restants",
  "limit.breachAt": "Infraction à {amount}",
  days: { one: "{count} jour", many: "{count} jours", other: "{count} jours" },
  "days.of": "{v} sur {min}",
  "days.count": { one: "{count} jour", many: "{count} jours", other: "{count} jours" },
  "days.met": "Minimum atteint",
  "days.toGo": { one: "Encore {count}", many: "Encore {count}", other: "Encore {count}" },
  "days.noMinimum": "Aucun minimum",
  "time.left": "{d} j {h} h restants",
  "time.deadline": "Fin le {date}",
  "consistency.rule": "Meilleure journée ≤ {pct} % du profit",
  "consistency.noProfit": "Pas encore de profit",
  "reset.title": "Perte du jour réinitialisée dans",
  "reset.note": "17:00 New York, chaque jour de trading",

  // Funded account: payout window ring
  "payoutHero.title": "Prochain paiement",
  "payoutHero.share": "Votre part à ce jour",
  // display
  "payoutHero.open": "Ouvert",
  // display
  "payoutHero.ready": "Prêt",
  // display
  "payoutHero.days": { one: "{count} jour", many: "{count} jours", other: "{count} jours" },
  "payoutHero.eligible": "Éligible dès maintenant avec votre part de {split} %.",
  "payoutHero.opens": "La fenêtre de paiement ouvre le {date}.",
  "payoutHero.later": "Demandez un paiement dès que vous avez un profit éligible.",

  // Big states (titles are display)
  "hero.opening.title": "Ouverture du compte",
  "hero.opening.body": "Le paiement est confirmé et votre compte de trading est en cours de configuration. Cette page se met à jour automatiquement.",
  "hero.closed.title": "Challenge clôturé",
  "hero.closed.body": "Le compte de trading de ce challenge n'a pas pu être ouvert : le challenge a donc été clôturé et les frais ont été remboursés sur votre portefeuille USDT. Contactez l'assistance si vous avez des questions.",
  // {reason} is the prop service's reason, in English
  "hero.closed.reason": "{reason}. Les frais ont été remboursés sur votre portefeuille USDT.",
  "hero.failed.title": "{phase} échouée",
  "hero.failed.on": "Terminée le {date}",
  // {reason} is the breach reason from the risk engine
  "hero.failed.body": "{reason}. Toutes les positions ont été clôturées et le compte est désactivé.",
  "hero.failed.ruleBreached": "Une règle a été enfreinte",
  // {rule} is a rule name, e.g. "Perte journalière"
  "hero.failed.rule": "{rule} : limite enfreinte",
  "hero.failed.new": "Commencer un nouveau challenge",
  "hero.passed.title": "{phase} réussie",
  "hero.passed.on": "Réussie le {date}.",
  "hero.passed.next": "Votre compte {phase} est ouvert.",
  "hero.passed.nextLogin": "Votre compte {phase} est ouvert (#{login}).",
  "hero.passed.opening": "Votre compte suivant est en cours d'ouverture.",
  "hero.passed.certificate": "Voir le certificat",
  "hero.passed.goNext": "Aller à {phase}",
  "hero.funded.title": "Financé",
  "hero.funded.body": "Tradez le compte financé et recevez {split} % du profit sous forme de paiements.",
  "hero.funded.certificate": "Voir votre certificat de trader financé",

  // Warnings while trading
  "warn.lossUsed": "{pct} % de la limite de perte du jour utilisés",
  "warn.lossUsedBody": "Des fonds propres inférieurs ou égaux à {floor} entraînent l'échec du compte et la clôture de toutes les positions. Restant aujourd'hui : {left}.",
  "warn.weekend": "Clôture du week-end",
  "warn.weekendBody": "Ce plan n'autorise pas la détention de positions le week-end : les positions ouvertes sont clôturées le vendredi à 16:45 New York.",

  // Actions
  "action.openTrade": "Ouvrir dans Trading",
  "action.trade": "Trader",
  "action.tradeBlocked": "Seul le compte en cours d'un challenge actif peut être tradé.",
  "action.payouts": "Paiements",
  "action.support": "Contacter l'assistance",

  // Equity chart
  "chart.title": "Courbe des fonds propres",
  "chart.start": "Départ",
  "chart.target": "Objectif",
  "chart.ddFloor": "Drawdown max",
  "chart.dailyFloor": "Perte journalière",
  "chart.now": "Actuel",
  "chart.empty": "La courbe apparaît après les premières minutes de trading.",

  // Trading stats
  "stats.title": "Statistiques de trading",
  "stats.trades": "Trades",
  "stats.winRate": "Taux de réussite",
  "stats.profitFactor": "Facteur de profit",
  "stats.avgWin": "Gain moyen",
  "stats.avgLoss": "Perte moyenne",
  "stats.lots": "Lots",
  "stats.bestDay": "Meilleure journée {date} : {amount}",

  // Rule log
  "events.title": "Journal des règles",
  "events.empty": "Aucun avertissement ni infraction. Continuez ainsi.",
  "events.equity": "fonds propres {amount}",
  "events.limit": "limite {amount}",
  "severity.breach": "Infraction",
  "severity.violation": "Violation",
  "severity.warning": "Avertissement",
  "severity.info": "Info",

  // Closed trades
  "trades.title": "Trades clôturés",
  "trades.all": "Tout ({count})",
  "trades.count": { one: "{count} trade clôturé", many: "{count} trades clôturés", other: "{count} trades clôturés" },
  "trades.empty": "Aucun trade clôturé pour le moment.",
  "trades.buy": "Achat",
  "trades.sell": "Vente",
  // Compact durations: s = secondes, min = minutes, h = heures, j = jours
  "duration.s": "{s} s",
  "duration.ms": "{m} min {s} s",
  "duration.hm": "{h} h {m} min",
  "duration.dh": "{d} j {h} h",

  // Account details
  "account.title": "Compte",
  "account.split": "Votre part",
  "account.initial": "Solde de départ",
  "account.started": "Début de la phase",
  "account.ended": "Terminée le",
  "account.deadline": "Échéance",
  "account.passwordNote": "Les mots de passe de trading ont été affichés une seule fois, lors de l'achat. « Ouvrir dans Trading » vous connecte à ce compte sans eux.",

  // Payouts
  // display
  "payouts.title": "Paiements",
  "payouts.available": "Disponible maintenant",
  "payouts.eligibleCount": {
    one: "{eligible} sur {count} compte financé éligible",
    many: "{eligible} sur {count} comptes financés éligibles",
    other: "{eligible} sur {count} comptes financés éligibles",
  },
  "payouts.requests": { one: "{count} demande", many: "{count} demandes", other: "{count} demandes" },
  "payouts.count": { one: "{count} paiement", many: "{count} paiements", other: "{count} paiements" },
  "payouts.paidToDate": "Payé à ce jour",
  "payouts.funded": "Comptes financés",
  // display; {size} e.g. "$100K"
  "payouts.account": "{size} financé",
  "payouts.quote": "Estimation du paiement",
  "payouts.eligibleNow": "Éligible maintenant",
  "payouts.notYet": "Pas encore",
  "payouts.toWallet": "vers votre portefeuille",
  "payouts.yourSplit": "Votre part",
  "payouts.firmShare": "Part de la société",
  "payouts.alreadyRefunded": "Déjà remboursés",
  "payouts.withFirst": "Avec le premier paiement",
  "payouts.opens": "Ouverture le {date}.",
  "payouts.minimum": "Minimum {amount}.",
  "payouts.kycNote": "Vérifiez votre identité pour demander ce paiement.",
  "payouts.kycPendingNote": "Vous pourrez demander ce paiement une fois votre vérification d'identité approuvée.",
  "payouts.readOnly": "Cette session ne permet pas de demander des paiements.",
  "payouts.request": "Demander un paiement",
  // Opens the account's live rule dashboard; short: it shares a row with Trader
  "payouts.dashboard": "Règles",
  "payouts.history": "Historique",
  "payouts.historyEmpty": "Aucun paiement pour le moment.",
  // display
  "payouts.emptyTitle": "Aucun compte financé",
  "payouts.emptyBody": "Réussissez un challenge pour obtenir un compte financé. Demandez vos paiements ici dès qu'il dégage un profit éligible.",
  "payouts.emptyAction": "Se faire financer",
  "payoutStatus.pending": "En cours d'examen",
  "payoutStatus.approved": "Approuvé",
  "payoutStatus.paid": "Payé",
  "payoutStatus.rejected": "Rejeté",
  "payoutStatus.failed": "Échoué",
  "split.title": "Partage des profits et évolution",
  "split.upTo": "Jusqu'à {pct} % avec l'évolution",
  "split.cycle": "Paiements",
  // {days} e.g. "14 jours"
  "split.first": "Premier après {days}",
  "split.firstNow": "Dès le premier jour",
  // {months} e.g. "4 mois"; {cap} e.g. "$2,000,000"
  "scaling.text": "Réalisez {profit} % de profit sur {months} et le compte augmente de {increase} %, jusqu'à {cap}.",
  "scaling.none": "Ce plan ne fait pas évoluer le compte.",
  months: { one: "{count} mois", many: "{count} mois", other: "{count} mois" },

  // Payout request sheet
  "request.eyebrow": "Demander un paiement",
  "request.profit": "Profit sur le compte",
  "request.share": "Votre part ({pct} %)",
  "request.feeRefund": "Remboursement des frais du challenge",
  "request.total": "Total vers votre portefeuille",
  "request.note": "La totalité du profit actuel est retirée du compte de trading dès maintenant, afin qu'il ne puisse pas être reperdu en tradant pendant l'examen. Une fois la demande approuvée, votre part est créditée sur votre portefeuille USDT ; en cas de rejet, le profit est reversé sur le compte.",
  "request.submit": "Demander {amount}",
  "request.done": "Paiement demandé",
  "request.doneBody": "{amount} seront versés sur votre portefeuille USDT après approbation.",

  // Identity verification (payouts)
  "kyc.verified": "Identité vérifiée : les paiements peuvent être approuvés.",
  "kyc.pendingTitle": "Vérification en cours d'examen",
  "kyc.pendingText": "Votre vérification est en cours d'examen. Vous pourrez demander des paiements une fois votre identité vérifiée.",
  "kyc.requiredTitle": "Vérifiez votre identité",
  "kyc.requiredText": "Les paiements sont versés uniquement aux traders vérifiés. Vérifiez votre identité avant votre premier paiement.",
  "kyc.rejectedText": "Votre vérification a été rejetée. Soumettez-la à nouveau pour recevoir des paiements.",

  // Why a payout can't be requested yet
  "blocker.notYetEligible": "La fenêtre de paiement n'est pas encore ouverte.",
  "blocker.belowMinimum": "Le profit est inférieur au paiement minimum.",
  "blocker.positionsOpen": "Clôturez toutes les positions ouvertes pour demander un paiement.",
  "blocker.payoutPending": "Un paiement est déjà en cours d'examen.",
  "blocker.consistency": "Règle de régularité non respectée : votre meilleure journée représente une part trop importante du profit.",

  // Certificates
  // display
  "certs.title": "Certificats",
  "certs.subtitle": "Chaque phase réussie, chaque compte financé et chaque paiement donne lieu à un certificat vérifiable par tous.",
  "certs.kind.pass": "Phase réussie",
  "certs.kind.funded": "Trader financé",
  "certs.kind.payout": "Paiement",
  "certs.revoked": "Révoqué",
  "certs.revokedBody": "Ce certificat a été révoqué par Kalks et n'est plus valide : il ne peut donc pas être partagé.",
  "certs.meta": "{plan} · {size} · {date}",
  "certs.number": "N° {code}",
  "certs.shareImage": "Partager l'image",
  "certs.shareLink": "Partager le lien",
  "certs.copyLink": "Copier le lien",
  "certs.linkCopied": "Lien de vérification copié",
  "certs.shareTitle": "Mon certificat Kalks Prop",
  "certs.shareMessage": "Mon certificat Kalks Prop. Vérifiez-le ici :",
  "certs.shareFailed": "Impossible de partager le certificat. Veuillez réessayer.",
  "certs.shareUnavailable": "Le partage n'est pas disponible sur cet appareil.",
  // display
  "certs.emptyTitle": "Aucun certificat",
  "certs.emptyBody": "Réussissez une phase de challenge pour obtenir votre premier certificat, avec un lien public vérifiable par tous.",
  "certs.emptyAction": "Voir les challenges",

  // Rule words shared by the checkout and the rules sheet
  accountSize: "Taille du compte",
  profitSplit: "Partage des profits",
  feeRefund: "Remboursement des frais",
  nonRefundable: "Non remboursable",
  leverage: "Effet de levier",
  none: "Aucune",
  allowed: "Autorisé",
  notAllowed: "Non autorisé",
  noTimeLimit: "Sans limite de temps",
  // {phase} is the phase name, e.g. "Phase 1"
  "rules.phaseTarget": "Objectif {phase}",
  "rules.phaseMinDays": "Jours minimum {phase}",
  "rules.phaseTimeLimit": "Limite de temps {phase}",
  "rules.evaluation": "Évaluation",
  "rules.evaluationNone": "Aucune, financé dès le premier jour",
  "rules.dailyLoss": "Limite de perte journalière",
  "rules.dailyLossBalance": "{pct} % · {amount} · à partir du solde à 17:00 New York",
  "rules.dailyLossEquity": "{pct} % · {amount} · à partir du plus élevé entre solde et fonds propres à 17:00 New York",
  "rules.ddStatic": "{pct} % statique",
  "rules.ddTrailing": "{pct} % suiveur",
  "rules.ddLocks": "{dd}, bloqué au niveau de départ",
  // ≤ = au maximum
  "rules.consistencyValue": "Meilleure journée ≤ {pct} % du profit total",
  "rules.news": "Trading pendant les annonces",
  "rules.newsBlocked": "Interdit à ±{min} min des annonces à fort impact",
  "rules.newsBlockedFails": "Interdit à ±{min} min des annonces à fort impact (entraîne l'échec du compte)",
  "rules.weekendClosed": "Positions clôturées le vendredi à 16:45 New York",
  "rules.ea": "Expert Advisors",
  "rules.banned": "Stratégies interdites",
  "rules.splitScaling": "{split} %, jusqu'à {max} %",
  "rules.firstPayout": "Premier paiement",
  // {freq} is a lower-case payout cycle, e.g. "chaque semaine"
  "rules.firstPayoutValue": "Après {days}, puis {freq} · min {min}",
  "rules.refunded": "Remboursés avec le premier paiement",

  // Banned trading strategies
  "banned.hft": "Trading haute fréquence",
  "banned.latencyArbitrage": "Arbitrage de latence",
  "banned.tickScalping": "Scalping au tick",
  "banned.crossAccountCopying": "Copie entre comptes",
  "banned.crossAccountHedging": "Couverture entre comptes",
  "banned.martingale": "Martingale",
  "banned.grid": "Trading en grille",

  // Payout cycle, lower case: used inside sentences ("puis chaque semaine")
  "payoutFreq.weekly": "chaque semaine",
  "payoutFreq.biWeekly": "toutes les 2 semaines",
  "payoutFreq.monthly": "chaque mois",
  "payoutFreq.onDemand": "à la demande",

  // Errors (messages for the prop service's error codes)
  "errorLink.deposit": "Déposer",
  "errorLink.verify": "Vérifier mon identité",
  "error.insufficientFunds": "Le solde de votre portefeuille USDT est insuffisant pour ces frais. Déposez des USDT et réessayez.",
  "error.kycRequired": "Vérifiez votre identité avant de demander un paiement.",
  "error.paymentPending": "Nous n'avons pas encore pu confirmer le paiement depuis le portefeuille. Réessayez dans une minute : vous ne serez pas débité deux fois.",
  "error.paymentFailed": "Le paiement depuis le portefeuille n'a pas abouti. Vous n'avez pas été débité.",
  "error.walletPending": "Le portefeuille n'a pas encore confirmé. Veuillez réessayer dans une minute.",
  "error.walletRejected": "Le portefeuille a refusé ce paiement. Veuillez contacter l'assistance.",
  "error.provisioning": "Paiement reçu. Votre compte de trading est encore en cours d'ouverture : il apparaîtra dans vos challenges d'ici une minute.",
  "error.planUnavailable": "Ce plan ou cette taille n'est plus disponible. Veuillez en choisir un autre.",
  "error.notYetEligible": "Ce compte n'est pas encore éligible à un paiement.",
  "error.belowMinimum": "Le profit est inférieur au paiement minimum.",
  "error.positionsOpen": "Clôturez toutes les positions ouvertes avant de demander un paiement.",
  "error.payoutPending": "Un paiement pour ce compte est déjà en cours d'examen.",
  "error.consistency": "La règle de régularité n'est pas encore respectée : votre meilleure journée représente une part trop importante du profit.",
  "error.notFunded": "Les paiements sont disponibles uniquement sur les comptes financés.",
  "error.accountUnavailable": "Nous n'avons pas pu ouvrir le compte de trading de ce challenge : les frais ont donc été remboursés sur votre portefeuille USDT. Contactez l'assistance si le problème persiste.",
  "error.idempotencyConflict": "Ce paiement a déjà été utilisé pour un autre achat. Fermez-le et recommencez.",
  "error.notActive": "Ce challenge n'est pas actif.",
  "error.accountLimit": "Vous avez atteint le nombre maximal de comptes prop. Contactez l'assistance pour relever la limite.",
  "error.staffReadOnly": "Session du personnel en lecture seule. Les modifications ne sont pas autorisées.",
  "error.engine": "Le serveur de trading n'a pas répondu. Veuillez réessayer dans un instant.",
  "error.generic": "Une erreur s'est produite. Veuillez réessayer.",
  // display
  "load.title": "Prop indisponible",
  "load.body": "Nous n'avons pas pu joindre le service prop. Vos comptes sont en sécurité ; veuillez réessayer dans un instant.",
};
export default mobileProp;
