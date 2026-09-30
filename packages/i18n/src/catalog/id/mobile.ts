import type { NsMessages } from "../../core";

// Kalks mobile app (apps/mobile): app shell, onboarding and the states every screen shares.
const mobile: NsMessages<"mobile"> = {
  // Tab bar (short: one word each)
  "tab.home": "Beranda",
  "tab.markets": "Pasar",
  "tab.trade": "Trading",
  "tab.portfolio": "Portofolio",
  "tab.more": "Lainnya",

  // Onboarding (3 slides). Titles are shown in tall uppercase display type: keep them short.
  "onboarding.skip": "Lewati",
  "onboarding.next": "Lanjut",
  "onboarding.getStarted": "Mulai",
  "onboarding.haveAccount": "Saya sudah punya akun",
  "onboarding.welcome.title": "Masuki pasar",
  "onboarding.welcome.body": "Forex, logam, indeks, energi, kripto, dan saham dalam satu akun, dengan pendanaan USDT instan.",
  "onboarding.markets.title": "Setiap tick, live",
  "onboarding.markets.body": "Harga bid dan ask nyata, grafik Anda sendiri, serta Buy dan Sell sekali ketuk, dirancang untuk ponsel.",
  "onboarding.security.title": "Terkunci rapat",
  "onboarding.security.body": "Kode email di perangkat baru, kode konfirmasi untuk penarikan, dan brankas aman untuk sesi Anda.",
  "onboarding.step": "{n} dari {total}", // slide counter, e.g. "1 dari 3"

  // Shared states
  "state.offline.title": "Koneksi terputus",
  "state.offline.body": "Periksa koneksi internet Anda. Harga dan akun Anda akan terhubung kembali secara otomatis.",
  "state.reconnecting": "Menghubungkan kembali…",
  "state.error.title": "Terjadi kesalahan",
  "state.error.body": "Kami tidak dapat memuat ini. Tarik ke bawah atau ketuk untuk mencoba lagi.",
  "state.maintenance.title": "Sedang pemeliharaan",
  "state.maintenance.body": "Kami sedang memperbarui Kalks. Posisi dan dana Anda aman. Silakan periksa kembali sebentar lagi.",
  "state.sessionExpired": "Sesi Anda telah berakhir. Silakan masuk kembali.",
  "state.updated": "Diperbarui {time}",
  "state.pullToRefresh": "Tarik untuk memuat ulang",

  "viewOnly": "Akses hanya-lihat",
  "viewOnlyBody": "Login ini dapat melihat akun yang dibagikan tetapi tidak dapat membuat perubahan.",

  // Common short labels
  "action.retry": "Coba lagi",
  "action.openWeb": "Buka di Client Area",
  "action.signOut": "Keluar",
  "action.seeAll": "Lihat semua",
  "a11y.close": "Tutup",
  "a11y.back": "Kembali",
};
export default mobile;
