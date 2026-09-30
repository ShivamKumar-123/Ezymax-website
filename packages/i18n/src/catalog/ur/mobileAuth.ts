import type { NsMessages } from "../../core";

// Kalks mobile app: sign in, sign up and password reset (most texts reuse the `auth` namespace).
const mobileAuth: NsMessages<"mobileAuth"> = {
  eyebrow: "Kalks",
  "signIn.create": "اکاؤنٹ بنائیں",
  "signIn.newHere": "Kalks پر نئے ہیں؟",
  "signUp.eyebrow": "اپنا اکاؤنٹ کھولیں",
  "signUp.haveAccount": "پہلے سے اکاؤنٹ ہے؟",
  "signUp.signIn": "سائن اِن کریں",
  "signUp.dobPlaceholder": "YYYY-MM-DD",
  "signUp.dobHint": "آپ کی عمر 18 سال یا اس سے زیادہ ہونی چاہیے۔",
  "signUp.phonePlaceholder": "فون نمبر",
  "signUp.marketing": "مجھے ٹریڈنگ ٹپس، پروڈکٹ کی خبریں اور آفرز ای میل کریں۔ کسی بھی وقت ان سبسکرائب کریں۔",
  "signUp.chooseCountry": "اپنا ملک منتخب کریں",
  "signUp.continue": "Kalks پر جاری رکھیں",
  "forgot.eyebrow": "پاس ورڈ ری سیٹ",
  "forgot.continue": "جاری رکھیں",
  "otp.eyebrow": "سیکیورٹی چیک",
  "otp.wrongEmail": "دوسری ای میل استعمال کریں",
  googleSoon: "Google سائن اِن ویب پر کلائنٹ ایریا میں دستیاب ہے۔",
};
export default mobileAuth;
