import type { NsMessages } from "../../core";

// Kalks mobile app: the Academy screens (phases, chapter reader, quizzes, final exams, glossary, progress and
// certificates). Phone-only strings; the rest comes from the `academy` namespace. "Kalks" stays as is.
const mobileAcademy: NsMessages<"mobileAcademy"> = {
  // Small uppercase line above the Academy title
  eyebrow: "Kalks Akademi",
  // Under the title; {count} = number of chapters
  "home.subtitle": "Sekiz aşamada {count} bölüm; testler, final sınavları ve sertifikalarla.",
  // Big-number tiles on the Academy home (short labels under a number)
  "stats.chapters": "Biten bölüm",
  "stats.streakDays": "Gün serisi",
  "stats.certificates": "Sertifika",
  // {n} = phase number, {title} = phase title
  "home.phaseA11y": "Aşama {n}: {title}",

  // Chapter reader
  "reader.updated": "Güncellendi: {date}",
  "reader.completedOn": "Tamamlandı: {date}",
  "reader.upNext": "Sıradaki",
  "reader.completeHint": "Bu bölümü tamamlamak için testi geçin.",
  "reader.zoomHint": "Diyagramı tam ekran açar",
  "reader.tapToZoom": "Büyütmek için dokunun",
  "reader.zoomHelp": "İki parmakla veya çift dokunarak yakınlaştırın",

  // Practise the chapter's exercise on the app's own Trade tab; {login} = demo account number
  "practice.title": "Demoda pratik yapın",
  "practice.onDemo": "#{login} demo hesabında işlem yap",

  // Final exam screen
  "exam.answerAll": "Göndermek için tüm soruları yanıtlayın.",

  // Glossary; "terms" is the small label next to the big number of terms
  "glossary.terms": { one: "terim, sade bir dille", other: "terim, sade bir dille" },
  "glossary.letters": "Alfabetik dizin",
  "glossary.openTerm": "Tanımı açar",

  // Certificates
  "cert.share": "Paylaş",
  // Shared text; {brand} = the broker's name, {n} = phase number, {title} = phase title, {url} = verification link
  "cert.shareText": "{brand} Akademi Aşama {n} sertifikam, {title}: {url}",
  "cert.imageA11y": "Aşama {n} sertifikası",

  // Accessibility labels
  "a11y.glossary": "Sözlüğü aç",
  "a11y.progress": "İlerlemem",
  "a11y.contents": "Bölüm içeriği",

  // States
  "state.viewer.title": "Sizinle paylaşılmadı",
  "state.viewer.body": "Akademi, bu salt görüntüleme girişiyle paylaşılanlar arasında değil.",
  "state.disabled.title": "Kullanılamıyor",
  "state.disabled.body": "Akademi hesabınızda kullanılamıyor.",
};
export default mobileAcademy;
