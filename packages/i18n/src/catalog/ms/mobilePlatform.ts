import type { NsMessages } from "../../core";

// Kalks mobile app (apps/mobile, src/features/platform): the notifications inbox, push notifications, the app lock
// (Face ID / fingerprint / the phone's passcode), "Continue with Google" and links that open the app.
// Brand and product names stay as they are: Kalks, Face ID, Touch ID, Google.
const mobilePlatform: NsMessages<"mobilePlatform"> = {
  // Notifications inbox (/notifications). Day headers above each group: Today, Yesterday, then the date.
  "inbox.eyebrow": "Peti masuk",
  "inbox.unread": { other: "{count} belum dibaca" },
  "inbox.caughtUp": "Semua sudah dibaca",
  "inbox.filter.unread": "Belum dibaca",
  "inbox.markedAll": "Semua ditanda sudah dibaca",
  "inbox.emptyUnread.title": "Semua sudah dibaca",
  "inbox.emptyUnread.body": "Anda telah membaca setiap pemberitahuan. Pemberitahuan baharu dipaparkan di sini sebaik sahaja tiba.",
  "inbox.loadMoreFailed": "Tidak dapat memuatkan pemberitahuan lama. Ketik untuk cuba lagi.",
  // Under the title while the phone is offline and the inbox shows what it saved earlier
  "inbox.offlineCached": "Anda di luar talian. Ini ialah pemberitahuan yang disimpan pada telefon ini.",
  // Row accessibility: "Belum dibaca. Deposit dikreditkan. …"
  "inbox.a11y.unread": "Belum dibaca",
  "inbox.a11y.settings": "Tetapan pemberitahuan",
  // Detail sheet of a notification without a screen to open
  "inbox.detail.openWeb": "Buka pautan",
  "inbox.detail.received": "Diterima {time}",

  // Asking for push permission (never on the first launch): a sheet on Home and a card in the inbox
  "push.ask.eyebrow": "Pemberitahuan",
  "push.ask.title": "Tahu sebaik sahaja ia berlaku",
  "push.ask.body": "Deposit dikreditkan, pengeluaran dibayar, margin call, stop-out dan balasan sokongan, terus ke skrin kunci anda.",
  "push.ask.point.money": "Deposit dan pengeluaran",
  "push.ask.point.risk": "Margin call dan stop-out",
  "push.ask.point.support": "Balasan daripada sokongan",
  "push.ask.allow": "Hidupkan pemberitahuan",
  "push.ask.later": "Bukan sekarang",
  "push.ask.note": "Anda memilih topik di Profil › Pemberitahuan. Tawaran hanya dihantar jika anda menghidupkannya.",
  // The sample notification drawn in the ask, as it would look on the lock screen ("now" = its time label)
  "push.ask.now": "kini",
  "push.ask.sampleTitle": "Deposit dikreditkan",
  "push.ask.sampleBody": "250.00 USDT telah dikreditkan ke dompet anda.",
  "push.card.title": "Hidupkan pemberitahuan tolak",
  "push.card.body": "Terima deposit, pelaksanaan dan margin call pada skrin kunci anda.",
  "push.card.action": "Hidupkan",
  "push.card.deniedTitle": "Pemberitahuan tolak dimatikan",
  "push.card.deniedBody": "Benarkan pemberitahuan untuk Kalks dalam tetapan telefon anda untuk menerimanya pada skrin kunci.",
  "push.card.deniedAction": "Buka tetapan",
  "push.card.dismiss": "Sembunyi",
  "push.enabled": "Pemberitahuan tolak dihidupkan",
  // Android notification channels (shown in the phone's settings for the app)
  "push.channel.alerts": "Margin call dan keselamatan",
  "push.channel.alertsHint": "Amaran margin call dan stop-out, amaran harga anda, log masuk baharu",
  "push.channel.activity": "Aktiviti akaun",
  "push.channel.activityHint": "Deposit, pengeluaran, pelaksanaan, pengesahan dan balasan sokongan",
  "push.channel.news": "Berita dan tawaran",
  "push.channel.newsHint": "Promosi dan berita produk yang anda langgan",
  // In-app banner for a push that arrives while the app is open
  "push.banner.a11y": "Pemberitahuan baharu: {title}. Ketik dua kali untuk membuka.",

  // App lock screen (cold start, after the chosen time in the background, and /lock)
  "lock.eyebrow": "Dikunci",
  "lock.title": "Selamat kembali",
  "lock.subtitle": "Buka kunci untuk melihat akaun dan baki anda.",
  // {method}: Face ID, Touch ID, fingerprint, face unlock or passcode
  "lock.unlockWith": "Buka kunci dengan {method}",
  "lock.unlock": "Buka kunci",
  "lock.prompt": "Buka kunci Kalks",
  "lock.promptSubtitle": "Sahkan bahawa ini anda",
  "lock.failed": "Itu tidak berjaya. Cuba lagi.",
  "lock.lockout": "Terlalu banyak cubaan. Buka kunci telefon anda dengan kod laluannya, kemudian cuba lagi.",
  "lock.noScreenLock": "Telefon anda tidak lagi mempunyai kunci skrin, jadi Kalks tidak dapat mengesahkan bahawa ini anda. Log keluar dan log masuk dengan kata laluan anda.",
  "lock.notYou": "Bukan anda, atau tidak dapat membuka kunci?",
  "lock.signOut": "Log keluar",
  "lock.signOutTitle": "Log keluar daripada Kalks?",
  "lock.signOutBody": "Anda akan log masuk semula dengan e-mel dan kata laluan anda. Posisi dan dana anda tidak terjejas.",
  "lock.method.faceId": "Face ID",
  "lock.method.touchId": "Touch ID",
  "lock.method.fingerprint": "cap jari",
  "lock.method.face": "buka kunci wajah",
  "lock.method.iris": "iris",
  "lock.method.passcode": "kod laluan",

  // Settings › App lock (/settings/app-lock)
  "settings.eyebrow": "Keselamatan",
  "settings.title": "Kunci aplikasi",
  "settings.subtitle": "Pastikan Kalks dikunci dengan {method} apabila dibuka dan selepas berada di latar belakang.",
  "settings.toggle": "Kunci Kalks",
  "settings.toggleHint": "Menggunakan {method}, dengan kod laluan telefon anda sebagai sandaran",
  "settings.on": "Kunci aplikasi hidup",
  "settings.off": "Kunci aplikasi mati",
  "settings.after": "Kunci semula selepas",
  "settings.afterHint": "Berapa lama Kalks boleh kekal di latar belakang sebelum ia meminta semula. Ia sentiasa meminta semasa dimulakan.",
  "settings.timeout.0": "Serta-merta",
  "settings.timeout.60": "1 minit",
  "settings.timeout.300": "5 minit",
  "settings.timeout.900": "15 minit",
  "settings.timeout.3600": "1 jam",
  "settings.privacy": "Semasa kunci aplikasi hidup, penukar aplikasi memaparkan penutup dan bukannya baki anda.",
  "settings.lockNow": "Kunci sekarang",
  "settings.confirmOn": "Sahkan untuk menghidupkan kunci aplikasi",
  "settings.confirmOff": "Sahkan untuk mematikan kunci aplikasi",
  // System prompt when the reader picks a longer "Lock again after" time
  "settings.confirmTimeout": "Sahkan untuk menukar bila Kalks dikunci",
  // Toast body after a password sign-in on a phone whose screen lock was removed (the app lock can't work without it)
  "settings.turnedOffNoScreenLock": "Telefon ini tiada kunci skrin, jadi Kalks tidak dapat mengesahkan bahawa ini anda. Tetapkan satu dalam tetapan telefon anda untuk menggunakan kunci aplikasi semula.",
  "settings.notConfirmed": "Tidak disahkan, tiada apa-apa yang berubah",
  "settings.unavailableTitle": "Tetapkan kunci skrin dahulu",
  "settings.unavailableBody": "Kunci aplikasi menggunakan Face ID, cap jari atau kod laluan telefon anda. Hidupkan salah satu dalam tetapan telefon anda, kemudian kembali ke sini.",
  "settings.webTitle": "Tersedia dalam aplikasi",
  "settings.webBody": "Kunci aplikasi berfungsi dalam aplikasi Kalks untuk iPhone dan Android.",
  "settings.thisPhone": "Terpakai pada telefon ini sahaja",

  // Links that open the app (kalks://…, notification taps) but match no screen
  "link.notFound.title": "Tiada apa-apa untuk dibuka di sini",
  "link.notFound.body": "Pautan ini tidak sepadan dengan mana-mana skrin dalam aplikasi. Ia mungkin sudah lama, atau ditujukan untuk Kawasan Pelanggan di web.",
  "link.notFound.home": "Pergi ke Utama",
  "link.openFailed": "Tidak dapat membuka pautan ini.",
};
export default mobilePlatform;
