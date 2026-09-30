import type { NsMessages } from "../../core";

// Kalks mobile app (apps/mobile): app shell, onboarding and the states every screen shares.
const mobile: NsMessages<"mobile"> = {
  // Tab bar (short: one word each)
  "tab.home": "Ana sayfa",
  "tab.markets": "Piyasalar",
  "tab.trade": "İşlem",
  "tab.portfolio": "Portföy",
  "tab.more": "Diğer",

  // Onboarding (3 slides). Titles are shown in tall uppercase display type: keep them short.
  "onboarding.skip": "Atla",
  "onboarding.next": "İleri",
  "onboarding.getStarted": "Başla",
  "onboarding.haveAccount": "Hesabım var",
  "onboarding.welcome.title": "Piyasalara adım atın",
  "onboarding.welcome.body": "Forex, metaller, endeksler, enerji, kripto ve hisseler tek hesapta; USDT ile anında fonlama.",
  "onboarding.markets.title": "Her tik, canlı",
  "onboarding.markets.body": "Gerçek bid ve ask fiyatları, kendi grafikleriniz ve tek dokunuşla Al ve Sat; telefon için tasarlandı.",
  "onboarding.security.title": "Kilit altında",
  "onboarding.security.body": "Yeni cihazlarda e-posta kodu, para çekimlerinde onay kodu ve oturumunuz için güvenli kasa.",
  "onboarding.step": "{n} / {total}", // slide counter, e.g. "1 / 3"

  // Shared states
  "state.offline.title": "Bağlantı kesildi",
  "state.offline.body": "İnternet bağlantınızı kontrol edin. Fiyatlar ve hesabınız otomatik olarak yeniden bağlanır.",
  "state.reconnecting": "Yeniden bağlanıyor…",
  "state.error.title": "Bir sorun oluştu",
  "state.error.body": "Bu içerik yüklenemedi. Tekrar denemek için aşağı çekin veya dokunun.",
  "state.maintenance.title": "Bakımdayız",
  "state.maintenance.body": "Kalks'ı güncelliyoruz. Pozisyonlarınız ve fonlarınız güvende. Lütfen kısa süre sonra tekrar bakın.",
  "state.sessionExpired": "Oturumunuz sona erdi. Lütfen tekrar giriş yapın.",
  "state.updated": "Son güncelleme: {time}",
  "state.pullToRefresh": "Yenilemek için aşağı çekin",

  "viewOnly": "Salt görüntüleme erişimi",
  "viewOnlyBody": "Bu giriş, paylaşılan hesapları görüntüleyebilir ancak değişiklik yapamaz.",

  // Common short labels
  "action.retry": "Tekrar deneyin",
  "action.openWeb": "Müşteri Alanı'nda aç",
  "action.signOut": "Çıkış yap",
  "action.seeAll": "Tümünü gör",
  "a11y.close": "Kapat",
  "a11y.back": "Geri",
};
export default mobile;
