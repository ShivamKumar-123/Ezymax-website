import type { NsMessages } from "../../core";

// Kalks mobile app: sign in, sign up and password reset (most texts reuse the `auth` namespace).
const mobileAuth: NsMessages<"mobileAuth"> = {
  eyebrow: "Kalks",
  "signIn.create": "অ্যাকাউন্ট তৈরি করুন",
  "signIn.newHere": "Kalks-এ নতুন?",
  "signUp.eyebrow": "আপনার অ্যাকাউন্ট খুলুন",
  "signUp.haveAccount": "ইতিমধ্যে অ্যাকাউন্ট আছে?",
  "signUp.signIn": "সাইন ইন",
  "signUp.dobPlaceholder": "YYYY-MM-DD",
  "signUp.dobHint": "আপনার বয়স কমপক্ষে 18 বছর হতে হবে।",
  "signUp.phonePlaceholder": "ফোন নম্বর",
  "signUp.marketing": "আমাকে ট্রেডিং টিপস, প্রোডাক্টের খবর ও অফার ইমেইল করুন। যেকোনো সময় আনসাবস্ক্রাইব করা যাবে।",
  "signUp.chooseCountry": "আপনার দেশ বেছে নিন",
  "signUp.continue": "Kalks-এ চালিয়ে যান",
  "forgot.eyebrow": "পাসওয়ার্ড রিসেট",
  "forgot.continue": "চালিয়ে যান",
  "otp.eyebrow": "নিরাপত্তা যাচাই",
  "otp.wrongEmail": "অন্য ইমেইল ব্যবহার করুন",
  googleSoon: "Google সাইন-ইন ওয়েবের ক্লায়েন্ট এরিয়ায় উপলব্ধ।",
};
export default mobileAuth;
