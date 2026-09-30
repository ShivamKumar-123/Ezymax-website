import type { NsMessages } from "../../core";

// Kalks mobile app: the Academy screens (phases, chapter reader, quizzes, final exams, glossary, progress and
// certificates). Phone-only strings; the rest reuses the `academy` namespace. Keep "Kalks" as is.
const mobileAcademy: NsMessages<"mobileAcademy"> = {
  // Small uppercase line above the Academy title
  eyebrow: "Akademi Kalks",
  // Under the title; {count} = number of chapters
  "home.subtitle": "{count} bab dalam lapan fasa, dengan kuiz, peperiksaan akhir dan sijil.",
  // Big-number tiles on the Academy home (short labels under a number)
  "stats.chapters": "Bab selesai",
  "stats.streakDays": "Rentetan hari",
  "stats.certificates": "Sijil",
  // {n} = phase number, {title} = phase title
  "home.phaseA11y": "Fasa {n}: {title}",

  // Chapter reader
  "reader.updated": "Dikemas kini {date}",
  "reader.completedOn": "Selesai {date}",
  "reader.upNext": "Seterusnya",
  "reader.completeHint": "Lulus kuiz untuk melengkapkan bab ini.",
  "reader.zoomHint": "Membuka rajah dalam skrin penuh",
  "reader.tapToZoom": "Ketik untuk zum",
  "reader.zoomHelp": "Cubit atau ketik dua kali untuk zum",

  // Practise the chapter's exercise on the app's own Trade tab; {login} = demo account number
  "practice.title": "Berlatih pada demo",
  "practice.onDemo": "Dagang pada demo #{login}",

  // Final exam screen
  "exam.answerAll": "Jawab setiap soalan untuk menghantar.",

  // Glossary; "terms" is the small label next to the big number of terms
  "glossary.terms": { other: "istilah dalam bahasa mudah" },
  "glossary.letters": "Indeks abjad",
  "glossary.openTerm": "Membuka definisi",

  // Certificates
  "cert.share": "Kongsi",
  // Shared text; {brand} = the broker's name, {n} = phase number, {title} = phase title, {url} = verification link
  "cert.shareText": "Sijil Akademi {brand} saya untuk Fasa {n}, {title}: {url}",
  "cert.imageA11y": "Sijil Fasa {n}",

  // Accessibility labels
  "a11y.glossary": "Buka glosari",
  "a11y.progress": "Kemajuan saya",
  "a11y.contents": "Kandungan bab",

  // States
  "state.viewer.title": "Tidak dikongsi dengan anda",
  "state.viewer.body": "Akademi bukan sebahagian daripada apa yang dikongsi dengan log masuk lihat sahaja ini.",
  "state.disabled.title": "Tidak tersedia",
  "state.disabled.body": "Akademi tidak tersedia pada akaun anda.",
};
export default mobileAcademy;
