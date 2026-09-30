import type { NsMessages } from "../../core";

// Kalks mobile app: sign in, sign up and password reset (most texts reuse the `auth` namespace).
const mobileAuth: NsMessages<"mobileAuth"> = {
  eyebrow: "Kalks",
  "signIn.create": "ایجاد حساب",
  "signIn.newHere": "در Kalks تازه‌وارد هستید؟",
  "signUp.eyebrow": "افتتاح حساب",
  "signUp.haveAccount": "قبلاً حساب دارید؟",
  "signUp.signIn": "ورود",
  // Date format hint (Gregorian year-month-day)
  "signUp.dobPlaceholder": "YYYY-MM-DD",
  "signUp.dobHint": "باید دست‌کم 18 سال داشته باشید (تاریخ میلادی).",
  "signUp.phonePlaceholder": "شماره تلفن",
  "signUp.marketing": "نکات معاملاتی، اخبار محصولات و پیشنهادها را برایم ایمیل کنید. لغو اشتراک در هر زمان.",
  "signUp.chooseCountry": "کشور خود را انتخاب کنید",
  "signUp.continue": "ادامه به Kalks",
  "forgot.eyebrow": "بازنشانی رمز عبور",
  "forgot.continue": "ادامه",
  "otp.eyebrow": "بررسی امنیتی",
  "otp.wrongEmail": "استفاده از ایمیل دیگر",
  "googleSoon": "ورود با Google در پنل کاربری وب در دسترس است.",
};
export default mobileAuth;
