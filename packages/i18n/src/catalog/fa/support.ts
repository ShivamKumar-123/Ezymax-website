import type { NsMessages } from "../../core";

// Client Area support: live chat, launcher, support page.
const support: NsMessages<"support"> = {
  // Support page
  "page.title": "پشتیبانی",
  "page.subtitle": "برای پاسخ فوری با Ezymex AI گفتگو کنید. هر زمان بخواهید می‌توانید با یک کارشناس صحبت کنید و تیم ما با کل گفتگو ادامه می‌دهد.",
  "email.prefer": "ایمیل را ترجیح می‌دهید؟",
  // <email> and <id> wrap the client's email address and client ID
  "email.writeFrom": "از <email>{email}</email> بنویسید و شناسه مشتری خود <id>{id}</id> را درج کنید.",
  "email.write": "نوشتن به پشتیبانی",
  "email.copyId": "کپی شناسه مشتری",
  clientId: "شناسه مشتری",
  notice: "پاسخ‌های تیم ما در زنگ اعلان‌ها نیز نمایش داده می‌شود و وقتی آنلاین نیستید برایتان ایمیل می‌فرستیم. این مورد را در پروفایل ← اعلان‌ها تغییر دهید.",
  "toast.copied": "{what} کپی شد",
  "toast.copyFailed": "کپی نشد، لطفاً آن را انتخاب کنید",

  // Conversation status
  "status.bot": "دستیار هوش مصنوعی",
  "status.waiting": "در صف",
  "status.assigned": "با کارشناس",
  "status.resolved": "پایان‌یافته",

  // Conversation history
  "history.title": "گفتگوهای شما",
  "history.subtitle": "متن گفتگوها در پنل کاربری شما نگهداری می‌شود",
  "history.emptyTitle": "هنوز گفتگویی ندارید",
  "history.emptyText": "در چت سؤالی بپرسید تا اینجا نمایش داده شود.",
  conversation: "گفتگو",
  "toast.openFailed": "گفتگو باز نشد",

  // Floating button
  "launcher.open": "باز کردن چت پشتیبانی",
  "launcher.close": "بستن چت پشتیبانی",

  // Chat
  you: "شما",
  agent: "کارشناس",
  // Fallback name for a team member without a name
  supportName: "پشتیبانی",
  // File size, e.g. "120 KB · PDF"
  attachmentSize: "{size} KB · PDF",
  // Suggested first questions (sent as the client's message)
  "quick.verify": "چگونه هویت خود را تأیید کنم؟",
  "quick.deposit": "چگونه USDT واریز کنم؟",
  "quick.withdrawal": "برداشت من کی می‌رسد؟",
  "quick.stopOut": "استاپ‌اوت چیست؟",
  "header.supportTeam": "تیم پشتیبانی",
  "header.agentSub": "پشتیبانی مشتریان · Ezymex",
  "header.connecting": "در حال اتصال شما به کارشناس…",
  "header.replySoon": "تیم ما به‌زودی اینجا پاسخ می‌دهد",
  "header.helpCentre": "پاسخ از مرکز راهنما · هر زمان یک کارشناس می‌تواند وارد شود",
  "header.instant": "پاسخ فوری · هر زمان یک کارشناس می‌تواند وارد شود",
  "chip.liveAgent": "کارشناس آنلاین",
  "menu.aria": "گزینه‌های چت",
  "menu.talkToPerson": "صحبت با کارشناس",
  "menu.endChat": "پایان چت",
  "menu.newChat": "شروع چت جدید",
  closeChat: "بستن چت",
  unavailable: "چت در حال حاضر در دسترس نیست.",
  greeting: "سلام {name}.",
  "csat.question": "این چت چطور بود؟",
  "csat.stars": { one: "{count} ستاره", other: "{count} ستاره" },
  "csat.placeholder": "نکته‌ای برای افزودن دارید؟ (اختیاری)",
  "csat.send": "ارسال امتیاز",
  "csat.rated": "به این چت امتیاز {rating}/5 دادید",
  "composer.attach": "پیوست فایل",
  "composer.messageTo": "پیام به {name}…",
  "composer.newChat": "شروع چت جدید…",
  "composer.ask": "هر سؤالی دارید از {name} بپرسید…",
  "composer.aria": "پیام",
  disclaimer: "{name} ممکن است اشتباه کند و هرگز مشاوره سرمایه‌گذاری نمی‌دهد. گفتگوها برای کنترل کیفیت ضبط می‌شوند.",
  "toast.chattingWith": "در حال گفتگو با {name} هستید",
  "toast.inQueue": "در صف انتظار کارشناس هستید",
  "toast.notSent": "پیام ارسال نشد",
  "toast.teamUnreachable": "ارتباط با تیم برقرار نشد",
  "toast.endFailed": "پایان دادن به چت انجام نشد",
  "toast.rateFailed": "امتیاز ذخیره نشد",
  "toast.thanks": "از بازخورد شما سپاسگزاریم",
  "toast.fileTooLarge": "حجم فایل بیش از حد است",
  "toast.fileTooLargeText": "حجم فایل حداکثر می‌تواند {mb} MB باشد.",
  "toast.unsupported": "فایل پشتیبانی نمی‌شود",
  "toast.unsupportedText": "یک تصویر (PNG، JPG، GIF، WEBP) یا PDF پیوست کنید.",
  "toast.uploadFailed": "بارگذاری ناموفق بود",
  "error.uploadFailed": "بارگذاری ناموفق بود.",
};
export default support;
