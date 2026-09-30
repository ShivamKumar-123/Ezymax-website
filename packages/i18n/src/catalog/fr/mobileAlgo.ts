import type { NsMessages } from "../../core";

// Kalks mobile app: Algo (/algo): strategies running 24/7 on the server (deployments), the kill switch, backtest
// reports, the strategy marketplace, API keys and webhooks.
// Kept as they are: Kalks, Algo, API, USDT, USD, indicator names (EMA, RSI, MACD, ATR, CCI, ADX, DI…), symbols
// (EURUSD, XAUUSD), timeframes (M15, H1, H4), "R" (a multiple of the stop distance), pips, points, P&L, DD, SL / TP.
// Titles marked (display) are shown in tall uppercase display type: keep them short.
// "Déploiement" = one strategy version running on one trading account. "Arrêt d'urgence" = the kill switch.
const mobileAlgo: NsMessages<"mobileAlgo"> = {
  never: "jamais",
  // {n} days, compact (j = jours)
  days: "{n} j",
  lot: "lot",
  // How long a trade was held: min = minutes, h = heures, j = jours (compact)
  "dur.m": "{m} min",
  "dur.h": "{h} h",
  "dur.hm": "{h} h {m} min",
  "dur.d": "{d} j",
  "dur.dh": "{d} j {h} h",
  nTrades: { one: "{count} trade", many: "{count} trades", other: "{count} trades" },
  readOnly: "Cet identifiant peut consulter les stratégies, mais ne peut rien modifier.",

  /* ---------------------------------------------------------------- */
  /* Screen states (titles are display)                                */
  /* ---------------------------------------------------------------- */
  "state.unavailable.title": "Algo indisponible",
  "state.unavailable.text": "Nous n'avons pas pu joindre le service de stratégies. Vos stratégies continuent de tourner sur le serveur ; veuillez réessayer dans un instant.",
  "state.disabled.title": "Non disponible",
  "state.disabled.text": "Cette fonctionnalité n'est pas disponible sur votre compte.",
  "state.notFound.title": "Introuvable",
  "state.notFound.text": "Il a peut-être été supprimé, ou le lien est incorrect.",
  "state.back": "Retour à Algo",

  /* ---------------------------------------------------------------- */
  /* Server errors (codes of the strategy service)                     */
  /* ---------------------------------------------------------------- */
  "error.haltedMine": "Votre arrêt d'urgence est activé. Désactivez-le sur l'écran Algo avant de relancer des stratégies.",
  "error.haltedPlatform": "Le trading automatisé est suspendu par le courtier pour le moment. Veuillez réessayer plus tard.",
  // {n} = the most strategies that can run at once
  "error.limitRunning": "Vous pouvez faire tourner jusqu'à {n} stratégies à la fois. Arrêtez-en d'abord une.",
  "error.accountStatus": "Ce compte ne peut pas trader pour le moment.",
  "error.alreadyRunning": "Cette version tourne déjà sur ce compte.",
  "error.invalidStrategy": "Corrigez d'abord les erreurs de la stratégie (dans l'espace client ou avec le Trader IA).",
  "error.state": "L'état a déjà changé. Tirez vers le bas pour voir l'état actuel.",
  "error.queueFull": "Vous avez déjà 3 backtests en file d'attente ou en cours. Attendez que l'un d'eux se termine.",
  "error.dailyLimit": "Vous avez atteint la limite quotidienne de {n} backtests.",
  "error.ownListing": "Vous ne pouvez pas vous abonner à votre propre stratégie.",
  "error.subscribed": "Vous êtes déjà abonné à cette stratégie.",
  "error.cloneNotAllowed": "L'auteur n'autorise pas le clonage ; copiez-la plutôt sur votre compte.",
  // {amount} in USDT
  "error.insufficientFunds": "Le solde de votre portefeuille est inférieur à {amount} USDT. Déposez des USDT pour vous abonner.",
  "error.insufficientFundsPlain": "Le solde de votre portefeuille est insuffisant. Déposez des USDT pour vous abonner.",
  "error.inactive": "Cet abonnement n'est plus actif.",
  "error.archiveRunning": "Arrêtez les déploiements de cette stratégie avant de l'archiver.",
  "error.archived": "Cette stratégie est archivée.",
  "error.finished": "Ce backtest est déjà terminé.",
  "error.revoked": "Cette clé est déjà révoquée.",
  "error.notFound": "Cet élément n'existe plus.",
  // {tf} = timeframe (H1), {days} = number of days
  "error.rangeTooLong": "Les backtests en {tf} peuvent couvrir {days} jours au maximum. Choisissez une période plus courte.",
  "error.balanceRange": "Le solde initial doit être compris entre 100 et 10 000 000.",
  "error.dates": "La date de début doit précéder la date de fin.",

  /* ---------------------------------------------------------------- */
  /* Home                                                              */
  /* ---------------------------------------------------------------- */
  "home.eyebrow": "Trading automatisé",
  // (display)
  "home.title": "Algo",
  "home.heroEyebrow": "En cours",
  "home.heroRunning": {
    zero: "stratégie active 24h/24 sur le serveur",
    one: "stratégie active 24h/24 sur le serveur",
    many: "stratégies actives 24h/24 sur le serveur",
    other: "stratégies actives 24h/24 sur le serveur",
  },
  "home.heroRealized": "P&L réalisé",
  "home.heroOpen": "Ouvertes",
  // Closed trades so far
  "home.heroTrades": "Trades",
  "home.qaAi": "Créer avec l'IA",
  "home.qaAiHint": "Décrivez une idée, obtenez des règles précises",
  "home.qaMarket": "Marketplace",
  "home.qaMarketHint": "Copiez des stratégies vérifiées",
  "home.qaKeys": "Clés API et webhooks",
  "home.qaKeysHint": "Utilisation, révocation, alertes récentes",
  // (display)
  "home.running": "Déploiements",
  "home.runningSub": { zero: "Rien ne tourne pour le moment", one: "{count} en cours", many: "{count} en cours", other: "{count} en cours" },
  // {n} = count shown on the filter pill
  "home.filterActive": "Actifs · {n}",
  "home.filterAll": "Tous · {n}",
  // (display)
  "home.strategies": "Mes stratégies",
  "home.strategiesSub": { zero: "Aucune enregistrée", one: "{count} enregistrée", many: "{count} enregistrées", other: "{count} enregistrées" },
  "home.newWithAi": "Nouvelle avec l'IA",
  // (display)
  "home.backtests": "Backtests",
  "home.backtestsSub": "Les derniers, du plus récent au plus ancien",
  "home.emptyDeps": "Rien n'a encore tourné. Ouvrez l'une de vos stratégies ci-dessous et déployez-la d'abord sur un compte démo.",
  "home.emptyActive": "Rien ne tourne pour le moment. Les stratégies arrêtées sont dans Tous.",
  "home.showAll": "Tout afficher",
  "home.emptyStrats": "Vous n'avez pas encore de stratégie. Décrivez votre idée au Trader IA : elle devient des règles précises que vous pouvez tester.",
  "home.browseMarket": "Parcourir la marketplace",
  "home.emptyBts": "Aucun backtest pour l'instant. Ouvrez une stratégie et lancez-en un sur l'historique réel des prix.",
  "home.startEyebrow": "Pour commencer",
  // (display)
  "home.startTitle": "Lancez une stratégie",
  "home.step1": "Décrivez votre idée au Trader IA : elle devient des règles précises que vous pouvez lire et modifier.",
  "home.step2": "Backtestez les règles sur l'historique réel des prix, avec les coûts de votre compte.",
  "home.step3": "Faites-la d'abord tourner 24h/24 sur un compte démo. Mettez-la en pause, arrêtez-la ou stoppez-la d'urgence à tout moment.",
  "home.footnote": "Les stratégies tournent sur les serveurs Kalks 24h/24, sur barres clôturées, avec les mêmes contrôles d'ordres que le trading manuel : marge, horaires de marché, vos limites. Créez et modifiez vos stratégies avec le Trader IA ou dans l'espace client.",
  "home.openWeb": "Ouvrir le constructeur de stratégies sur le web",

  /* ---------------------------------------------------------------- */
  /* Kill switch (account-wide)                                        */
  /* ---------------------------------------------------------------- */
  "kill.cardTitle": "Arrêt d'urgence",
  "kill.cardBody": "Arrêtez toutes les stratégies d'un coup et bloquez les ordres webhook et API.",
  "kill.stopAll": "Tout arrêter",
  "kill.onTitle": "L'arrêt d'urgence est activé",
  // {at} = date and time
  "kill.onSince": "Depuis le {at}. Les stratégies sont arrêtées ; les ordres webhook et API sont bloqués.",
  "kill.onBody": "Les stratégies sont arrêtées ; les ordres webhook et API sont bloqués.",
  "kill.release": "Désactiver",
  // (display)
  "kill.title": "Tout arrêter ?",
  "kill.body": {
    zero: "Toutes les stratégies s'arrêtent immédiatement, et les ordres webhook et API sont bloqués jusqu'à ce que vous désactiviez l'arrêt d'urgence.",
    one: "La stratégie en cours s'arrête immédiatement, et les ordres webhook et API sont bloqués jusqu'à ce que vous désactiviez l'arrêt d'urgence.",
    many: "Les {count} stratégies en cours s'arrêtent immédiatement, et les ordres webhook et API sont bloqués jusqu'à ce que vous désactiviez l'arrêt d'urgence.",
    other: "Les {count} stratégies en cours s'arrêtent immédiatement, et les ordres webhook et API sont bloqués jusqu'à ce que vous désactiviez l'arrêt d'urgence.",
  },
  "kill.alsoClose": "Clôturer aussi leurs positions",
  "kill.alsoCloseHint": "Clôture au marché toutes les positions ouvertes par une stratégie, un webhook ou l'API sur tous vos comptes. Vos trades manuels restent ouverts.",
  "kill.confirm": "Tout arrêter maintenant",
  // (display)
  "kill.doneTitle": "Tout est arrêté",
  "kill.stopped": "Stratégies arrêtées",
  "kill.doneBody": "L'arrêt d'urgence reste activé jusqu'à ce que vous le désactiviez. Les stratégies arrêtées ne redémarrent pas d'elles-mêmes.",
  // (display)
  "kill.releaseTitle": "Désactiver l'arrêt d'urgence ?",
  "kill.releaseBody": "Les ordres webhook et API sont de nouveau autorisés. Les stratégies arrêtées le restent : redéployez-les quand vous êtes prêt.",
  // (display)
  "kill.releasedTitle": "Arrêt désactivé",
  "kill.releasedBody": "Les ordres webhook et API sont de nouveau autorisés. Déployez une stratégie pour la lancer.",
  "kill.globalTitle": "Le trading automatisé est suspendu",
  "kill.globalBody": "Le courtier a suspendu toutes les stratégies et tous les ordres webhook et API pour le moment. Les positions ouvertes conservent leurs stops.",

  /* ---------------------------------------------------------------- */
  /* Deployment statuses, controls                                     */
  /* ---------------------------------------------------------------- */
  "dep.status.running": "En cours",
  "dep.status.paused": "En pause",
  "dep.status.stopped": "Arrêtée",
  "dep.status.killed": "Stoppée d'urgence",
  "dep.status.error": "Erreur",
  "dep.realized": "P&L réalisé",
  "dep.trades": "Trades",
  "dep.winRate": "Taux de réussite",
  "dep.open": "Ouvertes",
  "dep.orders": "Ordres",
  "dep.openNow": "Ouverte",
  // {ago} = "il y a 5 minutes" (or "jamais")
  "dep.lastCheck": "Dernière barre vérifiée : {ago}",
  // {since} = start date
  "dep.lastCheckSince": "Dernière barre vérifiée : {ago} · en cours depuis le {since}",
  // {reason} = the service's reason, e.g. "stopped by the owner"
  "dep.stoppedWhy": "Arrêtée : {reason}",
  "dep.stoppedTitle": "Arrêtée le {at}",
  "dep.errorTitle": "La stratégie a rencontré une erreur",
  // {account} = "Démo · 50000083"
  "dep.eyebrow": "Déploiement · {account}",
  "dep.marketplaceCopy": "Copie depuis la marketplace",
  "dep.openStrategy": "Ouvrir la stratégie",
  "dep.openSubscription": "Ouvrir mes abonnements",
  // {pct} = return %, {amount} = starting balance
  "dep.onStart": "{pct} sur {amount}",
  "dep.curveA11y": "Solde par jour sur {days} jours, réalisé {pnl}",
  "dep.tabLog": "Journal · {n}",
  "dep.tabTrades": "Trades · {n}",
  "dep.tabSetup": "Configuration",
  "dep.noLogs": "Rien de journalisé pour l'instant : la première barre clôturée sert de préchauffage.",
  "dep.noTrades": "Aucun trade pour l'instant.",
  "dep.older": "Charger les entrées plus anciennes",
  "dep.logStart": "C'est la première entrée.",
  "dep.rules": "Règles",
  "dep.rulesHidden": "L'auteur garde les règles privées : la stratégie tourne sur votre compte telle qu'elle a été publiée.",
  "dep.lotMultiplier": "Multiplicateur de lot",
  "dep.maxLots": "Lots max par ordre",
  "dep.maxOpen": "Positions ouvertes max",
  "dep.dailyLoss": "Limite de perte journalière",
  "dep.started": "Démarrée le",
  "dep.startBalance": "Solde de départ",
  "dep.setupNote": "Un déploiement exécute une version précise : enregistrer une nouvelle version ne le modifie pas. Déployez la nouvelle version pour basculer.",

  "ctl.pause": "Pause",
  "ctl.resume": "Reprendre",
  "ctl.stop": "Arrêter",
  "ctl.kill": "Stopper",
  "ctl.killNow": "Stopper maintenant",
  "ctl.closePositions": "Clôturer les positions",
  // (display)
  "ctl.pauseTitle": "La mettre en pause ?",
  "ctl.pauseBody": "Aucun nouveau trade. Les positions ouvertes conservent leur stop, leur objectif et leur seuil de rentabilité. Reprenez quand vous le souhaitez.",
  // (display)
  "ctl.resumeTitle": "La reprendre ?",
  "ctl.resumeBody": "Elle trade de nouveau à partir de la prochaine barre clôturée.",
  // (display)
  "ctl.stopTitle": "L'arrêter ?",
  "ctl.stopBody": "Elle s'arrête définitivement : aucun nouveau trade. Pour la relancer, déployez-la à nouveau.",
  "ctl.keepTitle": "Garder les positions ouvertes",
  "ctl.keepText": {
    one: "La position ouverte conserve son stop et son objectif ; gérez-la vous-même.",
    many: "Les {count} positions ouvertes conservent leurs stops et objectifs ; gérez-les vous-même.",
    other: "Les {count} positions ouvertes conservent leurs stops et objectifs ; gérez-les vous-même.",
  },
  "ctl.closeAllTitle": "Les clôturer maintenant",
  "ctl.closeAllText": {
    one: "La position ouverte est clôturée au marché.",
    many: "Les {count} positions ouvertes sont clôturées au marché.",
    other: "Les {count} positions ouvertes sont clôturées au marché.",
  },
  // (display)
  "ctl.killTitle": "La stopper maintenant ?",
  "ctl.killBody": "L'arrêt d'urgence stoppe immédiatement cette stratégie et, par défaut, clôture au marché les positions qu'elle a ouvertes.",
  "ctl.killClose": "Clôturer ses positions",
  "ctl.killCloseHint": "Au marché, maintenant. Désactivez pour les garder ouvertes avec leurs stops.",
  // (display)
  "ctl.closeTitle": "Clôturer ses positions ?",
  "ctl.closeBody": {
    one: "La position ouverte par cette stratégie est clôturée au marché. La stratégie continue de tourner.",
    many: "Les {count} positions ouvertes par cette stratégie sont clôturées au marché. La stratégie continue de tourner.",
    other: "Les {count} positions ouvertes par cette stratégie sont clôturées au marché. La stratégie continue de tourner.",
  },
  // (display)
  "ctl.done.pause": "En pause",
  // (display)
  "ctl.done.resume": "Relancée",
  // (display)
  "ctl.done.stop": "Arrêtée",
  // (display)
  "ctl.done.kill": "Stoppée",
  // (display)
  "ctl.done.close": "Positions clôturées",
  "ctl.donePause": "Aucun nouveau trade tant que vous ne la reprenez pas.",
  "ctl.doneResume": "Elle trade de nouveau à partir de la prochaine barre clôturée.",
  "ctl.doneClosed": { one: "{count} position a été clôturée.", many: "{count} positions ont été clôturées.", other: "{count} positions ont été clôturées." },
  "ctl.doneKept": "Ses positions ouvertes, s'il y en a, restent ouvertes avec leurs stops et objectifs.",
  "ctl.doneNothing": "Il n'y avait rien d'ouvert à clôturer.",
  "ctl.closedLabel": "Clôturées",
  "ctl.failedLabel": "Non clôturées",
  "ctl.failedTitle": {
    one: "{count} position n'a pas pu être clôturée",
    many: "{count} positions n'ont pas pu être clôturées",
    other: "{count} positions n'ont pas pu être clôturées",
  },
  "ctl.failedBody": "Le marché est peut-être fermé. Clôturez depuis le Portfolio à la réouverture du trading.",
  // Stopping or killing a marketplace copy leaves its subscription (and a paid one's renewals) running
  "ctl.copyNote": "Il s'agit d'une copie depuis la marketplace : l'arrêter ne met pas fin à l'abonnement. Pour ne plus payer, résiliez-le dans Marketplace › Abonnements.",

  /* ---------------------------------------------------------------- */
  /* Strategy                                                          */
  /* ---------------------------------------------------------------- */
  // {version} = version number
  "strat.eyebrow": "Stratégie · v{version}",
  "strat.runningN": { one: "En cours", many: "{count} en cours", other: "{count} en cours" },
  "strat.draft": "Brouillon",
  "strat.ready": "Prête",
  "strat.errors": { one: "{count} erreur", many: "{count} erreurs", other: "{count} erreurs" },
  "strat.archivedTag": "Archivée",
  "strat.lastBacktest": "Dernier backtest",
  "strat.backtested": "backtest",
  // (display)
  "strat.notTested": "Pas encore testée",
  "strat.notTestedBody": "Testez les règles sur l'historique réel des prix, avec les coûts de votre compte, avant de les exécuter.",
  "strat.runFirst": "Lancer un backtest",
  "strat.openReport": "Ouvrir le rapport complet",
  "strat.deployV": "Déployer v{version}",
  "strat.backtest": "Backtest",
  "strat.fixFirst": "À corriger avant de tester ou de déployer",
  "strat.line": "Ligne {n} :",
  // (display)
  "strat.rules": "Règles",
  "strat.rulesSub": "Vérifiées à chaque barre clôturée",
  "strat.rulesCodeSub": "Les signaux du code, vérifiés à chaque barre clôturée",
  "strat.showCode": "Afficher en code",
  // (display)
  "strat.risk": "Risque",
  "strat.riskSub": "Taille, stops, horaires et limites",
  "strat.editVisual": "Pour modifier les règles, demandez au Trader IA ou modifiez-les dans l'espace client ; chaque modification est enregistrée comme une nouvelle version.",
  "strat.editCode": "Les stratégies en code se modifient dans l'espace client sur le web ; chaque modification est enregistrée comme une nouvelle version.",
  "strat.openWeb": "Modifier le code sur le web",
  // (display)
  "strat.deployments": "Déploiements",
  "strat.deploymentsSub": { zero: "Ne tourne nulle part", one: "{count} déploiement", many: "{count} déploiements", other: "{count} déploiements" },
  "strat.notRunning": "Ne tourne pas. Déployez-la d'abord sur un compte démo pour voir comment elle trade en direct.",
  // (display)
  "strat.backtests": "Backtests",
  "strat.backtestsSub": { zero: "Aucun pour l'instant", one: "{count} exécution", many: "{count} exécutions", other: "{count} exécutions" },
  "strat.runNew": "Nouveau",
  "strat.noBacktests": "Aucun backtest pour l'instant.",
  // (display)
  "strat.versions": "Versions",
  "strat.versionsSub": { one: "{count} version", many: "{count} versions", other: "{count} versions" },
  "strat.current": "Actuelle",
  "strat.archive": "Archiver",
  // (display)
  "strat.archiveTitle": "L'archiver ?",
  "strat.archiveBody": "« {name} » quitte votre liste. Ses backtests et déploiements passés restent dans votre historique.",
  "strat.archived": "« {name} » archivée",

  "kind.visual": "Règles visuelles",
  "kind.code": "Code",
  // Where a strategy came from
  "origin.ai": "Trader IA",
  "origin.template": "Modèle",
  "origin.manual": "Créée à la main",
  "origin.marketplace": "Marketplace",

  /* ---------------------------------------------------------------- */
  /* Rules in words                                                    */
  /* ---------------------------------------------------------------- */
  "rules.buy": "Acheter quand",
  "rules.sell": "Vendre quand",
  "rules.exitBuy": "Clôturer les achats quand",
  "rules.exitSell": "Clôturer les ventes quand",
  "rules.and": "et",
  "rules.or": "ou",
  // {tf} = timeframe, e.g. "en H4"
  "rules.onTf": "en {tf}",
  "rules.noRules": "Aucune règle d'entrée pour l'instant.",
  "rules.size": "Taille",
  "rules.stop": "Stop Loss",
  "rules.target": "Take Profit",
  "rules.trailing": "Stop suiveur",
  "rules.window": "Plage horaire",
  "rules.limits": "Limites",
  "rules.none": "Aucun",
  "rules.lots": "{lots} lot",
  "rules.riskPct": "Risque de {pct} % par trade",
  "rules.maxLots": "max. {lots} lot",
  // Points: move the stop to entry + {o} after {v} points in profit
  "rules.breakeven": "seuil de rentabilité à {v} points (+{o})",
  "rules.allDay": "24h/24",
  "rules.perDay": { one: "{count} trade par jour", many: "{count} trades par jour", other: "{count} trades par jour" },
  "rules.dailyLoss": "Arrêt pour la journée après une perte de {amount}",
  "rules.oneAtATime": "Une position à la fois",
  "rules.closeOutside": "Clôture hors de la plage horaire",
  "rules.noLimits": "Aucune limite quotidienne",
  "op.crossesAbove": "croise au-dessus de",
  "op.crossesBelow": "croise en dessous de",
  "dist.pips": "{v} pips",
  "dist.points": "{v} points",
  "dist.price": "à {v}",
  "dist.percent": "{v} % du prix",
  // {v} × ATR({p})
  "dist.atr": "{v} × ATR({p})",
  "dist.level": "niveau {v}",
  // A multiple of the stop distance
  "dist.rr": "{v}R",
  "field.close": "Clôture",
  "field.open": "Ouverture",
  "field.high": "Plus haut",
  "field.low": "Plus bas",
  "field.hl2": "Prix médian",
  "field.hlc3": "Prix typique",
  "field.ohlc4": "Prix moyen",
  "field.volume": "Volume",
  "pattern.bullish": "Bougie haussière",
  "pattern.bearish": "Bougie baissière",
  "pattern.bullish_engulfing": "Avalement haussier",
  "pattern.bearish_engulfing": "Avalement baissier",
  "pattern.hammer": "Marteau",
  "pattern.shooting_star": "Étoile filante",
  "pattern.doji": "Doji",
  "pattern.inside_bar": "Inside bar",
  "ind.sma": "SMA",
  "ind.ema": "EMA",
  "ind.wma": "WMA",
  "ind.rsi": "RSI",
  "ind.macd": "MACD",
  "ind.macd_signal": "Signal MACD",
  "ind.macd_hist": "Histogramme MACD",
  "ind.bb_upper": "Bollinger supérieure",
  "ind.bb_middle": "Bollinger médiane",
  "ind.bb_lower": "Bollinger inférieure",
  "ind.atr": "ATR",
  "ind.stoch_k": "Stochastique %K",
  "ind.stoch_d": "Stochastique %D",
  "ind.highest": "Plus haut des hauts",
  "ind.lowest": "Plus bas des bas",
  "ind.cci": "CCI",
  "ind.willr": "Williams %R",
  "ind.adx": "ADX",
  "ind.plus_di": "+DI",
  "ind.minus_di": "−DI",
  "ind.momentum": "Momentum",
  "ind.roc": "ROC",
  "ind.stddev": "Écart type",
  "note.noDailyLimit": "Aucune limite quotidienne de trades",
  "note.noStop": "Pas de Stop Loss : les positions ne sont pas protégées",
  "note.riskNeedsStop": "Une taille basée sur le risque nécessite un Stop Loss",
  "note.rrNeedsStop": "Un Take Profit en R nécessite un Stop Loss",
  "note.noEntry": "Aucune règle d'entrée : ajoutez une condition d'achat ou de vente",

  /* ---------------------------------------------------------------- */
  /* Deploy (form)                                                     */
  /* ---------------------------------------------------------------- */
  "deploy.eyebrow": "Déployer · v{version}",
  // (display)
  "deploy.title": "Exécution 24h/24",
  "deploy.body": "« {name} » v{version} trade {symbol} à chaque barre {tf} clôturée, sur les serveurs Kalks, même lorsque votre téléphone est éteint. Mettez-la en pause, arrêtez-la ou stoppez-la à tout moment.",
  "deploy.account": "Compte",
  "deploy.equity": "Fonds propres {amount}",
  "deploy.noAccounts": "Vous avez besoin d'un compte de trading actif. Ouvrez un compte démo pour essayer des stratégies sans risque.",
  "deploy.openAccount": "Ouvrir un compte",
  "deploy.multiplier": "Multiplicateur de lot",
  "deploy.multiplierHint": "Ajuste la taille de chaque ordre. 1× trade la taille propre à la stratégie.",
  "deploy.maxOpen": "Positions ouvertes max",
  "deploy.maxOpenHint": "Un plafond qui s'ajoute aux règles de la stratégie.",
  "deploy.strategyDefault": "Règle de la stratégie",
  "deploy.dailyLoss": "Limite de perte journalière",
  "deploy.dailyLossHint": "Lorsque la perte clôturée et latente du jour l'atteint, aucun nouveau trade jusqu'au lendemain (heure du serveur).",
  "deploy.off": "Désactivée",
  "deploy.custom": "Personnalisée",
  "deploy.dailyLossAmount": "Perte par jour",
  "deploy.lossInvalid": "Saisissez un montant supérieur à 0.",
  "deploy.liveTitle": "Argent réel",
  "deploy.liveBody": "Il s'agit d'un compte réel. La stratégie passe des ordres réels avec de l'argent réel, et peut en perdre.",
  "deploy.ack": "Je comprends que la stratégie trade de l'argent réel sur mon compte réel et que j'en suis responsable.",
  "deploy.note": "Le trading automatisé peut entraîner des pertes. Les backtests sont des simulations et ne prédisent pas les résultats futurs. Ceci n'est pas un conseil financier.",
  // {account} = "Démo · 50000083"
  "deploy.confirm": "Déployer sur {account}",
  // (display)
  "deploy.doneTitle": "En cours",
  "deploy.doneBody": "« {name} » v{version} tourne sur {account}.",
  "deploy.warmup": "La première barre {tf} clôturée sert de préchauffage ; les ordres peuvent partir dès la suivante.",
  "deploy.open": "Ouvrir le déploiement",

  /* ---------------------------------------------------------------- */
  /* Backtests                                                         */
  /* ---------------------------------------------------------------- */
  "bt.status.queued": "En file d'attente",
  "bt.status.running": "En cours",
  "bt.status.done": "Terminé",
  "bt.status.failed": "Échec",
  "bt.status.cancelled": "Annulé",
  "bt.stage.queued": "En attente d'un serveur de calcul libre",
  "bt.stage.loading": "Chargement de l'historique des prix",
  "bt.stage.m1": "Chargement des barres minute",
  "bt.stage.simulating": "Simulation des trades",
  "bt.stage.running": "En cours",
  // {id} = backtest number, {version} = strategy version
  "bt.eyebrow": "Backtest #{id} · v{version}",
  // (display)
  "bt.title": "Backtest",
  "bt.start": "Départ {amount}",
  "bt.runningNote": "Il s'exécute sur le serveur : vous pouvez quitter cet écran et revenir plus tard.",
  "bt.failed": "Le backtest a échoué",
  // (display)
  "bt.cancelled": "Annulé",
  "bt.runAgain": "Relancer",
  "bt.net": "Profit net",
  // {pct} = return, {amount} = starting balance
  "bt.returnOf": "{pct} sur {amount}",
  "bt.pf": "Profit factor",
  "bt.winRate": "Taux de réussite",
  "bt.winsOf": "{wins} sur {trades}",
  "bt.maxDd": "Drawdown max",
  "bt.maxDdShort": "DD max",
  "bt.sharpe": "Sharpe",
  "bt.sortino": "Sortino {v}",
  "bt.trades": "Trades",
  "bt.longShort": "{long} long · {short} short",
  "bt.expectancy": "Espérance",
  "bt.perTrade": "par trade",
  // (display)
  "bt.equity": "Fonds propres",
  "bt.drawdown": "Drawdown",
  "bt.legendEquity": "Fonds propres",
  "bt.legendBalance": "Solde",
  "bt.legendStart": "Départ",
  "bt.noCurve": "Pas assez de barres pour tracer une courbe.",
  "bt.scrubHint": "Faites glisser le doigt sur le graphique, ou maintenez-le appuyé, pour lire n'importe quel point.",
  "bt.curveA11y": "Fonds propres du {from} au {to} ; drawdown maximal {dd}",
  // (display)
  "bt.monthly": "Par mois",
  "bt.monthlySub": "Rendement de chaque mois, en % du solde",
  "bt.noTradesMonth": "aucun trade",
  // (display)
  "bt.statistics": "Statistiques",
  // (display)
  "bt.tradeList": "Trades",
  "bt.tradeListSub": "Du plus récent au plus ancien, nets de coûts",
  "bt.truncated": "Les {n} premiers trades, du plus récent au plus ancien",
  "bt.fAll": "Tous · {n}",
  "bt.fWins": "Gains · {n}",
  "bt.fLosses": "Pertes · {n}",
  "bt.noTrades": "Les règles n'ont pas tradé sur cette période.",
  // (display)
  "bt.data": "Données et coûts",
  "bt.m1Bars": "Barres minute (intrabar)",
  "bt.since": "depuis le {date}",
  "bt.signals": "Signaux",
  "bt.signalsValue": "{buy} achat · {sell} vente · {exits} sortie",
  "bt.skipped": "Ignorés : {reason}",
  "bt.model": "Modèle",
  "bt.group": "Type de compte",
  "bt.spread": "Spread",
  "bt.spreadValue": "{points} points ({source})",
  "bt.commission": "Commission",
  "bt.perLot": "{amount} par lot",
  "bt.swaps": "Swaps",
  "bt.swapsOn": "Prélevés à chaque rollover",
  "bt.swapsOff": "Non prélevés (sans swap)",
  "bt.conversion": "Conversion du P&L",
  "bt.usdBase": "USD en devise de base : au prix de sortie",
  "bt.usdQuoted": "Coté en USD",
  "bt.currentRate": "Au taux actuel ({rate})",
  "bt.simNote": "Le backtest #{id} est une simulation sur des prix passés : exécutions à l'ouverture de la barre suivante, stops et objectifs sur un parcours OHLC (barres minute lorsqu'elles existent), spread, commission et swaps de votre type de compte. Les résultats passés ne prédisent pas les résultats futurs.",
  // History sources and skip reasons from the service
  "source.native": "natif",
  "source.built_from_M1": "construit à partir de M1",
  "source.built_from_M5": "construit à partir de M5",
  "source.built_from_M15": "construit à partir de M15",
  "source.built_from_M30": "construit à partir de M30",
  "source.built_from_H1": "construit à partir de H1",
  "skip.outside_trading_window": "hors plage horaire",
  "skip.position_already_open": "une position était déjà ouverte",
  "skip.daily_trade_limit": "limite quotidienne de trades",
  "skip.max_daily_loss": "limite de perte journalière",
  "skip.market_closed": "marché fermé",
  "skip.20_open_positions": "20 positions déjà ouvertes",
  "skip.buy_and_sell_on_the_same_bar": "achat et vente sur la même barre",
  "skip.stop_distance_not_ready": "distance du stop pas encore disponible",
  "skip.SL_level_on_the_wrong_side": "niveau du stop du mauvais côté",
  "skip.volume_below_the_minimum_lot": "taille inférieure au lot minimum",
  "spreadSource.group_quote": "cotation en direct de votre type de compte",
  "spreadSource.catalogue": "spread du catalogue",
  "spreadSource.fixed": "fixe",

  // (display)
  "btNew.title": "Lancer un backtest",
  "btNew.period": "Période",
  "btNew.balance": "Solde initial",
  "btNew.other": "Autre",
  "btNew.amount": "Montant",
  "btNew.costs": "Coûts selon",
  "btNew.accountType": "Type de compte",
  "btNew.myAccount": "Mon compte",
  "btNew.costsGroupHint": "Le spread, la commission et les swaps de ce type de compte.",
  "btNew.costsAccountHint": "Le spread, la commission et les swaps du groupe de ce compte.",
  "btNew.noAccounts": "Vous n'avez pas encore de compte de trading actif.",
  "btNew.run": "Lancer le backtest",
  "btNew.note": "La période maximale dépend de l'unité de temps. Jusqu'à 3 backtests peuvent s'exécuter en même temps.",

  // 1M = 1 mois, 1A = 1 an
  "period.p1m": "1M",
  "period.p3m": "3M",
  "period.p6m": "6M",
  "period.p1y": "1A",
  "period.p2y": "2A",
  "period.p5y": "5A",

  // Trade exit reasons (server codes)
  "exit.sl": "Stop Loss",
  "exit.tp": "Take Profit",
  "exit.trailing": "Stop suiveur",
  "exit.breakeven": "Seuil de rentabilité",
  "exit.signal": "Signal",
  "exit.exit_rule": "Règle de sortie",
  "exit.session": "Hors horaires",
  "exit.end_of_test": "Fin du test",
  "exit.stop_out": "Stop out",
  "exit.kill": "Arrêt d'urgence",
  "exit.stopped": "Arrêtée",
  "exit.client": "Clôturé",
  "exit.close": "Clôturé",

  "stat.balance": "Solde",
  "stat.gross": "Profit brut / perte brute",
  "stat.cagr": "Croissance annuelle (CAGR)",
  "stat.avgWinLoss": "Gain / perte moyens",
  "stat.largest": "Plus gros gain / plus grosse perte",
  "stat.payoff": "Ratio de gain",
  "stat.long": "Trades long · taux de réussite",
  "stat.short": "Trades short · taux de réussite",
  "stat.streaks": "Gains / pertes consécutifs max",
  "stat.maxDd": "Drawdown max",
  "stat.recovery": "Facteur de récupération",
  "stat.sharpeSortino": "Sharpe / Sortino",
  "stat.avgBars": "Durée moyenne en barres",
  "stat.exposure": "Temps en position",
  "stat.costs": "Commission / swap / spread",
  "stat.bars": "Barres testées",
  "stat.cpu": "Calculé en",
  "stat.seconds": "{s} s",

  /* ---------------------------------------------------------------- */
  /* Log kinds (runtime)                                               */
  /* ---------------------------------------------------------------- */
  "log.eval": "Barre",
  "log.signal": "Signal",
  "log.order": "Ordre",
  "log.close": "Clôture",
  "log.manage": "Gestion",
  "log.error": "Erreur",
  "log.info": "Info",

  /* ---------------------------------------------------------------- */
  /* Marketplace                                                       */
  /* ---------------------------------------------------------------- */
  "house.badge": "Stratégie maison · Opérée par Kalks",
  "house.disclosure":
    "Stratégie maison opérée par Kalks : un compte réel appartenant au courtier qui exécute cette stratégie. L'historique repose uniquement sur ses propres trades réels depuis son lancement ; rien n'est simulé ni reconstitué.",
  "market.eyebrow": "Marketplace de stratégies",
  // (display)
  "market.title": "Marketplace",
  "market.subtitle": "Des stratégies à l'historique vérifié sur de vrais comptes Kalks. Copiez-en une sur votre compte, ou clonez ses règles si l'auteur l'autorise.",
  "market.browse": "Parcourir",
  "market.subs": "Abonnements",
  "market.subsN": "Abonnements · {n}",
  "market.mine": "Vos annonces",
  "market.search": "Rechercher des stratégies, des auteurs…",
  "market.clear": "Effacer la recherche",
  "market.all": "Toutes",
  "market.free": "Gratuites",
  "market.paid": "Payantes",
  "market.newest": "Plus récentes",
  "market.topRated": "Mieux notées",
  "market.popular": "Populaires",
  // {price} in USDT
  "market.perMonth": "{price} USDT/mois",
  "market.by": "par {author}",
  "market.return": "Rendement",
  "market.winRate": "Taux de réussite",
  "market.maxDd": "DD max",
  "market.trades": "Trades",
  // {type} = réel / démo (lower case)
  "market.verified": "Vérifié en {type}",
  "market.verifiedDays": "vérifié en {type} · {days} jours",
  // A track record younger than a day
  "market.verifiedNew": "vérifié en {type} · moins d'un jour",
  "market.subscribed": "Abonné",
  "market.ratings": { zero: "Aucune note", one: "{count} note", many: "{count} notes", other: "{count} notes" },
  "market.subscribers": { one: "{count} abonné", many: "{count} abonnés", other: "{count} abonnés" },
  // (display)
  "market.emptyTitle": "Rien de publié",
  "market.emptyText": "Les stratégies apparaissent ici dès que leurs auteurs les publient avec un historique vérifié.",
  // (display)
  "market.noMatchTitle": "Aucun résultat",
  "market.noMatchText": "Essayez une autre recherche ou un autre filtre.",
  // (display)
  "market.noSubsTitle": "Aucun abonnement",
  "market.noSubsText": "Les stratégies que vous copiez ou clonez depuis la marketplace apparaissent ici.",
  "market.disclaimer": "Les performances passées ne garantissent pas les résultats futurs. Les historiques proviennent de comptes réels ou démo sur Kalks et sont identifiés comme tels. Frais de plateforme sur les abonnements payants : {pct} %.",
  "market.houseFootnote": "Les stratégies maison tournent sur des comptes réels appartenant au courtier ; leurs historiques reposent uniquement sur leurs propres trades réels.",
  "market.earned": "Gagné",
  "market.fees": "Frais de plateforme",
  "market.payments": "Paiements",
  "market.publishWeb": "La publication d'une stratégie (avec son historique vérifié) et la modification d'une annonce se font dans l'espace client sur le web.",
  "market.openWeb": "Ouvrir la marketplace sur le web",

  // Listing statuses (server values)
  "listing.pending": "En cours d'examen",
  "listing.approved": "Publiée",
  "listing.rejected": "Refusée",
  "listing.suspended": "Suspendue",
  "listing.unlisted": "Retirée",
  "listing.eyebrow": "Marketplace · {symbol} {tf}",
  "listing.verified": "Historique vérifié en {type}",
  "listing.cloneAllowed": "Clonage autorisé",
  "listing.trackReturn": "Rendement vérifié",
  "listing.net": "Net",
  "listing.noCurve": "La courbe jour par jour apparaît après deux jours de trading.",
  "listing.curveA11y": "Fonds propres par jour sur {days} jours, rendement {ret}",
  "listing.trackNote": "Issu du propre déploiement de l'auteur sur Kalks depuis le {since}, calculé à partir des transactions clôturées sur le moteur de trading : jamais saisi par l'auteur.",
  "listing.btSimulated": "Backtest · simulé",
  "listing.btNote": "Comment les règles auraient tradé sur les prix passés avec les coûts de ce type de compte. Il ne fait pas partie de l'historique réel ci-dessus.",
  "listing.btA11y": "Courbe des fonds propres du backtest (simulée)",
  // (display)
  "listing.about": "À propos",
  // (display)
  "listing.risk": "Risque",
  // (display)
  "listing.rules": "Règles",
  "listing.rulesPrivate": "Les règles sont privées : copiez la stratégie pour l'exécuter sur votre compte.",
  // (display)
  "listing.reviews": "Avis · {n}",
  "listing.noReviews": "Aucun avis pour l'instant.",
  "listing.subscribeFree": "S'abonner gratuitement",
  "listing.subscribePaid": "S'abonner · {price} USDT / mois",
  "listing.copying": "Copie sur le compte {login}",
  "listing.clonedTo": "Clonée dans vos stratégies",
  "listing.openDeployment": "Ouvrir le déploiement",
  "listing.openStrategy": "Ouvrir la stratégie",
  "listing.cancel": "Résilier",
  "listing.cancelConfirm": "Résilier l'abonnement",
  "listing.keep": "Le conserver",
  // (display)
  "listing.cancelTitle": "Le résilier ?",
  "listing.cancelCopy": "La stratégie s'arrête sur votre compte dès maintenant. Ses positions ouvertes restent ouvertes avec leurs stops et objectifs.",
  "listing.cancelClone": "L'abonnement prend fin. La stratégie clonée reste dans votre liste.",
  // {date} = end of the paid period
  "listing.cancelPaid": "Il reste actif jusqu'au {date} et ne sera pas renouvelé. La période en cours n'est pas remboursée.",
  "listing.cancelled": "Abonnement résilié",
  "listing.cancelledPaid": "Il ne sera pas renouvelé",
  "listing.yours": "Votre annonce",
  "listing.manageWeb": "Gérer sur le web",

  /* ---------------------------------------------------------------- */
  /* Subscribe (form), subscriptions                                   */
  /* ---------------------------------------------------------------- */
  "sub.eyebrow": "S'abonner",
  "sub.title": "S'abonner",
  "sub.body": "par {author} · {symbol} {tf}",
  "sub.how": "Mode",
  "sub.copyTitle": "Copier sur mon compte",
  "sub.copyText": "La version exacte de l'auteur tourne sur votre compte, 24h/24. Les règles restent privées.",
  "sub.copyTextOpen": "La version exacte de l'auteur tourne sur votre compte, 24h/24.",
  "sub.cloneTitle": "Cloner les règles",
  "sub.cloneText": "Les règles deviennent l'une de vos stratégies : testez-les, modifiez-les et déployez-les vous-même.",
  "sub.multiplierHint": "Ajuste la taille des ordres de la stratégie sur votre compte.",
  "sub.price": "Prix",
  "sub.dueNow": "À payer maintenant",
  "sub.wallet": "Portefeuille (disponible)",
  "sub.renewal": "Renouvellement",
  "sub.noCharge": "Gratuit, rien n'est débité",
  "sub.shortTitle": "USDT insuffisants",
  "sub.shortBody": "Votre portefeuille doit disposer d'au moins {amount} USDT.",
  "sub.deposit": "Déposer",
  "sub.liveBody": "La stratégie passe des ordres réels avec de l'argent réel sur ce compte, et peut en perdre.",
  "sub.ackPay": "Débiter {price} USDT de mon portefeuille Kalks maintenant, puis tous les 30 jours jusqu'à ma résiliation.",
  // (display)
  "sub.doneTitle": "Abonné",
  // {title} = strategy, {account} = "Démo · 50000083"
  "sub.doneCopy": "« {title} » tourne sur {account}.",
  "sub.doneClone": "« {title} » fait désormais partie de vos stratégies.",
  "sub.charged": "{amount} USDT ont été débités de votre portefeuille.",
  // The answer to a subscribe request was lost (connection, timeout): the app re-reads the listing before a retry
  "sub.noAnswer": "Nous n'avons pas reçu de réponse. L'abonnement a peut-être abouti.",
  "sub.checkingTitle": "Vérification de votre abonnement",
  "sub.checkingBody": "La réponse s'est perdue en route. Nous vérifions auprès du serveur avant que vous puissiez réessayer, afin que vous ne soyez jamais débité deux fois.",
  "sub.noAnswerRetry": "Toujours pas de réponse, et aucun nouvel abonnement sur votre compte. Vous pouvez réessayer.",
  "sub.notThrough": "L'abonnement n'a pas abouti et rien ne reste débité (tout débit est remboursé sur votre portefeuille). Vous pouvez réessayer.",
  "sub.unfinished": "Il est encore en cours de configuration sur le serveur. Vérifiez Marketplace › Abonnements et l'historique de votre portefeuille, ou contactez l'assistance, avant de réessayer.",
  "sub.free": "Abonnement gratuit : rien n'a été débité.",
  "sub.copyOn": "copie sur {login}",
  "sub.cloned": "clonée",
  "sub.renews": "renouvellement le {date}",
  "sub.ends": "se termine le {date}",
  "sub.status.active": "Actif",
  "sub.status.cancelled": "Résilié",
  "sub.status.expired": "Expiré",
  "sub.status.past_due": "Paiement dû",

  // (display)
  "review.title": "Noter",
  "review.rating": "Votre note",
  "review.stars": { one: "{count} étoile", many: "{count} étoiles", other: "{count} étoiles" },
  "review.comment": "Commentaire (facultatif)",
  "review.placeholder": "Comment a-t-elle tradé pour vous ?",
  "review.post": "Publier l'avis",
  "review.saved": "Avis enregistré",
  "review.rate": "Noter",
  "review.edit": "Modifier l'avis",
  "review.you": "Vous",

  /* ---------------------------------------------------------------- */
  /* API keys and webhooks                                             */
  /* ---------------------------------------------------------------- */
  "keys.eyebrow": "Développeurs",
  // (display)
  "keys.title": "API",
  "keys.subtitle": "Des clés pour vos propres programmes de trading et des URL de webhook pour les alertes (TradingView et autres).",
  "keys.requests24h": "Requêtes · dernières 24 h",
  "keys.errors": "Erreurs",
  // Requests refused by the rate limit
  "keys.limited": "Limitées",
  "keys.p50": "Médiane",
  "keys.writes": "Ordres",
  // (display)
  "keys.keys": "Clés API",
  "keys.keysSub": "{n} actives · 20 max",
  "keys.none": "Aucune clé API. Créez-en une dans l'espace client sur le web.",
  "keys.status.active": "Active",
  "keys.status.revoked": "Révoquée",
  "keys.status.expired": "Expirée",
  "keys.scope.read": "Lecture",
  "keys.scope.trade": "Trading",
  // {ips} = list of IP addresses
  "keys.ips": "Uniquement depuis {ips}",
  "keys.anyIp": "Depuis toute adresse IP",
  "keys.expires": "Expire le {date}",
  "keys.noExpiry": "N'expire jamais",
  "keys.lastUsed": "dernière utilisation : {ago}",
  "keys.revoke": "Révoquer",
  // (display)
  "keys.revokeTitle": "Révoquer cette clé ?",
  "keys.revokeBody": "« {name} » ({id}) cesse immédiatement de fonctionner pour tous les programmes qui l'utilisent. Cette action est irréversible.",
  "keys.revoked": "« {name} » révoquée",
  "keys.webTitle": "Création sur le web",
  "keys.webBody": "Les nouvelles clés et les nouveaux webhooks se créent dans l'espace client : le secret d'une clé et l'URL d'un webhook n'y sont affichés qu'une seule fois, pour que vous les copiiez dans vos outils de trading.",
  "keys.openWeb": "Ouvrir l'espace client",
  "keys.killHint": "Besoin de tout arrêter ? L'arrêt d'urgence de l'écran Algo arrête toutes les stratégies et bloque les ordres webhook et API.",

  // (display)
  "hooks.title": "Webhooks",
  "hooks.sub": "{n} sur 20 max",
  "hooks.none": "Aucun webhook. Créez-en un dans l'espace client sur le web.",
  // {hint} = the URL's last characters
  "hooks.hint": "URL …{hint}",
  "hooks.accounts": { one: "{count} compte", many: "{count} comptes", other: "{count} comptes" },
  "hooks.today": { zero: "aucune alerte aujourd'hui", one: "{count} alerte aujourd'hui", many: "{count} alertes aujourd'hui", other: "{count} alertes aujourd'hui" },
  "hooks.used": "dernière utilisation : {ago}",
  "hooks.on": "Activé",
  "hooks.off": "Désactivé",
  "hooks.switch": "Webhook « {name} » activé",
  "hooks.passphrase": "Phrase secrète requise",
  "hooks.noPassphrase": "Sans phrase secrète",
  "hooks.delete": "Supprimer",
  // (display)
  "hooks.deleteTitle": "Supprimer ce webhook ?",
  "hooks.deleteBody": "« {name} » et son URL secrète cessent immédiatement de fonctionner ; les alertes qui y sont envoyées sont refusées. Cette action est irréversible.",
  "hooks.deleted": "« {name} » supprimé",
  // (display)
  "hooks.alerts": "Alertes récentes",
  "hooks.alertsSub": "Chaque alerte avec le résultat de chaque compte",
  // Alert statuses (server values)
  "hooks.status.accepted": "Acceptée",
  "hooks.status.partial": "Partielle",
  "hooks.status.failed": "Échec",
  "hooks.status.received": "Reçue",
  "hooks.status.rejected": "Rejetée",
  "hooks.status.blocked": "Bloquée (arrêt d'urgence)",
  // Each account's result of an alert (server values)
  "hooks.result.filled": "exécuté",
  "hooks.result.pending": "ordre placé",
  "hooks.result.closed": "clôturé",
  "hooks.result.nothing_to_close": "rien à clôturer",
  "hooks.result.rejected": "rejeté",
};
export default mobileAlgo;
