import type { NsMessages } from "../../core";

// Kalks mobile app: the Academy screens (phases, chapter reader, quizzes, final exams, glossary, progress and
// certificates). Most wording is reused from the `academy` namespace; these are the phone-only strings.
const mobileAcademy: NsMessages<"mobileAcademy"> = {
  // Small uppercase line above the Academy title
  eyebrow: "Kalks एकेडमी",
  // Under the title; {count} = number of chapters
  "home.subtitle": "आठ फ़ेज़ में {count} चैप्टर, क्विज़, अंतिम परीक्षाओं और सर्टिफ़िकेट के साथ।",
  // Big-number tiles on the Academy home (short labels under a number)
  "stats.chapters": "पूरे चैप्टर",
  "stats.streakDays": "दिन की स्ट्रीक",
  "stats.certificates": "सर्टिफ़िकेट",
  // {n} = phase number, {title} = phase title
  "home.phaseA11y": "फ़ेज़ {n}: {title}",

  // Chapter reader
  "reader.updated": "{date} को अपडेट हुआ",
  "reader.completedOn": "{date} को पूरा किया",
  "reader.upNext": "अगला",
  "reader.completeHint": "यह चैप्टर पूरा करने के लिए क्विज़ पास करें।",
  "reader.zoomHint": "डायग्राम फ़ुल स्क्रीन में खोलता है",
  "reader.tapToZoom": "ज़ूम करने के लिए टैप करें",
  "reader.zoomHelp": "ज़ूम करने के लिए पिंच या डबल-टैप करें",

  // Practise the chapter's exercise on the app's own Trade tab; {login} = demo account number
  "practice.title": "डेमो पर अभ्यास करें",
  "practice.onDemo": "डेमो #{login} पर ट्रेड करें",

  // Final exam screen
  "exam.answerAll": "सबमिट करने के लिए हर प्रश्न का जवाब दें।",

  // Glossary; "terms" is the small label next to the big number of terms
  "glossary.terms": { one: "शब्द सरल भाषा में", other: "शब्द सरल भाषा में" },
  "glossary.letters": "अक्षर सूची",
  "glossary.openTerm": "परिभाषा खोलता है",

  // Certificates
  "cert.share": "शेयर करें",
  // Shared text; {brand} = the broker's name, {n} = phase number, {title} = phase title, {url} = verification link
  "cert.shareText": "फ़ेज़ {n}, {title} के लिए मेरा {brand} एकेडमी सर्टिफ़िकेट: {url}",
  "cert.imageA11y": "फ़ेज़ {n} सर्टिफ़िकेट",

  // Accessibility labels
  "a11y.glossary": "शब्दावली खोलें",
  "a11y.progress": "मेरी प्रगति",
  "a11y.contents": "चैप्टर की विषय-सूची",

  // States
  "state.viewer.title": "आपके साथ शेयर नहीं किया गया",
  "state.viewer.body": "इस केवल-देखने वाले लॉगिन के साथ एकेडमी शेयर नहीं की गई है।",
  "state.disabled.title": "उपलब्ध नहीं",
  "state.disabled.body": "आपके अकाउंट पर एकेडमी उपलब्ध नहीं है।",
};
export default mobileAcademy;
