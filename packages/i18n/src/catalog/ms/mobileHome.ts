import type { NsMessages } from "../../core";

// Kalks mobile app: Home tab. Headings are shown in tall uppercase display type: keep them short.
const mobileHome: NsMessages<"mobileHome"> = {
  "greet.morning": "Selamat pagi, {name}",
  "greet.afternoon": "Selamat petang, {name}",
  "greet.evening": "Selamat malam, {name}",
  equity: "Ekuiti",
  closedToday: "Ditutup hari ini",
  openPnl: "P&L terbuka",
  allLive: "Semua akaun sebenar {amount}",
  "quick.deposit": "Deposit",
  "quick.withdraw": "Keluarkan",
  "quick.transfer": "Pindah",
  "quick.trade": "Dagang",
  movers: "Pergerakan teratas",
  news: "Tajuk berita",
  allNews: "Semua berita",
  notifications: "Pemberitahuan",
  "kyc.title": "Sahkan identiti anda",
  "kyc.body": "Pengesahan membuka dagangan sebenar dan pengeluaran. Ia mengambil masa beberapa minit.",
  "kyc.pending": "Pengesahan sedang disemak",
  "kyc.pendingBody": "Kami sedang menyemak dokumen anda. Anda akan menerima pemberitahuan apabila ia selesai.",
  "kyc.action": "Teruskan",
  "noAccount.title": "Buka akaun pertama anda",
  "noAccount.body": "Akaun demo sedia dalam beberapa saat dengan dana maya. Beralih ke akaun sebenar apabila anda bersedia.",
  "noAccount.action": "Buka akaun",
  "news.empty": "Tiada tajuk berita buat masa ini.",
  "a11y.bell": "Pemberitahuan, {count} belum dibaca",

  // Explore: one colour block per module (title in display type on two short lines at most, hint on two lines)
  "explore.title": "Teroka",
  "explore.copy": "Copy trading",
  "explore.copyHint": "Ikuti pedagang terbukti",
  "explore.prop": "Cabaran prop",
  "explore.propHint": "Dapatkan dana untuk berdagang",
  "explore.academy": "Akademi",
  "explore.academyHint": "Belajar berdagang, langkah demi langkah",
  "explore.ai": "AI Trader",
  "explore.aiHint": "Jadikan idea sebagai strategi",
  "explore.invite": "Jemput rakan",
  "explore.inviteHint": "Peroleh apabila mereka berdagang",
};
export default mobileHome;
