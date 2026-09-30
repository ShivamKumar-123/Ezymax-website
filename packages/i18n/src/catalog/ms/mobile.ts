import type { NsMessages } from "../../core";

// Kalks mobile app (apps/mobile): app shell, onboarding and the states every screen shares.
const mobile: NsMessages<"mobile"> = {
  // Tab bar (short: one word each)
  "tab.home": "Utama",
  "tab.markets": "Pasaran",
  "tab.trade": "Dagangan",
  "tab.portfolio": "Portfolio",
  "tab.more": "Lagi",

  // Onboarding (3 slides). Titles are shown in tall uppercase display type: keep them short.
  "onboarding.skip": "Langkau",
  "onboarding.next": "Seterusnya",
  "onboarding.getStarted": "Mulakan",
  "onboarding.haveAccount": "Saya sudah ada akaun",
  "onboarding.welcome.title": "Masuki pasaran",
  "onboarding.welcome.body": "Forex, logam, indeks, tenaga, kripto dan saham dalam satu akaun, dengan pendanaan USDT segera.",
  "onboarding.markets.title": "Setiap tick, langsung",
  "onboarding.markets.body": "Harga bid dan ask sebenar, carta anda sendiri dan Beli serta Jual dengan satu ketikan, dibina untuk telefon.",
  "onboarding.security.title": "Terkunci rapi",
  "onboarding.security.body": "Kod e-mel pada peranti baharu, kod pengesahan untuk pengeluaran dan peti besi selamat untuk sesi anda.",
  "onboarding.step": "{n} daripada {total}", // slide counter, e.g. "1 daripada 3"

  // Shared states
  "state.offline.title": "Sambungan terputus",
  "state.offline.body": "Semak sambungan internet anda. Harga dan akaun anda akan disambung semula secara automatik.",
  "state.reconnecting": "Menyambung semula…",
  "state.error.title": "Berlaku ralat",
  "state.error.body": "Kami tidak dapat memuatkan ini. Tarik ke bawah atau ketik untuk cuba lagi.",
  "state.maintenance.title": "Dalam penyelenggaraan",
  "state.maintenance.body": "Kami sedang menaik taraf Kalks. Posisi dan dana anda selamat. Sila semak semula sebentar lagi.",
  "state.sessionExpired": "Sesi anda telah tamat. Sila log masuk semula.",
  "state.updated": "Dikemas kini {time}",
  "state.pullToRefresh": "Tarik untuk muat semula",

  "viewOnly": "Akses lihat sahaja",
  "viewOnlyBody": "Log masuk ini boleh melihat akaun yang dikongsi tetapi tidak boleh membuat perubahan.",

  // Common short labels
  "action.retry": "Cuba lagi",
  "action.openWeb": "Buka di Kawasan Pelanggan",
  "action.signOut": "Log keluar",
  "action.seeAll": "Lihat semua",
  "a11y.close": "Tutup",
  "a11y.back": "Kembali",
};
export default mobile;
