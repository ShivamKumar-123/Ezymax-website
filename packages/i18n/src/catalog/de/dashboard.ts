import type { NsMessages } from "../../core";

const dashboard: NsMessages<"dashboard"> = {
  // Page header (Client Area home). {name} = client's first name
  "greeting.morning": "Guten Morgen, {name}",
  "greeting.afternoon": "Guten Tag, {name}",
  "greeting.evening": "Guten Abend, {name}",
  "greeting.welcome": "Willkommen, {name}",
  "subtitle.live": "Willkommen bei Kalks. Hier sehen Sie Ihr Konto und die heutigen Märkte.",
  "subtitle.demo": "So entwickeln sich Ihre Konten heute.",
  launchTrader: "Kalks Trader starten",
  openTerminal: "Handelsterminal öffnen",

  // Getting started checklist
  "steps.title": "Erste Schritte",
  "steps.subtitle": "Ihr Fortschritt zum Live-Handel",
  "steps.progress": "{done} von {total}",
  "steps.account.title": "Konto erstellen",
  "steps.account.text": "Registriert am {date}.",
  "steps.email.title": "E-Mail verifizieren",
  "steps.email.verified": "{email} ist verifiziert.",
  "steps.email.confirm": "Bestätigen Sie {email} mit dem gesendeten Code.",
  "steps.kyc.title": "Identität verifizieren",
  "steps.kyc.verified": "Ihre Identität ist verifiziert. Auszahlungen sind freigeschaltet.",
  "steps.kyc.moreInfo": "Unser Team benötigt noch ein Dokument von Ihnen.",
  "steps.kyc.review": "Ihre Dokumente werden von unserem Verifizierungsteam geprüft.",
  "steps.kyc.draft": "Machen Sie dort weiter, wo Sie aufgehört haben. Dauert etwa 3 Minuten.",
  "steps.kyc.rejected": "Wir konnten Ihre Dokumente nicht verifizieren. Sie können neu beginnen.",
  "steps.kyc.todo": "Dauert etwa 3 Minuten. Schaltet Auszahlungen frei.",
  "steps.accountOpen.title": "Handelskonto eröffnen",
  // {count} = live + demo accounts in total
  "steps.accountOpen.opened": { one: "{live} Live- und {demo} Demokonto eröffnet.", other: "{live} Live- und {demo} Demokonten eröffnet." },
  "steps.accountOpen.todo": "Eröffnen Sie ein Live- oder Demokonto; Ihr Login wird sofort erstellt.",
  "steps.wallet.title": "Wallet aufladen",
  "steps.wallet.text": "USDT-Einzahlungen über TRC20 werden gerade angebunden.",
  // Step status chips
  "steps.state.done": "Erledigt",
  "steps.state.todo": "Offen",
  "steps.state.review": "In Prüfung",
  "steps.state.rejected": "Abgelehnt",
  "steps.state.soon": "Nicht begonnen",

  // Trading accounts card. <b> wraps the equity amount
  "accounts.title": "Handelskonten",
  "accounts.summary": "Live-Eigenkapital <b>{equity}</b> · {live} live · {demo} demo · {positions} offene Positionen",
  "accounts.subtitle": "Ihre Live- und Demokonten",
  "accounts.all": "Alle Konten",
  "accounts.open": "Konto eröffnen",
  "accounts.unavailable": "Handelskonten sind derzeit nicht verfügbar. Ihre Guthaben sind sicher.",
  "accounts.openLive.title": "Live-Konto eröffnen",
  "accounts.openLive.text": "Echte Märkte. Startet mit Kontostand null; laden Sie es über Ihre Wallet auf.",
  "accounts.openDemo.title": "Demokonto eröffnen",
  "accounts.openDemo.text": "Virtuelles Guthaben mit Echtzeitkursen, täglich aufladbar.",
  "accounts.more": { one: "{count} weiteres Konto", other: "{count} weitere Konten" },
  "accounts.myTitle": "Meine Handelskonten",

  // Your account card
  "account.title": "Ihr Konto",
  "account.clientId": "Kunden-ID",
  "account.emailStatus": "E-Mail-Status",
  "account.notVerified": "Nicht verifiziert",
  "account.identity": "Identität",
  "account.memberSince": "Mitglied seit",
  "account.profile": "Profil",

  // Kalks Trader banner
  "trader.chip": "Live-Kurse",
  "trader.text": "Echtzeitkurse und Charts für {count} Instrumente aus Forex, Metallen, Indizes, Energie, Krypto und Aktien. Läuft im Browser, keine Installation nötig.",

  // Market clock / heatmap
  "sessions.title": "Marktzeiten",
  "sessions.open": "{open} von {total} Märkten geöffnet",
  "heatmap.title": "Markt-Heatmap",
  "heatmap.subtitle": "Heutige Bewegung laut Live-Kursen · leerer Punkt: Markt geschlossen",
  "heatmap.up": "{count} im Plus",
  "heatmap.down": "{count} im Minus",
  "heatmap.allMarkets": "Alle Märkte",
  "heatmap.tipOpen": "{symbol} · Markt geöffnet",
  "heatmap.tipClosed": "{symbol} · Markt geschlossen, Bewegung der letzten Sitzung",

  // Support card. <mail> wraps the support email address
  "support.title": "Brauchen Sie Hilfe?",
  "support.text": "Schreiben Sie von Ihrer registrierten Adresse an <mail>{email}</mail> und geben Sie Ihre Kunden-ID an.",
  "support.emailSupport": "Support kontaktieren",
  "support.copied": "E-Mail-Adresse kopiert",
  "support.copyFailed": "Kopieren fehlgeschlagen, bitte markieren Sie die Adresse",

  // Demo dashboard: onboarding strip
  "onboarding.title": "Schließen Sie die Kontoeinrichtung ab",
  "onboarding.text": "Schließen Sie KYC ab, um Auszahlungen und höhere Limits freizuschalten.",
  "onboarding.progress": "Fortschritt",
  "onboarding.dismiss": "Ausblenden",

  // Margin health
  "margin.title": "Margin-Status",
  "margin.subtitle": "Über alle Live-Konten",
  "margin.healthy": "Gesund",
  "margin.level": "Margin-Level",
  "margin.used": "Genutzte Margin",
  "margin.free": "Freie Margin",

  // Equity / P&L. {range} = 1W, 1M, 3M, YTD, 1Y, ALL (keep as-is)
  "equity.title": "Gesamtes Eigenkapital",
  "equity.changeOver": "Veränderung über {range}",
  "pnl.title": "Gewinn/Verlust · Monat",
  "pnl.lowRisk": "Geringes Risiko",
  "pnl.winRate": "Trefferquote (30T)",
  "pnl.trades": "Trades (30T)",
  "pnl.avgWin": "Ø Gewinn-Trade",
  "pnl.avgLoss": "Ø Verlust-Trade",
  "pnl.charges": "Gezahlte Gebühren",

  // KPI cards
  "kpi.wallet": "Wallet",
  "kpi.today": "+{pct}% heute",
  "kpi.monthPnl": "G/V Monat",
  "kpi.vsLastMonth": "+{pct}% ggü. Vormonat",
  "kpi.partnerEarnings": "Partnereinnahmen",
  // Copy = copy-trading earnings
  "kpi.copy": "Copy {amount}",

  // Top movers
  "movers.title": "Top-Mover",
  "movers.gainers": "Gewinner",
  "movers.losers": "Verlierer",

  // Economic calendar. A = Actual, F = Forecast, P = Previous
  "calendar.title": "Wirtschaftskalender",
  "calendar.subtitle": "Heute · Serverzeit GMT+3",
  "calendar.actual": "A {value} · ",
  "calendar.forecastPrevious": "P {forecast} · V {previous}",

  // News / world
  "news.title": "Marktnews",
  "news.all": "Alle News",
  "news.pinned": "Angeheftet",
  "world.title": "Märkte & News weltweit",
  "world.subtitle": "Live-Schlagzeilen nach Land und Währungsstimmung",
  "world.stories": { one: "{count} Meldung heute", other: "{count} Meldungen heute" },

  // Open positions
  "positions.title": "Offene Positionen",
  "positions.summary": { one: "{count} Position · schwebend", other: "{count} Positionen · schwebend" },
  "positions.terminal": "Terminal",

  // Partner banner. <link> wraps the referral link
  "partner.chip": "Partnerprogramm",
  "partner.title": "Trader einladen. Bis zu $15 pro Lot verdienen – lebenslang.",
  "partner.text": "Mehrstufige Provisionen, CPA-Boni und Echtzeit-Tracking. Ihr Link: <link>{url}</link>",
  "partner.open": "Partner-Dashboard öffnen",

  // Short relative times (m = minutes, h = hours, d = days)
  "time.justNow": "Gerade eben",
  "time.minutesAgo": "vor {count} Min.",
  "time.hoursAgo": "vor {count} Std.",
  "time.daysAgo": "vor {count} T.",
  // {time} = sample value like "5m"
  "time.ago": "vor {time}",

  // Notifications bell / panel
  "notifications.title": "Benachrichtigungen",
  "notifications.ariaUnread": "Benachrichtigungen, {count} ungelesen",
  "notifications.markAll": "Alle gelesen",
  "notifications.clear": "Leeren",
  "notifications.emptyTitle": "Noch keine Benachrichtigungen",
  "notifications.emptyText": "Einzahlungen, Auszahlungen, Verifizierung, Handelsalarme und Antworten vom Support erscheinen hier.",
  "notifications.settings": "Benachrichtigungseinstellungen",

  // Client Area redesign: side menu, dashboard overview
  "chrome.expand": "Menü ausklappen",
  "chrome.collapse": "Menü einklappen",
  "chrome.menu": "Menü",
  "home.todayPnl": "G&V heute",
  "home.walletBalance": "Wallet-Guthaben",
  "home.rewardsEarnings": "Prämien & IB-Einnahmen",
  "home.todayPct": "{pct}% heute",
  "home.floating": "Offene G&V",
  "home.rewards": "Prämien",
  "home.accountsChip": "{live} live · {positions} offene Positionen",
  "home.statistics": "Statistik",
  "home.pnl": "G&V",
  "home.weekly": "Wöchentlich",
  "home.monthly": "Monatlich",
  "home.lastYear": "Letztes Jahr",
  "home.noHistory": "Ihr Equity-Verlauf erscheint hier, sobald Ihre Live-Konten Aktivität haben.",
  "home.thisPeriod": "Dieser Zeitraum",
  "home.previousPeriod": "Vorheriger Zeitraum",
  "home.yourAccounts": "Ihre Konten",
  "home.tradingAccount": "Handelskonto",
  "home.accountInfo": "Kontoinformationen",
  "home.accountName": "Kontoname",
  "home.leverage": "Hebel",
  "home.previous": "Vorheriges Konto",
  "home.next": "Nächstes Konto",
  "home.showBalances": "Salden anzeigen",
  "home.hideBalances": "Salden ausblenden",
  "home.trade": "Handeln",
  "home.history": "Verlauf",
  "home.funding": "Einzahlung",
  "home.linked": "Verknüpft",
  "home.connected": "Verbunden",
  "home.subscriptions": { one: "{count} aktives Abonnement", other: "{count} aktive Abonnements" },
  "home.points": "{points} Punkte",
  "home.redeem": "Einlösen",
  "home.networkUnavailable": "Pausiert",
  "home.totalBalance": "Gesamtsaldo",
  "home.totalBalanceSub": "Live-Konten und Wallet",
  "home.transferFunds": "Geld übertragen",
  "home.quickActions": "Schnellaktionen",
  "home.later": "Später",
  "home.viewDetails": "Details ansehen",
  "home.verifyNow": "Jetzt verifizieren",
  "home.fundTitle": "Wallet aufladen",
  "home.fundText": "Zahlen Sie USDT ein, um auf einem Live-Konto zu handeln.",
  "home.depositNow": "Jetzt einzahlen",
  "home.tradingTitle": "Handel",
  "home.marketsTitle": "Märkte",
  "home.moreTitle": "Mehr für Sie",

  // Ask Kalks AI on the Overview
  "ai.title": "{name} fragen",
  "ai.subtitle": "Sofortige Antworten zu Ihrem Konto, Einzahlungen und dem Handel.",
  "ai.placeholder": "Fragen Sie alles zu Ihrem Konto oder zum Handel…",
  "ai.followUp": "Stellen Sie eine Folgefrage…",
  "ai.openChat": "Chat öffnen",
  "ai.continueChat": "Im Chat fortfahren",
  "ai.newQuestion": "Neue Frage",
  "ai.thinking": "{name} schreibt eine Antwort",
  "ai.slow": "Das dauert länger als üblich. Ihre Frage ist in Ihrem Support-Chat gespeichert, die Antwort erscheint dort.",
  "ai.withTeam": "Unser Support-Team antwortet Ihnen im Chat.",
  "ai.withAgent": "Sie chatten mit {name}. Antworten erscheinen in Ihrem Support-Chat.",
  "ai.connecting": "Sie werden mit einem Support-Mitarbeiter verbunden…",
  "ai.yourAccounts": "Ihre Live-Konten",
  "ai.chip.deposit": "Wie zahle ich ein?",
  "ai.chip.freeMargin": "Wie hoch ist meine freie Marge?",
  "ai.chip.marginLevel": "Margin-Level erklären",
  "ai.chip.openAccount": "Neues Konto eröffnen",
  "ai.q.openAccount": "Wie eröffne ich ein neues Handelskonto?",
};
export default dashboard;
