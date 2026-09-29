import type { NsMessages } from "../../core";

// Client Area support: live chat, launcher, support page.
const support: NsMessages<"support"> = {
  // Support page
  "page.title": "Destek",
  "page.subtitle": "Anında yanıt için Kalks AI ile sohbet edin. İstediğiniz an bir temsilci isteyebilirsiniz; ekibimiz sohbetin tamamını görerek devralır.",
  "email.prefer": "E-postayı mı tercih edersiniz?",
  // <email> and <id> wrap the client's email address and client ID
  "email.writeFrom": "<email>{email}</email> adresinden yazın ve müşteri numaranızı <id>{id}</id> ekleyin.",
  "email.write": "Desteğe yazın",
  "email.copyId": "Müşteri numarasını kopyala",
  clientId: "Müşteri numarası",
  notice: "Ekibimizin yanıtları bildirim zilinde de görünür; çevrimdışıyken size e-posta göndeririz. Bunu Profil → Bildirimler bölümünden değiştirebilirsiniz.",
  "toast.copied": "{what} kopyalandı",
  "toast.copyFailed": "Kopyalanamadı, lütfen metni seçin",

  // Conversation status
  "status.bot": "AI asistan",
  "status.waiting": "Sırada",
  "status.assigned": "Temsilcide",
  "status.resolved": "Sona erdi",

  // Conversation history
  "history.title": "Sohbetleriniz",
  "history.subtitle": "Sohbet kayıtları Müşteri Alanınızda saklanır",
  "history.emptyTitle": "Henüz sohbet yok",
  "history.emptyText": "Sohbette bir soru sorun, burada görünecektir.",
  conversation: "Sohbet",
  "toast.openFailed": "Sohbet açılamadı",

  // Floating button
  "launcher.open": "Destek sohbetini aç",
  "launcher.close": "Destek sohbetini kapat",

  // Chat
  you: "Siz",
  agent: "Temsilci",
  // Fallback name for a team member without a name
  supportName: "Destek",
  // File size, e.g. "120 KB · PDF"
  attachmentSize: "{size} KB · PDF",
  // Suggested first questions (sent as the client's message)
  "quick.verify": "Kimliğimi nasıl doğrularım?",
  "quick.deposit": "Nasıl USDT yatırırım?",
  "quick.withdrawal": "Çekimim ne zaman ulaşır?",
  "quick.stopOut": "Stop-out nedir?",
  "header.supportTeam": "Destek ekibi",
  "header.agentSub": "Müşteri Desteği · Kalks",
  "header.connecting": "Bir temsilciye bağlanıyorsunuz…",
  "header.replySoon": "Ekibimiz kısa süre içinde burada yanıt verecek",
  "header.helpCentre": "Yardım merkezi yanıtları · istediğiniz an bir temsilci katılabilir",
  "header.instant": "Anında yanıt · istediğiniz an bir temsilci katılabilir",
  "chip.liveAgent": "Canlı temsilci",
  "menu.aria": "Sohbet seçenekleri",
  "menu.talkToPerson": "Bir temsilciyle görüş",
  "menu.endChat": "Sohbeti bitir",
  "menu.newChat": "Yeni sohbet başlat",
  closeChat: "Sohbeti kapat",
  unavailable: "Sohbet şu anda kullanılamıyor.",
  greeting: "Merhaba {name}.",
  "csat.question": "Bu sohbet nasıldı?",
  "csat.stars": { one: "{count} yıldız", other: "{count} yıldız" },
  "csat.placeholder": "Eklemek istediğiniz bir şey var mı? (isteğe bağlı)",
  "csat.send": "Puanı gönder",
  "csat.rated": "Bu sohbete {rating}/5 puan verdiniz",
  "composer.attach": "Dosya ekle",
  "composer.messageTo": "{name} için mesaj…",
  "composer.newChat": "Yeni bir sohbet başlatın…",
  "composer.ask": "Sorunuzu yazın, {name} yanıtlasın…",
  "composer.aria": "Mesaj",
  disclaimer: "{name} hata yapabilir ve asla yatırım tavsiyesi vermez. Sohbetler kalite amacıyla kaydedilir.",
  "toast.chattingWith": "{name} ile sohbet ediyorsunuz",
  "toast.inQueue": "Bir temsilci için sıradasınız",
  "toast.notSent": "Mesaj gönderilemedi",
  "toast.teamUnreachable": "Ekibe ulaşılamadı",
  "toast.endFailed": "Sohbet sonlandırılamadı",
  "toast.rateFailed": "Puan kaydedilemedi",
  "toast.thanks": "Geri bildiriminiz için teşekkürler",
  "toast.fileTooLarge": "Dosya çok büyük",
  "toast.fileTooLargeText": "Dosyalar en fazla {mb} MB olabilir.",
  "toast.unsupported": "Desteklenmeyen dosya",
  "toast.unsupportedText": "Bir görsel (PNG, JPG, GIF, WEBP) veya PDF ekleyin.",
  "toast.uploadFailed": "Yükleme başarısız",
  "error.uploadFailed": "Yükleme başarısız.",
};
export default support;
