import type { NsMessages } from "../../core";

// Kalks mobile app: Home tab. Headings are shown in tall display type: keep them short.
const mobileHome: NsMessages<"mobileHome"> = {
  "greet.morning": "صبح بخیر، {name}",
  "greet.afternoon": "عصر بخیر، {name}",
  "greet.evening": "شب بخیر، {name}",
  equity: "اکوئیتی",
  closedToday: "بسته‌شده امروز",
  openPnl: "سود/زیان باز",
  allLive: "همه حساب‌های واقعی {amount}",
  "quick.deposit": "واریز",
  "quick.withdraw": "برداشت",
  "quick.transfer": "انتقال",
  "quick.trade": "معامله",
  movers: "بیشترین تغییرات",
  news: "سرخط خبرها",
  allNews: "همه اخبار",
  notifications: "اعلان‌ها",
  "kyc.title": "هویت خود را تأیید کنید",
  "kyc.body": "احراز هویت، معامله واقعی و برداشت را فعال می‌کند. فقط چند دقیقه طول می‌کشد.",
  "kyc.pending": "احراز هویت در حال بررسی",
  "kyc.pendingBody": "در حال بررسی مدارک شما هستیم. پس از پایان، اعلانی دریافت می‌کنید.",
  "kyc.action": "ادامه",
  "noAccount.title": "اولین حساب خود را باز کنید",
  "noAccount.body": "حساب دمو با وجوه مجازی در چند ثانیه آماده می‌شود. هر وقت آماده بودید، حساب واقعی باز کنید.",
  "noAccount.action": "افتتاح حساب",
  "news.empty": "در حال حاضر خبری وجود ندارد.",
  "a11y.bell": "اعلان‌ها، {count} خوانده‌نشده",

  // Explore: one colour block per module (title in display type on two short lines at most, hint on two lines)
  "explore.title": "کاوش",
  "explore.copy": "کپی ترید",
  "explore.copyHint": "معامله‌گران موفق را دنبال کنید",
  "explore.prop": "چالش پراپ",
  "explore.propHint": "برای معامله سرمایه بگیرید",
  "explore.academy": "آکادمی",
  "explore.academyHint": "آموزش معامله، گام به گام",
  "explore.ai": "معامله‌گر هوش مصنوعی",
  "explore.aiHint": "ایده را به استراتژی تبدیل کنید",
  "explore.invite": "دعوت از دوستان",
  "explore.inviteHint": "از معاملات آن‌ها درآمد کسب کنید",
};
export default mobileHome;
