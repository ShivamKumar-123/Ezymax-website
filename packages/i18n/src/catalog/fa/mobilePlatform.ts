import type { NsMessages } from "../../core";

// Kalks mobile app: notifications inbox, push notifications, the app lock (Face ID / fingerprint / passcode),
// "Continue with Google" and links that open the app.
// Keep brand and product names as they are: Kalks, Face ID, Touch ID, Google.
const mobilePlatform: NsMessages<"mobilePlatform"> = {
  // Notifications inbox (/notifications)
  "inbox.eyebrow": "صندوق پیام",
  "inbox.unread": { one: "{count} خوانده‌نشده", other: "{count} خوانده‌نشده" },
  "inbox.caughtUp": "همه را خوانده‌اید",
  "inbox.filter.unread": "خوانده‌نشده",
  "inbox.markedAll": "همه به‌عنوان خوانده‌شده علامت خوردند",
  "inbox.emptyUnread.title": "همه را خوانده‌اید",
  "inbox.emptyUnread.body": "همه اعلان‌ها را خوانده‌اید. اعلان‌های جدید به محض رسیدن اینجا نمایش داده می‌شوند.",
  "inbox.loadMoreFailed": "بارگذاری اعلان‌های قدیمی‌تر انجام نشد. برای تلاش دوباره ضربه بزنید.",
  // Under the title while the phone is offline and the inbox shows what it saved earlier
  "inbox.offlineCached": "آفلاین هستید. این‌ها اعلان‌های ذخیره‌شده در این گوشی هستند.",
  "inbox.a11y.unread": "خوانده‌نشده",
  "inbox.a11y.settings": "تنظیمات اعلان‌ها",
  // Detail sheet of a notification without a screen to open
  "inbox.detail.openWeb": "باز کردن لینک",
  "inbox.detail.received": "دریافت {time}",

  // Asking for push permission: a sheet on Home and a card in the inbox
  "push.ask.eyebrow": "اعلان‌ها",
  "push.ask.title": "همان لحظه باخبر شوید",
  "push.ask.body": "ثبت واریزها، پرداخت برداشت‌ها، مارجین کال، استاپ‌اوت و پاسخ‌های پشتیبانی، مستقیم روی صفحه قفل شما.",
  "push.ask.point.money": "واریزها و برداشت‌ها",
  "push.ask.point.risk": "مارجین کال و استاپ‌اوت",
  "push.ask.point.support": "پاسخ‌های پشتیبانی",
  "push.ask.allow": "روشن کردن اعلان‌ها",
  "push.ask.later": "اکنون نه",
  "push.ask.note": "موضوعات را در پروفایل › اعلان‌ها انتخاب می‌کنید. پیشنهادها فقط در صورت فعال کردن شما ارسال می‌شوند.",
  // The sample notification drawn on the lock screen ("now" = its time label)
  "push.ask.now": "اکنون",
  "push.ask.sampleTitle": "واریز ثبت شد",
  "push.ask.sampleBody": "250.00 USDT به کیف پول شما واریز شد.",
  "push.card.title": "روشن کردن اعلان‌های پوش",
  "push.card.body": "واریزها، اجرای سفارش‌ها و مارجین کال را روی صفحه قفل دریافت کنید.",
  "push.card.action": "روشن کردن",
  "push.card.deniedTitle": "اعلان‌های پوش خاموش است",
  "push.card.deniedBody": "برای دریافت اعلان‌ها روی صفحه قفل، در تنظیمات گوشی به Kalks اجازه ارسال اعلان بدهید.",
  "push.card.deniedAction": "باز کردن تنظیمات",
  "push.card.dismiss": "پنهان کردن",
  "push.enabled": "اعلان‌های پوش روشن است",
  // Android notification channels (shown in the phone's settings for the app)
  "push.channel.alerts": "مارجین کال و امنیت",
  "push.channel.alertsHint": "هشدارهای مارجین کال و استاپ‌اوت، هشدارهای قیمت شما، ورودهای جدید",
  "push.channel.activity": "فعالیت حساب",
  "push.channel.activityHint": "واریزها، برداشت‌ها، اجرای سفارش‌ها، احراز هویت و پاسخ‌های پشتیبانی",
  "push.channel.news": "اخبار و پیشنهادها",
  "push.channel.newsHint": "تبلیغات و اخبار محصول که آن‌ها را فعال کرده‌اید",
  // In-app banner for a push that arrives while the app is open
  "push.banner.a11y": "اعلان جدید: {title}. برای باز کردن دو بار ضربه بزنید.",

  // App lock screen
  "lock.eyebrow": "قفل‌شده",
  "lock.title": "خوش برگشتید",
  "lock.subtitle": "برای دیدن حساب‌ها و موجودی‌ها قفل را باز کنید.",
  // {method}: Face ID, Touch ID, fingerprint, face unlock or passcode
  "lock.unlockWith": "باز کردن قفل با {method}",
  "lock.unlock": "باز کردن قفل",
  "lock.prompt": "باز کردن قفل Kalks",
  "lock.promptSubtitle": "تأیید کنید که خودتان هستید",
  "lock.failed": "انجام نشد. دوباره تلاش کنید.",
  "lock.lockout": "تلاش‌ها بیش از حد مجاز است. قفل گوشی را با رمز آن باز کنید و دوباره تلاش کنید.",
  "lock.noScreenLock": "گوشی شما دیگر قفل صفحه ندارد، پس Kalks نمی‌تواند هویت شما را تأیید کند. خارج شوید و با رمز عبور خود وارد شوید.",
  "lock.notYou": "شما نیستید یا قفل باز نمی‌شود؟",
  "lock.signOut": "خروج",
  "lock.signOutTitle": "از Kalks خارج می‌شوید؟",
  "lock.signOutBody": "دوباره با ایمیل و رمز عبور خود وارد می‌شوید. پوزیشن‌ها و وجوه شما تحت تأثیر قرار نمی‌گیرند.",
  "lock.method.faceId": "Face ID",
  "lock.method.touchId": "Touch ID",
  "lock.method.fingerprint": "اثر انگشت",
  "lock.method.face": "تشخیص چهره",
  "lock.method.iris": "عنبیه",
  "lock.method.passcode": "رمز گوشی",

  // Settings › App lock (/settings/app-lock)
  "settings.eyebrow": "امنیت",
  "settings.title": "قفل برنامه",
  "settings.subtitle": "Kalks را هنگام باز شدن و پس از قرار گرفتن در پس‌زمینه با {method} قفل نگه دارید.",
  "settings.toggle": "قفل Kalks",
  "settings.toggleHint": "از {method} استفاده می‌کند و رمز گوشی به‌عنوان جایگزین",
  "settings.on": "قفل برنامه روشن است",
  "settings.off": "قفل برنامه خاموش است",
  "settings.after": "قفل دوباره پس از",
  "settings.afterHint": "مدت زمانی که Kalks می‌تواند در پس‌زمینه بماند تا دوباره تأیید بخواهد. هنگام شروع همیشه تأیید می‌خواهد.",
  "settings.timeout.0": "فوراً",
  "settings.timeout.60": "1 دقیقه",
  "settings.timeout.300": "5 دقیقه",
  "settings.timeout.900": "15 دقیقه",
  "settings.timeout.3600": "1 ساعت",
  "settings.privacy": "وقتی قفل برنامه روشن است، فهرست برنامه‌های باز به‌جای موجودی‌های شما یک پوشش نشان می‌دهد.",
  "settings.lockNow": "قفل همین حالا",
  "settings.confirmOn": "برای روشن کردن قفل برنامه تأیید کنید",
  "settings.confirmOff": "برای خاموش کردن قفل برنامه تأیید کنید",
  // System prompt when the reader picks a longer "Lock again after" time
  "settings.confirmTimeout": "برای تغییر زمان قفل شدن Kalks تأیید کنید",
  "settings.turnedOffNoScreenLock": "این گوشی قفل صفحه ندارد، پس Kalks نمی‌تواند هویت شما را تأیید کند. برای استفاده دوباره از قفل برنامه، در تنظیمات گوشی یک قفل صفحه تنظیم کنید.",
  "settings.notConfirmed": "تأیید نشد، تغییری ایجاد نشد",
  "settings.unavailableTitle": "ابتدا قفل صفحه را تنظیم کنید",
  "settings.unavailableBody": "قفل برنامه از Face ID، اثر انگشت یا رمز گوشی شما استفاده می‌کند. یکی را در تنظیمات گوشی فعال کنید و بازگردید.",
  "settings.webTitle": "در برنامه در دسترس است",
  "settings.webBody": "قفل برنامه در اپلیکیشن Kalks برای iPhone و Android کار می‌کند.",
  "settings.thisPhone": "فقط برای این گوشی اعمال می‌شود",

  // Links that open the app (kalks://…, notification taps) but match no screen
  "link.notFound.title": "چیزی برای باز کردن نیست",
  "link.notFound.body": "این لینک با هیچ صفحه‌ای در برنامه مطابقت ندارد. ممکن است قدیمی باشد یا برای پنل کاربری وب باشد.",
  "link.notFound.home": "رفتن به خانه",
  "link.openFailed": "باز کردن این لینک انجام نشد.",
};
export default mobilePlatform;
