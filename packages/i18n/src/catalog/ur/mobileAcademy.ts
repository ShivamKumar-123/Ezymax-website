import type { NsMessages } from "../../core";

// Kalks mobile app: the Academy screens (phone-only strings; the rest reuses the `academy` namespace).
const mobileAcademy: NsMessages<"mobileAcademy"> = {
  // Small uppercase line above the Academy title
  eyebrow: "Kalks اکیڈمی",
  // Under the title; {count} = number of chapters
  "home.subtitle": "آٹھ مراحل میں {count} ابواب، کوئزز، فائنل امتحانات اور سرٹیفکیٹس کے ساتھ۔",
  // Big-number tiles on the Academy home (short labels under a number)
  "stats.chapters": "مکمل ابواب",
  "stats.streakDays": "مسلسل دن",
  "stats.certificates": "سرٹیفکیٹس",
  // {n} = phase number, {title} = phase title
  "home.phaseA11y": "مرحلہ {n}: {title}",

  // Chapter reader
  "reader.updated": "{date} کو اپ ڈیٹ ہوا",
  "reader.completedOn": "{date} کو مکمل ہوا",
  "reader.upNext": "اگلا",
  "reader.completeHint": "یہ باب مکمل کرنے کے لیے کوئز پاس کریں۔",
  "reader.zoomHint": "خاکہ فل اسکرین میں کھولتا ہے",
  "reader.tapToZoom": "زوم کے لیے ٹیپ کریں",
  "reader.zoomHelp": "زوم کے لیے پنچ کریں یا ڈبل ٹیپ کریں",

  // Practise on the app's own Trade tab; {login} = demo account number
  "practice.title": "ڈیمو پر مشق کریں",
  "practice.onDemo": "ڈیمو #{login} پر ٹریڈ کریں",

  // Final exam screen
  "exam.answerAll": "جمع کرانے کے لیے ہر سوال کا جواب دیں۔",

  // Glossary; "terms" is the small label next to the big number of terms
  "glossary.terms": { one: "اصطلاح آسان زبان میں", other: "اصطلاحات آسان زبان میں" },
  "glossary.letters": "حروفِ تہجی کی فہرست",
  "glossary.openTerm": "تعریف کھولتا ہے",

  // Certificates
  "cert.share": "شیئر کریں",
  // {brand} = broker name, {n} = phase number, {title} = phase title, {url} = verification link
  "cert.shareText": "مرحلہ {n}، {title} کے لیے میرا {brand} اکیڈمی سرٹیفکیٹ: {url}",
  "cert.imageA11y": "مرحلہ {n} کا سرٹیفکیٹ",

  // Accessibility labels
  "a11y.glossary": "اصطلاحات کھولیں",
  "a11y.progress": "میری پیش رفت",
  "a11y.contents": "باب کے مندرجات",

  // States
  "state.viewer.title": "آپ کے ساتھ شیئر نہیں کیا گیا",
  "state.viewer.body": "اکیڈمی اس صرف دیکھنے والے لاگ اِن کے ساتھ شیئر کی گئی چیزوں میں شامل نہیں ہے۔",
  "state.disabled.title": "دستیاب نہیں",
  "state.disabled.body": "اکیڈمی آپ کے اکاؤنٹ پر دستیاب نہیں ہے۔",
};
export default mobileAcademy;
