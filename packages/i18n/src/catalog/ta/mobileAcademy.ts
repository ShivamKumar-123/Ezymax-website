import type { NsMessages } from "../../core";

// Kalks mobile app: the Academy screens (phone-only strings; the rest reuse the `academy` namespace).
const mobileAcademy: NsMessages<"mobileAcademy"> = {
  // Small uppercase line above the Academy title
  eyebrow: "Kalks அகாடமி",
  // Under the title; {count} = number of chapters
  "home.subtitle": "எட்டு கட்டங்களில் {count} அத்தியாயங்கள், வினாடி வினாக்கள், இறுதித் தேர்வுகள் மற்றும் சான்றிதழ்களுடன்.",
  // Big-number tiles on the Academy home
  "stats.chapters": "முடிந்த அத்தியாயங்கள்",
  "stats.streakDays": "நாள் தொடர்",
  "stats.certificates": "சான்றிதழ்கள்",
  "home.phaseA11y": "கட்டம் {n}: {title}",

  // Chapter reader
  "reader.updated": "புதுப்பிப்பு: {date}",
  "reader.completedOn": "{date} அன்று முடிந்தது",
  "reader.upNext": "அடுத்தது",
  "reader.completeHint": "இந்த அத்தியாயத்தை முடிக்க வினாடி வினாவில் தேர்ச்சி பெறுங்கள்.",
  "reader.zoomHint": "வரைபடத்தை முழுத்திரையில் திறக்கும்",
  "reader.tapToZoom": "பெரிதாக்கத் தட்டவும்",
  "reader.zoomHelp": "பெரிதாக்கப் பிஞ்ச் செய்யவும் அல்லது இருமுறை தட்டவும்",

  // Practise on the app's Trade tab; {login} = demo account number
  "practice.title": "டெமோவில் பயிற்சி",
  "practice.onDemo": "டெமோ #{login} இல் டிரேட் செய்",

  // Final exam screen
  "exam.answerAll": "சமர்ப்பிக்க ஒவ்வொரு கேள்விக்கும் பதிலளியுங்கள்.",

  // Glossary; "terms" is the small label next to the big number of terms
  "glossary.terms": { one: "சொல், எளிய மொழியில்", other: "சொற்கள், எளிய மொழியில்" },
  "glossary.letters": "அகர வரிசை அட்டவணை",
  "glossary.openTerm": "வரையறையைத் திறக்கும்",

  // Certificates
  "cert.share": "பகிர்",
  "cert.shareText": "கட்டம் {n}, {title} க்கான எனது {brand} அகாடமி சான்றிதழ்: {url}",
  "cert.imageA11y": "கட்டம் {n} சான்றிதழ்",

  // Accessibility labels
  "a11y.glossary": "சொற்களஞ்சியத்தைத் திற",
  "a11y.progress": "எனது முன்னேற்றம்",
  "a11y.contents": "அத்தியாய உள்ளடக்கம்",

  // States
  "state.viewer.title": "உங்களுடன் பகிரப்படவில்லை",
  "state.viewer.body": "இந்தப் பார்வை-மட்டும் உள்நுழைவுடன் பகிரப்பட்டவற்றில் அகாடமி இல்லை.",
  "state.disabled.title": "கிடைக்கவில்லை",
  "state.disabled.body": "உங்கள் கணக்கில் அகாடமி கிடைக்கவில்லை.",
};
export default mobileAcademy;
