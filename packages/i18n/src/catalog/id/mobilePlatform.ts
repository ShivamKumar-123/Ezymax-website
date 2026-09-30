import type { NsMessages } from "../../core";

// Kalks mobile app: notifications inbox, push notifications, app lock (Face ID / fingerprint / passcode),
// "Continue with Google" and links that open the app. Keep Kalks, Face ID, Touch ID and Google as they are.
// iOS / Android terms: kode sandi = passcode, sidik jari = fingerprint, layar kunci = lock screen.
const mobilePlatform: NsMessages<"mobilePlatform"> = {
  // Notifications inbox (/notifications)
  "inbox.eyebrow": "Kotak masuk",
  "inbox.unread": { other: "{count} belum dibaca" },
  "inbox.caughtUp": "Semua sudah dibaca",
  "inbox.filter.unread": "Belum dibaca",
  "inbox.markedAll": "Semua ditandai sudah dibaca",
  "inbox.emptyUnread.title": "Semua sudah dibaca",
  "inbox.emptyUnread.body": "Anda sudah membaca semua notifikasi. Notifikasi baru muncul di sini saat tiba.",
  "inbox.loadMoreFailed": "Tidak dapat memuat notifikasi yang lebih lama. Ketuk untuk mencoba lagi.",
  // Under the title while the phone is offline and the inbox shows what it saved earlier
  "inbox.offlineCached": "Anda sedang offline. Ini adalah notifikasi yang tersimpan di ponsel ini.",
  // Row accessibility: "Belum dibaca. Deposit dikreditkan. ..."
  "inbox.a11y.unread": "Belum dibaca",
  "inbox.a11y.settings": "Pengaturan notifikasi",
  // Detail sheet of a notification without a screen to open
  "inbox.detail.openWeb": "Buka tautan",
  "inbox.detail.received": "Diterima {time}",

  // Asking for push permission: a sheet on Home and a card in the inbox
  "push.ask.eyebrow": "Notifikasi",
  "push.ask.title": "Tahu saat itu juga",
  "push.ask.body": "Deposit dikreditkan, penarikan dibayarkan, margin call, stop-out, dan balasan dukungan, langsung ke layar kunci Anda.",
  "push.ask.point.money": "Deposit dan penarikan",
  "push.ask.point.risk": "Margin call dan stop-out",
  "push.ask.point.support": "Balasan dari dukungan",
  "push.ask.allow": "Aktifkan notifikasi",
  "push.ask.later": "Nanti saja",
  "push.ask.note": "Anda memilih topiknya di Profil › Notifikasi. Penawaran hanya dikirim jika Anda mengaktifkannya.",
  // The sample notification drawn in the ask, as it would look on the lock screen ("now" = its time label)
  "push.ask.now": "sekarang",
  "push.ask.sampleTitle": "Deposit dikreditkan",
  "push.ask.sampleBody": "250.00 USDT telah dikreditkan ke dompet Anda.",
  "push.card.title": "Aktifkan notifikasi push",
  "push.card.body": "Dapatkan deposit, eksekusi order, dan margin call di layar kunci Anda.",
  "push.card.action": "Aktifkan",
  "push.card.deniedTitle": "Notifikasi push nonaktif",
  "push.card.deniedBody": "Izinkan notifikasi untuk Kalks di pengaturan ponsel Anda agar notifikasi muncul di layar kunci.",
  "push.card.deniedAction": "Buka pengaturan",
  "push.card.dismiss": "Sembunyikan",
  "push.enabled": "Notifikasi push aktif",
  // Android notification channels (shown in the phone's settings for the app)
  "push.channel.alerts": "Margin call dan keamanan",
  "push.channel.alertsHint": "Peringatan margin call dan stop-out, peringatan harga Anda, login baru",
  "push.channel.activity": "Aktivitas akun",
  "push.channel.activityHint": "Deposit, penarikan, eksekusi order, verifikasi, dan balasan dukungan",
  "push.channel.news": "Berita dan penawaran",
  "push.channel.newsHint": "Promosi dan berita produk yang Anda pilih untuk diterima",
  // In-app banner for a push that arrives while the app is open
  "push.banner.a11y": "Notifikasi baru: {title}. Ketuk dua kali untuk membuka.",

  // App lock screen
  "lock.eyebrow": "Terkunci",
  "lock.title": "Selamat datang kembali",
  "lock.subtitle": "Buka kunci untuk melihat akun dan saldo Anda.",
  // {method}: Face ID, Touch ID, sidik jari, pengenalan wajah or kode sandi
  "lock.unlockWith": "Buka kunci dengan {method}",
  "lock.unlock": "Buka kunci",
  "lock.prompt": "Buka kunci Kalks",
  "lock.promptSubtitle": "Konfirmasi bahwa ini Anda",
  "lock.failed": "Tidak berhasil. Coba lagi.",
  "lock.lockout": "Terlalu banyak percobaan. Buka kunci ponsel Anda dengan kode sandinya, lalu coba lagi.",
  "lock.noScreenLock": "Ponsel Anda tidak lagi memiliki kunci layar, sehingga Kalks tidak dapat mengonfirmasi bahwa ini Anda. Keluar lalu masuk dengan kata sandi Anda.",
  "lock.notYou": "Bukan Anda, atau tidak bisa membuka kunci?",
  "lock.signOut": "Keluar",
  "lock.signOutTitle": "Keluar dari Kalks?",
  "lock.signOutBody": "Anda akan masuk lagi dengan email dan kata sandi. Posisi dan dana Anda tidak terpengaruh.",
  "lock.method.faceId": "Face ID",
  "lock.method.touchId": "Touch ID",
  "lock.method.fingerprint": "sidik jari",
  "lock.method.face": "pengenalan wajah",
  "lock.method.iris": "iris",
  "lock.method.passcode": "kode sandi",

  // Settings › App lock (/settings/app-lock)
  "settings.eyebrow": "Keamanan",
  "settings.title": "Kunci aplikasi",
  "settings.subtitle": "Kunci Kalks dengan {method} saat dibuka dan setelah berada di latar belakang.",
  "settings.toggle": "Kunci Kalks",
  "settings.toggleHint": "Menggunakan {method}, dengan kode sandi ponsel sebagai cadangan",
  "settings.on": "Kunci aplikasi aktif",
  "settings.off": "Kunci aplikasi nonaktif",
  "settings.after": "Kunci lagi setelah",
  "settings.afterHint": "Berapa lama Kalks boleh berada di latar belakang sebelum meminta konfirmasi lagi. Kalks selalu meminta konfirmasi saat dibuka.",
  "settings.timeout.0": "Segera",
  "settings.timeout.60": "1 menit",
  "settings.timeout.300": "5 menit",
  "settings.timeout.900": "15 menit",
  "settings.timeout.3600": "1 jam",
  "settings.privacy": "Selama kunci aplikasi aktif, pengalih aplikasi menampilkan penutup, bukan saldo Anda.",
  "settings.lockNow": "Kunci sekarang",
  "settings.confirmOn": "Konfirmasi untuk mengaktifkan kunci aplikasi",
  "settings.confirmOff": "Konfirmasi untuk menonaktifkan kunci aplikasi",
  // System prompt when the reader picks a longer "Lock again after" time
  "settings.confirmTimeout": "Konfirmasi untuk mengubah waktu penguncian Kalks",
  // Toast body after a password sign-in on a phone whose screen lock was removed
  "settings.turnedOffNoScreenLock": "Ponsel ini tidak memiliki kunci layar, sehingga Kalks tidak dapat mengonfirmasi bahwa ini Anda. Atur kunci layar di pengaturan ponsel untuk menggunakan kunci aplikasi lagi.",
  "settings.notConfirmed": "Tidak dikonfirmasi, tidak ada yang berubah",
  "settings.unavailableTitle": "Atur kunci layar terlebih dahulu",
  "settings.unavailableBody": "Kunci aplikasi menggunakan Face ID, sidik jari, atau kode sandi ponsel Anda. Aktifkan salah satunya di pengaturan ponsel, lalu kembali ke sini.",
  "settings.webTitle": "Tersedia di aplikasi",
  "settings.webBody": "Kunci aplikasi berfungsi di aplikasi Kalks untuk iPhone dan Android.",
  "settings.thisPhone": "Hanya berlaku untuk ponsel ini",

  // Links that open the app but match no screen
  "link.notFound.title": "Tidak ada yang dapat dibuka",
  "link.notFound.body": "Tautan ini tidak cocok dengan layar mana pun di aplikasi. Tautan mungkin sudah lama, atau ditujukan untuk Client Area di web.",
  "link.notFound.home": "Ke Beranda",
  "link.openFailed": "Tidak dapat membuka tautan ini.",
};
export default mobilePlatform;
