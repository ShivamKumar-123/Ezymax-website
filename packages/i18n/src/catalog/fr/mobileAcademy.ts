import type { NsMessages } from "../../core";

// Kalks mobile app: the Academy screens (phases, chapter reader, quizzes, final exams, glossary, progress and
// certificates). Phone-only strings; the rest is reused from `academy`. Keep "Kalks" as is.
const mobileAcademy: NsMessages<"mobileAcademy"> = {
  // Small uppercase line above the Academy title
  eyebrow: "Académie Kalks",
  // Under the title; {count} = number of chapters
  "home.subtitle": "{count} chapitres en huit phases, avec quiz, examens finaux et certificats.",
  // Big-number tiles on the Academy home (short labels under a number)
  "stats.chapters": "Chapitres terminés",
  "stats.streakDays": "Jours de série",
  "stats.certificates": "Certificats",
  // {n} = phase number, {title} = phase title
  "home.phaseA11y": "Phase {n} : {title}",

  // Chapter reader
  "reader.updated": "Mis à jour le {date}",
  "reader.completedOn": "Terminé le {date}",
  "reader.upNext": "À suivre",
  "reader.completeHint": "Réussissez le quiz pour terminer ce chapitre.",
  "reader.zoomHint": "Ouvre le schéma en plein écran",
  "reader.tapToZoom": "Touchez pour zoomer",
  "reader.zoomHelp": "Pincez ou touchez deux fois pour zoomer",

  // Practise the chapter's exercise on the app's own Trade tab; {login} = demo account number
  "practice.title": "S'entraîner en démo",
  "practice.onDemo": "Trader sur la démo #{login}",

  // Final exam screen
  "exam.answerAll": "Répondez à toutes les questions pour valider.",

  // Glossary; "terms" is the small label next to the big number of terms
  "glossary.terms": { one: "terme en langage simple", many: "termes en langage simple", other: "termes en langage simple" },
  "glossary.letters": "Index alphabétique",
  "glossary.openTerm": "Ouvre la définition",

  // Certificates
  "cert.share": "Partager",
  // Shared text; {brand} = the broker's name, {n} = phase number, {title} = phase title, {url} = verification link
  "cert.shareText": "Mon certificat de l'Académie {brand} pour la phase {n}, {title} : {url}",
  "cert.imageA11y": "Certificat de la phase {n}",

  // Accessibility labels
  "a11y.glossary": "Ouvrir le glossaire",
  "a11y.progress": "Ma progression",
  "a11y.contents": "Sommaire du chapitre",

  // States
  "state.viewer.title": "Non partagé avec vous",
  "state.viewer.body": "L'Académie ne fait pas partie de ce qui a été partagé avec cet identifiant en lecture seule.",
  "state.disabled.title": "Non disponible",
  "state.disabled.body": "L'Académie n'est pas disponible sur votre compte.",
};
export default mobileAcademy;
