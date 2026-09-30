import type { NsMessages } from "../../core";

// Kalks mobile app (apps/mobile): app shell, onboarding and the states every screen shares.
const mobile: NsMessages<"mobile"> = {
  // Tab bar (short: one word each)
  "tab.home": "الرئيسية",
  "tab.markets": "الأسواق",
  "tab.trade": "التداول",
  "tab.portfolio": "الصفقات",
  "tab.more": "المزيد",

  // Onboarding (3 slides). Titles are shown in tall display type: keep them short.
  "onboarding.skip": "تخطي",
  "onboarding.next": "التالي",
  "onboarding.getStarted": "ابدأ الآن",
  "onboarding.haveAccount": "لديّ حساب",
  "onboarding.welcome.title": "ادخل إلى الأسواق",
  "onboarding.welcome.body": "الفوركس والمعادن والمؤشرات والطاقة والعملات المشفرة والأسهم في حساب واحد، مع تمويل فوري عبر USDT.",
  "onboarding.markets.title": "كل تيك لحظة بلحظة",
  "onboarding.markets.body": "أسعار Bid وAsk حقيقية، ورسوم بيانية خاصة بك، وشراء وبيع بلمسة واحدة، مصمَّمة للهاتف.",
  "onboarding.security.title": "حماية محكمة",
  "onboarding.security.body": "رموز عبر البريد الإلكتروني على الأجهزة الجديدة، ورموز تأكيد لعمليات السحب، وخزنة آمنة لجلستك.",
  "onboarding.step": "{n} من {total}",

  // Shared states
  "state.offline.title": "انقطع الاتصال",
  "state.offline.body": "تحقّق من اتصالك بالإنترنت. يُعاد اتصال الأسعار وحسابك تلقائيًا.",
  "state.reconnecting": "جارٍ إعادة الاتصال…",
  "state.error.title": "حدث خطأ ما",
  "state.error.body": "تعذّر تحميل هذا المحتوى. اسحب للأسفل أو اضغط للمحاولة مرة أخرى.",
  "state.maintenance.title": "متوقف للصيانة",
  "state.maintenance.body": "نعمل على تحديث Kalks. صفقاتك وأموالك في أمان. يرجى العودة بعد قليل.",
  "state.sessionExpired": "انتهت جلستك. يرجى تسجيل الدخول مرة أخرى.",
  "state.updated": "آخر تحديث {time}",
  "state.pullToRefresh": "اسحب للتحديث",

  viewOnly: "صلاحية العرض فقط",
  viewOnlyBody: "يمكن لتسجيل الدخول هذا عرض الحسابات المشارَكة، لكن لا يمكنه إجراء تغييرات.",

  // Common short labels
  "action.retry": "حاول مرة أخرى",
  "action.openWeb": "فتح في منطقة العملاء",
  "action.signOut": "تسجيل الخروج",
  "action.seeAll": "عرض الكل",
  "a11y.close": "إغلاق",
  "a11y.back": "رجوع",
};
export default mobile;
