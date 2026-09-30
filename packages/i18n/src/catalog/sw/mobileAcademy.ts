import type { NsMessages } from "../../core";

// Kalks mobile app: Academy screens (phone-only strings; the rest reuse the `academy` namespace).
const mobileAcademy: NsMessages<"mobileAcademy"> = {
  // Small uppercase line above the Academy title
  eyebrow: "Kalks Academy",
  "home.subtitle": "Sura {count} katika awamu nane, pamoja na maswali, mitihani ya mwisho na vyeti.",
  // Big-number tiles on the Academy home
  "stats.chapters": "Sura zilizokamilika",
  "stats.streakDays": "Mfululizo wa siku",
  "stats.certificates": "Vyeti",
  "home.phaseA11y": "Awamu {n}: {title}",

  // Chapter reader
  "reader.updated": "Imesasishwa {date}",
  "reader.completedOn": "Imekamilika {date}",
  "reader.upNext": "Inayofuata",
  "reader.completeHint": "Faulu maswali ili ukamilishe sura hii.",
  "reader.zoomHint": "Hufungua mchoro kwenye skrini nzima",
  "reader.tapToZoom": "Gusa ili kukuza",
  "reader.zoomHelp": "Bana au gusa mara mbili ili kukuza",

  // Practise on the Trade tab
  "practice.title": "Fanya mazoezi kwenye demo",
  "practice.onDemo": "Fanya biashara kwenye demo #{login}",

  // Final exam screen
  "exam.answerAll": "Jibu kila swali ili uwasilishe.",

  // Glossary
  "glossary.terms": { one: "istilahi kwa lugha rahisi", other: "istilahi kwa lugha rahisi" },
  "glossary.letters": "Faharasa ya alfabeti",
  "glossary.openTerm": "Hufungua maana",

  // Certificates
  "cert.share": "Shiriki",
  "cert.shareText": "Cheti changu cha {brand} Academy cha Awamu {n}, {title}: {url}",
  "cert.imageA11y": "Cheti cha Awamu {n}",

  // Accessibility labels
  "a11y.glossary": "Fungua kamusi",
  "a11y.progress": "Maendeleo yangu",
  "a11y.contents": "Yaliyomo kwenye sura",

  // States
  "state.viewer.title": "Haijashirikiwa nawe",
  "state.viewer.body": "Academy si sehemu ya kilichoshirikiwa na login hii ya kutazama tu.",
  "state.disabled.title": "Haipatikani",
  "state.disabled.body": "Academy haipatikani kwenye akaunti yako.",
};
export default mobileAcademy;
