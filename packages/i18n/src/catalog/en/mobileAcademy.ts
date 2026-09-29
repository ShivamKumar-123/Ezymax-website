// Keys for this namespace. English is the source; translations live in ../<lang>/mobileAcademy.ts.
// Kalks mobile app: the Academy screens (phases, chapter reader, quizzes, final exams, glossary, progress and
// certificates). Most wording is shared with the Client Area and reused from the `academy` namespace (already
// translated); these are the phone-only strings. Keep "Kalks" as is. {placeholders} are filled in by the app.
const mobileAcademy = {
  // Small uppercase line above the Academy title
  eyebrow: "Kalks Academy",
  // Under the title; {count} = number of chapters
  "home.subtitle": "{count} chapters in eight phases, with quizzes, final exams and certificates.",
  // Big-number tiles on the Academy home (short labels under a number)
  "stats.chapters": "Chapters done",
  "stats.streakDays": "Day streak",
  "stats.certificates": "Certificates",
  // {n} = phase number, {title} = phase title
  "home.phaseA11y": "Phase {n}: {title}",

  // Chapter reader
  "reader.updated": "Updated {date}",
  "reader.completedOn": "Completed {date}",
  "reader.upNext": "Up next",
  "reader.completeHint": "Pass the quiz to complete this chapter.",
  "reader.zoomHint": "Opens the diagram full screen",
  "reader.tapToZoom": "Tap to zoom",
  "reader.zoomHelp": "Pinch or double-tap to zoom",

  // Practise the chapter's exercise on the app's own Trade tab; {login} = demo account number
  "practice.title": "Practise on demo",
  "practice.onDemo": "Trade on demo #{login}",

  // Final exam screen
  "exam.answerAll": "Answer every question to submit.",

  // Glossary; "terms" is the small label next to the big number of terms
  "glossary.terms": { one: "term in plain language", other: "terms in plain language" },
  "glossary.letters": "Alphabet index",
  "glossary.openTerm": "Opens the definition",

  // Certificates
  "cert.share": "Share",
  // Shared text; {brand} = the broker's name, {n} = phase number, {title} = phase title, {url} = verification link
  "cert.shareText": "My {brand} Academy certificate for Phase {n}, {title}: {url}",
  "cert.imageA11y": "Phase {n} certificate",

  // Accessibility labels
  "a11y.glossary": "Open the glossary",
  "a11y.progress": "My progress",
  "a11y.contents": "Chapter contents",

  // States
  "state.viewer.title": "Not shared with you",
  "state.viewer.body": "The Academy isn't part of what was shared with this view-only login.",
  "state.disabled.title": "Not available",
  "state.disabled.body": "The Academy isn't available on your account.",
};
export default mobileAcademy;
