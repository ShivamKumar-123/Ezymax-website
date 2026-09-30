import type { NsMessages } from "../../core";

// App mobile Kalks: shell dell'app, onboarding e stati comuni a tutte le schermate.
const mobile: NsMessages<"mobile"> = {
  // Barra delle schede (una parola ciascuna)
  "tab.home": "Home",
  "tab.markets": "Mercati",
  "tab.trade": "Trade",
  "tab.portfolio": "Portafoglio",
  "tab.more": "Altro",

  // Onboarding (3 schermate). Titoli in maiuscolo grande: brevi
  "onboarding.skip": "Salta",
  "onboarding.next": "Avanti",
  "onboarding.getStarted": "Inizia",
  "onboarding.haveAccount": "Ho già un account",
  "onboarding.welcome.title": "Entra nei mercati",
  "onboarding.welcome.body": "Forex, metalli, indici, energie, cripto e azioni in un unico account, con depositi USDT istantanei.",
  "onboarding.markets.title": "Ogni tick, in tempo reale",
  "onboarding.markets.body": "Prezzi bid e ask reali, grafici tutti tuoi e Buy e Sell con un tocco, pensati per lo smartphone.",
  "onboarding.security.title": "Tutto protetto",
  "onboarding.security.body": "Codici via email sui nuovi dispositivi, codici di conferma per i prelievi e una cassaforte sicura per la tua sessione.",
  "onboarding.step": "{n} di {total}",

  // Stati condivisi
  "state.offline.title": "Connessione persa",
  "state.offline.body": "Controlla la connessione a internet. Prezzi e account si ricollegano automaticamente.",
  "state.reconnecting": "Riconnessione…",
  "state.error.title": "Si è verificato un errore",
  "state.error.body": "Impossibile caricare questo contenuto. Trascina verso il basso o tocca per riprovare.",
  "state.maintenance.title": "In manutenzione",
  "state.maintenance.body": "Stiamo aggiornando Kalks. Le tue posizioni e i tuoi fondi sono al sicuro. Riprova tra poco.",
  "state.sessionExpired": "La tua sessione è terminata. Accedi di nuovo.",
  "state.updated": "Aggiornato {time}",
  "state.pullToRefresh": "Trascina per aggiornare",

  viewOnly: "Accesso in sola visualizzazione",
  viewOnlyBody: "Questo accesso può vedere i conti condivisi ma non può apportare modifiche.",

  // Etichette brevi comuni
  "action.retry": "Riprova",
  "action.openWeb": "Apri nell'Area Clienti",
  "action.signOut": "Esci",
  "action.seeAll": "Vedi tutti",
  "a11y.close": "Chiudi",
  "a11y.back": "Indietro",
};
export default mobile;
