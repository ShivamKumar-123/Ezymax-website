import type { NsMessages } from "../../core";

// Kalks mobile app: Home tab. Headings are shown in tall uppercase display type: keep them short.
const mobileHome: NsMessages<"mobileHome"> = {
  "greet.morning": "Selamat pagi, {name}",
  "greet.afternoon": "Selamat siang, {name}",
  "greet.evening": "Selamat malam, {name}",
  equity: "Ekuitas",
  closedToday: "Ditutup hari ini",
  openPnl: "P&L terbuka",
  allLive: "Semua akun live {amount}",
  "quick.deposit": "Deposit",
  "quick.withdraw": "Tarik",
  "quick.transfer": "Transfer",
  "quick.trade": "Trading",
  movers: "Pergerakan teratas",
  news: "Berita utama",
  allNews: "Semua berita",
  notifications: "Notifikasi",
  "kyc.title": "Verifikasi identitas Anda",
  "kyc.body": "Verifikasi membuka trading live dan penarikan dana. Hanya butuh beberapa menit.",
  "kyc.pending": "Verifikasi sedang ditinjau",
  "kyc.pendingBody": "Kami sedang memeriksa dokumen Anda. Anda akan mendapat notifikasi setelah selesai.",
  "kyc.action": "Lanjutkan",
  "noAccount.title": "Buka akun pertama Anda",
  "noAccount.body": "Akun demo siap dalam hitungan detik dengan dana virtual. Beralih ke live kapan pun Anda siap.",
  "noAccount.action": "Buka akun",
  "news.empty": "Belum ada berita utama saat ini.",
  "a11y.bell": "Notifikasi, {count} belum dibaca",

  // Explore: one colour block per module (title in display type on two short lines at most, hint on two lines)
  "explore.title": "Jelajahi",
  "explore.copy": "Copy trading",
  "explore.copyHint": "Ikuti trader yang terbukti",
  "explore.prop": "Prop challenge",
  "explore.propHint": "Dapatkan modal untuk trading",
  "explore.academy": "Academy",
  "explore.academyHint": "Belajar trading, langkah demi langkah",
  "explore.ai": "AI Trader",
  "explore.aiHint": "Ubah ide jadi strategi",
  "explore.invite": "Undang teman",
  "explore.inviteHint": "Dapat komisi saat mereka trading",
};
export default mobileHome;
