import type { NsMessages } from "../../core";

// Kalks mobile app: Algo (/algo): strategies running 24/7 on the server (deployments), the kill switch, backtest
// reports, the strategy marketplace, API keys and webhooks. Terms follow the `developer` namespace.
// Keep as they are: Kalks, Algo, API, USDT, USD, indicator names (EMA, RSI, MACD, ATR, CCI, ADX, DI…), symbols
// (EURUSD, XAUUSD), timeframes (M15, H1, H4), "R" (a multiple of the stop distance), P&L, DD, SL / TP.
// Titles marked (display) are tall uppercase: keep them short. "Deployment" = one strategy version running on one
// trading account. "Notaus" = kill switch. {ago} is a relative time or "nie".
const mobileAlgo: NsMessages<"mobileAlgo"> = {
  never: "nie",
  // {n} days, compact
  days: "{n} T",
  lot: "Lot",
  // How long a trade was held (compact)
  "dur.m": "{m} Min.",
  "dur.h": "{h} Std.",
  "dur.hm": "{h} Std. {m} Min.",
  "dur.d": "{d} T",
  "dur.dh": "{d} T {h} Std.",
  nTrades: { one: "{count} Trade", other: "{count} Trades" },
  readOnly: "Dieser Login kann Strategien ansehen, aber nichts ändern.",

  /* ---------------------------------------------------------------- */
  /* Screen states                                                     */
  /* ---------------------------------------------------------------- */
  "state.unavailable.title": "Algo nicht verfügbar", // (display)
  "state.unavailable.text": "Der Strategiedienst ist nicht erreichbar. Ihre Strategien laufen auf dem Server weiter; bitte versuchen Sie es gleich erneut.",
  "state.disabled.title": "Nicht verfügbar", // (display)
  "state.disabled.text": "Diese Funktion ist für Ihr Konto nicht verfügbar.",
  "state.notFound.title": "Nicht gefunden", // (display)
  "state.notFound.text": "Möglicherweise wurde es entfernt oder der Link ist falsch.",
  "state.back": "Zurück zu Algo",

  /* ---------------------------------------------------------------- */
  /* Server errors (codes of the strategy service)                     */
  /* ---------------------------------------------------------------- */
  "error.haltedMine": "Ihr Notaus ist aktiv. Heben Sie ihn im Algo-Bildschirm auf, bevor Sie wieder Strategien starten.",
  "error.haltedPlatform": "Der automatisierte Handel ist derzeit vom Broker pausiert. Bitte versuchen Sie es später erneut.",
  // {n} = the most strategies that can run at once
  "error.limitRunning": "Sie können bis zu {n} Strategien gleichzeitig laufen lassen. Stoppen Sie zuerst eine.",
  "error.accountStatus": "Mit diesem Konto kann derzeit nicht gehandelt werden.",
  "error.alreadyRunning": "Diese Version läuft bereits auf diesem Konto.",
  "error.invalidStrategy": "Beheben Sie zuerst die Fehler der Strategie (im Kundenbereich oder mit dem AI Trader).",
  "error.state": "Der Status hat sich bereits geändert. Ziehen Sie nach unten, um den aktuellen Stand zu sehen.",
  "error.queueFull": "Sie haben bereits 3 Backtests in der Warteschlange oder in Ausführung. Warten Sie, bis einer abgeschlossen ist.",
  "error.dailyLimit": "Sie haben das heutige Limit von {n} Backtests erreicht.",
  "error.ownListing": "Sie können Ihre eigene Strategie nicht abonnieren.",
  "error.subscribed": "Sie haben diese Strategie bereits abonniert.",
  "error.cloneNotAllowed": "Der Autor erlaubt kein Klonen; kopieren Sie die Strategie stattdessen auf Ihr Konto.",
  // {amount} in USDT
  "error.insufficientFunds": "Ihr Wallet-Guthaben liegt unter {amount} USDT. Zahlen Sie USDT ein, um zu abonnieren.",
  "error.insufficientFundsPlain": "Ihr Wallet-Guthaben ist zu niedrig. Zahlen Sie USDT ein, um zu abonnieren.",
  "error.inactive": "Dieses Abonnement ist nicht mehr aktiv.",
  "error.archiveRunning": "Stoppen Sie die Deployments dieser Strategie, bevor Sie sie archivieren.",
  "error.archived": "Diese Strategie ist archiviert.",
  "error.finished": "Dieser Backtest ist bereits abgeschlossen.",
  "error.revoked": "Dieser Key ist bereits widerrufen.",
  "error.notFound": "Das ist nicht mehr vorhanden.",
  // {tf} = timeframe (H1), {days} = number of days
  "error.rangeTooLong": "{tf}-Backtests können höchstens {days} Tage abdecken. Wählen Sie einen kürzeren Zeitraum.",
  "error.balanceRange": "Das Startguthaben muss zwischen 100 und 10,000,000 liegen.",
  "error.dates": "Das Startdatum muss vor dem Enddatum liegen.",

  /* ---------------------------------------------------------------- */
  /* Home                                                              */
  /* ---------------------------------------------------------------- */
  "home.eyebrow": "Automatisierter Handel",
  "home.title": "Algo", // (display)
  "home.heroEyebrow": "Läuft jetzt",
  "home.heroRunning": {
    zero: "Strategien handeln 24/7 auf dem Server",
    one: "Strategie handelt 24/7 auf dem Server",
    other: "Strategien handeln 24/7 auf dem Server",
  },
  "home.heroRealized": "Realisierter P&L",
  "home.heroOpen": "Jetzt offen",
  // closed trades so far
  "home.heroTrades": "Trades",
  "home.qaAi": "Mit KI erstellen",
  "home.qaAiHint": "Idee beschreiben, exakte Regeln erhalten",
  "home.qaMarket": "Marketplace",
  "home.qaMarketHint": "Verifizierte Strategien kopieren",
  "home.qaKeys": "API-Keys & Webhooks",
  "home.qaKeysHint": "Nutzung, Widerruf, letzte Alerts",
  "home.running": "Deployments", // (display)
  "home.runningSub": { zero: "Derzeit läuft nichts", one: "{count} läuft", other: "{count} laufen" },
  // {n} = count shown on the filter pill
  "home.filterActive": "Aktiv · {n}",
  "home.filterAll": "Alle · {n}",
  "home.strategies": "Meine Strategien", // (display)
  "home.strategiesSub": { zero: "Noch keine gespeichert", one: "{count} gespeichert", other: "{count} gespeichert" },
  "home.newWithAi": "Neu mit KI",
  "home.backtests": "Backtests", // (display)
  "home.backtestsSub": "Die letzten Läufe, neueste zuerst",
  "home.emptyDeps": "Noch lief nichts. Öffnen Sie unten eine Ihrer Strategien und starten Sie sie zuerst auf einem Demokonto.",
  "home.emptyActive": "Derzeit läuft nichts. Gestoppte Strategien finden Sie unter Alle.",
  "home.showAll": "Alle anzeigen",
  "home.emptyStrats": "Noch keine eigene Strategie. Beschreiben Sie dem AI Trader Ihre Idee, und sie wird zu exakten Regeln, die Sie testen können.",
  "home.browseMarket": "Marketplace durchsuchen",
  "home.emptyBts": "Noch keine Backtests. Öffnen Sie eine Strategie und testen Sie sie auf echter Kurshistorie.",
  "home.startEyebrow": "Erste Schritte",
  "home.startTitle": "Strategie einsetzen", // (display)
  "home.step1": "Beschreiben Sie dem AI Trader Ihre Idee: Sie wird zu exakten Regeln, die Sie lesen und ändern können.",
  "home.step2": "Backtesten Sie die Regeln auf echter Kurshistorie, mit den Kosten Ihres Kontos.",
  "home.step3": "Lassen Sie sie zuerst auf einem Demokonto rund um die Uhr laufen. Pausieren, stoppen oder beenden Sie sie jederzeit.",
  "home.footnote": "Strategien laufen rund um die Uhr auf Kalks-Servern, auf geschlossenen Bars, mit denselben Orderprüfungen wie beim manuellen Handel: Margin, Handelszeiten, Ihre Limits. Erstellen und bearbeiten Sie Strategien mit dem AI Trader oder im Kundenbereich.",
  "home.openWeb": "Strategie-Builder im Web öffnen",

  /* ---------------------------------------------------------------- */
  /* Kill switch (account-wide)                                        */
  /* ---------------------------------------------------------------- */
  "kill.cardTitle": "Notaus",
  "kill.cardBody": "Stoppen Sie alle Strategien auf einmal und blockieren Sie Webhook- und API-Orders.",
  "kill.stopAll": "Alle stoppen",
  "kill.onTitle": "Notaus ist aktiv",
  // {at} = date and time
  "kill.onSince": "Seit {at}. Strategien sind gestoppt; Webhook- und API-Orders sind blockiert.",
  "kill.onBody": "Strategien sind gestoppt; Webhook- und API-Orders sind blockiert.",
  "kill.release": "Aufheben",
  "kill.title": "Alles stoppen?", // (display)
  "kill.body": {
    zero: "Alle Strategien stoppen sofort, und Webhook- und API-Orders sind blockiert, bis Sie den Notaus aufheben.",
    one: "Die laufende Strategie stoppt sofort, und Webhook- und API-Orders sind blockiert, bis Sie den Notaus aufheben.",
    other: "Alle {count} laufenden Strategien stoppen sofort, und Webhook- und API-Orders sind blockiert, bis Sie den Notaus aufheben.",
  },
  "kill.alsoClose": "Auch ihre Positionen schließen",
  "kill.alsoCloseHint": "Schließt auf allen Ihren Konten jede von einer Strategie, einem Webhook oder der API eröffnete Position zum Marktpreis. Ihre eigenen manuellen Trades bleiben offen.",
  "kill.confirm": "Jetzt alle stoppen",
  "kill.doneTitle": "Alles gestoppt", // (display)
  "kill.stopped": "Gestoppte Strategien",
  "kill.doneBody": "Der Notaus bleibt aktiv, bis Sie ihn aufheben. Gestoppte Strategien starten nicht von selbst neu.",
  "kill.releaseTitle": "Notaus aufheben?", // (display)
  "kill.releaseBody": "Webhook- und API-Orders sind wieder erlaubt. Gestoppte Strategien bleiben gestoppt: Starten Sie sie erneut, wenn Sie bereit sind.",
  "kill.releasedTitle": "Notaus aufgehoben", // (display)
  "kill.releasedBody": "Webhook- und API-Orders sind wieder erlaubt. Starten Sie eine Strategie, um sie laufen zu lassen.",
  "kill.globalTitle": "Automatisierter Handel pausiert",
  "kill.globalBody": "Der Broker hat vorerst alle Strategien, Webhooks und API-Orders pausiert. Offene Positionen behalten ihre Stops.",

  /* ---------------------------------------------------------------- */
  /* Deployment statuses, controls                                     */
  /* ---------------------------------------------------------------- */
  "dep.status.running": "Läuft",
  "dep.status.paused": "Pausiert",
  "dep.status.stopped": "Gestoppt",
  "dep.status.killed": "Beendet",
  "dep.status.error": "Fehler",
  "dep.realized": "Realisierter P&L",
  "dep.trades": "Trades",
  "dep.winRate": "Trefferquote",
  "dep.open": "Offen",
  "dep.orders": "Orders",
  "dep.openNow": "Offen",
  // {ago} = "vor 5 Minuten" or "nie"
  "dep.lastCheck": "Letzter geprüfter Bar: {ago}",
  // {since} = start date
  "dep.lastCheckSince": "Letzter geprüfter Bar: {ago} · läuft seit {since}",
  // {reason} = the service's reason, e.g. "stopped by the owner"
  "dep.stoppedWhy": "Gestoppt: {reason}",
  "dep.stoppedTitle": "Gestoppt: {at}",
  "dep.errorTitle": "Bei der Strategie ist ein Fehler aufgetreten",
  // {account} = "Demo 50000083"
  "dep.eyebrow": "Deployment · {account}",
  "dep.marketplaceCopy": "Marketplace-Kopie",
  "dep.openStrategy": "Strategie öffnen",
  "dep.openSubscription": "Meine Abonnements öffnen",
  // {pct} = return, {amount} = starting balance
  "dep.onStart": "{pct} auf {amount}",
  "dep.curveA11y": "Kontostand pro Tag über {days} Tage, realisiert {pnl}",
  "dep.tabLog": "Protokoll · {n}",
  "dep.tabTrades": "Trades · {n}",
  "dep.tabSetup": "Einrichtung",
  "dep.noLogs": "Noch nichts protokolliert: Der erste geschlossene Bar dient zum Aufwärmen.",
  "dep.noTrades": "Noch keine Trades.",
  "dep.older": "Ältere Einträge laden",
  "dep.logStart": "Das ist der erste Eintrag.",
  "dep.rules": "Regeln",
  "dep.rulesHidden": "Der Autor hält die Regeln privat: Die Strategie läuft auf Ihrem Konto wie veröffentlicht.",
  "dep.lotMultiplier": "Lot-Multiplikator",
  "dep.maxLots": "Max. Lots pro Order",
  "dep.maxOpen": "Max. offene Positionen",
  "dep.dailyLoss": "Tagesverlustlimit",
  "dep.started": "Gestartet",
  "dep.startBalance": "Startguthaben",
  "dep.setupNote": "Ein Deployment führt genau eine Version aus: Das Speichern einer neuen Version ändert es nicht. Starten Sie die neue Version, um zu wechseln.",

  "ctl.pause": "Pausieren",
  "ctl.resume": "Fortsetzen",
  "ctl.stop": "Stoppen",
  "ctl.kill": "Beenden",
  "ctl.killNow": "Jetzt beenden",
  "ctl.closePositions": "Positionen schließen",
  "ctl.pauseTitle": "Pausieren?", // (display)
  "ctl.pauseBody": "Keine neuen Trades. Offene Positionen behalten Stop, Ziel und Breakeven. Setzen Sie sie fort, wann Sie möchten.",
  "ctl.resumeTitle": "Fortsetzen?", // (display)
  "ctl.resumeBody": "Sie handelt ab dem nächsten geschlossenen Bar wieder.",
  "ctl.stopTitle": "Stoppen?", // (display)
  "ctl.stopBody": "Sie stoppt endgültig: keine neuen Trades. Um sie erneut laufen zu lassen, starten Sie sie erneut.",
  "ctl.keepTitle": "Positionen offen lassen",
  "ctl.keepText": {
    one: "Die offene Position behält Stop und Ziel; Sie verwalten sie selbst.",
    other: "Die {count} offenen Positionen behalten ihre Stops und Ziele; Sie verwalten sie selbst.",
  },
  "ctl.closeAllTitle": "Jetzt schließen",
  "ctl.closeAllText": { one: "Die offene Position wird zum Marktpreis geschlossen.", other: "Die {count} offenen Positionen werden zum Marktpreis geschlossen." },
  "ctl.killTitle": "Jetzt beenden?", // (display)
  "ctl.killBody": "Der Notaus stoppt diese Strategie sofort und schließt standardmäßig die von ihr eröffneten Positionen zum Marktpreis.",
  "ctl.killClose": "Ihre Positionen schließen",
  "ctl.killCloseHint": "Sofort zum Marktpreis. Deaktivieren, um sie mit ihren Stops offen zu lassen.",
  "ctl.closeTitle": "Ihre Positionen schließen?", // (display)
  "ctl.closeBody": {
    one: "Die von dieser Strategie eröffnete Position wird zum Marktpreis geschlossen. Die Strategie läuft weiter.",
    other: "Die {count} von dieser Strategie eröffneten Positionen werden zum Marktpreis geschlossen. Die Strategie läuft weiter.",
  },
  "ctl.done.pause": "Pausiert", // (display)
  "ctl.done.resume": "Läuft wieder", // (display)
  "ctl.done.stop": "Gestoppt", // (display)
  "ctl.done.kill": "Beendet", // (display)
  "ctl.done.close": "Positionen geschlossen", // (display)
  "ctl.donePause": "Keine neuen Trades, bis Sie sie fortsetzen.",
  "ctl.doneResume": "Sie handelt ab dem nächsten geschlossenen Bar wieder.",
  "ctl.doneClosed": { one: "{count} Position wurde geschlossen.", other: "{count} Positionen wurden geschlossen." },
  "ctl.doneKept": "Ihre offenen Positionen bleiben, falls vorhanden, mit Stops und Zielen offen.",
  "ctl.doneNothing": "Es gab nichts Offenes zu schließen.",
  "ctl.closedLabel": "Geschlossen",
  "ctl.failedLabel": "Nicht geschlossen",
  "ctl.failedTitle": { one: "{count} Position konnte nicht geschlossen werden", other: "{count} Positionen konnten nicht geschlossen werden" },
  "ctl.failedBody": "Der Markt ist möglicherweise geschlossen. Schließen Sie sie über das Portfolio, sobald der Handel wieder öffnet.",
  // stopping or killing a marketplace copy leaves its subscription (and a paid one's renewals) running
  "ctl.copyNote": "Dies ist eine Marketplace-Kopie: Das Stoppen beendet das Abonnement nicht. Um nicht mehr zu zahlen, kündigen Sie es unter Marketplace › Abonnements.",

  /* ---------------------------------------------------------------- */
  /* Strategy                                                          */
  /* ---------------------------------------------------------------- */
  // {version} = version number
  "strat.eyebrow": "Strategie · v{version}",
  "strat.runningN": { one: "Läuft", other: "{count} laufen" },
  "strat.draft": "Entwurf",
  "strat.ready": "Bereit",
  "strat.errors": { one: "{count} Fehler", other: "{count} Fehler" },
  "strat.archivedTag": "Archiviert",
  "strat.lastBacktest": "Letzter Backtest",
  "strat.backtested": "Backtest",
  "strat.notTested": "Noch nicht getestet", // (display)
  "strat.notTestedBody": "Testen Sie die Regeln auf echter Kurshistorie mit den Kosten Ihres Kontos, bevor Sie sie laufen lassen.",
  "strat.runFirst": "Backtest starten",
  "strat.openReport": "Vollständigen Bericht öffnen",
  "strat.deployV": "v{version} starten",
  "strat.backtest": "Backtest",
  "strat.fixFirst": "Beheben Sie dies vor dem Testen oder Starten",
  "strat.line": "Zeile {n}:",
  "strat.rules": "Regeln", // (display)
  "strat.rulesSub": "Bei jedem geschlossenen Bar geprüft",
  "strat.rulesCodeSub": "Die Signale des Codes, bei jedem geschlossenen Bar geprüft",
  "strat.showCode": "Als Code anzeigen",
  "strat.risk": "Risiko", // (display)
  "strat.riskSub": "Größe, Stops, Zeiten und Limits",
  "strat.editVisual": "Um die Regeln zu ändern, fragen Sie den AI Trader oder bearbeiten Sie sie im Kundenbereich; jede Änderung wird als neue Version gespeichert.",
  "strat.editCode": "Code-Strategien werden im Kundenbereich im Web bearbeitet; jede Änderung wird als neue Version gespeichert.",
  "strat.openWeb": "Code im Web bearbeiten",
  "strat.deployments": "Deployments", // (display)
  "strat.deploymentsSub": { zero: "Läuft nirgends", one: "{count} Deployment", other: "{count} Deployments" },
  "strat.notRunning": "Läuft nicht. Starten Sie sie zuerst auf einem Demokonto, um zu sehen, wie sie live handelt.",
  "strat.backtests": "Backtests", // (display)
  "strat.backtestsSub": { zero: "Noch keine", one: "{count} Lauf", other: "{count} Läufe" },
  "strat.runNew": "Neuer Lauf",
  "strat.noBacktests": "Noch keine Backtests.",
  "strat.versions": "Versionen", // (display)
  "strat.versionsSub": { one: "{count} Version", other: "{count} Versionen" },
  "strat.current": "Aktuell",
  "strat.archive": "Archivieren",
  "strat.archiveTitle": "Archivieren?", // (display)
  "strat.archiveBody": "„{name}“ verschwindet aus Ihrer Liste. Backtests und frühere Deployments bleiben in Ihrem Verlauf.",
  "strat.archived": "„{name}“ archiviert",

  "kind.visual": "Visuelle Regeln",
  "kind.code": "Code",
  // Where a strategy came from
  "origin.ai": "AI Trader",
  "origin.template": "Vorlage",
  "origin.manual": "Manuell erstellt",
  "origin.marketplace": "Marketplace",

  /* ---------------------------------------------------------------- */
  /* Rules in words                                                    */
  /* ---------------------------------------------------------------- */
  "rules.buy": "Kaufen, wenn",
  "rules.sell": "Verkaufen, wenn",
  "rules.exitBuy": "Käufe schließen, wenn",
  "rules.exitSell": "Verkäufe schließen, wenn",
  "rules.and": "und",
  "rules.or": "oder",
  // {tf} = timeframe, e.g. "auf H4"
  "rules.onTf": "auf {tf}",
  "rules.noRules": "Noch keine Einstiegsregeln.",
  "rules.size": "Größe",
  "rules.stop": "Stop Loss",
  "rules.target": "Take Profit",
  "rules.trailing": "Trailing",
  "rules.window": "Handelszeiten",
  "rules.limits": "Limits",
  "rules.none": "Keine",
  "rules.lots": "{lots} Lot",
  "rules.riskPct": "{pct}% Risiko pro Trade",
  "rules.maxLots": "max. {lots} Lot",
  // points: move the stop to entry + {o} after {v} points in profit
  "rules.breakeven": "Breakeven bei {v} Punkten (+{o})",
  "rules.allDay": "Rund um die Uhr",
  "rules.perDay": { one: "{count} Trade pro Tag", other: "{count} Trades pro Tag" },
  "rules.dailyLoss": "Stopp für den Tag bei {amount} Verlust",
  "rules.oneAtATime": "Jeweils eine Position",
  "rules.closeOutside": "Schließt außerhalb der Zeiten",
  "rules.noLimits": "Keine Tageslimits",
  "op.crossesAbove": "kreuzt über",
  "op.crossesBelow": "kreuzt unter",
  "dist.pips": "{v} Pips",
  "dist.points": "{v} Punkte",
  "dist.price": "bei {v}",
  "dist.percent": "{v}% des Preises",
  // {v} × ATR({p})
  "dist.atr": "{v} × ATR({p})",
  "dist.level": "Niveau {v}",
  // a multiple of the stop distance
  "dist.rr": "{v}R",
  "field.close": "Schlusskurs",
  "field.open": "Eröffnungskurs",
  "field.high": "Hoch",
  "field.low": "Tief",
  "field.hl2": "Medianpreis",
  "field.hlc3": "Typischer Preis",
  "field.ohlc4": "Durchschnittspreis",
  "field.volume": "Volumen",
  "pattern.bullish": "Bullische Kerze",
  "pattern.bearish": "Bärische Kerze",
  "pattern.bullish_engulfing": "Bullish Engulfing",
  "pattern.bearish_engulfing": "Bearish Engulfing",
  "pattern.hammer": "Hammer",
  "pattern.shooting_star": "Shooting Star",
  "pattern.doji": "Doji",
  "pattern.inside_bar": "Inside Bar",
  "ind.sma": "SMA",
  "ind.ema": "EMA",
  "ind.wma": "WMA",
  "ind.rsi": "RSI",
  "ind.macd": "MACD",
  "ind.macd_signal": "MACD-Signal",
  "ind.macd_hist": "MACD-Histogramm",
  "ind.bb_upper": "Oberes Bollinger-Band",
  "ind.bb_middle": "Mittleres Bollinger-Band",
  "ind.bb_lower": "Unteres Bollinger-Band",
  "ind.atr": "ATR",
  "ind.stoch_k": "Stochastik %K",
  "ind.stoch_d": "Stochastik %D",
  "ind.highest": "Höchstes Hoch",
  "ind.lowest": "Tiefstes Tief",
  "ind.cci": "CCI",
  "ind.willr": "Williams %R",
  "ind.adx": "ADX",
  "ind.plus_di": "+DI",
  "ind.minus_di": "−DI",
  "ind.momentum": "Momentum",
  "ind.roc": "ROC",
  "ind.stddev": "Standardabweichung",
  "note.noDailyLimit": "Kein Tageslimit für Trades",
  "note.noStop": "Kein Stop Loss: Positionen sind ungeschützt",
  "note.riskNeedsStop": "Risikobasierte Größe erfordert einen Stop Loss",
  "note.rrNeedsStop": "Ein Take Profit in R erfordert einen Stop Loss",
  "note.noEntry": "Keine Einstiegsregel: Fügen Sie eine Kauf- oder Verkaufsbedingung hinzu",

  /* ---------------------------------------------------------------- */
  /* Deploy (form)                                                     */
  /* ---------------------------------------------------------------- */
  "deploy.eyebrow": "Starten · v{version}",
  "deploy.title": "Rund um die Uhr", // (display)
  "deploy.body": "„{name}“ v{version} handelt {symbol} bei jedem geschlossenen {tf}-Bar auf Kalks-Servern, auch wenn Ihr Smartphone aus ist. Pausieren, stoppen oder beenden Sie die Strategie jederzeit.",
  "deploy.account": "Konto",
  "deploy.equity": "{amount} Eigenkapital",
  "deploy.noAccounts": "Sie benötigen ein aktives Handelskonto. Eröffnen Sie ein Demokonto, um Strategien ohne Risiko auszuprobieren.",
  "deploy.openAccount": "Konto eröffnen",
  "deploy.multiplier": "Lot-Multiplikator",
  "deploy.multiplierHint": "Skaliert die Größe jeder Order. 1× handelt die Größe der Strategie.",
  "deploy.maxOpen": "Max. offene Positionen",
  "deploy.maxOpenHint": "Eine Obergrenze zusätzlich zu den Regeln der Strategie.",
  "deploy.strategyDefault": "Regel der Strategie",
  "deploy.dailyLoss": "Tagesverlustlimit",
  "deploy.dailyLossHint": "Erreicht der geschlossene und offene Verlust des Tages diesen Wert, gibt es bis morgen (Serverzeit) keine neuen Trades.",
  "deploy.off": "Aus",
  "deploy.custom": "Benutzerdefiniert",
  "deploy.dailyLossAmount": "Verlust pro Tag",
  "deploy.lossInvalid": "Geben Sie einen Betrag über 0 ein.",
  "deploy.liveTitle": "Echtes Geld",
  "deploy.liveBody": "Dies ist ein Live-Konto. Die Strategie platziert echte Orders mit echtem Geld und kann es verlieren.",
  "deploy.ack": "Mir ist bewusst, dass die Strategie auf meinem Live-Konto mit echtem Geld handelt, und ich trage die Verantwortung dafür.",
  "deploy.note": "Automatisierter Handel kann Verluste verursachen. Backtests sind Simulationen und sagen keine zukünftigen Ergebnisse voraus. Dies ist keine Anlageberatung.",
  // {account} = "Demo 50000083"
  "deploy.confirm": "Auf {account} starten",
  "deploy.doneTitle": "Läuft", // (display)
  "deploy.doneBody": "„{name}“ v{version} läuft auf {account}.",
  "deploy.warmup": "Der erste geschlossene {tf}-Bar dient zum Aufwärmen; Orders sind ab dem nächsten möglich.",
  "deploy.open": "Deployment öffnen",

  /* ---------------------------------------------------------------- */
  /* Backtests                                                         */
  /* ---------------------------------------------------------------- */
  "bt.status.queued": "In Warteschlange",
  "bt.status.running": "Läuft",
  "bt.status.done": "Fertig",
  "bt.status.failed": "Fehlgeschlagen",
  "bt.status.cancelled": "Abgebrochen",
  "bt.stage.queued": "Warten auf einen freien Worker",
  "bt.stage.loading": "Kurshistorie wird geladen",
  "bt.stage.m1": "Minuten-Bars werden geladen",
  "bt.stage.simulating": "Trades werden simuliert",
  "bt.stage.running": "Läuft",
  // {id} = backtest number, {version} = strategy version
  "bt.eyebrow": "Backtest #{id} · v{version}",
  "bt.title": "Backtest", // (display)
  "bt.start": "Start {amount}",
  "bt.runningNote": "Er läuft auf dem Server: Sie können diesen Bildschirm verlassen und später zurückkehren.",
  "bt.failed": "Der Backtest ist fehlgeschlagen",
  "bt.cancelled": "Abgebrochen", // (display)
  "bt.runAgain": "Erneut starten",
  "bt.net": "Nettogewinn",
  // {pct} = return, {amount} = starting balance
  "bt.returnOf": "{pct} auf {amount}",
  "bt.pf": "Profitfaktor",
  "bt.winRate": "Trefferquote",
  "bt.winsOf": "{wins} von {trades}",
  "bt.maxDd": "Max. Drawdown",
  "bt.maxDdShort": "Max. DD",
  "bt.sharpe": "Sharpe",
  "bt.sortino": "Sortino {v}",
  "bt.trades": "Trades",
  "bt.longShort": "{long} Long · {short} Short",
  "bt.expectancy": "Erwartungswert",
  "bt.perTrade": "pro Trade",
  "bt.equity": "Eigenkapital", // (display)
  "bt.drawdown": "Drawdown",
  "bt.legendEquity": "Eigenkapital",
  "bt.legendBalance": "Kontostand",
  "bt.legendStart": "Start",
  "bt.noCurve": "Nicht genug Bars für eine Kurve.",
  "bt.scrubHint": "Ziehen Sie über den Chart oder halten Sie ihn gedrückt, um einen beliebigen Punkt abzulesen.",
  "bt.curveA11y": "Eigenkapital von {from} bis {to}; maximaler Drawdown {dd}",
  "bt.monthly": "Monatlich", // (display)
  "bt.monthlySub": "Rendite jedes Monats, % des Kontostands",
  "bt.noTradesMonth": "keine Trades",
  "bt.statistics": "Statistik", // (display)
  "bt.tradeList": "Trades", // (display)
  "bt.tradeListSub": "Neueste zuerst, nach Kosten",
  "bt.truncated": "Die ersten {n} Trades, neueste zuerst",
  "bt.fAll": "Alle · {n}",
  "bt.fWins": "Gewinner · {n}",
  "bt.fLosses": "Verlierer · {n}",
  "bt.noTrades": "Die Regeln haben in diesem Zeitraum nicht gehandelt.",
  "bt.data": "Daten & Kosten", // (display)
  "bt.m1Bars": "Minuten-Bars (Intrabar)",
  "bt.since": "seit {date}",
  "bt.signals": "Signale",
  "bt.signalsValue": "{buy} Kauf · {sell} Verkauf · {exits} Ausstieg",
  "bt.skipped": "Übersprungen: {reason}",
  "bt.model": "Modell",
  "bt.group": "Kontotyp",
  "bt.spread": "Spread",
  "bt.spreadValue": "{points} Punkte ({source})",
  "bt.commission": "Kommission",
  "bt.perLot": "{amount} pro Lot",
  "bt.swaps": "Swaps",
  "bt.swapsOn": "Bei jedem Rollover berechnet",
  "bt.swapsOff": "Nicht berechnet (swapfrei)",
  "bt.conversion": "P&L-Umrechnung",
  "bt.usdBase": "USD als Basis: zum Ausstiegskurs",
  "bt.usdQuoted": "In USD notiert",
  "bt.currentRate": "Zum aktuellen Kurs ({rate})",
  "bt.simNote": "Backtest #{id} ist eine Simulation auf vergangenen Kursen: Ausführung zur Eröffnung des nächsten Bars, Stops und Ziele auf einem OHLC-Pfad (Minuten-Bars, sofern vorhanden), Spread, Kommission und Swaps Ihres Kontotyps. Vergangene Ergebnisse sagen keine zukünftigen Ergebnisse voraus.",
  // History sources and skip reasons from the service
  "source.native": "nativ",
  "source.built_from_M1": "aus M1 gebildet",
  "source.built_from_M5": "aus M5 gebildet",
  "source.built_from_M15": "aus M15 gebildet",
  "source.built_from_M30": "aus M30 gebildet",
  "source.built_from_H1": "aus H1 gebildet",
  "skip.outside_trading_window": "außerhalb der Handelszeiten",
  "skip.position_already_open": "eine Position war bereits offen",
  "skip.daily_trade_limit": "Tageslimit für Trades",
  "skip.max_daily_loss": "Tagesverlustlimit",
  "skip.market_closed": "Markt geschlossen",
  "skip.20_open_positions": "bereits 20 Positionen offen",
  "skip.buy_and_sell_on_the_same_bar": "Kauf und Verkauf auf demselben Bar",
  "skip.stop_distance_not_ready": "Stop-Abstand noch nicht bereit",
  "skip.SL_level_on_the_wrong_side": "Stop-Niveau auf der falschen Seite",
  "skip.volume_below_the_minimum_lot": "Größe unter dem Mindest-Lot",
  "spreadSource.group_quote": "Live-Kurs Ihres Kontotyps",
  "spreadSource.catalogue": "Katalog-Spread",
  "spreadSource.fixed": "fest",

  "btNew.title": "Backtest starten", // (display)
  "btNew.period": "Zeitraum",
  "btNew.balance": "Startguthaben",
  "btNew.other": "Andere",
  "btNew.amount": "Betrag",
  "btNew.costs": "Kosten von",
  "btNew.accountType": "Kontotyp",
  "btNew.myAccount": "Mein Konto",
  "btNew.costsGroupHint": "Spread, Kommission und Swaps dieses Kontotyps.",
  "btNew.costsAccountHint": "Spread, Kommission und Swaps der Gruppe dieses Kontos.",
  "btNew.noAccounts": "Sie haben noch kein aktives Handelskonto.",
  "btNew.run": "Backtest starten",
  "btNew.note": "Der längste Zeitraum hängt vom Zeitrahmen ab. Bis zu 3 Backtests können gleichzeitig laufen.",

  "period.p1m": "1M",
  "period.p3m": "3M",
  "period.p6m": "6M",
  "period.p1y": "1J",
  "period.p2y": "2J",
  "period.p5y": "5J",

  // Trade exit reasons (server codes)
  "exit.sl": "Stop Loss",
  "exit.tp": "Take Profit",
  "exit.trailing": "Trailing Stop",
  "exit.breakeven": "Breakeven",
  "exit.signal": "Signal",
  "exit.exit_rule": "Ausstiegsregel",
  "exit.session": "Außerhalb der Zeiten",
  "exit.end_of_test": "Testende",
  "exit.stop_out": "Stop Out",
  "exit.kill": "Notaus",
  "exit.stopped": "Gestoppt",
  "exit.client": "Geschlossen",
  "exit.close": "Geschlossen",

  "stat.balance": "Kontostand",
  "stat.gross": "Bruttogewinn / -verlust",
  "stat.cagr": "Jährliches Wachstum (CAGR)",
  "stat.avgWinLoss": "Ø Gewinn / Verlust",
  "stat.largest": "Größter Gewinn / Verlust",
  "stat.payoff": "Payoff-Ratio",
  "stat.long": "Long-Trades · Trefferquote",
  "stat.short": "Short-Trades · Trefferquote",
  "stat.streaks": "Meiste Gewinne / Verluste in Folge",
  "stat.maxDd": "Max. Drawdown",
  "stat.recovery": "Recovery-Faktor",
  "stat.sharpeSortino": "Sharpe / Sortino",
  "stat.avgBars": "Ø gehaltene Bars",
  "stat.exposure": "Zeit im Markt",
  "stat.costs": "Kommission / Swap / Spread",
  "stat.bars": "Getestete Bars",
  "stat.cpu": "Berechnet in",
  "stat.seconds": "{s} s",

  /* ---------------------------------------------------------------- */
  /* Log kinds (runtime)                                               */
  /* ---------------------------------------------------------------- */
  "log.eval": "Bar",
  "log.signal": "Signal",
  "log.order": "Order",
  "log.close": "Schließen",
  "log.manage": "Verwaltung",
  "log.error": "Fehler",
  "log.info": "Info",

  /* ---------------------------------------------------------------- */
  /* Marketplace                                                       */
  /* ---------------------------------------------------------------- */
  "house.badge": "Hausstrategie · Betrieben von Kalks",
  "house.disclosure":
    "Hausstrategie, betrieben von Kalks: ein brokereigenes Live-Konto, auf dem diese Strategie läuft. Die Historie umfasst nur die eigenen Live-Trades seit dem Start; nichts ist simuliert oder rückwirkend ergänzt.",
  "market.eyebrow": "Strategie-Marketplace",
  "market.title": "Marketplace", // (display)
  "market.subtitle": "Strategien mit verifizierter Historie von echten Kalks-Konten. Kopieren Sie eine auf Ihr Konto oder klonen Sie ihre Regeln, wenn der Autor es erlaubt.",
  "market.browse": "Durchsuchen",
  "market.subs": "Abonnements",
  "market.subsN": "Abonnements · {n}",
  "market.mine": "Ihre Angebote",
  "market.search": "Strategien, Autoren suchen…",
  "market.clear": "Suche leeren",
  "market.all": "Alle",
  "market.free": "Kostenlos",
  "market.paid": "Kostenpflichtig",
  "market.newest": "Neueste",
  "market.topRated": "Bestbewertet",
  "market.popular": "Beliebt",
  // {price} in USDT
  "market.perMonth": "{price} USDT/Mon.",
  "market.by": "von {author}",
  "market.return": "Rendite",
  "market.winRate": "Trefferquote",
  "market.maxDd": "Max. DD",
  "market.trades": "Trades",
  // {type} = live / demo
  "market.verified": "Verifiziert {type}",
  "market.verifiedDays": "verifiziert {type} · {days} Tage",
  // a track record younger than a day
  "market.verifiedNew": "verifiziert {type} · unter einem Tag",
  "market.subscribed": "Abonniert",
  "market.ratings": { zero: "Keine Bewertungen", one: "{count} Bewertung", other: "{count} Bewertungen" },
  "market.subscribers": { one: "{count} Abonnent", other: "{count} Abonnenten" },
  "market.emptyTitle": "Noch nichts gelistet", // (display)
  "market.emptyText": "Strategien erscheinen hier, sobald ihre Autoren sie mit einer verifizierten Historie veröffentlichen.",
  "market.noMatchTitle": "Keine Treffer", // (display)
  "market.noMatchText": "Versuchen Sie eine andere Suche oder einen anderen Filter.",
  "market.noSubsTitle": "Keine Abonnements", // (display)
  "market.noSubsText": "Strategien, die Sie aus dem Marketplace kopieren oder klonen, erscheinen hier.",
  "market.disclaimer": "Frühere Wertentwicklungen sind keine Garantie für künftige Ergebnisse. Historien stammen von Live- oder Demokonten bei Kalks und sind entsprechend gekennzeichnet. Plattformgebühr auf kostenpflichtige Abonnements: {pct}%.",
  "market.houseFootnote": "Hausstrategien laufen auf brokereigenen Live-Konten; ihre Historien umfassen nur ihre eigenen Live-Trades.",
  "market.earned": "Verdient",
  "market.fees": "Plattformgebühren",
  "market.payments": "Zahlungen",
  "market.publishWeb": "Das Veröffentlichen einer Strategie (mit ihrer verifizierten Historie) und das Bearbeiten eines Angebots erfolgen im Kundenbereich im Web.",
  "market.openWeb": "Marketplace im Web öffnen",

  // Listing statuses (server values)
  "listing.pending": "In Prüfung",
  "listing.approved": "Gelistet",
  "listing.rejected": "Abgelehnt",
  "listing.suspended": "Gesperrt",
  "listing.unlisted": "Nicht gelistet",
  "listing.eyebrow": "Marketplace · {symbol} {tf}",
  "listing.verified": "Verifizierte {type}-Historie",
  "listing.cloneAllowed": "Klonen erlaubt",
  "listing.trackReturn": "Verifizierte Rendite",
  "listing.net": "Netto",
  "listing.noCurve": "Die Tageskurve erscheint nach zwei Handelstagen.",
  "listing.curveA11y": "Eigenkapital pro Tag über {days} Tage, Rendite {ret}",
  "listing.trackNote": "Aus dem eigenen Deployment des Autors auf Kalks seit {since}, berechnet aus geschlossenen Deals der Handelsengine: nie vom Autor eingegeben.",
  "listing.btSimulated": "Backtest · simuliert",
  "listing.btNote": "So hätten die Regeln historische Kurse mit den Kosten dieses Kontotyps gehandelt. Dies ist nicht Teil der obigen Live-Historie.",
  "listing.btA11y": "Backtest-Eigenkapitalkurve (simuliert)",
  "listing.about": "Über", // (display)
  "listing.risk": "Risiko", // (display)
  "listing.rules": "Regeln", // (display)
  "listing.rulesPrivate": "Die Regeln sind privat: Kopieren Sie die Strategie, um sie auf Ihrem Konto auszuführen.",
  "listing.reviews": "Bewertungen · {n}", // (display)
  "listing.noReviews": "Noch keine Bewertungen.",
  "listing.subscribeFree": "Kostenlos abonnieren",
  "listing.subscribePaid": "Abonnieren · {price} USDT / Monat",
  "listing.copying": "Wird auf {login} kopiert",
  "listing.clonedTo": "In Ihre Strategien geklont",
  "listing.openDeployment": "Deployment öffnen",
  "listing.openStrategy": "Strategie öffnen",
  "listing.cancel": "Kündigen",
  "listing.cancelConfirm": "Abonnement kündigen",
  "listing.keep": "Behalten",
  "listing.cancelTitle": "Kündigen?", // (display)
  "listing.cancelCopy": "Die Strategie stoppt jetzt auf Ihrem Konto. Ihre offenen Positionen bleiben mit Stops und Zielen offen.",
  "listing.cancelClone": "Das Abonnement endet. Die geklonte Strategie bleibt in Ihrer Liste.",
  // {date} = end of the paid period
  "listing.cancelPaid": "Es läuft bis {date} weiter und verlängert sich nicht. Für den aktuellen Zeitraum wird nichts erstattet.",
  "listing.cancelled": "Abonnement gekündigt",
  "listing.cancelledPaid": "Es verlängert sich nicht",
  "listing.yours": "Ihr Angebot",
  "listing.manageWeb": "Im Web verwalten",

  /* ---------------------------------------------------------------- */
  /* Subscribe (form), subscriptions                                   */
  /* ---------------------------------------------------------------- */
  "sub.eyebrow": "Abonnieren",
  "sub.title": "Abonnieren",
  "sub.body": "von {author} · {symbol} {tf}",
  "sub.how": "Art",
  "sub.copyTitle": "Auf mein Konto kopieren",
  "sub.copyText": "Die exakte Version des Autors läuft rund um die Uhr auf Ihrem Konto. Die Regeln bleiben privat.",
  "sub.copyTextOpen": "Die exakte Version des Autors läuft rund um die Uhr auf Ihrem Konto.",
  "sub.cloneTitle": "Regeln klonen",
  "sub.cloneText": "Die Regeln werden zu einer Ihrer Strategien: Testen, ändern und starten Sie sie selbst.",
  "sub.multiplierHint": "Skaliert die Ordergrößen der Strategie auf Ihrem Konto.",
  "sub.price": "Preis",
  "sub.dueNow": "Jetzt fällig",
  "sub.wallet": "Wallet (verfügbar)",
  "sub.renewal": "Verlängerung",
  "sub.noCharge": "Kostenlos, es wird nichts berechnet",
  "sub.shortTitle": "Nicht genug USDT",
  "sub.shortBody": "Ihre Wallet benötigt mindestens {amount} USDT verfügbares Guthaben.",
  "sub.deposit": "Einzahlen",
  "sub.liveBody": "Die Strategie platziert echte Orders mit echtem Geld auf diesem Konto und kann es verlieren.",
  "sub.ackPay": "Jetzt und alle 30 Tage bis zu meiner Kündigung {price} USDT aus meiner Kalks Wallet abbuchen.",
  "sub.doneTitle": "Abonniert", // (display)
  // {title} = strategy, {account} = "Demo 50000083"
  "sub.doneCopy": "„{title}“ läuft auf {account}.",
  "sub.doneClone": "„{title}“ ist jetzt eine Ihrer Strategien.",
  "sub.charged": "{amount} USDT wurden von Ihrer Wallet abgebucht.",
  // the answer to a subscribe request was lost (connection, timeout): the app re-reads the listing before a retry
  "sub.noAnswer": "Wir haben keine Antwort erhalten. Das Abonnement wurde möglicherweise abgeschlossen.",
  "sub.checkingTitle": "Ihr Abonnement wird geprüft",
  "sub.checkingBody": "Die Antwort ging unterwegs verloren. Wir prüfen beim Server, bevor Sie es erneut versuchen können, damit Ihnen nie doppelt berechnet wird.",
  "sub.noAnswerRetry": "Immer noch keine Antwort und kein neues Abonnement auf Ihrem Konto. Sie können es erneut versuchen.",
  "sub.notThrough": "Es ist nicht durchgegangen, und es bleibt nichts berechnet (eine Belastung wird Ihrer Wallet erstattet). Sie können es erneut versuchen.",
  "sub.unfinished": "Es wird auf dem Server noch eingerichtet. Prüfen Sie Marketplace › Abonnements und Ihren Wallet-Verlauf oder wenden Sie sich an den Support, bevor Sie es erneut versuchen.",
  "sub.free": "Kostenloses Abonnement: Es wurde nichts berechnet.",
  "sub.copyOn": "Kopie auf {login}",
  "sub.cloned": "geklont",
  "sub.renews": "Verlängerung am {date}",
  "sub.ends": "endet am {date}",
  "sub.status.active": "Aktiv",
  "sub.status.cancelled": "Gekündigt",
  "sub.status.expired": "Abgelaufen",
  "sub.status.past_due": "Zahlung fällig",

  "review.title": "Bewerten", // (display)
  "review.rating": "Ihre Bewertung",
  "review.stars": { one: "{count} Stern", other: "{count} Sterne" },
  "review.comment": "Kommentar (optional)",
  "review.placeholder": "Wie hat die Strategie für Sie gehandelt?",
  "review.post": "Bewertung senden",
  "review.saved": "Bewertung gespeichert",
  "review.rate": "Bewerten",
  "review.edit": "Bewertung bearbeiten",
  "review.you": "Sie",

  /* ---------------------------------------------------------------- */
  /* API keys and webhooks                                             */
  /* ---------------------------------------------------------------- */
  "keys.eyebrow": "Entwickler",
  "keys.title": "API", // (display)
  "keys.subtitle": "Keys für Ihre eigenen Handelsprogramme und Webhook-URLs für Alerts (TradingView und andere).",
  "keys.requests24h": "Anfragen · letzte 24 Std.",
  "keys.errors": "Fehler",
  // requests refused by the rate limit
  "keys.limited": "Begrenzt",
  "keys.p50": "Median",
  "keys.writes": "Orders",
  "keys.keys": "API-Keys", // (display)
  "keys.keysSub": "{n} aktiv · bis zu 20",
  "keys.none": "Keine API-Keys. Erstellen Sie einen im Kundenbereich im Web.",
  "keys.status.active": "Aktiv",
  "keys.status.revoked": "Widerrufen",
  "keys.status.expired": "Abgelaufen",
  "keys.scope.read": "Lesen",
  "keys.scope.trade": "Handeln",
  // {ips} = list of IP addresses
  "keys.ips": "Nur von {ips}",
  "keys.anyIp": "Von jeder IP-Adresse",
  "keys.expires": "Läuft ab am {date}",
  "keys.noExpiry": "Läuft nie ab",
  "keys.lastUsed": "zuletzt verwendet: {ago}",
  "keys.revoke": "Widerrufen",
  "keys.revokeTitle": "Diesen Key widerrufen?", // (display)
  "keys.revokeBody": "„{name}“ ({id}) funktioniert sofort für kein Programm mehr, das ihn nutzt. Dies kann nicht rückgängig gemacht werden.",
  "keys.revoked": "„{name}“ widerrufen",
  "keys.webTitle": "Im Web erstellen",
  "keys.webBody": "Neue Keys und Webhooks werden im Kundenbereich erstellt: Das Secret eines Keys und die URL eines Webhooks werden einmalig angezeigt, damit Sie sie in Ihre Trading-Tools kopieren können.",
  "keys.openWeb": "Kundenbereich öffnen",
  "keys.killHint": "Müssen Sie alles stoppen? Der Notaus im Algo-Bildschirm stoppt jede Strategie und blockiert Webhook- und API-Orders.",

  "hooks.title": "Webhooks", // (display)
  "hooks.sub": "{n} von bis zu 20",
  "hooks.none": "Keine Webhooks. Erstellen Sie einen im Kundenbereich im Web.",
  // {hint} = the URL's last characters
  "hooks.hint": "URL …{hint}",
  "hooks.accounts": { one: "{count} Konto", other: "{count} Konten" },
  "hooks.today": { zero: "heute keine Alerts", one: "{count} Alert heute", other: "{count} Alerts heute" },
  "hooks.used": "zuletzt: {ago}",
  "hooks.on": "An",
  "hooks.off": "Aus",
  "hooks.switch": "Webhook „{name}“ an",
  "hooks.passphrase": "Passphrase erforderlich",
  "hooks.noPassphrase": "Keine Passphrase",
  "hooks.delete": "Löschen",
  "hooks.deleteTitle": "Diesen Webhook löschen?", // (display)
  "hooks.deleteBody": "„{name}“ und seine geheime URL funktionieren sofort nicht mehr; an ihn gesendete Alerts werden abgelehnt. Dies kann nicht rückgängig gemacht werden.",
  "hooks.deleted": "„{name}“ gelöscht",
  "hooks.alerts": "Letzte Alerts", // (display)
  "hooks.alertsSub": "Jeder Alert mit dem Ergebnis jedes Kontos",
  // Alert statuses (server values)
  "hooks.status.accepted": "Angenommen",
  "hooks.status.partial": "Teilweise ausgeführt",
  "hooks.status.failed": "Fehlgeschlagen",
  "hooks.status.received": "Empfangen",
  "hooks.status.rejected": "Abgelehnt",
  "hooks.status.blocked": "Blockiert (Notaus)",
  // Each account's result of an alert (server values)
  "hooks.result.filled": "ausgeführt",
  "hooks.result.pending": "Order platziert",
  "hooks.result.closed": "geschlossen",
  "hooks.result.nothing_to_close": "nichts zu schließen",
  "hooks.result.rejected": "abgelehnt",
};
export default mobileAlgo;
