import type { NsMessages } from "../../core";

// Kalks mobile app: the Academy screens (phases, chapter reader, quizzes, final exams, glossary, progress and
// certificates). Most wording is reused from the `academy` namespace; these are the phone-only strings.
const mobileAcademy: NsMessages<"mobileAcademy"> = {
  // Small uppercase line above the Academy title
  eyebrow: "Kalks অ্যাকাডেমি",
  // Under the title; {count} = number of chapters
  "home.subtitle": "আটটি ধাপে {count}টি অধ্যায়, সাথে কুইজ, চূড়ান্ত পরীক্ষা ও সার্টিফিকেট।",
  // Big-number tiles on the Academy home (short labels under a number)
  "stats.chapters": "সম্পন্ন অধ্যায়",
  "stats.streakDays": "দিনের ধারাবাহিকতা",
  "stats.certificates": "সার্টিফিকেট",
  // {n} = phase number, {title} = phase title
  "home.phaseA11y": "ধাপ {n}: {title}",

  // Chapter reader
  "reader.updated": "আপডেট {date}",
  "reader.completedOn": "সম্পন্ন {date}",
  "reader.upNext": "এরপর",
  "reader.completeHint": "এই অধ্যায় সম্পন্ন করতে কুইজে পাস করুন।",
  "reader.zoomHint": "ডায়াগ্রামটি ফুল স্ক্রিনে খোলে",
  "reader.tapToZoom": "জুম করতে ট্যাপ করুন",
  "reader.zoomHelp": "জুম করতে পিঞ্চ বা ডাবল-ট্যাপ করুন",

  // Practise the chapter's exercise on the app's own Trade tab; {login} = demo account number
  "practice.title": "ডেমোতে অনুশীলন করুন",
  "practice.onDemo": "ডেমো #{login}-এ ট্রেড করুন",

  // Final exam screen
  "exam.answerAll": "জমা দিতে প্রতিটি প্রশ্নের উত্তর দিন।",

  // Glossary; "terms" is the small label next to the big number of terms
  "glossary.terms": { one: "পরিভাষা, সহজ ভাষায়", other: "পরিভাষা, সহজ ভাষায়" },
  "glossary.letters": "বর্ণানুক্রমিক সূচি",
  "glossary.openTerm": "সংজ্ঞা খোলে",

  // Certificates
  "cert.share": "শেয়ার",
  // Shared text; {brand} = the broker's name, {n} = phase number, {title} = phase title, {url} = verification link
  "cert.shareText": "ধাপ {n}, {title}-এর জন্য আমার {brand} অ্যাকাডেমি সার্টিফিকেট: {url}",
  "cert.imageA11y": "ধাপ {n}-এর সার্টিফিকেট",

  // Accessibility labels
  "a11y.glossary": "শব্দকোষ খুলুন",
  "a11y.progress": "আমার অগ্রগতি",
  "a11y.contents": "অধ্যায়ের বিষয়সূচি",

  // States
  "state.viewer.title": "আপনার সাথে শেয়ার করা হয়নি",
  "state.viewer.body": "এই শুধু দেখার লগইনে যা শেয়ার করা হয়েছে, অ্যাকাডেমি তার মধ্যে নেই।",
  "state.disabled.title": "উপলব্ধ নয়",
  "state.disabled.body": "আপনার অ্যাকাউন্টে অ্যাকাডেমি উপলব্ধ নয়।",
};
export default mobileAcademy;
