import type { NsMessages } from "../../core";

// Kalks mobile app: Prop (challenge catalogue and checkout, live rule dashboard, payouts, certificates).
// "Kalks", "Kalks Prop", "Kalks Trader", "Kalks-Live", "USDT", "New York" and "17:00" stay as they are.
// Titles marked "display" are tall uppercase: keep them short. {days} values are nominative ("14 Tage").
const mobileProp: NsMessages<"mobileProp"> = {
  // Prop home
  "home.eyebrow": "Kalks Prop",
  "home.title": "Funded werden", // display
  "home.subtitle": "Bestehen Sie eine Challenge, erhalten Sie ein Funded-Konto und behalten Sie bis zu {split}% des Gewinns. Alle Prop-Konten sind simuliert.",
  "home.subtitleNoSplit": "Bestehen Sie eine Challenge, erhalten Sie ein Funded-Konto und behalten Sie einen Anteil am Gewinn. Alle Prop-Konten sind simuliert.",
  "home.payouts": "Auszahlungen",
  "home.payoutsReady": "{amount} bereit",
  "home.payoutsNone": "Noch keine bereit",
  "home.certificates": "Zertifikate",
  "home.certCount": { one: "{count} erhalten", other: "{count} erhalten" },
  "home.mine": "Ihre Challenges",
  "home.past": "Vergangene Challenges",
  "home.showAll": "Alle {count} anzeigen",
  "home.yourCertificates": "Ihre Zertifikate",
  "home.plans": "Wählen Sie Ihre Challenge",
  "home.newChallenge": "Neue Challenge starten",
  "home.emptyTitle": "Keine Challenges im Angebot", // display
  "home.emptyBody": "Neue Challenge-Pläne werden vorbereitet. Bitte schauen Sie bald wieder vorbei.",
  "home.mineError": "Ihre Challenges konnten nicht geladen werden.",
  "home.plansError": "Die Challenge-Pläne konnten nicht geladen werden.",

  // How it works (numbered 01–04 on the Prop home)
  "how.title": "So funktioniert es",
  "how.1.title": "Plan wählen",
  "how.1.body": "Wählen Sie Modell und Kontogröße. Die Gebühr wird einmalig aus Ihrer USDT-Wallet bezahlt.",
  "how.2.title": "Ziel erreichen",
  "how.2.body": "Erreichen Sie das Gewinnziel innerhalb der Limits für Tagesverlust und Drawdown, über die Mindestanzahl an Handelstagen.",
  "how.3.title": "Funded werden",
  "how.3.body": "Bestehen Sie, und Ihr Funded-Konto wird automatisch eröffnet, mit einem Zertifikat zum Teilen.",
  "how.4.title": "Auszahlung erhalten",
  "how.4.body": "Beantragen Sie in jedem Auszahlungszyklus Ihren Gewinnanteil an Ihre USDT-Wallet.",
  "how.enforce": "Die Limits werden sekündlich auf dem Server anhand des Eigenkapitals geprüft. Sie werden bei 50, 75 und 90% des Tagesverlusts gewarnt; eine Verletzung schließt alle Positionen und beendet die Challenge.",

  // Plan models
  "type.oneStep": "1-Step",
  "type.twoStep": "2-Step",
  "type.instant": "Instant",
  "typeText.oneStep": "Eine Evaluierungsphase. Erreichen Sie das Ziel, halten Sie die Limits ein und werden Sie Funded.",
  "typeText.twoStep": "Zwei Evaluierungsphasen mit niedrigeren Zielen und weiteren Limits.",
  "typeText.instant": "Keine Evaluierung. Starten Sie sofort auf einem Funded-Konto mit engeren Limits.",

  // Plan card
  "plan.refundable": "Gebühr erstattet",
  "plan.fee": "Gebühr",
  "plan.account": "Konto",
  "plan.leverage": "Hebel 1:{n}",
  "plan.target": "Ziel",
  "plan.dailyLoss": "Tagesverlust",
  "plan.maxDD": "Max. Drawdown",
  "plan.static": "statisch",
  "plan.trailing": "nachlaufend",
  "plan.start": "Starten · {fee}",

  // Checkout
  "checkout.eyebrow": "Kauf",
  "checkout.fee": "Einmalige Gebühr",
  "checkout.chargedRefund": "Bezahlt aus Ihrer USDT-Wallet. Erstattung mit Ihrer ersten Auszahlung.",
  "checkout.chargedNoRefund": "Bezahlt aus Ihrer USDT-Wallet. Nicht erstattungsfähig.",
  "checkout.walletBalance": "Wallet-Guthaben: {balance} USDT",
  "checkout.shortTitle": "Ihr Wallet-Guthaben reicht nicht für die Gebühr",
  "checkout.short": "Sie haben {balance} USDT. Zahlen Sie {missing} USDT mehr ein, um diese Challenge zu bezahlen.",
  "checkout.rules": "Die Regeln",
  "checkout.limitsNote": "Limits sind ein Prozentsatz des Startguthabens. Eine Verletzung des Tagesverlusts oder des max. Drawdowns führt zum Nichtbestehen und schließt alle Positionen zum Marktpreis. Der Handelstag wird um 17:00 New York zurückgesetzt.",
  "checkout.agree": "Ich habe die Regeln gelesen und verstehe, dass das Konto simuliert ist und automatisch als nicht bestanden gilt, wenn ein Verlustlimit verletzt wird.",
  "checkout.pay": "{fee} bezahlen",
  "checkout.retry": "Erneut versuchen · {fee}",
  "checkout.paying": "Wird bezahlt…",
  "checkout.goToMine": "Meine Challenges ansehen",
  "checkout.readyTitle": "Sie sind dabei", // display
  "checkout.readyBody": "{fee} wurde aus Ihrer USDT-Wallet bezahlt und Ihr Konto über {size} für {phase} ist eröffnet. Die Regeln gelten ab sofort.",
  "checkout.savePasswords": "Speichern Sie diese Passwörter jetzt: Sie werden nur einmal angezeigt und nicht von uns gespeichert. In der App können Sie mit diesem Konto jederzeit auch ohne sie handeln.",
  "checkout.passwordsShown": "Die Handelspasswörter wurden bei der ersten Bestätigung dieses Kaufs angezeigt. In der App können Sie mit diesem Konto auch ohne sie handeln.",
  "checkout.viewChallenge": "Challenge ansehen",
  "checkout.readOnly": "In dieser Sitzung können keine Challenges gekauft werden.",

  // Account credentials
  "cred.login": "Login",
  "cred.server": "Server",
  "cred.password": "Handelspasswort",
  "cred.investorPassword": "Investorpasswort (nur lesen)",
  "cred.show": "Passwort anzeigen",
  "cred.hide": "Passwort verbergen",
  "copied": "{what} kopiert",
  "a11y.copy": "{what} kopieren",

  // Challenge statuses
  "status.pendingPayment": "Warten auf Zahlung",
  "status.provisioning": "Konto wird eröffnet",
  "status.active": "Aktiv",
  "status.funded": "Funded",
  "status.failed": "Nicht bestanden",
  "status.closed": "Geschlossen",
  "status.paymentFailed": "Zahlung fehlgeschlagen",
  // {phase} is the phase name from the plan, e.g. "Phase 2"
  "stage.active": "{phase} · Aktiv",
  "stage.failed": "{phase} · Nicht bestanden",
  "phaseStatus.provisioning": "Wird eröffnet",
  "phaseStatus.active": "Live",
  "phaseStatus.passed": "Bestanden",
  "phaseStatus.failed": "Nicht bestanden",
  "phaseStatus.closed": "Geschlossen",

  // Challenge cards (Prop home)
  "card.target": "Gewinnziel",
  "card.profit": "Gewinn",
  "card.equity": "Eigenkapital {amount}",
  "card.dailyLeft": "Verbleibender Tagesverlust {amount}",
  "card.opening": "Ihr Handelskonto wird eröffnet. Das dauert einige Sekunden.",

  // Dashboard
  "dash.equity": "Eigenkapital",
  "dash.balance": "Kontostand",
  "dash.floating": "Schwebend",
  "dash.open": "Offen",
  "dash.sinceStart": "seit Beginn der Phase",
  "dash.rules": "Regeln",
  "dash.rulesTitle": "Regeln dieser Challenge",
  "dash.notFound": "Challenge nicht gefunden", // display
  "dash.notFoundBody": "Sie wurde möglicherweise mit einem anderen Login eröffnet.",
  "dash.backToProp": "Zurück zu Prop",
  "live.live": "Live",
  "live.connecting": "Verbindung…",
  "live.offline": "Offline",
  // {time}: date and time of the last rule check
  "live.updated": "Geprüft: {time}",
  // {time}: when the phase ended
  "live.final": "Endstand · {time}",

  // Rule names (gauges, the rule log)
  "rule.dailyLoss": "Tagesverlust",
  "rule.maxDrawdown": "Max. Drawdown",
  "rule.profitTarget": "Gewinnziel",
  "rule.tradingDays": "Handelstage",
  "rule.timeLimit": "Zeitlimit",
  "rule.weekendHolding": "Halten übers Wochenende",
  "rule.newsWindow": "News-Zeitfenster",
  "rule.bannedStrategy": "Verbotene Strategie",
  "rule.consistency": "Konsistenz",
  "rule.riskDesk": "Entscheidung des Risk Desks",
  "ruleState.ok": "Läuft",
  "ruleState.passed": "Erfüllt",
  "ruleState.failed": "Verletzt",
  "ruleState.off": "Aus",

  // Gauges
  "target.ofTarget": "des Ziels",
  "target.of": "Ziel {amount} ({pct}%)",
  "target.left": "Noch {amount}",
  "target.reachedBy": "Erreicht, {amount} darüber",
  "limit.left": "Noch {amount}",
  "limit.breachAt": "Verletzung bei {amount}",
  "days": { one: "{count} Tag", other: "{count} Tage" },
  "days.of": "{v} von {min}",
  "days.count": { one: "{count} Tag", other: "{count} Tage" },
  "days.met": "Minimum erreicht",
  "days.toGo": { one: "Noch {count}", other: "Noch {count}" },
  "days.noMinimum": "Kein Minimum",
  "time.left": "noch {d} T {h} Std.",
  "time.deadline": "Endet am {date}",
  "consistency.rule": "Bester Tag ≤ {pct}% des Gewinns",
  "consistency.noProfit": "Noch kein Gewinn",
  "reset.title": "Tagesverlust wird zurückgesetzt in",
  "reset.note": "17:00 New York, jeden Handelstag",

  // Funded account: payout window ring
  "payoutHero.title": "Nächste Auszahlung",
  "payoutHero.share": "Ihr bisheriger Anteil",
  "payoutHero.open": "Offen", // display
  "payoutHero.ready": "Bereit", // display
  "payoutHero.days": { one: "{count} Tag", other: "{count} Tage" }, // display
  "payoutHero.eligible": "Jetzt berechtigt, mit Ihrem Anteil von {split}%.",
  "payoutHero.opens": "Das Auszahlungsfenster öffnet am {date}.",
  "payoutHero.later": "Beantragen Sie eine Auszahlung, sobald Sie berechtigten Gewinn haben.",

  // Big states
  "hero.opening.title": "Konto wird eröffnet", // display
  "hero.opening.body": "Die Zahlung ist bestätigt und Ihr Handelskonto wird eingerichtet. Diese Seite aktualisiert sich automatisch.",
  "hero.closed.title": "Challenge geschlossen", // display
  "hero.closed.body": "Das Handelskonto für diese Challenge konnte nicht eröffnet werden. Daher wurde die Challenge geschlossen und die Gebühr Ihrer USDT-Wallet erstattet. Wenden Sie sich bei Fragen an den Support.",
  // {reason} is the prop service's reason, in English
  "hero.closed.reason": "{reason}. Die Gebühr wurde Ihrer USDT-Wallet erstattet.",
  "hero.failed.title": "{phase} nicht bestanden", // display
  "hero.failed.on": "Beendet am {date}",
  // {reason} is the breach reason from the risk engine
  "hero.failed.body": "{reason}. Alle Positionen wurden geschlossen und das Konto ist deaktiviert.",
  "hero.failed.ruleBreached": "Eine Regel wurde verletzt",
  // {rule} is a rule name, e.g. "Tagesverlust"
  "hero.failed.rule": "{rule}: Limit verletzt",
  "hero.failed.new": "Neue Challenge starten",
  "hero.passed.title": "{phase} bestanden", // display
  "hero.passed.on": "Bestanden am {date}.",
  "hero.passed.next": "Ihr Konto für {phase} ist eröffnet.",
  "hero.passed.nextLogin": "Ihr Konto für {phase} ist eröffnet (#{login}).",
  "hero.passed.opening": "Ihr nächstes Konto wird eröffnet.",
  "hero.passed.certificate": "Zertifikat ansehen",
  "hero.passed.goNext": "Zu {phase}",
  "hero.funded.title": "Funded", // display
  "hero.funded.body": "Handeln Sie auf dem Funded-Konto und erhalten Sie {split}% des Gewinns als Auszahlungen.",
  "hero.funded.certificate": "Ihr Funded-Zertifikat ansehen",

  // Warnings while trading
  "warn.lossUsed": "{pct}% des heutigen Verlustlimits genutzt",
  "warn.lossUsedBody": "Eigenkapital auf oder unter {floor} führt zum Nichtbestehen und schließt alle Positionen. Heute verbleibend: {left}.",
  "warn.weekend": "Wochenendschließung",
  "warn.weekendBody": "Dieser Plan erlaubt kein Halten über das Wochenende: Offene Positionen werden freitags um 16:45 New York geschlossen.",

  // Actions
  "action.openTrade": "Im Handel öffnen",
  "action.trade": "Handeln",
  "action.tradeBlocked": "Nur mit dem Live-Konto einer aktiven Challenge kann gehandelt werden.",
  "action.payouts": "Auszahlungen",
  "action.support": "Support kontaktieren",

  // Equity chart
  "chart.title": "Eigenkapitalkurve",
  "chart.start": "Start",
  "chart.target": "Ziel",
  "chart.ddFloor": "Max. Drawdown",
  "chart.dailyFloor": "Tagesverlust",
  "chart.now": "Jetzt",
  "chart.empty": "Die Kurve erscheint nach den ersten Handelsminuten.",

  // Trading stats
  "stats.title": "Handelsstatistik",
  "stats.trades": "Trades",
  "stats.winRate": "Trefferquote",
  "stats.profitFactor": "Profit-Faktor",
  "stats.avgWin": "Ø Gewinn",
  "stats.avgLoss": "Ø Verlust",
  "stats.lots": "Lots",
  "stats.bestDay": "Bester Tag {date}: {amount}",

  // Rule log
  "events.title": "Regelprotokoll",
  "events.empty": "Keine Warnungen oder Verletzungen. Weiter so.",
  "events.equity": "Eigenkapital {amount}",
  "events.limit": "Limit {amount}",
  "severity.breach": "Verletzung",
  "severity.violation": "Verstoß",
  "severity.warning": "Warnung",
  "severity.info": "Info",

  // Closed trades
  "trades.title": "Geschlossene Trades",
  "trades.all": "Alle {count}",
  "trades.count": { one: "{count} geschlossener Trade", other: "{count} geschlossene Trades" },
  "trades.empty": "Noch keine geschlossenen Trades.",
  "trades.buy": "Kauf",
  "trades.sell": "Verkauf",
  // compact durations: Sek. = seconds, Min. = minutes, Std. = hours, T = days
  "duration.s": "{s} Sek.",
  "duration.ms": "{m} Min. {s} Sek.",
  "duration.hm": "{h} Std. {m} Min.",
  "duration.dh": "{d} T {h} Std.",

  // Account details
  "account.title": "Konto",
  "account.split": "Ihr Anteil",
  "account.initial": "Startguthaben",
  "account.started": "Phase begonnen",
  "account.ended": "Beendet",
  "account.deadline": "Frist",
  "account.passwordNote": "Die Handelspasswörter wurden beim Kauf einmalig angezeigt. „Im Handel öffnen“ meldet Sie ohne sie bei diesem Konto an.",

  // Payouts
  "payouts.title": "Auszahlungen", // display
  "payouts.available": "Jetzt verfügbar",
  "payouts.eligibleCount": { one: "{eligible} von {count} Funded-Konto berechtigt", other: "{eligible} von {count} Funded-Konten berechtigt" },
  "payouts.requests": { one: "{count} Antrag", other: "{count} Anträge" },
  "payouts.count": { one: "{count} Auszahlung", other: "{count} Auszahlungen" },
  "payouts.paidToDate": "Bisher ausgezahlt",
  "payouts.funded": "Funded-Konten",
  "payouts.account": "Funded {size}", // display
  "payouts.quote": "Auszahlungsübersicht",
  "payouts.eligibleNow": "Jetzt berechtigt",
  "payouts.notYet": "Noch nicht",
  "payouts.toWallet": "an Ihre Wallet",
  "payouts.yourSplit": "Ihr Anteil",
  "payouts.firmShare": "Anteil des Unternehmens",
  "payouts.alreadyRefunded": "Bereits erstattet",
  "payouts.withFirst": "Mit der ersten Auszahlung",
  "payouts.opens": "Möglich ab {date}.",
  "payouts.minimum": "Minimum {amount}.",
  "payouts.kycNote": "Verifizieren Sie Ihre Identität, um diese Auszahlung zu beantragen.",
  "payouts.kycPendingNote": "Sie können diese Auszahlung beantragen, sobald Ihre Identitätsprüfung genehmigt ist.",
  "payouts.readOnly": "In dieser Sitzung können keine Auszahlungen beantragt werden.",
  "payouts.request": "Auszahlung beantragen",
  // opens the account's live rule dashboard (the web calls it "Regel-Dashboard"); short: it shares a row with Trade
  "payouts.dashboard": "Regeln",
  "payouts.history": "Verlauf",
  "payouts.historyEmpty": "Noch keine Auszahlungen.",
  "payouts.emptyTitle": "Noch kein Funded-Konto", // display
  "payouts.emptyBody": "Bestehen Sie eine Challenge, um ein Funded-Konto zu erhalten. Sobald es berechtigten Gewinn aufweist, beantragen Sie hier Auszahlungen.",
  "payouts.emptyAction": "Funded werden",
  "payoutStatus.pending": "In Prüfung",
  "payoutStatus.approved": "Genehmigt",
  "payoutStatus.paid": "Ausgezahlt",
  "payoutStatus.rejected": "Abgelehnt",
  "payoutStatus.failed": "Fehlgeschlagen",
  "split.title": "Gewinnbeteiligung und Skalierung",
  "split.upTo": "Bis zu {pct}% mit Skalierung",
  "split.cycle": "Auszahlungen",
  // {days} e.g. "14 Tage"
  "split.first": "{days} bis zur ersten",
  "split.firstNow": "Ab dem ersten Tag",
  // {months} e.g. "4 Monate"; {cap} e.g. "$2,000,000"
  "scaling.text": "Erzielen Sie {profit}% Gewinn über {months}, und das Konto wächst um {increase}%, bis zu {cap}.",
  "scaling.none": "Bei diesem Plan wird das Konto nicht skaliert.",
  "months": { one: "{count} Monat", other: "{count} Monate" },

  // Payout request sheet
  "request.eyebrow": "Auszahlung beantragen",
  "request.profit": "Gewinn auf dem Konto",
  "request.share": "Ihr Anteil ({pct}%)",
  "request.feeRefund": "Erstattung der Challenge-Gebühr",
  "request.total": "Gesamt an Ihre Wallet",
  "request.note": "Der gesamte aktuelle Gewinn wird jetzt vom Handelskonto abgebucht, damit er während der Prüfung nicht verhandelt werden kann. Nach Genehmigung wird Ihr Anteil Ihrer USDT-Wallet gutgeschrieben; bei Ablehnung wird der Gewinn wieder auf das Konto gebucht.",
  "request.submit": "{amount} beantragen",
  "request.done": "Auszahlung beantragt",
  "request.doneBody": "{amount} geht nach Genehmigung an Ihre USDT-Wallet.",

  // Identity verification (payouts)
  "kyc.verified": "Identität verifiziert: Auszahlungen können genehmigt werden.",
  "kyc.pendingTitle": "Verifizierung in Prüfung",
  "kyc.pendingText": "Ihre Verifizierung wird geprüft. Sie können Auszahlungen beantragen, sobald Ihre Identität verifiziert ist.",
  "kyc.requiredTitle": "Identität verifizieren",
  "kyc.requiredText": "Auszahlungen erfolgen nur an verifizierte Trader. Verifizieren Sie sich vor Ihrer ersten Auszahlung.",
  "kyc.rejectedText": "Ihre Verifizierung wurde abgelehnt. Reichen Sie sie erneut ein, um Auszahlungen zu erhalten.",

  // Why a payout can't be requested yet
  "blocker.notYetEligible": "Das Auszahlungsfenster ist noch nicht geöffnet.",
  "blocker.belowMinimum": "Der Gewinn liegt unter der Mindestauszahlung.",
  "blocker.positionsOpen": "Schließen Sie alle offenen Positionen, um eine Auszahlung zu beantragen.",
  "blocker.payoutPending": "Eine Auszahlung wird bereits geprüft.",
  "blocker.consistency": "Konsistenzregel nicht erfüllt: Ihr bester Tag macht einen zu großen Anteil am Gewinn aus.",

  // Certificates
  "certs.title": "Zertifikate", // display
  "certs.subtitle": "Für jede bestandene Phase, jedes Funded-Konto und jede Auszahlung erhalten Sie ein Zertifikat, das jeder prüfen kann.",
  "certs.kind.pass": "Phase bestanden",
  "certs.kind.funded": "Funded Trader",
  "certs.kind.payout": "Auszahlung",
  "certs.revoked": "Widerrufen",
  "certs.revokedBody": "Dieses Zertifikat wurde von Kalks widerrufen und ist nicht mehr gültig. Es kann daher nicht geteilt werden.",
  "certs.meta": "{plan} · {size} · {date}",
  "certs.number": "Nr. {code}",
  "certs.shareImage": "Bild teilen",
  "certs.shareLink": "Link teilen",
  "certs.copyLink": "Link kopieren",
  "certs.linkCopied": "Prüflink kopiert",
  "certs.shareTitle": "Mein Kalks-Prop-Zertifikat",
  "certs.shareMessage": "Mein Kalks-Prop-Zertifikat. Hier prüfen:",
  "certs.shareFailed": "Das Zertifikat konnte nicht geteilt werden. Bitte versuchen Sie es erneut.",
  "certs.shareUnavailable": "Teilen ist auf diesem Gerät nicht verfügbar.",
  "certs.emptyTitle": "Noch keine Zertifikate", // display
  "certs.emptyBody": "Bestehen Sie eine Challenge-Phase, um Ihr erstes Zertifikat zu erhalten, mit einem öffentlichen Link, den jeder prüfen kann.",
  "certs.emptyAction": "Challenges ansehen",

  // Rule words shared by the checkout and the rules sheet
  "accountSize": "Kontogröße",
  "profitSplit": "Gewinnbeteiligung",
  "feeRefund": "Gebührenerstattung",
  "nonRefundable": "Nicht erstattungsfähig",
  "leverage": "Hebel",
  "none": "Keine",
  "allowed": "Erlaubt",
  "notAllowed": "Nicht erlaubt",
  "noTimeLimit": "Kein Zeitlimit",
  // {phase} is the phase name, e.g. "Phase 1"
  "rules.phaseTarget": "Ziel {phase}",
  "rules.phaseMinDays": "Mindesttage {phase}",
  "rules.phaseTimeLimit": "Zeitlimit {phase}",
  "rules.evaluation": "Evaluierung",
  "rules.evaluationNone": "Keine, Funded ab dem ersten Tag",
  "rules.dailyLoss": "Tagesverlustlimit",
  "rules.dailyLossBalance": "{pct}% · {amount} · vom Kontostand um 17:00 New York",
  "rules.dailyLossEquity": "{pct}% · {amount} · vom höheren Wert aus Kontostand und Eigenkapital um 17:00 New York",
  "rules.ddStatic": "{pct}% statisch",
  "rules.ddTrailing": "{pct}% nachlaufend",
  "rules.ddLocks": "{dd}, fixiert bei Startwert",
  // ≤ = at most
  "rules.consistencyValue": "Bester Tag ≤ {pct}% des Gesamtgewinns",
  "rules.news": "News-Trading",
  "rules.newsBlocked": "Nicht innerhalb von ±{min} Min. um News mit hoher Auswirkung",
  "rules.newsBlockedFails": "Nicht innerhalb von ±{min} Min. um News mit hoher Auswirkung (führt zum Nichtbestehen)",
  "rules.weekendClosed": "Positionen werden freitags um 16:45 New York geschlossen",
  "rules.ea": "Expert Advisors",
  "rules.banned": "Verbotene Strategien",
  "rules.splitScaling": "{split}%, steigend bis {max}%",
  "rules.firstPayout": "Erste Auszahlung",
  // {freq} is a lower-case payout cycle, e.g. "wöchentlich"; {days} e.g. "14 Tage"
  "rules.firstPayoutValue": "{days} Wartezeit, dann {freq} · min. {min}",
  "rules.refunded": "Erstattung mit der ersten Auszahlung",

  // Banned trading strategies
  "banned.hft": "Hochfrequenzhandel",
  "banned.latencyArbitrage": "Latenzarbitrage",
  "banned.tickScalping": "Tick-Scalping",
  "banned.crossAccountCopying": "Kopieren zwischen Konten",
  "banned.crossAccountHedging": "Hedging zwischen Konten",
  "banned.martingale": "Martingale",
  "banned.grid": "Grid-Trading",

  // Payout cycle, lower case: used inside sentences ("dann wöchentlich")
  "payoutFreq.weekly": "wöchentlich",
  "payoutFreq.biWeekly": "alle 2 Wochen",
  "payoutFreq.monthly": "monatlich",
  "payoutFreq.onDemand": "auf Anfrage",

  // Errors (messages for the prop service's error codes)
  "errorLink.deposit": "Einzahlen",
  "errorLink.verify": "Identität verifizieren",
  "error.insufficientFunds": "Ihr USDT-Wallet-Guthaben reicht für diese Gebühr nicht aus. Zahlen Sie USDT ein und versuchen Sie es erneut.",
  "error.kycRequired": "Verifizieren Sie Ihre Identität, bevor Sie eine Auszahlung beantragen.",
  "error.paymentPending": "Die Wallet-Zahlung konnte noch nicht bestätigt werden. Versuchen Sie es in einer Minute erneut: Sie werden nicht doppelt belastet.",
  "error.paymentFailed": "Die Wallet-Zahlung ist nicht durchgegangen. Ihnen wurde nichts berechnet.",
  "error.walletPending": "Die Wallet hat noch nicht bestätigt. Bitte versuchen Sie es in einer Minute erneut.",
  "error.walletRejected": "Die Wallet hat diese Zahlung abgelehnt. Bitte wenden Sie sich an den Support.",
  "error.provisioning": "Zahlung erhalten. Ihr Handelskonto wird noch eröffnet: Es erscheint innerhalb einer Minute unter Ihren Challenges.",
  "error.planUnavailable": "Dieser Plan oder diese Größe ist nicht mehr verfügbar. Bitte wählen Sie einen anderen.",
  "error.notYetEligible": "Dieses Konto ist noch nicht für eine Auszahlung berechtigt.",
  "error.belowMinimum": "Der Gewinn liegt unter der Mindestauszahlung.",
  "error.positionsOpen": "Schließen Sie alle offenen Positionen, bevor Sie eine Auszahlung beantragen.",
  "error.payoutPending": "Eine Auszahlung für dieses Konto wird bereits geprüft.",
  "error.consistency": "Die Konsistenzregel ist noch nicht erfüllt: Ihr bester Tag macht einen zu großen Anteil am Gewinn aus.",
  "error.notFunded": "Auszahlungen sind nur für Funded-Konten verfügbar.",
  "error.accountUnavailable": "Das Handelskonto für diese Challenge konnte nicht eröffnet werden, daher wurde die Gebühr Ihrer USDT-Wallet erstattet. Wenden Sie sich an den Support, falls das wiederholt passiert.",
  "error.idempotencyConflict": "Dieser Kaufvorgang wurde bereits für einen anderen Kauf verwendet. Schließen Sie ihn und beginnen Sie erneut.",
  "error.notActive": "Diese Challenge ist nicht aktiv.",
  "error.accountLimit": "Sie haben die maximale Anzahl an Prop-Konten erreicht. Wenden Sie sich an den Support, um das Limit zu erhöhen.",
  "error.staffReadOnly": "Dies ist eine schreibgeschützte Mitarbeitersitzung. Änderungen sind nicht erlaubt.",
  "error.engine": "Der Handelsserver hat nicht geantwortet. Bitte versuchen Sie es in Kürze erneut.",
  "error.generic": "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
  "load.title": "Prop ist nicht verfügbar", // display
  "load.body": "Der Prop-Dienst ist nicht erreichbar. Ihre Konten sind sicher; bitte versuchen Sie es gleich erneut.",
};
export default mobileProp;
