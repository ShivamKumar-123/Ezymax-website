import type { NsMessages } from "../../core";

// Kalks mobile app: the Academy screens (phases, chapter reader, quizzes, final exams, glossary, progress and
// certificates). Most wording is reused from the `academy` namespace; these are the phone-only strings.
const mobileAcademy: NsMessages<"mobileAcademy"> = {
  // Small line above the Academy title
  eyebrow: "آکادمی Kalks",
  // Under the title; {count} = number of chapters
  "home.subtitle": "{count} فصل در هشت مرحله، همراه با آزمونک، آزمون نهایی و گواهینامه.",
  // Big-number tiles on the Academy home (short labels under a number)
  "stats.chapters": "فصل تکمیل‌شده",
  "stats.streakDays": "روز پیاپی",
  "stats.certificates": "گواهینامه",
  // {n} = phase number, {title} = phase title
  "home.phaseA11y": "مرحله {n}: {title}",

  // Chapter reader
  "reader.updated": "به‌روزرسانی {date}",
  "reader.completedOn": "تکمیل‌شده در {date}",
  "reader.upNext": "بعدی",
  "reader.completeHint": "برای تکمیل این فصل، در آزمونک قبول شوید.",
  "reader.zoomHint": "نمودار را تمام‌صفحه باز می‌کند",
  "reader.tapToZoom": "برای بزرگ‌نمایی ضربه بزنید",
  "reader.zoomHelp": "برای بزرگ‌نمایی، با دو انگشت باز کنید یا دو بار ضربه بزنید",

  // Practise the chapter's exercise on the app's own Trade tab; {login} = demo account number
  "practice.title": "تمرین روی دمو",
  "practice.onDemo": "معامله روی دمو #{login}",

  // Final exam screen
  "exam.answerAll": "برای ارسال، به همه سؤالات پاسخ دهید.",

  // Glossary; "terms" is the small label next to the big number of terms
  "glossary.terms": { one: "اصطلاح به زبان ساده", other: "اصطلاح به زبان ساده" },
  "glossary.letters": "فهرست الفبایی",
  "glossary.openTerm": "تعریف را باز می‌کند",

  // Certificates
  "cert.share": "اشتراک‌گذاری",
  // Shared text; {brand} = the broker's name, {n} = phase number, {title} = phase title, {url} = verification link
  "cert.shareText": "گواهینامه آکادمی {brand} من برای مرحله {n}، {title}: {url}",
  "cert.imageA11y": "گواهینامه مرحله {n}",

  // Accessibility labels
  "a11y.glossary": "باز کردن واژه‌نامه",
  "a11y.progress": "پیشرفت من",
  "a11y.contents": "فهرست مطالب فصل",

  // States
  "state.viewer.title": "با شما به اشتراک گذاشته نشده",
  "state.viewer.body": "آکادمی جزو بخش‌هایی نیست که با این ورود فقط‌خواندنی به اشتراک گذاشته شده است.",
  "state.disabled.title": "در دسترس نیست",
  "state.disabled.body": "آکادمی برای حساب شما در دسترس نیست.",
};
export default mobileAcademy;
