import type { NsMessages } from "../../core";

// Kalks mobile app: the Academy screens (phases, chapter reader, quizzes, final exams, glossary, progress and
// certificates). Most wording is reused from the `academy` namespace; these are the phone-only strings.
const mobileAcademy: NsMessages<"mobileAcademy"> = {
  // Small uppercase line above the Academy title
  eyebrow: "Kalks Academy",
  // Under the title; {count} = number of chapters
  "home.subtitle": "{count} บทในแปดระยะ พร้อมแบบทดสอบ การสอบปลายระยะ และใบรับรอง",
  // Big-number tiles on the Academy home (short labels under a number)
  "stats.chapters": "บทที่เรียนจบ",
  "stats.streakDays": "วันต่อเนื่อง",
  "stats.certificates": "ใบรับรอง",
  // {n} = phase number, {title} = phase title
  "home.phaseA11y": "ระยะที่ {n}: {title}",

  // Chapter reader
  "reader.updated": "อัปเดต {date}",
  "reader.completedOn": "เรียนจบ {date}",
  "reader.upNext": "ถัดไป",
  "reader.completeHint": "ทำแบบทดสอบให้ผ่านเพื่อเรียนจบบทนี้",
  "reader.zoomHint": "เปิดแผนภาพแบบเต็มจอ",
  "reader.tapToZoom": "แตะเพื่อซูม",
  "reader.zoomHelp": "ถ่างนิ้วหรือแตะสองครั้งเพื่อซูม",

  // Practise the chapter's exercise on the app's own Trade tab; {login} = demo account number
  "practice.title": "ฝึกในบัญชีทดลอง",
  "practice.onDemo": "เทรดในบัญชีทดลอง #{login}",

  // Final exam screen
  "exam.answerAll": "ตอบให้ครบทุกข้อเพื่อส่งคำตอบ",

  // Glossary; "terms" is the small label next to the big number of terms
  "glossary.terms": { other: "คำศัพท์ในภาษาที่เข้าใจง่าย" },
  "glossary.letters": "ดัชนีตัวอักษร",
  "glossary.openTerm": "เปิดคำจำกัดความ",

  // Certificates
  "cert.share": "แชร์",
  // Shared text; {brand} = the broker's name, {n} = phase number, {title} = phase title, {url} = verification link
  "cert.shareText": "ใบรับรอง {brand} Academy ของฉัน ระยะที่ {n} {title}: {url}",
  "cert.imageA11y": "ใบรับรองระยะที่ {n}",

  // Accessibility labels
  "a11y.glossary": "เปิดอภิธานศัพท์",
  "a11y.progress": "ความคืบหน้าของฉัน",
  "a11y.contents": "สารบัญของบท",

  // States
  "state.viewer.title": "ไม่ได้แชร์กับคุณ",
  "state.viewer.body": "Academy ไม่ได้อยู่ในส่วนที่แชร์กับล็อกอินแบบดูอย่างเดียวนี้",
  "state.disabled.title": "ไม่พร้อมใช้งาน",
  "state.disabled.body": "Academy ไม่พร้อมใช้งานสำหรับบัญชีของคุณ",
};
export default mobileAcademy;
