import type { NsMessages } from "../../core";

// Assistenza dell'Area Clienti: chat dal vivo, pulsante di apertura, pagina di assistenza.
const support: NsMessages<"support"> = {
  // Pagina di assistenza
  "page.title": "Assistenza",
  "page.subtitle": "Chatta con Ezymex AI per risposte immediate. Puoi chiedere di parlare con una persona in qualsiasi momento: il nostro team subentra con l'intera conversazione.",
  "email.prefer": "Preferisci l'email?",
  "email.writeFrom": "Scrivi da <email>{email}</email> e indica il tuo ID cliente <id>{id}</id>.",
  "email.write": "Scrivi all'assistenza",
  "email.copyId": "Copia ID cliente",
  clientId: "ID cliente",
  notice: "Le risposte del nostro team compaiono anche nella campanella delle notifiche e ti inviamo un'email quando non sei collegato. Puoi modificarlo in Profilo → Notifiche.",
  "toast.copied": "{what} copiato",
  "toast.copyFailed": "Impossibile copiare, selezionalo manualmente",

  // Stato della conversazione
  "status.bot": "Assistente AI",
  "status.waiting": "In coda",
  "status.assigned": "Con un operatore",
  "status.resolved": "Terminata",

  // Cronologia delle conversazioni
  "history.title": "Le tue conversazioni",
  "history.subtitle": "Le trascrizioni sono conservate nella tua Area Clienti",
  "history.emptyTitle": "Ancora nessuna conversazione",
  "history.emptyText": "Fai una domanda in chat e comparirà qui.",
  conversation: "Conversazione",
  "toast.openFailed": "Impossibile aprire la conversazione",

  // Pulsante flottante
  "launcher.open": "Apri la chat di assistenza",
  "launcher.close": "Chiudi la chat di assistenza",

  // Chat
  you: "Tu",
  agent: "Operatore",
  supportName: "Assistenza",
  attachmentSize: "{size} KB · PDF",
  // Prime domande suggerite
  "quick.verify": "Come verifico la mia identità?",
  "quick.deposit": "Come deposito USDT?",
  "quick.withdrawal": "Quando arriverà il mio prelievo?",
  "quick.stopOut": "Che cos'è uno stop-out?",
  "header.supportTeam": "Team di assistenza",
  "header.agentSub": "Assistenza clienti · Ezymex",
  "header.connecting": "Ti stiamo mettendo in contatto con un operatore…",
  "header.replySoon": "Il nostro team ti risponderà qui a breve",
  "header.helpCentre": "Risposte dal centro assistenza · una persona può intervenire in qualsiasi momento",
  "header.instant": "Risposte immediate · una persona può intervenire in qualsiasi momento",
  "chip.liveAgent": "Operatore",
  "menu.aria": "Opzioni della chat",
  "menu.talkToPerson": "Parla con una persona",
  "menu.endChat": "Termina chat",
  "menu.newChat": "Nuova chat",
  closeChat: "Chiudi chat",
  unavailable: "La chat non è disponibile al momento.",
  greeting: "Ciao {name}.",
  "csat.question": "Com'è andata questa chat?",
  "csat.stars": { one: "{count} stella", other: "{count} stelle" },
  "csat.placeholder": "Vuoi aggiungere qualcosa? (facoltativo)",
  "csat.send": "Invia valutazione",
  "csat.rated": "Hai valutato questa chat {rating}/5",
  "composer.attach": "Allega file",
  "composer.messageTo": "Scrivi a {name}…",
  "composer.newChat": "Avvia una nuova chat…",
  "composer.ask": "Chiedi qualsiasi cosa a {name}…",
  "composer.aria": "Messaggio",
  disclaimer: "{name} può commettere errori e non fornisce mai consulenza sugli investimenti. Le chat vengono registrate per finalità di qualità.",
  "toast.chattingWith": "Stai chattando con {name}",
  "toast.inQueue": "Sei in coda per un operatore",
  "toast.notSent": "Messaggio non inviato",
  "toast.teamUnreachable": "Impossibile contattare il team",
  "toast.endFailed": "Impossibile terminare la chat",
  "toast.rateFailed": "Valutazione non salvata",
  "toast.thanks": "Grazie per il tuo feedback",
  "toast.fileTooLarge": "File troppo grande",
  "toast.fileTooLargeText": "I file possono pesare al massimo {mb} MB.",
  "toast.unsupported": "File non supportato",
  "toast.unsupportedText": "Allega un'immagine (PNG, JPG, GIF, WEBP) o un PDF.",
  "toast.uploadFailed": "Caricamento non riuscito",
  "error.uploadFailed": "Caricamento non riuscito.",
};
export default support;
