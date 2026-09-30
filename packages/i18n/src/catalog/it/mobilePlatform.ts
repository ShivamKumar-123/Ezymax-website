import type { NsMessages } from "../../core";

// App mobile Kalks: inbox delle notifiche, notifiche push, blocco dell'app (Face ID / impronta / codice del telefono),
// "Continua con Google" e link che aprono l'app. Nomi invariati: Kalks, Face ID, Touch ID, Google.
const mobilePlatform: NsMessages<"mobilePlatform"> = {
  // Inbox delle notifiche (/notifications)
  "inbox.eyebrow": "Inbox",
  "inbox.unread": { one: "{count} non letta", other: "{count} non lette" },
  "inbox.caughtUp": "Tutto letto",
  "inbox.filter.unread": "Non lette",
  "inbox.markedAll": "Tutte segnate come lette",
  "inbox.emptyUnread.title": "Tutto letto",
  "inbox.emptyUnread.body": "Hai letto tutte le notifiche. Quelle nuove compaiono qui appena arrivano.",
  "inbox.loadMoreFailed": "Impossibile caricare le notifiche meno recenti. Tocca per riprovare.",
  // Sotto il titolo quando il telefono è offline e l'inbox mostra quanto salvato in precedenza
  "inbox.offlineCached": "Sei offline. Queste sono le notifiche salvate su questo telefono.",
  // Accessibilità della riga: "Non letta. Deposito accreditato. …"
  "inbox.a11y.unread": "Non letta",
  "inbox.a11y.settings": "Impostazioni notifiche",
  // Dettaglio di una notifica senza schermata da aprire
  "inbox.detail.openWeb": "Apri link",
  "inbox.detail.received": "Ricevuta {time}",

  // Richiesta del permesso push (mai al primo avvio): pannello in Home e scheda nell'inbox
  "push.ask.eyebrow": "Notifiche",
  "push.ask.title": "Sappilo subito",
  "push.ask.body": "Depositi accreditati, prelievi pagati, margin call, stop out e risposte dell'assistenza, direttamente sulla schermata di blocco.",
  "push.ask.point.money": "Depositi e prelievi",
  "push.ask.point.risk": "Margin call e stop out",
  "push.ask.point.support": "Risposte dell'assistenza",
  "push.ask.allow": "Attiva le notifiche",
  "push.ask.later": "Non ora",
  "push.ask.note": "Scegli gli argomenti in Profilo › Notifiche. Le offerte vengono inviate solo se le attivi.",
  // Notifica di esempio come apparirebbe sulla schermata di blocco ("ora" = etichetta dell'orario)
  "push.ask.now": "ora",
  "push.ask.sampleTitle": "Deposito accreditato",
  "push.ask.sampleBody": "250.00 USDT sono stati accreditati sul tuo wallet.",
  "push.card.title": "Attiva le notifiche push",
  "push.card.body": "Ricevi depositi, esecuzioni e margin call sulla schermata di blocco.",
  "push.card.action": "Attiva",
  "push.card.deniedTitle": "Le notifiche push sono disattivate",
  "push.card.deniedBody": "Consenti le notifiche per Kalks nelle impostazioni del telefono per riceverle sulla schermata di blocco.",
  "push.card.deniedAction": "Apri impostazioni",
  "push.card.dismiss": "Nascondi",
  "push.enabled": "Le notifiche push sono attive",
  // Canali di notifica Android (mostrati nelle impostazioni dell'app sul telefono)
  "push.channel.alerts": "Margin call e sicurezza",
  "push.channel.alertsHint": "Avvisi di margin call e stop out, i tuoi avvisi di prezzo, nuovi accessi",
  "push.channel.activity": "Attività dell'account",
  "push.channel.activityHint": "Depositi, prelievi, esecuzioni, verifica e risposte dell'assistenza",
  "push.channel.news": "Novità e offerte",
  "push.channel.newsHint": "Promozioni e novità sui prodotti a cui ti sei iscritto",
  // Banner in-app per una push che arriva con l'app aperta
  "push.banner.a11y": "Nuova notifica: {title}. Tocca due volte per aprire.",

  // Schermata di blocco dell'app
  "lock.eyebrow": "Bloccata",
  "lock.title": "Bentornato",
  "lock.subtitle": "Sblocca per vedere i tuoi conti e saldi.",
  // {method}: Face ID, Touch ID, impronta, sblocco con il volto o codice
  "lock.unlockWith": "Sblocca con {method}",
  "lock.unlock": "Sblocca",
  "lock.prompt": "Sblocca Kalks",
  "lock.promptSubtitle": "Conferma che sei tu",
  "lock.failed": "Non ha funzionato. Riprova.",
  "lock.lockout": "Troppi tentativi. Sblocca il telefono con il suo codice, poi riprova.",
  "lock.noScreenLock": "Il telefono non ha più un blocco schermo, quindi Kalks non può confermare che sei tu. Esci e accedi con la tua password.",
  "lock.notYou": "Non sei tu o non riesci a sbloccare?",
  "lock.signOut": "Esci",
  "lock.signOutTitle": "Uscire da Kalks?",
  "lock.signOutBody": "Accederai di nuovo con email e password. Le tue posizioni e i tuoi fondi non cambiano.",
  "lock.method.faceId": "Face ID",
  "lock.method.touchId": "Touch ID",
  "lock.method.fingerprint": "impronta digitale",
  "lock.method.face": "sblocco con il volto",
  "lock.method.iris": "iride",
  "lock.method.passcode": "codice",

  // Impostazioni › Blocco app (/settings/app-lock)
  "settings.eyebrow": "Sicurezza",
  "settings.title": "Blocco app",
  "settings.subtitle": "Mantieni Kalks bloccata con {method} all'apertura e dopo che è rimasta in background.",
  "settings.toggle": "Blocca Kalks",
  "settings.toggleHint": "Usa {method}, con il codice del telefono come alternativa",
  "settings.on": "Il blocco app è attivo",
  "settings.off": "Il blocco app è disattivato",
  "settings.after": "Blocca di nuovo dopo",
  "settings.afterHint": "Quanto tempo Kalks può restare in background prima di chiedere di nuovo. All'avvio lo chiede sempre.",
  "settings.timeout.0": "Subito",
  "settings.timeout.60": "1 minuto",
  "settings.timeout.300": "5 minuti",
  "settings.timeout.900": "15 minuti",
  "settings.timeout.3600": "1 ora",
  "settings.privacy": "Con il blocco app attivo, il selettore delle app mostra una copertina al posto dei tuoi saldi.",
  "settings.lockNow": "Blocca ora",
  "settings.confirmOn": "Conferma per attivare il blocco app",
  "settings.confirmOff": "Conferma per disattivare il blocco app",
  // Richiesta di sistema quando si sceglie un tempo "Blocca di nuovo dopo" più lungo
  "settings.confirmTimeout": "Conferma per cambiare quando Kalks si blocca",
  // Dopo un accesso con password su un telefono senza più blocco schermo
  "settings.turnedOffNoScreenLock": "Questo telefono non ha un blocco schermo, quindi Kalks non può confermare che sei tu. Impostane uno nelle impostazioni del telefono per usare di nuovo il blocco app.",
  "settings.notConfirmed": "Non confermato, nessuna modifica",
  "settings.unavailableTitle": "Imposta prima un blocco schermo",
  "settings.unavailableBody": "Il blocco app usa Face ID, l'impronta digitale o il codice del telefono. Attivane uno nelle impostazioni del telefono, poi torna qui.",
  "settings.webTitle": "Disponibile nell'app",
  "settings.webBody": "Il blocco app funziona nell'app Kalks per iPhone e Android.",
  "settings.thisPhone": "Vale solo per questo telefono",

  // Link che aprono l'app (kalks://…, tocchi sulle notifiche) ma non corrispondono a nessuna schermata
  "link.notFound.title": "Niente da aprire qui",
  "link.notFound.body": "Questo link non corrisponde a nessuna schermata dell'app. Potrebbe essere vecchio o destinato all'Area Clienti sul web.",
  "link.notFound.home": "Vai alla Home",
  "link.openFailed": "Impossibile aprire questo link.",
};
export default mobilePlatform;
