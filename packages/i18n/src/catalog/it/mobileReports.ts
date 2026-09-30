import type { NsMessages } from "../../core";

// App mobile Kalks, Report: Estratti conto (/reports/statements) e Analisi (/reports/analytics).
// Gran parte delle etichette riusa portfolio.st.* / portfolio.an.*; qui solo i testi del telefono.
const mobileReports: NsMessages<"mobileReports"> = {
  eyebrow: "Report",
  "eyebrow.analytics": "Report · USD · ora del server",

  // Selettore del conto (una scheda che apre un pannello)
  "account.title": "Conto",
  "account.choose": "Scegli un conto",
  "account.allHint": { one: "{count} conto reale", other: "{count} conti reali" },
  "account.change": "Cambia conto",

  // Estratti conto
  "st.day": "Giorno",
  "st.pickDay": "Scegli un giorno",
  "st.pickFrom": "Data di inizio",
  "st.pickTo": "Data di fine",
  "st.include": "Includi",
  "st.summary": "#{login} · {period} · {format}",
  "st.preparing": "Preparazione…",
  "st.ready": "Estratto conto pronto",
  "st.saved": "Salvato come {file}",
  "st.shareTitle": "Condividi estratto conto",
  "st.failed": "Impossibile scaricare l'estratto conto",
  "st.offline": "Sei offline. Connettiti per scaricare gli estratti conto.",
  "st.monthly.empty": "Ancora nessun mese di estratto conto.",
  "st.monthly.offline": "Sei offline. Connettiti per vedere gli estratti conto mensili.",
  "st.monthly.a11y": "{month}: netto {net}, {trades}. Apre i download.",
  "st.month.title": "Estratto conto di {month}",
  "st.month.formats": "Scarica come",
  "st.prevMonth": "Mese precedente",
  "st.nextMonth": "Mese successivo",

  // Analisi: riquadro principale e statistiche
  "an.hero.label": "P&L netto · {period}",
  "an.hero.return": "Rendimento",
  "an.hero.trades": "Operazioni",
  "an.hero.lots": "Lotti",
  "an.tile.sharpe": "Indice di Sharpe",
  "an.tile.expectancy": "Aspettativa",
  "an.tile.sortino": "Sortino {value}",
  "an.tile.avgWinLoss": "Guadagno / perdita medi",
  "an.tile.rr": "Rendimento : rischio 1 : {value}",
  "an.tile.holdSplit": "Vincenti {win} · perdenti {loss}",
  "an.tile.streaks": "Serie",
  "an.tile.streaksSub": "Vincite / perdite consecutive",
  "an.tile.trade": "{side} {volume} · #{ticket}",
  "an.tile.none": "Ancora nessuna operazione",

  // Analisi: curve
  "an.curve.hint": "Tieni premuto sul grafico per vedere ogni giorno",
  "an.curve.drawdown": "Drawdown",
  "an.curve.a11y": "Equity {equity}, saldo {balance} il {date}. Drawdown massimo {drawdown}.",

  // Analisi: calendario del P&L (netto delle operazioni chiuse per giorno del server)
  "an.cal.title": "Calendario del P&L",
  "an.cal.subtitle": "Risultato netto delle operazioni chiuse per giorno del server",
  "an.cal.subtitleEstimated": "Variazione giornaliera del saldo, esclusi depositi e prelievi",
  "an.cal.days": { one: "{count} giorno di trading", other: "{count} giorni di trading" },
  "an.cal.green": "{count} in verde",
  "an.cal.red": "{count} in rosso",
  "an.cal.noTrades": "Nessuna operazione chiusa",
  "an.cal.select": "Tocca un giorno per il suo risultato",
  "an.cal.a11yDay": "{date}: {net}, {trades}",

  // Analisi: ripartizioni
  "an.hour.byHour": "P&L netto per ora",
  "an.hour.byDayHour": "Giorno × ora",
  "an.hour.tap": "Tocca una barra o una cella per i dettagli",
  "an.tapBar": "Tocca una barra per i dettagli",
  "an.session.best": "Migliore",
  "an.session.asia": "Asia",
  "an.session.london": "Londra",
  "an.session.overlap": "Londra / New York",
  "an.session.newYork": "New York",
  "an.session.lateNewYork": "New York tarda",
  "an.side.split": "{long} · {short}",
  "an.flow.equityNow": "Equity attuale",
  "an.charges.total": "Costi pagati",

  // Analisi del comportamento (i numeri arrivano dal servizio report)
  "insight.overtrading.title": { one: "Overtrading in {count} giorno", other: "Overtrading in {count} giorni" },
  "insight.overtrading.text": "In questi giorni hai aperto più di {limit} operazioni (la tua giornata tipica è {median}). Risultato netto in quei giorni: {net}.",
  "insight.overtrading.tip": "Imposta un limite giornaliero di {cap} operazioni.",
  "insight.revenge.title": { one: "{count} possibile operazione di rivalsa", other: "{count} possibili operazioni di rivalsa" },
  "insight.revenge.text": "Operazioni aperte entro 15 minuti da una chiusura in perdita, con volume uguale o maggiore. Hanno vinto il {rate}% delle volte, per un totale di {net}.",
  "insight.revenge.tip": "Dopo una perdita, fai una pausa di 15 minuti prima della prossima operazione.",
  "insight.risk.title": "Rischio per operazione in perdita",
  "insight.risk.text": { one: "In media un'operazione in perdita è costata il {avg}% del saldo, al massimo il {max}%. {count} perdita ha superato il 2%.", other: "In media un'operazione in perdita è costata il {avg}% del saldo, al massimo il {max}%. {count} perdite hanno superato il 2%." },
  "insight.risk.tip": "Dimensiona le posizioni in modo che uno stop loss costi al massimo l'1–2% del saldo.",
  "insight.holdLosers.title": "Le perdenti restano aperte più delle vincenti",
  "insight.holdLosers.text": "Le operazioni in perdita restano aperte in media {loss}, quelle vincenti {win}.",
  "insight.holdLosers.tip": "Imposta uno stop loss all'apertura dell'operazione e non spostarlo.",
  "insight.stopOut.title": { one: "{count} chiusura per stop out", other: "{count} chiusure per stop out" },
  "insight.stopOut.text": "Le posizioni sono state chiuse dallo stop out del margine, non dal tuo stop loss.",
  "insight.stopOut.tip": "Mantieni il livello di margine sopra il livello di margin call con posizioni più piccole.",
  "insight.slTp.title": "Operazioni chiuse da stop loss o take profit",
  "insight.slTp.text": "{tp} da take profit, {sl} da stop loss, le altre chiuse manualmente o dal desk.",
  "insight.slTp.tip": "Uscite pianificate rendono i risultati più costanti.",
  "insight.session.title": "Sessione migliore: {session}",
  "insight.session.text": "{trades} operazioni con il {rate}% di successo. La più debole: {worst} ({net}).",
  "insight.session.tip": "Concentrati sulla sessione {session}.",
  "insight.tip": "Consiglio",

  // Stati
  "state.updating": "Aggiornamento…",
  "state.stale": "Dati salvati. Trascina verso il basso per aggiornare.",
  "state.notShared.title": "Non condiviso con te",
  "state.footer": "Tutti gli importi in USD (conti cent convertiti). Orari in ora del server, GMT+2 / GMT+3.",
  "state.footerStatements": "Gli estratti conto sono nella valuta del conto (USC per i conti cent). Orari in ora del server, GMT+2 / GMT+3.",
};
export default mobileReports;
