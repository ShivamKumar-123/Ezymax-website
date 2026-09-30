import type { NsMessages } from "../../core";

// Kalks mobile app (apps/mobile, src/features/platform): the notifications inbox, push notifications, the app lock
// (Face ID / fingerprint / the phone's passcode), "Continue with Google" and links that open the app.
// Brand and product names stay as they are: Kalks, Face ID, Touch ID, Google.
const mobilePlatform: NsMessages<"mobilePlatform"> = {
  // Notifications inbox (/notifications). Day headers above each group: Today, Yesterday, then the date.
  "inbox.eyebrow": "صندوق الوارد",
  "inbox.unread": {
    zero: "لا توجد إشعارات غير مقروءة",
    one: "إشعار واحد غير مقروء",
    two: "إشعاران غير مقروءين",
    few: "{count} إشعارات غير مقروءة",
    many: "{count} إشعارًا غير مقروء",
    other: "{count} إشعار غير مقروء",
  },
  "inbox.caughtUp": "لا شيء جديد",
  "inbox.filter.unread": "غير المقروءة",
  "inbox.markedAll": "تم تحديد الكل كمقروء",
  "inbox.emptyUnread.title": "لا شيء جديد",
  "inbox.emptyUnread.body": "قرأت كل الإشعارات. تظهر الإشعارات الجديدة هنا فور وصولها.",
  "inbox.loadMoreFailed": "تعذّر تحميل الإشعارات الأقدم. اضغط للمحاولة مرة أخرى.",
  // Under the title while the phone is offline and the inbox shows what it saved earlier
  "inbox.offlineCached": "أنت غير متصل. هذه هي الإشعارات المحفوظة على هذا الهاتف.",
  // Row accessibility: "غير مقروء. تمت إضافة الإيداع. …"
  "inbox.a11y.unread": "غير مقروء",
  "inbox.a11y.settings": "إعدادات الإشعارات",
  // Detail sheet of a notification without a screen to open
  "inbox.detail.openWeb": "فتح الرابط",
  "inbox.detail.received": "تم الاستلام {time}",

  // Asking for push permission (never on the first launch): a sheet on Home and a card in the inbox
  "push.ask.eyebrow": "الإشعارات",
  "push.ask.title": "اعرف لحظة حدوثه",
  "push.ask.body": "الإيداعات المضافة وعمليات السحب المدفوعة ونداءات الهامش والإيقاف الإجباري وردود الدعم، مباشرة إلى شاشة القفل.",
  "push.ask.point.money": "الإيداعات وعمليات السحب",
  "push.ask.point.risk": "نداءات الهامش والإيقاف الإجباري",
  "push.ask.point.support": "ردود الدعم",
  "push.ask.allow": "تفعيل الإشعارات",
  "push.ask.later": "ليس الآن",
  "push.ask.note": "تختار المواضيع من الملف الشخصي ← الإشعارات. لا تُرسل العروض إلا إذا فعّلتها.",
  // The sample notification drawn in the ask, as it would look on the lock screen ("now" = its time label)
  "push.ask.now": "الآن",
  "push.ask.sampleTitle": "تمت إضافة الإيداع",
  "push.ask.sampleBody": "تمت إضافة 250.00 USDT إلى محفظتك.",
  "push.card.title": "فعّل الإشعارات الفورية",
  "push.card.body": "استلم الإيداعات وتنفيذ الأوامر ونداءات الهامش على شاشة القفل.",
  "push.card.action": "تفعيل",
  "push.card.deniedTitle": "الإشعارات الفورية متوقفة",
  "push.card.deniedBody": "اسمح بإشعارات Kalks في إعدادات هاتفك لتصلك على شاشة القفل.",
  "push.card.deniedAction": "فتح الإعدادات",
  "push.card.dismiss": "إخفاء",
  "push.enabled": "الإشعارات الفورية مفعّلة",
  // Android notification channels (shown in the phone's settings for the app)
  "push.channel.alerts": "نداءات الهامش والأمان",
  "push.channel.alertsHint": "تحذيرات نداء الهامش والإيقاف الإجباري، وتنبيهات الأسعار الخاصة بك، وتسجيلات الدخول الجديدة",
  "push.channel.activity": "نشاط الحساب",
  "push.channel.activityHint": "الإيداعات وعمليات السحب وتنفيذ الأوامر والتحقق وردود الدعم",
  "push.channel.news": "الأخبار والعروض",
  "push.channel.newsHint": "العروض الترويجية وأخبار المنتجات التي اشتركت فيها",
  // In-app banner for a push that arrives while the app is open
  "push.banner.a11y": "إشعار جديد: {title}. اضغط مرتين للفتح.",

  // App lock screen (cold start, after the chosen time in the background, and /lock)
  "lock.eyebrow": "مقفل",
  "lock.title": "مرحبًا بعودتك",
  "lock.subtitle": "افتح القفل لعرض حساباتك وأرصدتك.",
  // {method}: Face ID, Touch ID, fingerprint, face unlock or passcode
  "lock.unlockWith": "فتح القفل باستخدام {method}",
  "lock.unlock": "فتح القفل",
  "lock.prompt": "فتح قفل Kalks",
  "lock.promptSubtitle": "أكّد أنك أنت",
  "lock.failed": "لم ينجح ذلك. حاول مرة أخرى.",
  "lock.lockout": "محاولات كثيرة جدًا. افتح قفل هاتفك برمز المرور، ثم حاول مرة أخرى.",
  "lock.noScreenLock": "لم يعد لهاتفك قفل شاشة، لذا لا يمكن لـ Kalks التأكد من هويتك. سجّل الخروج ثم سجّل الدخول بكلمة المرور.",
  "lock.notYou": "لست أنت، أو تعذّر فتح القفل؟",
  "lock.signOut": "تسجيل الخروج",
  "lock.signOutTitle": "تسجيل الخروج من Kalks؟",
  "lock.signOutBody": "ستسجّل الدخول مجددًا ببريدك الإلكتروني وكلمة المرور. لن تتأثر صفقاتك وأموالك.",
  "lock.method.faceId": "Face ID",
  "lock.method.touchId": "Touch ID",
  "lock.method.fingerprint": "بصمة الإصبع",
  "lock.method.face": "التعرّف على الوجه",
  "lock.method.iris": "بصمة القزحية",
  "lock.method.passcode": "رمز المرور",

  // Settings › App lock (/settings/app-lock)
  "settings.eyebrow": "الأمان",
  "settings.title": "قفل التطبيق",
  "settings.subtitle": "أبقِ Kalks مقفلًا باستخدام {method} عند فتحه وبعد بقائه في الخلفية.",
  "settings.toggle": "قفل Kalks",
  "settings.toggleHint": "يستخدم {method}، مع رمز مرور هاتفك كبديل",
  "settings.on": "قفل التطبيق مفعّل",
  "settings.off": "قفل التطبيق متوقف",
  "settings.after": "إعادة القفل بعد",
  "settings.afterHint": "المدة التي يمكن أن يبقى فيها Kalks في الخلفية قبل أن يطلب فتح القفل مجددًا. يطلبه دائمًا عند التشغيل.",
  "settings.timeout.0": "فورًا",
  "settings.timeout.60": "دقيقة واحدة",
  "settings.timeout.300": "5 دقائق",
  "settings.timeout.900": "15 دقيقة",
  "settings.timeout.3600": "ساعة واحدة",
  "settings.privacy": "أثناء تفعيل قفل التطبيق، يعرض مبدّل التطبيقات غطاءً بدلًا من أرصدتك.",
  "settings.lockNow": "القفل الآن",
  "settings.confirmOn": "أكّد لتفعيل قفل التطبيق",
  "settings.confirmOff": "أكّد لإيقاف قفل التطبيق",
  // System prompt when the reader picks a longer "Lock again after" time
  "settings.confirmTimeout": "أكّد لتغيير توقيت قفل Kalks",
  // Toast body after a password sign-in on a phone whose screen lock was removed (the app lock can't work without it)
  "settings.turnedOffNoScreenLock": "لا يوجد قفل شاشة على هذا الهاتف، لذا لا يمكن لـ Kalks التأكد من هويتك. اضبط قفلًا في إعدادات هاتفك لاستخدام قفل التطبيق مجددًا.",
  "settings.notConfirmed": "لم يتم التأكيد، ولم يتغيّر شيء",
  "settings.unavailableTitle": "اضبط قفل الشاشة أولًا",
  "settings.unavailableBody": "يستخدم قفل التطبيق Face ID أو بصمة الإصبع أو رمز المرور في هاتفك. فعّل أحدها في إعدادات هاتفك، ثم عُد إلى هنا.",
  "settings.webTitle": "متاح في التطبيق",
  "settings.webBody": "يعمل قفل التطبيق في تطبيق Kalks لأجهزة iPhone وAndroid.",
  "settings.thisPhone": "ينطبق على هذا الهاتف فقط",

  // Links that open the app (kalks://…, notification taps) but match no screen
  "link.notFound.title": "لا يوجد ما يُفتح هنا",
  "link.notFound.body": "لا يطابق هذا الرابط أي شاشة في التطبيق. ربما يكون قديمًا، أو مخصصًا لمنطقة العملاء على الويب.",
  "link.notFound.home": "الانتقال إلى الرئيسية",
  "link.openFailed": "تعذّر فتح هذا الرابط.",
};
export default mobilePlatform;
