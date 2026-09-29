import type { NsMessages } from "../../core";

// Client Area support: live chat, launcher, support page.
const support: NsMessages<"support"> = {
  // Support page
  "page.title": "سپورٹ",
  "page.subtitle": "فوری جوابات کے لیے Kalks AI سے چیٹ کریں۔ کسی بھی وقت کسی نمائندے سے بات کرنے کا کہیں، ہماری ٹیم پوری گفتگو کے ساتھ بات آگے بڑھائے گی۔",
  "email.prefer": "ای میل کو ترجیح دیتے ہیں؟",
  // <email> and <id> wrap the client's email address and client ID
  "email.writeFrom": "<email>{email}</email> سے لکھیں اور اپنی کلائنٹ ID <id>{id}</id> شامل کریں۔",
  "email.write": "سپورٹ کو لکھیں",
  "email.copyId": "کلائنٹ ID کاپی کریں",
  clientId: "کلائنٹ ID",
  notice: "ہماری ٹیم کے جوابات نوٹیفکیشن بیل میں بھی نظر آتے ہیں، اور آپ کی غیر موجودگی میں ہم آپ کو ای میل کرتے ہیں۔ اسے پروفائل ← نوٹیفکیشنز میں تبدیل کریں۔",
  "toast.copied": "{what} کاپی ہو گیا",
  "toast.copyFailed": "کاپی نہیں ہو سکا، براہ کرم اسے منتخب کر لیں",

  // Conversation status
  "status.bot": "AI اسسٹنٹ",
  "status.waiting": "قطار میں",
  "status.assigned": "نمائندے کے ساتھ",
  "status.resolved": "ختم",

  // Conversation history
  "history.title": "آپ کی گفتگو",
  "history.subtitle": "ٹرانسکرپٹس آپ کے کلائنٹ ایریا میں محفوظ رہتی ہیں",
  "history.emptyTitle": "ابھی کوئی گفتگو نہیں",
  "history.emptyText": "چیٹ میں سوال پوچھیں، وہ یہاں نظر آئے گا۔",
  conversation: "گفتگو",
  "toast.openFailed": "گفتگو نہیں کھل سکی",

  // Floating button
  "launcher.open": "سپورٹ چیٹ کھولیں",
  "launcher.close": "سپورٹ چیٹ بند کریں",

  // Chat
  you: "آپ",
  agent: "نمائندہ",
  // Fallback name for a team member without a name
  supportName: "سپورٹ",
  // File size, e.g. "120 KB · PDF"
  attachmentSize: "{size} KB · PDF",
  // Suggested first questions (sent as the client's message)
  "quick.verify": "میں اپنی شناخت کی تصدیق کیسے کروں؟",
  "quick.deposit": "میں USDT کیسے ڈپازٹ کروں؟",
  "quick.withdrawal": "میری نکالی گئی رقم کب پہنچے گی؟",
  "quick.stopOut": "اسٹاپ آؤٹ کیا ہے؟",
  "header.supportTeam": "سپورٹ ٹیم",
  "header.agentSub": "کلائنٹ سپورٹ · Kalks",
  "header.connecting": "آپ کو نمائندے سے ملایا جا رہا ہے…",
  "header.replySoon": "ہماری ٹیم جلد یہاں جواب دے گی",
  "header.helpCentre": "ہیلپ سینٹر کے جوابات · نمائندہ کسی بھی وقت شامل ہو سکتا ہے",
  "header.instant": "فوری جوابات · نمائندہ کسی بھی وقت شامل ہو سکتا ہے",
  "chip.liveAgent": "لائیو نمائندہ",
  "menu.aria": "چیٹ کے اختیارات",
  "menu.talkToPerson": "نمائندے سے بات کریں",
  "menu.endChat": "چیٹ ختم کریں",
  "menu.newChat": "نئی چیٹ شروع کریں",
  closeChat: "چیٹ بند کریں",
  unavailable: "چیٹ فی الحال دستیاب نہیں ہے۔",
  greeting: "السلام علیکم {name}۔",
  "csat.question": "یہ چیٹ کیسی رہی؟",
  "csat.stars": { one: "{count} اسٹار", other: "{count} اسٹار" },
  "csat.placeholder": "کچھ اور کہنا چاہیں گے؟ (اختیاری)",
  "csat.send": "ریٹنگ بھیجیں",
  "csat.rated": "آپ نے اس چیٹ کو {rating}/5 ریٹنگ دی",
  "composer.attach": "فائل منسلک کریں",
  "composer.messageTo": "{name} کو پیغام…",
  "composer.newChat": "نئی چیٹ شروع کریں…",
  "composer.ask": "{name} سے کچھ بھی پوچھیں…",
  "composer.aria": "پیغام",
  disclaimer: "{name} سے غلطی ہو سکتی ہے اور یہ کبھی سرمایہ کاری کا مشورہ نہیں دیتا۔ معیار کے لیے چیٹس ریکارڈ کی جاتی ہیں۔",
  "toast.chattingWith": "آپ {name} سے چیٹ کر رہے ہیں",
  "toast.inQueue": "آپ نمائندے کی قطار میں ہیں",
  "toast.notSent": "پیغام نہیں بھیجا جا سکا",
  "toast.teamUnreachable": "ٹیم سے رابطہ نہیں ہو سکا",
  "toast.endFailed": "چیٹ ختم نہیں ہو سکی",
  "toast.rateFailed": "ریٹنگ محفوظ نہیں ہوئی",
  "toast.thanks": "آپ کی رائے کا شکریہ",
  "toast.fileTooLarge": "فائل بہت بڑی ہے",
  "toast.fileTooLargeText": "فائلیں زیادہ سے زیادہ {mb} MB کی ہو سکتی ہیں۔",
  "toast.unsupported": "غیر معاون فائل",
  "toast.unsupportedText": "تصویر (PNG, JPG, GIF, WEBP) یا PDF منسلک کریں۔",
  "toast.uploadFailed": "اپ لوڈ ناکام ہو گیا",
  "error.uploadFailed": "اپ لوڈ ناکام ہو گیا۔",
};
export default support;
