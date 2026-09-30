import type { NsMessages } from "../../core";

// Kalks mobile app (src/features/platform): notifications inbox, push notifications, the app lock,
// "Continue with Google" and links that open the app. Keep Kalks, Face ID, Touch ID and Google as they are.
const mobilePlatform: NsMessages<"mobilePlatform"> = {
  // Notifications inbox (/notifications)
  "inbox.eyebrow": "ان باکس",
  "inbox.unread": { one: "{count} غیر پڑھی ہوئی", other: "{count} غیر پڑھی ہوئی" },
  "inbox.caughtUp": "سب پڑھ لیا گیا",
  "inbox.filter.unread": "غیر پڑھی ہوئی",
  "inbox.markedAll": "سب کو پڑھا ہوا نشان زد کر دیا گیا",
  "inbox.emptyUnread.title": "سب پڑھ لیا گیا",
  "inbox.emptyUnread.body": "آپ ہر اطلاع پڑھ چکے ہیں۔ نئی اطلاعات آتے ہی یہاں نظر آئیں گی۔",
  "inbox.loadMoreFailed": "پرانی اطلاعات لوڈ نہیں ہو سکیں۔ دوبارہ کوشش کے لیے ٹیپ کریں۔",
  // Under the title while the phone is offline and the inbox shows what it saved earlier
  "inbox.offlineCached": "آپ آف لائن ہیں۔ یہ اس فون پر محفوظ کی گئی اطلاعات ہیں۔",
  // Row accessibility
  "inbox.a11y.unread": "غیر پڑھی ہوئی",
  "inbox.a11y.settings": "اطلاعات کی سیٹنگز",
  // Detail sheet of a notification without a screen to open
  "inbox.detail.openWeb": "لنک کھولیں",
  "inbox.detail.received": "{time} کو موصول ہوئی",

  // Asking for push permission: a sheet on Home and a card in the inbox
  "push.ask.eyebrow": "اطلاعات",
  "push.ask.title": "فوراً باخبر رہیں",
  "push.ask.body": "ڈپازٹ کا کریڈٹ، رقم کی ادائیگی، مارجن کالز، اسٹاپ آؤٹس اور سپورٹ کے جوابات، سیدھے آپ کی لاک اسکرین پر۔",
  "push.ask.point.money": "ڈپازٹس اور رقم نکالنا",
  "push.ask.point.risk": "مارجن کالز اور اسٹاپ آؤٹس",
  "push.ask.point.support": "سپورٹ کے جوابات",
  "push.ask.allow": "اطلاعات آن کریں",
  "push.ask.later": "ابھی نہیں",
  "push.ask.note": "موضوعات آپ پروفائل ← اطلاعات میں منتخب کرتے ہیں۔ آفرز صرف تب بھیجی جاتی ہیں جب آپ انہیں آن کریں۔",
  // The sample notification drawn in the ask ("now" = its time label)
  "push.ask.now": "ابھی",
  "push.ask.sampleTitle": "ڈپازٹ کریڈٹ ہو گیا",
  "push.ask.sampleBody": "250.00 USDT آپ کے والیٹ میں کریڈٹ ہو گئے۔",
  "push.card.title": "پش نوٹیفکیشنز آن کریں",
  "push.card.body": "ڈپازٹس، فِلز اور مارجن کالز اپنی لاک اسکرین پر پائیں۔",
  "push.card.action": "آن کریں",
  "push.card.deniedTitle": "پش نوٹیفکیشنز آف ہیں",
  "push.card.deniedBody": "لاک اسکرین پر اطلاعات پانے کے لیے اپنے فون کی سیٹنگز میں Kalks کو نوٹیفکیشنز کی اجازت دیں۔",
  "push.card.deniedAction": "سیٹنگز کھولیں",
  "push.card.dismiss": "چھپائیں",
  "push.enabled": "پش نوٹیفکیشنز آن ہیں",
  // Android notification channels (shown in the phone's settings for the app)
  "push.channel.alerts": "مارجن کالز اور سیکیورٹی",
  "push.channel.alertsHint": "مارجن کال اور اسٹاپ آؤٹ کی وارننگز، آپ کے قیمت کے الرٹس، نئے سائن اِنز",
  "push.channel.activity": "اکاؤنٹ کی سرگرمی",
  "push.channel.activityHint": "ڈپازٹس، رقم نکالنا، فِلز، تصدیق اور سپورٹ کے جوابات",
  "push.channel.news": "خبریں اور آفرز",
  "push.channel.newsHint": "پروموشنز اور پروڈکٹ کی خبریں جن کا آپ نے انتخاب کیا",
  // In-app banner for a push that arrives while the app is open
  "push.banner.a11y": "نئی اطلاع: {title}۔ کھولنے کے لیے ڈبل ٹیپ کریں۔",

  // App lock screen
  "lock.eyebrow": "لاک ہے",
  "lock.title": "دوبارہ خوش آمدید",
  "lock.subtitle": "اپنے اکاؤنٹس اور بیلنس دیکھنے کے لیے ان لاک کریں۔",
  // {method}: Face ID, Touch ID, fingerprint, face unlock or passcode
  "lock.unlockWith": "{method} سے ان لاک کریں",
  "lock.unlock": "ان لاک کریں",
  "lock.prompt": "Kalks ان لاک کریں",
  "lock.promptSubtitle": "تصدیق کریں کہ یہ آپ ہیں",
  "lock.failed": "یہ کام نہیں کیا۔ دوبارہ کوشش کریں۔",
  "lock.lockout": "بہت زیادہ کوششیں۔ اپنا فون اس کے پاس کوڈ سے ان لاک کریں، پھر دوبارہ کوشش کریں۔",
  "lock.noScreenLock": "آپ کے فون پر اب کوئی اسکرین لاک نہیں، اس لیے Kalks تصدیق نہیں کر سکتا کہ یہ آپ ہیں۔ سائن آؤٹ کریں اور اپنے پاس ورڈ سے سائن اِن کریں۔",
  "lock.notYou": "آپ نہیں ہیں، یا ان لاک نہیں ہو رہا؟",
  "lock.signOut": "سائن آؤٹ",
  "lock.signOutTitle": "Kalks سے سائن آؤٹ کریں؟",
  "lock.signOutBody": "آپ اپنی ای میل اور پاس ورڈ سے دوبارہ سائن اِن کریں گے۔ آپ کی پوزیشنز اور فنڈز متاثر نہیں ہوں گے۔",
  "lock.method.faceId": "Face ID",
  "lock.method.touchId": "Touch ID",
  "lock.method.fingerprint": "فنگر پرنٹ",
  "lock.method.face": "فیس ان لاک",
  "lock.method.iris": "آئرس",
  "lock.method.passcode": "پاس کوڈ",

  // Settings › App lock (/settings/app-lock)
  "settings.eyebrow": "سیکیورٹی",
  "settings.title": "ایپ لاک",
  "settings.subtitle": "Kalks کھلنے پر اور بیک گراؤنڈ میں رہنے کے بعد اسے {method} سے لاک رکھیں۔",
  "settings.toggle": "Kalks لاک کریں",
  "settings.toggleHint": "{method} استعمال کرتا ہے، اور متبادل کے طور پر آپ کے فون کا پاس کوڈ",
  "settings.on": "ایپ لاک آن ہے",
  "settings.off": "ایپ لاک آف ہے",
  "settings.after": "کتنی دیر بعد دوبارہ لاک ہو",
  "settings.afterHint": "Kalks دوبارہ پوچھنے سے پہلے کتنی دیر بیک گراؤنڈ میں رہ سکتا ہے۔ شروع ہوتے وقت یہ ہمیشہ پوچھتا ہے۔",
  "settings.timeout.0": "فوراً",
  "settings.timeout.60": "1 منٹ",
  "settings.timeout.300": "5 منٹ",
  "settings.timeout.900": "15 منٹ",
  "settings.timeout.3600": "1 گھنٹہ",
  "settings.privacy": "ایپ لاک آن ہونے پر ایپ سوئچر میں آپ کے بیلنس کی جگہ ایک پردہ دکھایا جاتا ہے۔",
  "settings.lockNow": "ابھی لاک کریں",
  "settings.confirmOn": "ایپ لاک آن کرنے کے لیے تصدیق کریں",
  "settings.confirmOff": "ایپ لاک آف کرنے کے لیے تصدیق کریں",
  // System prompt when the reader picks a longer "Lock again after" time
  "settings.confirmTimeout": "Kalks کے لاک ہونے کا وقت تبدیل کرنے کے لیے تصدیق کریں",
  // Toast body after a password sign-in on a phone whose screen lock was removed
  "settings.turnedOffNoScreenLock": "اس فون پر کوئی اسکرین لاک نہیں، اس لیے Kalks تصدیق نہیں کر سکتا کہ یہ آپ ہیں۔ ایپ لاک دوبارہ استعمال کرنے کے لیے اپنے فون کی سیٹنگز میں اسکرین لاک سیٹ کریں۔",
  "settings.notConfirmed": "تصدیق نہیں ہوئی، کچھ تبدیل نہیں ہوا",
  "settings.unavailableTitle": "پہلے اسکرین لاک سیٹ کریں",
  "settings.unavailableBody": "ایپ لاک آپ کے فون کا Face ID، فنگر پرنٹ یا پاس کوڈ استعمال کرتا ہے۔ اپنے فون کی سیٹنگز میں ان میں سے ایک آن کریں، پھر واپس آئیں۔",
  "settings.webTitle": "ایپ میں دستیاب",
  "settings.webBody": "ایپ لاک iPhone اور Android کے لیے Kalks ایپ میں کام کرتا ہے۔",
  "settings.thisPhone": "صرف اس فون پر لاگو ہوتا ہے",

  // Links that open the app but match no screen
  "link.notFound.title": "یہاں کھولنے کے لیے کچھ نہیں",
  "link.notFound.body": "یہ لنک ایپ کی کسی اسکرین سے میل نہیں کھاتا۔ ہو سکتا ہے یہ پرانا ہو، یا ویب پر کلائنٹ ایریا کے لیے ہو۔",
  "link.notFound.home": "ہوم پر جائیں",
  "link.openFailed": "یہ لنک نہیں کھل سکا۔",
};
export default mobilePlatform;
