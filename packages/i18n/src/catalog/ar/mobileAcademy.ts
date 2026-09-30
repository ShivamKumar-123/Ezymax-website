import type { NsMessages } from "../../core";

// Kalks mobile app: the Academy screens (phases, chapter reader, quizzes, final exams, glossary, progress and
// certificates). Most wording is reused from the `academy` namespace; these are the phone-only strings.
const mobileAcademy: NsMessages<"mobileAcademy"> = {
  // Small line above the Academy title
  eyebrow: "أكاديمية Kalks",
  // Under the title; {count} = number of chapters
  "home.subtitle": "{count} فصلًا في ثماني مراحل، مع اختبارات قصيرة وامتحانات نهائية وشهادات.",
  // Big-number tiles on the Academy home (short labels under a number)
  "stats.chapters": "فصول مكتملة",
  "stats.streakDays": "أيام متتالية",
  "stats.certificates": "الشهادات",
  // {n} = phase number, {title} = phase title
  "home.phaseA11y": "المرحلة {n}: {title}",

  // Chapter reader
  "reader.updated": "آخر تحديث {date}",
  "reader.completedOn": "اكتمل في {date}",
  "reader.upNext": "التالي",
  "reader.completeHint": "اجتز الاختبار لإكمال هذا الفصل.",
  "reader.zoomHint": "يفتح الرسم التوضيحي بملء الشاشة",
  "reader.tapToZoom": "اضغط للتكبير",
  "reader.zoomHelp": "باعد بإصبعين أو اضغط مرتين للتكبير",

  // Practise the chapter's exercise on the app's own Trade tab; {login} = demo account number
  "practice.title": "تدرّب على الحساب التجريبي",
  "practice.onDemo": "تداول على الحساب التجريبي #{login}",

  // Final exam screen
  "exam.answerAll": "أجب عن كل الأسئلة لإرسال الامتحان.",

  // Glossary; "terms" is the small label next to the big number of terms
  "glossary.terms": {
    zero: "مصطلح بلغة بسيطة",
    one: "مصطلح بلغة بسيطة",
    two: "مصطلحان بلغة بسيطة",
    few: "مصطلحات بلغة بسيطة",
    many: "مصطلحًا بلغة بسيطة",
    other: "مصطلح بلغة بسيطة",
  },
  "glossary.letters": "الفهرس الأبجدي",
  "glossary.openTerm": "يفتح التعريف",

  // Certificates
  "cert.share": "مشاركة",
  // Shared text; {brand} = the broker's name, {n} = phase number, {title} = phase title, {url} = verification link
  "cert.shareText": "شهادتي من أكاديمية {brand} للمرحلة {n}، {title}: {url}",
  "cert.imageA11y": "شهادة المرحلة {n}",

  // Accessibility labels
  "a11y.glossary": "فتح المسرد",
  "a11y.progress": "تقدّمي",
  "a11y.contents": "محتويات الفصل",

  // States
  "state.viewer.title": "غير مشارَك معك",
  "state.viewer.body": "الأكاديمية ليست ضمن ما تمت مشاركته مع تسجيل الدخول هذا للعرض فقط.",
  "state.disabled.title": "غير متاحة",
  "state.disabled.body": "الأكاديمية غير متاحة لحسابك.",
};
export default mobileAcademy;
