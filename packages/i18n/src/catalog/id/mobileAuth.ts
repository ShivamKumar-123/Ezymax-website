import type { NsMessages } from "../../core";

// Kalks mobile app: sign in, sign up and password reset (most texts reuse the `auth` namespace).
// YYYY-MM-DD is written TTTT-BB-HH (tahun-bulan-hari).
const mobileAuth: NsMessages<"mobileAuth"> = {
  eyebrow: "Kalks",
  "signIn.create": "Buat akun",
  "signIn.newHere": "Baru di Kalks?",
  "signUp.eyebrow": "Buka akun Anda",
  "signUp.haveAccount": "Sudah punya akun?",
  "signUp.signIn": "Masuk",
  "signUp.dobPlaceholder": "TTTT-BB-HH",
  "signUp.dobHint": "Anda harus berusia minimal 18 tahun.",
  "signUp.phonePlaceholder": "Nomor telepon",
  "signUp.marketing": "Kirimi saya tips trading, berita produk, dan penawaran melalui email. Berhenti berlangganan kapan saja.",
  "signUp.chooseCountry": "Pilih negara Anda",
  "signUp.continue": "Lanjut ke Kalks",
  "forgot.eyebrow": "Atur ulang kata sandi",
  "forgot.continue": "Lanjutkan",
  "otp.eyebrow": "Pemeriksaan keamanan",
  "otp.wrongEmail": "Gunakan email lain",
  googleSoon: "Masuk dengan Google tersedia di Client Area versi web.",
};
export default mobileAuth;
