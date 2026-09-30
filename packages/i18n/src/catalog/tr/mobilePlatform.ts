import type { NsMessages } from "../../core";

// Kalks mobile app (apps/mobile, src/features/platform): the notifications inbox, push notifications, the app lock
// (Face ID / fingerprint / the phone's passcode), "Continue with Google" and links that open the app.
// Brand and product names stay as they are: Kalks, Face ID, Touch ID, Google.
const mobilePlatform: NsMessages<"mobilePlatform"> = {
  // Notifications inbox (/notifications). Day headers above each group: Today, Yesterday, then the date.
  "inbox.eyebrow": "Gelen kutusu",
  "inbox.unread": { one: "{count} okunmamış", other: "{count} okunmamış" },
  "inbox.caughtUp": "Tümü okundu",
  "inbox.filter.unread": "Okunmamış",
  "inbox.markedAll": "Tümü okundu olarak işaretlendi",
  "inbox.emptyUnread.title": "Tümü okundu",
  "inbox.emptyUnread.body": "Tüm bildirimleri okudunuz. Yenileri geldikçe burada görünür.",
  "inbox.loadMoreFailed": "Daha eski bildirimler yüklenemedi. Tekrar denemek için dokunun.",
  // Under the title while the phone is offline and the inbox shows what it saved earlier
  "inbox.offlineCached": "Çevrimdışısınız. Bunlar bu telefonda kayıtlı bildirimler.",
  // Row accessibility: "Okunmamış. Yatırım hesaba geçti. …"
  "inbox.a11y.unread": "Okunmamış",
  "inbox.a11y.settings": "Bildirim ayarları",
  // Detail sheet of a notification without a screen to open
  "inbox.detail.openWeb": "Bağlantıyı aç",
  "inbox.detail.received": "Alınma: {time}",

  // Asking for push permission (never on the first launch): a sheet on Home and a card in the inbox
  "push.ask.eyebrow": "Bildirimler",
  "push.ask.title": "Olduğu an haberiniz olsun",
  "push.ask.body": "Hesaba geçen yatırımlar, ödenen çekimler, margin call ve stop out uyarıları ile destek yanıtları doğrudan kilit ekranınıza gelsin.",
  "push.ask.point.money": "Para yatırma ve çekme",
  "push.ask.point.risk": "Margin call ve stop out",
  "push.ask.point.support": "Destek yanıtları",
  "push.ask.allow": "Bildirimleri aç",
  "push.ask.later": "Şimdi değil",
  "push.ask.note": "Konuları Profil › Bildirimler bölümünden seçersiniz. Teklifler yalnızca siz açarsanız gönderilir.",
  // The sample notification drawn in the ask, as it would look on the lock screen ("now" = its time label)
  "push.ask.now": "şimdi",
  "push.ask.sampleTitle": "Yatırım hesaba geçti",
  "push.ask.sampleBody": "Cüzdanınıza 250,00 USDT geçti.",
  "push.card.title": "Anlık bildirimleri açın",
  "push.card.body": "Yatırımları, gerçekleşen emirleri ve margin call uyarılarını kilit ekranınızda görün.",
  "push.card.action": "Aç",
  "push.card.deniedTitle": "Anlık bildirimler kapalı",
  "push.card.deniedBody": "Kilit ekranınızda görmek için telefonunuzun ayarlarından Kalks bildirimlerine izin verin.",
  "push.card.deniedAction": "Ayarları aç",
  "push.card.dismiss": "Gizle",
  "push.enabled": "Anlık bildirimler açık",
  // Android notification channels (shown in the phone's settings for the app)
  "push.channel.alerts": "Margin call ve güvenlik",
  "push.channel.alertsHint": "Margin call ve stop out uyarıları, fiyat uyarılarınız, yeni girişler",
  "push.channel.activity": "Hesap etkinliği",
  "push.channel.activityHint": "Para yatırma, çekme, gerçekleşen emirler, doğrulama ve destek yanıtları",
  "push.channel.news": "Haberler ve teklifler",
  "push.channel.newsHint": "Almayı seçtiğiniz promosyonlar ve ürün haberleri",
  // In-app banner for a push that arrives while the app is open
  "push.banner.a11y": "Yeni bildirim: {title}. Açmak için çift dokunun.",

  // App lock screen (cold start, after the chosen time in the background, and /lock)
  "lock.eyebrow": "Kilitli",
  "lock.title": "Tekrar hoş geldiniz",
  "lock.subtitle": "Hesaplarınızı ve bakiyelerinizi görmek için kilidi açın.",
  // {method}: Face ID, Touch ID, parmak izi, yüz tanıma or cihaz parolası
  "lock.unlockWith": "{method} ile kilidi aç",
  "lock.unlock": "Kilidi aç",
  "lock.prompt": "Kalks'ın kilidini açın",
  "lock.promptSubtitle": "Siz olduğunuzu doğrulayın",
  "lock.failed": "Doğrulanamadı. Tekrar deneyin.",
  "lock.lockout": "Çok fazla deneme. Telefonunuzun kilidini cihaz parolasıyla açın, ardından tekrar deneyin.",
  "lock.noScreenLock": "Telefonunuzda artık ekran kilidi yok, bu yüzden Kalks siz olduğunuzu doğrulayamıyor. Çıkış yapıp şifrenizle giriş yapın.",
  "lock.notYou": "Siz değil misiniz veya kilidi açamıyor musunuz?",
  "lock.signOut": "Çıkış yap",
  "lock.signOutTitle": "Kalks'tan çıkış yapılsın mı?",
  "lock.signOutBody": "E-postanız ve şifrenizle yeniden giriş yaparsınız. Pozisyonlarınız ve fonlarınız etkilenmez.",
  "lock.method.faceId": "Face ID",
  "lock.method.touchId": "Touch ID",
  "lock.method.fingerprint": "parmak izi",
  "lock.method.face": "yüz tanıma",
  "lock.method.iris": "iris",
  "lock.method.passcode": "cihaz parolası",

  // Settings › App lock (/settings/app-lock)
  "settings.eyebrow": "Güvenlik",
  "settings.title": "Uygulama kilidi",
  "settings.subtitle": "Kalks açıldığında ve arka planda kaldıktan sonra {method} ile kilitli kalsın.",
  "settings.toggle": "Kalks'ı kilitle",
  "settings.toggleHint": "{method} kullanılır; yedek yöntem cihaz parolanızdır",
  "settings.on": "Uygulama kilidi açık",
  "settings.off": "Uygulama kilidi kapalı",
  "settings.after": "Yeniden kilitleme",
  "settings.afterHint": "Kalks'ın tekrar sormadan önce arka planda ne kadar kalabileceği. Uygulama açılırken her zaman sorar.",
  "settings.timeout.0": "Hemen",
  "settings.timeout.60": "1 dakika",
  "settings.timeout.300": "5 dakika",
  "settings.timeout.900": "15 dakika",
  "settings.timeout.3600": "1 saat",
  "settings.privacy": "Uygulama kilidi açıkken uygulama değiştiricide bakiyeleriniz yerine bir kapak görünür.",
  "settings.lockNow": "Şimdi kilitle",
  "settings.confirmOn": "Uygulama kilidini açmak için onaylayın",
  "settings.confirmOff": "Uygulama kilidini kapatmak için onaylayın",
  // System prompt when the reader picks a longer "Lock again after" time
  "settings.confirmTimeout": "Kalks'ın ne zaman kilitleneceğini değiştirmek için onaylayın",
  // Toast body after a password sign-in on a phone whose screen lock was removed (the app lock can't work without it)
  "settings.turnedOffNoScreenLock": "Bu telefonda ekran kilidi yok, bu yüzden Kalks siz olduğunuzu doğrulayamıyor. Uygulama kilidini yeniden kullanmak için telefonunuzun ayarlarından bir ekran kilidi kurun.",
  "settings.notConfirmed": "Onaylanmadı, hiçbir şey değişmedi",
  "settings.unavailableTitle": "Önce ekran kilidi kurun",
  "settings.unavailableBody": "Uygulama kilidi telefonunuzun Face ID, parmak izi veya parola özelliğini kullanır. Telefonunuzun ayarlarından birini açın, sonra geri dönün.",
  "settings.webTitle": "Uygulamada kullanılabilir",
  "settings.webBody": "Uygulama kilidi, iPhone ve Android için Kalks uygulamasında çalışır.",
  "settings.thisPhone": "Yalnızca bu telefon için geçerlidir",

  // Links that open the app (kalks://…, notification taps) but match no screen
  "link.notFound.title": "Burada açılacak bir şey yok",
  "link.notFound.body": "Bu bağlantı uygulamadaki bir ekranla eşleşmiyor. Eski olabilir veya web'deki Müşteri Alanı için olabilir.",
  "link.notFound.home": "Ana sayfaya git",
  "link.openFailed": "Bu bağlantı açılamadı.",
};
export default mobilePlatform;
