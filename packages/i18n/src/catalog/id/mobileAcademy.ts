import type { NsMessages } from "../../core";

// Kalks mobile app: the Academy screens (phone-only strings; the rest comes from the `academy` namespace).
const mobileAcademy: NsMessages<"mobileAcademy"> = {
  // Small uppercase line above the Academy title
  eyebrow: "Kalks Academy",
  // Under the title; {count} = number of chapters
  "home.subtitle": "{count} bab dalam delapan fase, dengan kuis, ujian akhir, dan sertifikat.",
  // Big-number tiles on the Academy home (short labels under a number)
  "stats.chapters": "Bab selesai",
  "stats.streakDays": "Hari beruntun",
  "stats.certificates": "Sertifikat",
  // {n} = phase number, {title} = phase title
  "home.phaseA11y": "Fase {n}: {title}",

  // Chapter reader
  "reader.updated": "Diperbarui {date}",
  "reader.completedOn": "Selesai {date}",
  "reader.upNext": "Berikutnya",
  "reader.completeHint": "Lulus kuis untuk menyelesaikan bab ini.",
  "reader.zoomHint": "Membuka diagram dalam layar penuh",
  "reader.tapToZoom": "Ketuk untuk memperbesar",
  "reader.zoomHelp": "Cubit atau ketuk dua kali untuk memperbesar",

  // Practise the chapter's exercise on the Trade tab; {login} = demo account number
  "practice.title": "Berlatih di demo",
  "practice.onDemo": "Trading di demo #{login}",

  // Final exam screen
  "exam.answerAll": "Jawab semua soal untuk mengirim.",

  // Glossary; "terms" is the small label next to the big number of terms
  "glossary.terms": { other: "istilah dalam bahasa sederhana" },
  "glossary.letters": "Indeks abjad",
  "glossary.openTerm": "Membuka definisi",

  // Certificates
  "cert.share": "Bagikan",
  // {brand} = broker name, {n} = phase number, {title} = phase title, {url} = verification link
  "cert.shareText": "Sertifikat {brand} Academy saya untuk Fase {n}, {title}: {url}",
  "cert.imageA11y": "Sertifikat Fase {n}",

  // Accessibility labels
  "a11y.glossary": "Buka glosarium",
  "a11y.progress": "Kemajuan saya",
  "a11y.contents": "Daftar isi bab",

  // States
  "state.viewer.title": "Tidak dibagikan dengan Anda",
  "state.viewer.body": "Academy tidak termasuk dalam akses yang dibagikan dengan login hanya-lihat ini.",
  "state.disabled.title": "Tidak tersedia",
  "state.disabled.body": "Academy tidak tersedia di akun Anda.",
};
export default mobileAcademy;
