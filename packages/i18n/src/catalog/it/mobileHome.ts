import type { NsMessages } from "../../core";

// App mobile Kalks: scheda Home. Titoli in maiuscolo grande: brevi.
const mobileHome: NsMessages<"mobileHome"> = {
  "greet.morning": "Buongiorno, {name}",
  "greet.afternoon": "Buon pomeriggio, {name}",
  "greet.evening": "Buonasera, {name}",
  equity: "Equity",
  closedToday: "Chiuso oggi",
  openPnl: "P&L aperto",
  allLive: "Tutti i conti reali {amount}",
  "quick.deposit": "Deposita",
  "quick.withdraw": "Preleva",
  "quick.transfer": "Trasferisci",
  "quick.trade": "Trade",
  movers: "Maggiori variazioni",
  news: "Titoli",
  allNews: "Tutte le notizie",
  notifications: "Notifiche",
  "kyc.title": "Verifica la tua identità",
  "kyc.body": "La verifica sblocca il trading reale e i prelievi. Richiede pochi minuti.",
  "kyc.pending": "Verifica in revisione",
  "kyc.pendingBody": "Stiamo controllando i tuoi documenti. Riceverai una notifica al termine.",
  "kyc.action": "Continua",
  "noAccount.title": "Apri il tuo primo conto",
  "noAccount.body": "Un conto demo con fondi virtuali è pronto in pochi secondi. Passa al reale quando sei pronto.",
  "noAccount.action": "Apri un conto",
  "news.empty": "Nessun titolo al momento.",
  "a11y.bell": "Notifiche, {count} non lette",

  // Esplora: un blocco colorato per modulo (titolo su due righe brevi al massimo, suggerimento su due righe)
  "explore.title": "Esplora",
  "explore.copy": "Copy trading",
  "explore.copyHint": "Segui trader affermati",
  "explore.prop": "Prop challenge",
  "explore.propHint": "Fatti finanziare per fare trading",
  "explore.academy": "Academy",
  "explore.academyHint": "Impara a fare trading, passo dopo passo",
  "explore.ai": "AI Trader",
  "explore.aiHint": "Trasforma un'idea in una strategia",
  "explore.invite": "Invita amici",
  "explore.inviteHint": "Guadagna quando fanno trading",
};
export default mobileHome;
