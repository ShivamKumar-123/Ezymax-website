import type { NsMessages } from "../../core";

// Kalks mobile app: Home tab. Headings are shown in tall display type: keep them short.
const mobileHome: NsMessages<"mobileHome"> = {
  "greet.morning": "صباح الخير، {name}",
  "greet.afternoon": "مساء الخير، {name}",
  "greet.evening": "مساء الخير، {name}",
  equity: "حقوق الملكية",
  closedToday: "المغلقة اليوم",
  openPnl: "الربح/الخسارة المفتوحة",
  allLive: "كل الحسابات الحقيقية {amount}",
  "quick.deposit": "إيداع",
  "quick.withdraw": "سحب",
  "quick.transfer": "تحويل",
  "quick.trade": "تداول",
  movers: "الأكثر تحركًا",
  news: "العناوين",
  allNews: "كل الأخبار",
  notifications: "الإشعارات",
  "kyc.title": "تحقّق من هويتك",
  "kyc.body": "يفعّل التحقق التداول الحقيقي وعمليات السحب. يستغرق بضع دقائق.",
  "kyc.pending": "التحقق قيد المراجعة",
  "kyc.pendingBody": "نراجع مستنداتك. سيصلك إشعار عند الانتهاء.",
  "kyc.action": "متابعة",
  "noAccount.title": "افتح حسابك الأول",
  "noAccount.body": "حساب تجريبي جاهز خلال ثوانٍ بأموال افتراضية. انتقل إلى الحقيقي متى كنت مستعدًا.",
  "noAccount.action": "فتح حساب",
  "news.empty": "لا توجد عناوين حاليًا.",
  "a11y.bell": "الإشعارات، {count} غير مقروءة",

  // Explore: one colour block per module (title in display type on two short lines at most, hint on two lines)
  "explore.title": "استكشف",
  "explore.copy": "نسخ التداول",
  "explore.copyHint": "تابِع متداولين ناجحين",
  "explore.prop": "تحدي التمويل",
  "explore.propHint": "احصل على تمويل للتداول",
  "explore.academy": "الأكاديمية",
  "explore.academyHint": "تعلّم التداول خطوة بخطوة",
  "explore.ai": "المتداول الذكي",
  "explore.aiHint": "حوّل فكرة إلى استراتيجية",
  "explore.invite": "ادعُ أصدقاءك",
  "explore.inviteHint": "اربح عندما يتداولون",
};
export default mobileHome;
