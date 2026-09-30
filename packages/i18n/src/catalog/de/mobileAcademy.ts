import type { NsMessages } from "../../core";

// Kalks mobile app: the Academy screens (phases, chapter reader, quizzes, final exams, glossary, progress and
// certificates); phone-only strings. Terms follow the `academy` namespace. Keep "Kalks" as is.
const mobileAcademy: NsMessages<"mobileAcademy"> = {
  // Small uppercase line above the Academy title
  eyebrow: "Kalks Academy",
  // Under the title; {count} = number of chapters
  "home.subtitle": "{count} Kapitel in acht Phasen, mit Quizfragen, Abschlussprüfungen und Zertifikaten.",
  // Big-number tiles on the Academy home (short labels under a number)
  "stats.chapters": "Kapitel erledigt",
  "stats.streakDays": "Tage in Folge",
  "stats.certificates": "Zertifikate",
  // {n} = phase number, {title} = phase title
  "home.phaseA11y": "Phase {n}: {title}",

  // Chapter reader
  "reader.updated": "Aktualisiert am {date}",
  "reader.completedOn": "Abgeschlossen am {date}",
  "reader.upNext": "Als Nächstes",
  "reader.completeHint": "Bestehen Sie das Quiz, um dieses Kapitel abzuschließen.",
  "reader.zoomHint": "Öffnet das Diagramm im Vollbild",
  "reader.tapToZoom": "Zum Zoomen tippen",
  "reader.zoomHelp": "Mit zwei Fingern oder Doppeltippen zoomen",

  // Practise the chapter's exercise on the app's own Trade tab; {login} = demo account number
  "practice.title": "Auf Demo üben",
  "practice.onDemo": "Auf Demo #{login} handeln",

  // Final exam screen
  "exam.answerAll": "Beantworten Sie alle Fragen, um die Prüfung abzugeben.",

  // Glossary; "terms" is the small label next to the big number of terms
  "glossary.terms": { one: "Begriff verständlich erklärt", other: "Begriffe verständlich erklärt" },
  "glossary.letters": "Alphabetischer Index",
  "glossary.openTerm": "Öffnet die Definition",

  // Certificates
  "cert.share": "Teilen",
  // Shared text; {brand} = the broker's name, {n} = phase number, {title} = phase title, {url} = verification link
  "cert.shareText": "Mein Zertifikat der {brand} Academy für Phase {n}, {title}: {url}",
  "cert.imageA11y": "Zertifikat Phase {n}",

  // Accessibility labels
  "a11y.glossary": "Glossar öffnen",
  "a11y.progress": "Mein Fortschritt",
  "a11y.contents": "Kapitelinhalt",

  // States
  "state.viewer.title": "Nicht für Sie freigegeben",
  "state.viewer.body": "Die Academy gehört nicht zu den Bereichen, die für diesen Nur-Lese-Login freigegeben wurden.",
  "state.disabled.title": "Nicht verfügbar",
  "state.disabled.body": "Die Academy ist für Ihr Konto nicht verfügbar.",
};
export default mobileAcademy;
