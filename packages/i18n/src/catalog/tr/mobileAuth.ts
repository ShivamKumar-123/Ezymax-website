import type { NsMessages } from "../../core";

// Kalks mobile app: sign in, sign up and password reset (most texts reuse the `auth` namespace).
const mobileAuth: NsMessages<"mobileAuth"> = {
  eyebrow: "Kalks",
  "signIn.create": "Hesap oluştur",
  "signIn.newHere": "Kalks'ta yeni misiniz?",
  "signUp.eyebrow": "Hesabınızı açın",
  "signUp.haveAccount": "Zaten hesabınız var mı?",
  "signUp.signIn": "Giriş yap",
  "signUp.dobPlaceholder": "YYYY-AA-GG",
  "signUp.dobHint": "En az 18 yaşında olmalısınız.",
  "signUp.phonePlaceholder": "Telefon numarası",
  "signUp.marketing": "İşlem ipuçları, ürün haberleri ve teklifler bana e-postayla gönderilsin. Abonelikten istediğiniz zaman çıkabilirsiniz.",
  "signUp.chooseCountry": "Ülkenizi seçin",
  "signUp.continue": "Kalks'a devam et",
  "forgot.eyebrow": "Şifre sıfırlama",
  "forgot.continue": "Devam",
  "otp.eyebrow": "Güvenlik kontrolü",
  "otp.wrongEmail": "Farklı bir e-posta kullan",
  "googleSoon": "Google ile giriş, web'deki Müşteri Alanı'nda kullanılabilir.",
};
export default mobileAuth;
