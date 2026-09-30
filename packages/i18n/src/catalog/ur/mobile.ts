import type { NsMessages } from "../../core";

// Kalks mobile app (apps/mobile): app shell, onboarding and the states every screen shares.
const mobile: NsMessages<"mobile"> = {
  // Tab bar (short: one word each)
  "tab.home": "ہوم",
  "tab.markets": "مارکیٹس",
  "tab.trade": "ٹریڈ",
  "tab.portfolio": "پورٹ فولیو",
  "tab.more": "مزید",

  // Onboarding (3 slides). Titles are shown in tall display type: keep them short.
  "onboarding.skip": "چھوڑیں",
  "onboarding.next": "اگلا",
  "onboarding.getStarted": "شروع کریں",
  "onboarding.haveAccount": "میرا اکاؤنٹ ہے",
  "onboarding.welcome.title": "مارکیٹس میں قدم رکھیں",
  "onboarding.welcome.body": "فاریکس، دھاتیں، انڈیکسز، توانائی، کرپٹو اور اسٹاکس ایک ہی اکاؤنٹ میں، فوری USDT فنڈنگ کے ساتھ۔",
  "onboarding.markets.title": "ہر ٹک، لائیو",
  "onboarding.markets.body": "حقیقی بِڈ اور آسک قیمتیں، آپ کے اپنے چارٹس اور ایک ٹیپ میں خرید و فروخت، خاص طور پر فون کے لیے۔",
  "onboarding.security.title": "مکمل محفوظ",
  "onboarding.security.body": "نئی ڈیوائسز پر ای میل کوڈز، رقم نکالنے کے لیے تصدیقی کوڈز اور آپ کے سیشن کے لیے محفوظ تجوری۔",
  "onboarding.step": "{n} از {total}",

  // Shared states
  "state.offline.title": "کنکشن منقطع ہو گیا",
  "state.offline.body": "اپنا انٹرنیٹ کنکشن چیک کریں۔ قیمتیں اور آپ کا اکاؤنٹ خود بخود دوبارہ جڑ جائیں گے۔",
  "state.reconnecting": "دوبارہ رابطہ ہو رہا ہے…",
  "state.error.title": "کچھ غلط ہو گیا",
  "state.error.body": "ہم اسے لوڈ نہیں کر سکے۔ دوبارہ کوشش کے لیے نیچے کھینچیں یا ٹیپ کریں۔",
  "state.maintenance.title": "مینٹیننس جاری ہے",
  "state.maintenance.body": "ہم Kalks کو اپ گریڈ کر رہے ہیں۔ آپ کی پوزیشنز اور فنڈز محفوظ ہیں۔ براہ کرم تھوڑی دیر بعد دوبارہ دیکھیں۔",
  "state.sessionExpired": "آپ کا سیشن ختم ہو گیا ہے۔ براہ کرم دوبارہ سائن اِن کریں۔",
  "state.updated": "آخری اپ ڈیٹ {time}",
  "state.pullToRefresh": "ریفریش کے لیے نیچے کھینچیں",

  viewOnly: "صرف دیکھنے کی رسائی",
  viewOnlyBody: "یہ لاگ اِن شیئر کیے گئے اکاؤنٹس دیکھ سکتا ہے لیکن کوئی تبدیلی نہیں کر سکتا۔",

  // Common short labels
  "action.retry": "دوبارہ کوشش کریں",
  "action.openWeb": "کلائنٹ ایریا میں کھولیں",
  "action.signOut": "سائن آؤٹ",
  "action.seeAll": "سب دیکھیں",
  "a11y.close": "بند کریں",
  "a11y.back": "واپس",
};
export default mobile;
