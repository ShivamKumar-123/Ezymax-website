import type { NsMessages } from "../../core";

// Client Area support: live chat, launcher, support page.
const support: NsMessages<"support"> = {
  // Support page
  "page.title": "الدعم",
  "page.subtitle": "تحدّث مع Kalks AI للحصول على إجابات فورية. يمكنك طلب التحدث إلى موظف في أي وقت وسيتولى فريقنا المحادثة كاملةً.",
  "email.prefer": "تفضّل البريد الإلكتروني؟",
  // <email> and <id> wrap the client's email address and client ID
  "email.writeFrom": "راسلنا من <email>{email}</email> وأرفق رقم العميل الخاص بك <id>{id}</id>.",
  "email.write": "راسل الدعم",
  "email.copyId": "نسخ رقم العميل",
  clientId: "رقم العميل",
  notice: "تظهر ردود فريقنا أيضًا في جرس الإشعارات، ونرسل إليك بريدًا إلكترونيًا عند غيابك. يمكنك تغيير ذلك من الملف الشخصي ← الإشعارات.",
  "toast.copied": "تم نسخ {what}",
  "toast.copyFailed": "تعذّر النسخ، يُرجى تحديده يدويًا",

  // Conversation status
  "status.bot": "المساعد الذكي",
  "status.waiting": "في قائمة الانتظار",
  "status.assigned": "مع موظف الدعم",
  "status.resolved": "انتهت",

  // Conversation history
  "history.title": "محادثاتك",
  "history.subtitle": "تُحفظ نصوص المحادثات في منطقة العملاء",
  "history.emptyTitle": "لا توجد محادثات بعد",
  "history.emptyText": "اطرح سؤالًا في الدردشة وسيظهر هنا.",
  conversation: "محادثة",
  "toast.openFailed": "تعذّر فتح المحادثة",

  // Floating button
  "launcher.open": "فتح دردشة الدعم",
  "launcher.close": "إغلاق دردشة الدعم",

  // Chat
  you: "أنت",
  agent: "موظف الدعم",
  // Fallback name for a team member without a name
  supportName: "الدعم",
  // File size, e.g. "120 KB · PDF"
  attachmentSize: "{size} KB · PDF",
  // Suggested first questions (sent as the client's message)
  "quick.verify": "كيف أتحقق من هويتي؟",
  "quick.deposit": "كيف أودع USDT؟",
  "quick.withdrawal": "متى سيصل السحب الخاص بي؟",
  "quick.stopOut": "ما هو الإيقاف الإجباري؟",
  "header.supportTeam": "فريق الدعم",
  "header.agentSub": "دعم العملاء · Kalks",
  "header.connecting": "جارٍ توصيلك بموظف الدعم…",
  "header.replySoon": "سيرد فريقنا هنا قريبًا",
  "header.helpCentre": "إجابات مركز المساعدة · يمكن لموظف الانضمام في أي وقت",
  "header.instant": "إجابات فورية · يمكن لموظف الانضمام في أي وقت",
  "chip.liveAgent": "موظف مباشر",
  "menu.aria": "خيارات الدردشة",
  "menu.talkToPerson": "التحدث إلى موظف",
  "menu.endChat": "إنهاء الدردشة",
  "menu.newChat": "بدء دردشة جديدة",
  closeChat: "إغلاق الدردشة",
  unavailable: "الدردشة غير متاحة حاليًا.",
  greeting: "مرحبًا {name}.",
  "csat.question": "كيف كانت هذه الدردشة؟",
  "csat.stars": {
    zero: "{count} نجمة",
    one: "نجمة واحدة",
    two: "نجمتان",
    few: "{count} نجوم",
    many: "{count} نجمة",
    other: "{count} نجمة",
  },
  "csat.placeholder": "هل تود إضافة شيء؟ (اختياري)",
  "csat.send": "إرسال التقييم",
  "csat.rated": "قيّمت هذه الدردشة {rating}/5",
  "composer.attach": "إرفاق ملف",
  "composer.messageTo": "رسالة إلى {name}…",
  "composer.newChat": "ابدأ دردشة جديدة…",
  "composer.ask": "اسأل {name} أي شيء…",
  "composer.aria": "الرسالة",
  disclaimer: "قد يخطئ {name} ولا يقدّم أبدًا نصائح استثمارية. تُسجَّل المحادثات لضمان الجودة.",
  "toast.chattingWith": "أنت تتحدث مع {name}",
  "toast.inQueue": "أنت في قائمة الانتظار لموظف الدعم",
  "toast.notSent": "لم يتم إرسال الرسالة",
  "toast.teamUnreachable": "تعذّر الوصول إلى الفريق",
  "toast.endFailed": "تعذّر إنهاء الدردشة",
  "toast.rateFailed": "لم يتم حفظ التقييم",
  "toast.thanks": "شكرًا على ملاحظاتك",
  "toast.fileTooLarge": "الملف كبير جدًا",
  "toast.fileTooLargeText": "الحد الأقصى لحجم الملف {mb} MB.",
  "toast.unsupported": "ملف غير مدعوم",
  "toast.unsupportedText": "أرفق صورة (PNG أو JPG أو GIF أو WEBP) أو ملف PDF.",
  "toast.uploadFailed": "فشل الرفع",
  "error.uploadFailed": "فشل الرفع.",
};
export default support;
