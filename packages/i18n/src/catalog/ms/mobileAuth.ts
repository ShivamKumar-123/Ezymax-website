import type { NsMessages } from "../../core";

// Kalks mobile app: sign in, sign up and password reset (most texts reuse the `auth` namespace).
const mobileAuth: NsMessages<"mobileAuth"> = {
  eyebrow: "Kalks",
  "signIn.create": "Cipta akaun",
  "signIn.newHere": "Baharu di Kalks?",
  "signUp.eyebrow": "Buka akaun anda",
  "signUp.haveAccount": "Sudah mempunyai akaun?",
  "signUp.signIn": "Log masuk",
  "signUp.dobPlaceholder": "TTTT-BB-HH",
  "signUp.dobHint": "Anda mesti berumur 18 tahun ke atas.",
  "signUp.phonePlaceholder": "Nombor telefon",
  "signUp.marketing": "Hantarkan saya tip dagangan, berita produk dan tawaran melalui e-mel. Nyahlanggan bila-bila masa.",
  "signUp.chooseCountry": "Pilih negara anda",
  "signUp.continue": "Teruskan ke Kalks",
  "forgot.eyebrow": "Set semula kata laluan",
  "forgot.continue": "Teruskan",
  "otp.eyebrow": "Semakan keselamatan",
  "otp.wrongEmail": "Guna e-mel lain",
  "googleSoon": "Log masuk Google tersedia di Kawasan Pelanggan di web.",
};
export default mobileAuth;
