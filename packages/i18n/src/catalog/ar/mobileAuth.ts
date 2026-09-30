import type { NsMessages } from "../../core";

// Kalks mobile app: sign in, sign up and password reset (most texts reuse the `auth` namespace).
const mobileAuth: NsMessages<"mobileAuth"> = {
  eyebrow: "Kalks",
  "signIn.create": "إنشاء حساب",
  "signIn.newHere": "جديد في Kalks؟",
  "signUp.eyebrow": "افتح حسابك",
  "signUp.haveAccount": "لديك حساب بالفعل؟",
  "signUp.signIn": "تسجيل الدخول",
  "signUp.dobPlaceholder": "YYYY-MM-DD",
  "signUp.dobHint": "يجب أن يكون عمرك 18 عامًا أو أكثر.",
  "signUp.phonePlaceholder": "رقم الهاتف",
  "signUp.marketing": "أرسل لي نصائح التداول وأخبار المنتجات والعروض عبر البريد الإلكتروني. يمكنك إلغاء الاشتراك في أي وقت.",
  "signUp.chooseCountry": "اختر بلدك",
  "signUp.continue": "المتابعة إلى Kalks",
  "forgot.eyebrow": "إعادة تعيين كلمة المرور",
  "forgot.continue": "متابعة",
  "otp.eyebrow": "التحقق الأمني",
  "otp.wrongEmail": "استخدام بريد إلكتروني آخر",
  googleSoon: "تسجيل الدخول عبر Google متاح في منطقة العملاء على الويب.",
};
export default mobileAuth;
