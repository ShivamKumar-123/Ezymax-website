import type { NsMessages } from "../../core";

// Kalks mobile app: Home tab. Headings are shown in tall uppercase display type: keep them short.
const mobileHome: NsMessages<"mobileHome"> = {
  "greet.morning": "Günaydın, {name}",
  "greet.afternoon": "İyi günler, {name}",
  "greet.evening": "İyi akşamlar, {name}",
  equity: "Varlık",
  closedToday: "Bugün kapanan",
  openPnl: "Açık K/Z",
  allLive: "Tüm gerçek hesaplar {amount}",
  "quick.deposit": "Para yatır",
  "quick.withdraw": "Para çek",
  "quick.transfer": "Transfer",
  "quick.trade": "İşlem yap",
  movers: "En hareketliler",
  news: "Manşetler",
  allNews: "Tüm haberler",
  notifications: "Bildirimler",
  "kyc.title": "Kimliğinizi doğrulayın",
  "kyc.body": "Doğrulama, gerçek işlem ve para çekmeyi açar. Birkaç dakika sürer.",
  "kyc.pending": "Doğrulama inceleniyor",
  "kyc.pendingBody": "Belgelerinizi kontrol ediyoruz. Tamamlandığında bildirim alacaksınız.",
  "kyc.action": "Devam",
  "noAccount.title": "İlk hesabınızı açın",
  "noAccount.body": "Sanal fonlu bir demo hesap saniyeler içinde açılır. Kendinizi hazır hissettiğinizde gerçek hesaba geçin.",
  "noAccount.action": "Hesap aç",
  "news.empty": "Şu anda manşet yok.",
  "a11y.bell": "Bildirimler, {count} okunmamış",

  // Explore: one colour block per module (title on two short lines at most, hint on two lines)
  "explore.title": "Keşfet",
  "explore.copy": "Copy trading",
  "explore.copyHint": "Başarılı trader'ları takip edin",
  "explore.prop": "Prop challenge",
  "explore.propHint": "Fonlanmış hesapla işlem yapın",
  "explore.academy": "Akademi",
  "explore.academyHint": "Adım adım işlem yapmayı öğrenin",
  "explore.ai": "AI Trader",
  "explore.aiHint": "Fikrinizi stratejiye dönüştürün",
  "explore.invite": "Arkadaş davet et",
  "explore.inviteHint": "Onlar işlem yaptıkça kazanın",
};
export default mobileHome;
