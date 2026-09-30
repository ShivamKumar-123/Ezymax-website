import type { NsMessages } from "../../core";

// Kalks mobile app (apps/mobile): app shell, onboarding and the states every screen shares.
// Feature screens have their own namespaces (mobileHome, mobileMarkets, mobileTrade, mobilePortfolio, ...).
const mobile: NsMessages<"mobile"> = {
  // Tab bar (short: one word each)
  "tab.home": "خانه",
  "tab.markets": "بازارها",
  "tab.trade": "معامله",
  "tab.portfolio": "پورتفولیو",
  "tab.more": "بیشتر",

  // Onboarding (3 slides). Titles are shown in tall display type: keep them short.
  "onboarding.skip": "رد شدن",
  "onboarding.next": "بعدی",
  "onboarding.getStarted": "شروع کنید",
  "onboarding.haveAccount": "حساب دارم",
  "onboarding.welcome.title": "پا به بازارها بگذارید",
  "onboarding.welcome.body": "فارکس، فلزات، شاخص‌ها، انرژی، رمزارز و سهام در یک حساب، با واریز فوری USDT.",
  "onboarding.markets.title": "هر تیک، زنده",
  "onboarding.markets.body": "قیمت‌های واقعی Bid و Ask، نمودارهای خودتان و خرید و فروش با یک لمس، ساخته‌شده برای موبایل.",
  "onboarding.security.title": "امنیت کامل",
  "onboarding.security.body": "کد ایمیلی در دستگاه‌های جدید، کد تأیید برای برداشت و محفظه‌ای امن برای نشست شما.",
  // Slide counter, e.g. "1 of 3"
  "onboarding.step": "{n} از {total}",

  // Shared states
  "state.offline.title": "اتصال قطع شد",
  "state.offline.body": "اتصال اینترنت خود را بررسی کنید. قیمت‌ها و حساب شما خودکار دوباره متصل می‌شوند.",
  "state.reconnecting": "در حال اتصال مجدد…",
  "state.error.title": "مشکلی پیش آمد",
  "state.error.body": "بارگذاری انجام نشد. صفحه را به پایین بکشید یا برای تلاش دوباره ضربه بزنید.",
  "state.maintenance.title": "در حال تعمیر و نگهداری",
  "state.maintenance.body": "در حال ارتقای Kalks هستیم. پوزیشن‌ها و وجوه شما امن است. لطفاً کمی بعد دوباره سر بزنید.",
  "state.sessionExpired": "نشست شما به پایان رسید. لطفاً دوباره وارد شوید.",
  "state.updated": "به‌روزرسانی: {time}",
  "state.pullToRefresh": "برای به‌روزرسانی بکشید",

  "viewOnly": "دسترسی فقط‌خواندنی",
  "viewOnlyBody": "با این ورود می‌توانید حساب‌های اشتراک‌گذاشته‌شده را ببینید، اما امکان ایجاد تغییر ندارید.",

  // Common short labels
  "action.retry": "تلاش دوباره",
  "action.openWeb": "باز کردن در پنل کاربری",
  "action.signOut": "خروج",
  "action.seeAll": "مشاهده همه",
  "a11y.close": "بستن",
  "a11y.back": "بازگشت",
};
export default mobile;
