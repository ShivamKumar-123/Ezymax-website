import type { NsMessages } from "../../core";

// Kalks mobile app (src/features/platform): the notifications inbox, push notifications, the app lock
// (Face ID / fingerprint / the phone's passcode), "Continue with Google" and links that open the app.
// Brand and product names stay as they are: Kalks, Face ID, Touch ID, Google.
const mobilePlatform: NsMessages<"mobilePlatform"> = {
  // Notifications inbox (/notifications). Day headers above each group: Today, Yesterday, then the date.
  "inbox.eyebrow": "ইনবক্স",
  "inbox.unread": { one: "{count}টি অপঠিত", other: "{count}টি অপঠিত" },
  "inbox.caughtUp": "সব পড়া হয়ে গেছে",
  "inbox.filter.unread": "অপঠিত",
  "inbox.markedAll": "সব পঠিত হিসেবে চিহ্নিত",
  "inbox.emptyUnread.title": "সব পড়া হয়ে গেছে",
  "inbox.emptyUnread.body": "আপনি সব নোটিফিকেশন পড়েছেন। নতুনগুলো এলেই এখানে দেখা যাবে।",
  "inbox.loadMoreFailed": "পুরোনো নোটিফিকেশন লোড করা যায়নি। আবার চেষ্টা করতে ট্যাপ করুন।",
  // Under the title while the phone is offline and the inbox shows what it saved earlier
  "inbox.offlineCached": "আপনি অফলাইনে আছেন। এগুলো এই ফোনে সংরক্ষিত নোটিফিকেশন।",
  // Row accessibility: "Unread. Deposit credited. 100 USDT was credited. 2 minutes ago"
  "inbox.a11y.unread": "অপঠিত",
  "inbox.a11y.settings": "নোটিফিকেশন সেটিংস",
  // Detail sheet of a notification without a screen to open
  "inbox.detail.openWeb": "লিংক খুলুন",
  "inbox.detail.received": "প্রাপ্ত {time}",

  // Asking for push permission (never on the first launch): a sheet on Home and a card in the inbox
  "push.ask.eyebrow": "নোটিফিকেশন",
  "push.ask.title": "ঘটার সঙ্গে সঙ্গেই জানুন",
  "push.ask.body": "জমা ক্রেডিট, উত্তোলন পরিশোধ, মার্জিন কল, স্টপ-আউট ও সাপোর্টের উত্তর, সরাসরি আপনার লক স্ক্রিনে।",
  "push.ask.point.money": "জমা ও উত্তোলন",
  "push.ask.point.risk": "মার্জিন কল ও স্টপ-আউট",
  "push.ask.point.support": "সাপোর্টের উত্তর",
  "push.ask.allow": "নোটিফিকেশন চালু করুন",
  "push.ask.later": "এখন নয়",
  "push.ask.note": "প্রোফাইল › নোটিফিকেশন-এ বিষয়গুলো আপনি বেছে নেন। অফার শুধু আপনি চালু করলেই পাঠানো হয়।",
  // The sample notification drawn in the ask, as it would look on the lock screen ("now" = its time label)
  "push.ask.now": "এখন",
  "push.ask.sampleTitle": "জমা ক্রেডিট হয়েছে",
  "push.ask.sampleBody": "আপনার ওয়ালেটে 250.00 USDT ক্রেডিট হয়েছে।",
  "push.card.title": "পুশ নোটিফিকেশন চালু করুন",
  "push.card.body": "জমা, অর্ডার পূরণ ও মার্জিন কলের খবর আপনার লক স্ক্রিনে পান।",
  "push.card.action": "চালু করুন",
  "push.card.deniedTitle": "পুশ নোটিফিকেশন বন্ধ আছে",
  "push.card.deniedBody": "লক স্ক্রিনে পেতে আপনার ফোনের সেটিংসে Kalks-এর নোটিফিকেশনের অনুমতি দিন।",
  "push.card.deniedAction": "সেটিংস খুলুন",
  "push.card.dismiss": "লুকান",
  "push.enabled": "পুশ নোটিফিকেশন চালু হয়েছে",
  // Android notification channels (shown in the phone's settings for the app)
  "push.channel.alerts": "মার্জিন কল ও নিরাপত্তা",
  "push.channel.alertsHint": "মার্জিন কল ও স্টপ-আউট সতর্কতা, আপনার প্রাইস অ্যালার্ট, নতুন সাইন-ইন",
  "push.channel.activity": "অ্যাকাউন্ট কার্যকলাপ",
  "push.channel.activityHint": "জমা, উত্তোলন, অর্ডার পূরণ, ভেরিফিকেশন ও সাপোর্টের উত্তর",
  "push.channel.news": "খবর ও অফার",
  "push.channel.newsHint": "আপনার বেছে নেওয়া প্রমোশন ও প্রোডাক্টের খবর",
  // In-app banner for a push that arrives while the app is open
  "push.banner.a11y": "নতুন নোটিফিকেশন: {title}। খুলতে ডাবল ট্যাপ করুন।",

  // App lock screen (cold start, after the chosen time in the background, and /lock)
  "lock.eyebrow": "লক করা",
  "lock.title": "আবার স্বাগতম",
  "lock.subtitle": "আপনার অ্যাকাউন্ট ও ব্যালেন্স দেখতে আনলক করুন।",
  // {method}: Face ID, Touch ID, fingerprint, face unlock or passcode
  "lock.unlockWith": "{method} দিয়ে আনলক করুন",
  "lock.unlock": "আনলক",
  "lock.prompt": "Kalks আনলক করুন",
  "lock.promptSubtitle": "নিশ্চিত করুন যে এটি আপনি",
  "lock.failed": "কাজ হয়নি। আবার চেষ্টা করুন।",
  "lock.lockout": "অনেকবার চেষ্টা করা হয়েছে। পাসকোড দিয়ে ফোন আনলক করে আবার চেষ্টা করুন।",
  "lock.noScreenLock": "আপনার ফোনে আর কোনো স্ক্রিন লক নেই, তাই Kalks নিশ্চিত হতে পারছে না যে এটি আপনি। সাইন আউট করে পাসওয়ার্ড দিয়ে সাইন ইন করুন।",
  "lock.notYou": "আপনি নন, বা আনলক করতে পারছেন না?",
  "lock.signOut": "সাইন আউট",
  "lock.signOutTitle": "Kalks থেকে সাইন আউট করবেন?",
  "lock.signOutBody": "আপনাকে ইমেইল ও পাসওয়ার্ড দিয়ে আবার সাইন ইন করতে হবে। আপনার পজিশন ও ফান্ডে কোনো প্রভাব পড়বে না।",
  "lock.method.faceId": "Face ID",
  "lock.method.touchId": "Touch ID",
  "lock.method.fingerprint": "ফিঙ্গারপ্রিন্ট",
  "lock.method.face": "ফেস আনলক",
  "lock.method.iris": "আইরিস",
  "lock.method.passcode": "পাসকোড",

  // Settings › App lock (/settings/app-lock)
  "settings.eyebrow": "নিরাপত্তা",
  "settings.title": "অ্যাপ লক",
  "settings.subtitle": "খোলার সময় এবং ব্যাকগ্রাউন্ডে থাকার পর Kalks-কে {method} দিয়ে লক রাখুন।",
  "settings.toggle": "Kalks লক করুন",
  "settings.toggleHint": "{method} ব্যবহার করে, বিকল্প হিসেবে থাকে আপনার ফোনের পাসকোড",
  "settings.on": "অ্যাপ লক চালু",
  "settings.off": "অ্যাপ লক বন্ধ",
  "settings.after": "আবার লক হবে",
  "settings.afterHint": "আবার আনলক চাওয়ার আগে Kalks কতক্ষণ ব্যাকগ্রাউন্ডে থাকতে পারবে। অ্যাপ চালু হওয়ার সময় সবসময় আনলক চাওয়া হয়।",
  "settings.timeout.0": "সঙ্গে সঙ্গে",
  "settings.timeout.60": "1 মিনিট",
  "settings.timeout.300": "5 মিনিট",
  "settings.timeout.900": "15 মিনিট",
  "settings.timeout.3600": "1 ঘণ্টা",
  "settings.privacy": "অ্যাপ লক চালু থাকলে অ্যাপ সুইচারে আপনার ব্যালেন্সের বদলে একটি কভার দেখানো হয়।",
  "settings.lockNow": "এখনই লক করুন",
  "settings.confirmOn": "অ্যাপ লক চালু করতে নিশ্চিত করুন",
  "settings.confirmOff": "অ্যাপ লক বন্ধ করতে নিশ্চিত করুন",
  // System prompt when the reader picks a longer "Lock again after" time
  "settings.confirmTimeout": "Kalks কখন লক হবে তা পরিবর্তন করতে নিশ্চিত করুন",
  // Toast body after a password sign-in on a phone whose screen lock was removed (the app lock can't work without it)
  "settings.turnedOffNoScreenLock": "এই ফোনে কোনো স্ক্রিন লক নেই, তাই Kalks নিশ্চিত হতে পারছে না যে এটি আপনি। আবার অ্যাপ লক ব্যবহার করতে ফোনের সেটিংসে একটি স্ক্রিন লক সেট করুন।",
  "settings.notConfirmed": "নিশ্চিত করা হয়নি, কিছুই পরিবর্তন হয়নি",
  "settings.unavailableTitle": "আগে একটি স্ক্রিন লক সেট করুন",
  "settings.unavailableBody": "অ্যাপ লক আপনার ফোনের Face ID, ফিঙ্গারপ্রিন্ট বা পাসকোড ব্যবহার করে। ফোনের সেটিংসে এর একটি চালু করে ফিরে আসুন।",
  "settings.webTitle": "অ্যাপে উপলব্ধ",
  "settings.webBody": "অ্যাপ লক iPhone ও Android-এর Kalks অ্যাপে কাজ করে।",
  "settings.thisPhone": "শুধু এই ফোনে প্রযোজ্য",

  // Links that open the app (kalks://…, notification taps) but match no screen
  "link.notFound.title": "এখানে খোলার মতো কিছু নেই",
  "link.notFound.body": "এই লিংকটি অ্যাপের কোনো স্ক্রিনের সাথে মেলে না। এটি পুরোনো হতে পারে, অথবা ওয়েবের ক্লায়েন্ট এরিয়ার জন্য।",
  "link.notFound.home": "হোমে যান",
  "link.openFailed": "এই লিংকটি খোলা যায়নি।",
};
export default mobilePlatform;
