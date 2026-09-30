import type { NsMessages } from "../../core";

// Kalks mobile app: the notifications inbox, push notifications, the app lock (Face ID / fingerprint / the phone's
// passcode), "Continue with Google" and links that open the app. Kalks, Face ID, Touch ID and Google stay as they are.
const mobilePlatform: NsMessages<"mobilePlatform"> = {
  // Notifications inbox (/notifications). Day headers above each group: Today, Yesterday, then the date.
  "inbox.eyebrow": "กล่องข้อความ",
  "inbox.unread": { other: "ยังไม่อ่าน {count}" },
  "inbox.caughtUp": "อ่านครบแล้ว",
  "inbox.filter.unread": "ยังไม่อ่าน",
  "inbox.markedAll": "ทำเครื่องหมายว่าอ่านทั้งหมดแล้ว",
  "inbox.emptyUnread.title": "อ่านครบแล้ว",
  "inbox.emptyUnread.body": "คุณอ่านการแจ้งเตือนครบทุกรายการแล้ว รายการใหม่จะแสดงที่นี่เมื่อมาถึง",
  "inbox.loadMoreFailed": "ไม่สามารถโหลดการแจ้งเตือนที่เก่ากว่าได้ แตะเพื่อลองอีกครั้ง",
  // Under the title while the phone is offline and the inbox shows what it saved earlier
  "inbox.offlineCached": "คุณออฟไลน์อยู่ นี่คือการแจ้งเตือนที่บันทึกไว้ในโทรศัพท์เครื่องนี้",
  // Row accessibility
  "inbox.a11y.unread": "ยังไม่อ่าน",
  "inbox.a11y.settings": "การตั้งค่าการแจ้งเตือน",
  // Detail sheet of a notification without a screen to open
  "inbox.detail.openWeb": "เปิดลิงก์",
  "inbox.detail.received": "ได้รับ {time}",

  // Asking for push permission (never on the first launch): a sheet on Home and a card in the inbox
  "push.ask.eyebrow": "การแจ้งเตือน",
  "push.ask.title": "รู้ทันทีที่เกิดขึ้น",
  "push.ask.body": "เงินฝากเข้าบัญชี การถอนเงินที่จ่ายแล้ว Margin Call, Stop Out และการตอบกลับจากฝ่ายสนับสนุน ส่งตรงถึงหน้าจอล็อกของคุณ",
  "push.ask.point.money": "การฝากและถอนเงิน",
  "push.ask.point.risk": "Margin Call และ Stop Out",
  "push.ask.point.support": "การตอบกลับจากฝ่ายสนับสนุน",
  "push.ask.allow": "เปิดการแจ้งเตือน",
  "push.ask.later": "ไว้ทีหลัง",
  "push.ask.note": "เลือกหัวข้อได้ที่ โปรไฟล์ › การแจ้งเตือน ข้อเสนอพิเศษจะส่งถึงคุณเฉพาะเมื่อคุณเปิดรับเท่านั้น",
  // The sample notification drawn in the ask, as it would look on the lock screen ("now" = its time label)
  "push.ask.now": "ตอนนี้",
  "push.ask.sampleTitle": "เงินฝากเข้าบัญชีแล้ว",
  "push.ask.sampleBody": "250.00 USDT เข้าวอลเล็ตของคุณแล้ว",
  "push.card.title": "เปิดการแจ้งเตือนแบบพุช",
  "push.card.body": "รับการแจ้งเตือนเงินฝาก คำสั่งที่ถูกจับคู่ และ Margin Call บนหน้าจอล็อก",
  "push.card.action": "เปิด",
  "push.card.deniedTitle": "การแจ้งเตือนแบบพุชปิดอยู่",
  "push.card.deniedBody": "อนุญาตการแจ้งเตือนสำหรับ Kalks ในการตั้งค่าโทรศัพท์ เพื่อรับการแจ้งเตือนบนหน้าจอล็อก",
  "push.card.deniedAction": "เปิดการตั้งค่า",
  "push.card.dismiss": "ซ่อน",
  "push.enabled": "เปิดการแจ้งเตือนแบบพุชแล้ว",
  // Android notification channels (shown in the phone's settings for the app)
  "push.channel.alerts": "Margin Call และความปลอดภัย",
  "push.channel.alertsHint": "คำเตือน Margin Call และ Stop Out การแจ้งเตือนราคาของคุณ และการเข้าสู่ระบบใหม่",
  "push.channel.activity": "กิจกรรมบัญชี",
  "push.channel.activityHint": "การฝากเงิน การถอนเงิน คำสั่งที่ถูกจับคู่ การยืนยันตัวตน และการตอบกลับจากฝ่ายสนับสนุน",
  "push.channel.news": "ข่าวสารและข้อเสนอ",
  "push.channel.newsHint": "โปรโมชันและข่าวผลิตภัณฑ์ที่คุณเลือกรับ",
  // In-app banner for a push that arrives while the app is open
  "push.banner.a11y": "การแจ้งเตือนใหม่: {title} แตะสองครั้งเพื่อเปิด",

  // App lock screen (cold start, after the chosen time in the background, and /lock)
  "lock.eyebrow": "ล็อกอยู่",
  "lock.title": "ยินดีต้อนรับกลับมา",
  "lock.subtitle": "ปลดล็อกเพื่อดูบัญชีและยอดเงินของคุณ",
  // {method}: Face ID, Touch ID, fingerprint, face unlock or passcode
  "lock.unlockWith": "ปลดล็อกด้วย {method}",
  "lock.unlock": "ปลดล็อก",
  "lock.prompt": "ปลดล็อก Kalks",
  "lock.promptSubtitle": "ยืนยันว่าเป็นคุณ",
  "lock.failed": "ไม่สำเร็จ โปรดลองอีกครั้ง",
  "lock.lockout": "พยายามหลายครั้งเกินไป ปลดล็อกโทรศัพท์ด้วยรหัสเครื่องก่อน แล้วลองอีกครั้ง",
  "lock.noScreenLock": "โทรศัพท์ของคุณไม่มีการล็อกหน้าจอแล้ว Kalks จึงยืนยันว่าเป็นคุณไม่ได้ โปรดออกจากระบบแล้วเข้าสู่ระบบใหม่ด้วยรหัสผ่าน",
  "lock.notYou": "ไม่ใช่คุณ หรือปลดล็อกไม่ได้?",
  "lock.signOut": "ออกจากระบบ",
  "lock.signOutTitle": "ออกจากระบบ Kalks ใช่ไหม",
  "lock.signOutBody": "คุณจะต้องเข้าสู่ระบบอีกครั้งด้วยอีเมลและรหัสผ่าน สถานะและเงินทุนของคุณจะไม่ได้รับผลกระทบ",
  "lock.method.faceId": "Face ID",
  "lock.method.touchId": "Touch ID",
  "lock.method.fingerprint": "ลายนิ้วมือ",
  "lock.method.face": "ใบหน้า",
  "lock.method.iris": "ม่านตา",
  "lock.method.passcode": "รหัสเครื่อง",

  // Settings › App lock (/settings/app-lock)
  "settings.eyebrow": "ความปลอดภัย",
  "settings.title": "ล็อกแอป",
  "settings.subtitle": "ล็อก Kalks ด้วย {method} เมื่อเปิดแอปและหลังจากแอปอยู่ในพื้นหลัง",
  "settings.toggle": "ล็อก Kalks",
  "settings.toggleHint": "ใช้ {method} โดยมีรหัสเครื่องเป็นทางเลือกสำรอง",
  "settings.on": "เปิดการล็อกแอปแล้ว",
  "settings.off": "ปิดการล็อกแอปอยู่",
  "settings.after": "ล็อกอีกครั้งหลังจาก",
  "settings.afterHint": "ระยะเวลาที่ Kalks อยู่ในพื้นหลังได้ก่อนจะขอยืนยันอีกครั้ง แอปจะขอยืนยันทุกครั้งที่เปิดใหม่",
  "settings.timeout.0": "ทันที",
  "settings.timeout.60": "1 นาที",
  "settings.timeout.300": "5 นาที",
  "settings.timeout.900": "15 นาที",
  "settings.timeout.3600": "1 ชั่วโมง",
  "settings.privacy": "ขณะที่เปิดการล็อกแอป หน้าสลับแอปจะแสดงหน้าปกแทนยอดเงินของคุณ",
  "settings.lockNow": "ล็อกตอนนี้",
  "settings.confirmOn": "ยืนยันเพื่อเปิดการล็อกแอป",
  "settings.confirmOff": "ยืนยันเพื่อปิดการล็อกแอป",
  // System prompt when the reader picks a longer "Lock again after" time
  "settings.confirmTimeout": "ยืนยันเพื่อเปลี่ยนเวลาล็อก Kalks",
  // Toast body after a password sign-in on a phone whose screen lock was removed
  "settings.turnedOffNoScreenLock": "โทรศัพท์นี้ไม่มีการล็อกหน้าจอ Kalks จึงยืนยันว่าเป็นคุณไม่ได้ ตั้งค่าการล็อกหน้าจอในการตั้งค่าโทรศัพท์เพื่อใช้การล็อกแอปอีกครั้ง",
  "settings.notConfirmed": "ไม่ได้ยืนยัน ไม่มีการเปลี่ยนแปลง",
  "settings.unavailableTitle": "ตั้งค่าการล็อกหน้าจอก่อน",
  "settings.unavailableBody": "การล็อกแอปใช้ Face ID ลายนิ้วมือ หรือรหัสเครื่องของโทรศัพท์ เปิดใช้อย่างใดอย่างหนึ่งในการตั้งค่าโทรศัพท์ แล้วกลับมาที่นี่",
  "settings.webTitle": "ใช้ได้ในแอป",
  "settings.webBody": "การล็อกแอปใช้งานได้ในแอป Kalks สำหรับ iPhone และ Android",
  "settings.thisPhone": "ใช้กับโทรศัพท์เครื่องนี้เท่านั้น",

  // Links that open the app (kalks://…, notification taps) but match no screen
  "link.notFound.title": "ไม่มีหน้าให้เปิด",
  "link.notFound.body": "ลิงก์นี้ไม่ตรงกับหน้าจอใดในแอป อาจเป็นลิงก์เก่า หรือมีไว้สำหรับพื้นที่ลูกค้าบนเว็บ",
  "link.notFound.home": "ไปที่หน้าหลัก",
  "link.openFailed": "ไม่สามารถเปิดลิงก์นี้ได้",
};
export default mobilePlatform;
