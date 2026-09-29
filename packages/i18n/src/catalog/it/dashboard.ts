import type { NsMessages } from "../../core";

const dashboard: NsMessages<"dashboard"> = {
  // Intestazione pagina (home Area Clienti). {name} = nome del cliente
  "greeting.morning": "Buongiorno, {name}",
  "greeting.afternoon": "Buon pomeriggio, {name}",
  "greeting.evening": "Buonasera, {name}",
  "greeting.welcome": "Benvenuto, {name}",
  "subtitle.live": "Benvenuto in Kalks. Ecco il tuo account e i mercati di oggi.",
  "subtitle.demo": "Ecco l'andamento dei tuoi conti oggi.",
  launchTrader: "Avvia Kalks Trader",
  openTerminal: "Apri il terminale di trading",

  // Checklist per iniziare
  "steps.title": "Per iniziare",
  "steps.subtitle": "I tuoi progressi verso il trading reale",
  "steps.progress": "{done} di {total}",
  "steps.account.title": "Crea il tuo account",
  "steps.account.text": "Registrato il {date}.",
  "steps.email.title": "Verifica la tua email",
  "steps.email.verified": "{email} è verificata.",
  "steps.email.confirm": "Conferma {email} con il codice che ti abbiamo inviato.",
  "steps.kyc.title": "Verifica la tua identità",
  "steps.kyc.verified": "La tua identità è verificata. I prelievi sono sbloccati.",
  "steps.kyc.moreInfo": "Il nostro team ha bisogno di un altro documento.",
  "steps.kyc.review": "I tuoi documenti sono in mano al nostro team di verifica.",
  "steps.kyc.draft": "Riprendi da dove avevi lasciato. Richiede circa 3 minuti.",
  "steps.kyc.rejected": "Non è stato possibile verificare i tuoi documenti. Puoi ricominciare.",
  "steps.kyc.todo": "Richiede circa 3 minuti. Sblocca i prelievi.",
  "steps.accountOpen.title": "Apri un conto di trading",
  "steps.accountOpen.opened": { one: "{live} conto reale e {demo} demo aperti.", other: "{live} conti reali e {demo} demo aperti." },
  "steps.accountOpen.todo": "Apri un conto reale o demo; il login viene emesso all'istante.",
  "steps.wallet.title": "Finanzia il tuo wallet",
  "steps.wallet.text": "I depositi in USDT su TRC20 sono in fase di attivazione.",
  // Chip di stato dei passaggi
  "steps.state.done": "Fatto",
  "steps.state.todo": "Da fare",
  "steps.state.review": "In revisione",
  "steps.state.rejected": "Rifiutato",
  "steps.state.soon": "Non iniziato",

  // Scheda conti di trading. <b> racchiude l'importo dell'equity
  "accounts.title": "Conti di trading",
  "accounts.summary": "Equity reale <b>{equity}</b> · {live} reali · {demo} demo · {positions} posizioni aperte",
  "accounts.subtitle": "I tuoi conti reali e demo",
  "accounts.all": "Tutti i conti",
  "accounts.open": "Apri conto",
  "accounts.unavailable": "I conti di trading non sono disponibili al momento. I tuoi saldi sono al sicuro.",
  "accounts.openLive.title": "Apri un conto reale",
  "accounts.openLive.text": "Mercati reali. Parte con saldo zero; i depositi si attivano con il wallet.",
  "accounts.openDemo.title": "Apri un conto demo",
  "accounts.openDemo.text": "Fondi virtuali su prezzi in tempo reale, ricaricabili ogni giorno.",
  "accounts.more": { one: "Ancora {count} conto", other: "Altri {count} conti" },
  "accounts.myTitle": "I miei conti di trading",

  // Scheda account
  "account.title": "Il tuo account",
  "account.clientId": "ID cliente",
  "account.emailStatus": "Stato email",
  "account.notVerified": "Non verificata",
  "account.identity": "Identità",
  "account.memberSince": "Cliente dal",
  "account.profile": "Profilo",

  // Banner Kalks Trader
  "trader.chip": "Prezzi in tempo reale",
  "trader.text": "Quotazioni e grafici in tempo reale per {count} strumenti tra forex, metalli, indici, energie, cripto e azioni. Funziona nel browser, nulla da installare.",

  // Orologio dei mercati / heatmap
  "sessions.title": "Orologio dei mercati",
  "sessions.open": "{open} mercati aperti su {total}",
  "heatmap.title": "Heatmap dei mercati",
  "heatmap.subtitle": "Variazione odierna dai prezzi in tempo reale · punto vuoto: mercato chiuso",
  "heatmap.up": "{count} in rialzo",
  "heatmap.down": "{count} in ribasso",
  "heatmap.allMarkets": "Tutti i mercati",
  "heatmap.tipOpen": "{symbol} · mercato aperto",
  "heatmap.tipClosed": "{symbol} · mercato chiuso, variazione dell'ultima sessione",

  // Scheda assistenza. <mail> racchiude l'indirizzo email dell'assistenza
  "support.title": "Serve aiuto?",
  "support.text": "Scrivi a <mail>{email}</mail> dal tuo indirizzo registrato indicando il tuo ID cliente.",
  "support.emailSupport": "Scrivi all'assistenza",
  "support.copied": "Indirizzo email copiato",
  "support.copyFailed": "Copia non riuscita, seleziona l'indirizzo manualmente",

  // Dashboard demo: barra di onboarding
  "onboarding.title": "Completa la configurazione del tuo account",
  "onboarding.text": "Completa il KYC per sbloccare i prelievi e limiti più alti.",
  "onboarding.progress": "Avanzamento",
  "onboarding.dismiss": "Ignora",

  // Stato del margine
  "margin.title": "Stato del margine",
  "margin.subtitle": "Su tutti i conti reali",
  "margin.healthy": "Buono",
  "margin.level": "Livello di margine",
  "margin.used": "Margine utilizzato",
  "margin.free": "Margine libero",

  // Equity / P&L. {range} = 1W, 1M, 3M, YTD, 1Y, ALL (invariati)
  "equity.title": "Equity totale",
  "equity.changeOver": "Variazione in {range}",
  "pnl.title": "Profitti / perdite · mese",
  "pnl.lowRisk": "Rischio basso",
  "pnl.winRate": "Tasso di successo (30g)",
  "pnl.trades": "Operazioni (30g)",
  "pnl.avgWin": "Operazione vincente media",
  "pnl.avgLoss": "Operazione perdente media",
  "pnl.charges": "Costi pagati",

  // Schede KPI
  "kpi.wallet": "Wallet",
  "kpi.today": "+{pct}% oggi",
  "kpi.monthPnl": "P&L del mese",
  "kpi.vsLastMonth": "+{pct}% rispetto al mese scorso",
  "kpi.partnerEarnings": "Guadagni partner",
  "kpi.copy": "Copy {amount}",

  // Maggiori variazioni
  "movers.title": "Maggiori variazioni",
  "movers.gainers": "In rialzo",
  "movers.losers": "In ribasso",

  // Calendario economico. A = Attuale, P = Previsione, Pr = Precedente
  "calendar.title": "Calendario economico",
  "calendar.subtitle": "Oggi · ora del server GMT+3",
  "calendar.actual": "A {value} · ",
  "calendar.forecastPrevious": "P {forecast} · Pr {previous}",

  // Notizie / mondo
  "news.title": "Notizie di mercato",
  "news.all": "Tutte le notizie",
  "news.pinned": "In evidenza",
  "world.title": "Mercati e notizie dal mondo",
  "world.subtitle": "Titoli in tempo reale per paese e sentiment sulle valute",
  "world.stories": { one: "{count} notizia oggi", other: "{count} notizie oggi" },

  // Posizioni aperte
  "positions.title": "Posizioni aperte",
  "positions.summary": { one: "{count} posizione · fluttuante", other: "{count} posizioni · fluttuante" },
  "positions.terminal": "Terminale",

  // Banner partner. <link> racchiude il link referral
  "partner.chip": "Programma partner",
  "partner.title": "Invita trader. Guadagna fino a $15 per lotto, per sempre.",
  "partner.text": "Commissioni multilivello, bonus CPA e monitoraggio in tempo reale. Il tuo link: <link>{url}</link>",
  "partner.open": "Apri la dashboard partner",

  // Tempi relativi brevi (m = minuti, h = ore, g = giorni)
  "time.justNow": "Adesso",
  "time.minutesAgo": "{count} min fa",
  "time.hoursAgo": "{count} h fa",
  "time.daysAgo": "{count} g fa",
  "time.ago": "{time} fa",

  // Campanella / pannello notifiche
  "notifications.title": "Notifiche",
  "notifications.ariaUnread": "Notifiche, {count} non lette",
  "notifications.markAll": "Segna tutte come lette",
  "notifications.clear": "Cancella",
  "notifications.emptyTitle": "Ancora nessuna notifica",
  "notifications.emptyText": "Qui trovi depositi, prelievi, verifica, avvisi di trading e risposte dell'assistenza.",
  "notifications.settings": "Impostazioni notifiche",
};
export default dashboard;
