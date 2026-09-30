import type { NsMessages } from "../../core";

// App mobile Kalks: schermate Academy (fasi, lettore dei capitoli, quiz, esami finali, glossario, progressi e
// certificati). Gran parte dei testi riusa `academy`; qui solo le stringhe del telefono. "Kalks" invariato.
const mobileAcademy: NsMessages<"mobileAcademy"> = {
  // Piccola riga in maiuscolo sopra il titolo Academy
  eyebrow: "Kalks Academy",
  // Sotto il titolo; {count} = numero di capitoli
  "home.subtitle": "{count} capitoli in otto fasi, con quiz, esami finali e certificati.",
  // Riquadri con numeri grandi nella home dell'Academy
  "stats.chapters": "Capitoli fatti",
  "stats.streakDays": "Giorni di fila",
  "stats.certificates": "Certificati",
  // {n} = numero della fase, {title} = titolo della fase
  "home.phaseA11y": "Fase {n}: {title}",

  // Lettore dei capitoli
  "reader.updated": "Aggiornato il {date}",
  "reader.completedOn": "Completato il {date}",
  "reader.upNext": "Prossimo",
  "reader.completeHint": "Supera il quiz per completare questo capitolo.",
  "reader.zoomHint": "Apre il diagramma a schermo intero",
  "reader.tapToZoom": "Tocca per ingrandire",
  "reader.zoomHelp": "Pizzica o tocca due volte per ingrandire",

  // Esercizio del capitolo nella scheda Trade dell'app; {login} = numero del conto demo
  "practice.title": "Esercitati in demo",
  "practice.onDemo": "Fai trading sulla demo #{login}",

  // Esame finale
  "exam.answerAll": "Rispondi a tutte le domande per inviare.",

  // Glossario; "terms" è la piccola etichetta accanto al numero di termini
  "glossary.terms": { one: "termine in parole semplici", other: "termini in parole semplici" },
  "glossary.letters": "Indice alfabetico",
  "glossary.openTerm": "Apre la definizione",

  // Certificati
  "cert.share": "Condividi",
  // {brand} = nome del broker, {n} = numero della fase, {title} = titolo della fase, {url} = link di verifica
  "cert.shareText": "Il mio certificato {brand} Academy per la Fase {n}, {title}: {url}",
  "cert.imageA11y": "Certificato della Fase {n}",

  // Etichette di accessibilità
  "a11y.glossary": "Apri il glossario",
  "a11y.progress": "I miei progressi",
  "a11y.contents": "Indice del capitolo",

  // Stati
  "state.viewer.title": "Non condiviso con te",
  "state.viewer.body": "L'Academy non fa parte di ciò che è stato condiviso con questo accesso in sola visualizzazione.",
  "state.disabled.title": "Non disponibile",
  "state.disabled.body": "L'Academy non è disponibile per il tuo account.",
};
export default mobileAcademy;
