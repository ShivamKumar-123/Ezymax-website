import type { NsMessages } from "../../core";

const dashboard: NsMessages<"dashboard"> = {
  // Page header (Client Area home). {name} = client's first name
  "greeting.morning": "Selamat pagi, {name}",
  "greeting.afternoon": "Selamat siang, {name}",
  "greeting.evening": "Selamat malam, {name}",
  "greeting.welcome": "Selamat datang, {name}",
  "subtitle.live": "Selamat datang di Kalks. Berikut akun Anda dan pasar hari ini.",
  "subtitle.demo": "Berikut kinerja akun Anda hari ini.",
  launchTrader: "Buka Kalks Trader",
  openTerminal: "Buka terminal trading",

  // Getting started checklist
  "steps.title": "Memulai",
  "steps.subtitle": "Kemajuan Anda menuju trading live",
  "steps.progress": "{done} dari {total}",
  "steps.account.title": "Buat akun Anda",
  "steps.account.text": "Terdaftar pada {date}.",
  "steps.email.title": "Verifikasi email Anda",
  "steps.email.verified": "{email} telah terverifikasi.",
  "steps.email.confirm": "Konfirmasi {email} dengan kode yang kami kirim kepada Anda.",
  "steps.kyc.title": "Verifikasi identitas Anda",
  "steps.kyc.verified": "Identitas Anda telah terverifikasi. Penarikan dana sudah dibuka.",
  "steps.kyc.moreInfo": "Tim kami memerlukan satu dokumen lagi dari Anda.",
  "steps.kyc.review": "Dokumen Anda sedang diperiksa oleh tim verifikasi kami.",
  "steps.kyc.draft": "Lanjutkan dari langkah terakhir. Butuh sekitar 3 menit.",
  "steps.kyc.rejected": "Kami tidak dapat memverifikasi dokumen Anda. Anda dapat memulai lagi.",
  "steps.kyc.todo": "Butuh sekitar 3 menit. Membuka akses penarikan dana.",
  "steps.accountOpen.title": "Buka akun trading",
  // {count} = live + demo accounts in total
  "steps.accountOpen.opened": { other: "{live} akun live dan {demo} akun demo terbuka." },
  "steps.accountOpen.todo": "Buka akun live atau demo; login Anda diterbitkan secara instan.",
  "steps.wallet.title": "Danai dompet Anda",
  "steps.wallet.text": "Deposit USDT melalui TRC20 sedang dihubungkan.",
  // Step status chips
  "steps.state.done": "Selesai",
  "steps.state.todo": "Belum",
  "steps.state.review": "Ditinjau",
  "steps.state.rejected": "Ditolak",
  "steps.state.soon": "Belum dimulai",

  // Trading accounts card. <b> wraps the equity amount
  "accounts.title": "Akun trading",
  "accounts.summary": "Ekuitas live <b>{equity}</b> · {live} live · {demo} demo · {positions} posisi terbuka",
  "accounts.subtitle": "Akun live dan demo Anda",
  "accounts.all": "Semua akun",
  "accounts.open": "Buka akun",
  "accounts.unavailable": "Akun trading sedang tidak tersedia. Saldo Anda aman.",
  "accounts.openLive.title": "Buka akun live",
  "accounts.openLive.text": "Pasar nyata. Dimulai dengan saldo nol; pendanaan dibuka bersama dompet.",
  "accounts.openDemo.title": "Buka akun demo",
  "accounts.openDemo.text": "Dana virtual dengan harga real-time, dapat diisi ulang setiap hari.",
  "accounts.more": { other: "{count} akun lainnya" },
  "accounts.myTitle": "Akun trading saya",

  // Your account card
  "account.title": "Akun Anda",
  "account.clientId": "ID klien",
  "account.emailStatus": "Status email",
  "account.notVerified": "Belum terverifikasi",
  "account.identity": "Identitas",
  "account.memberSince": "Anggota sejak",
  "account.profile": "Profil",

  // Kalks Trader banner
  "trader.chip": "Harga live",
  "trader.text": "Kuotasi dan grafik real-time untuk {count} instrumen di forex, logam, indeks, energi, kripto, dan saham. Berjalan di browser Anda, tanpa perlu instalasi.",

  // Market clock / heatmap
  "sessions.title": "Jam pasar",
  "sessions.open": "{open} dari {total} pasar buka",
  "heatmap.title": "Heatmap pasar",
  "heatmap.subtitle": "Pergerakan hari ini dari harga live · titik kosong: pasar tutup",
  "heatmap.up": "{count} naik",
  "heatmap.down": "{count} turun",
  "heatmap.allMarkets": "Semua pasar",
  "heatmap.tipOpen": "{symbol} · pasar buka",
  "heatmap.tipClosed": "{symbol} · pasar tutup, pergerakan sesi terakhir",

  // Support card. <mail> wraps the support email address
  "support.title": "Butuh bantuan?",
  "support.text": "Kirim email ke <mail>{email}</mail> dari alamat terdaftar Anda dan sertakan ID klien Anda.",
  "support.emailSupport": "Email dukungan",
  "support.copied": "Alamat email tersalin",
  "support.copyFailed": "Tidak dapat menyalin, silakan pilih alamatnya secara manual",

  // Demo dashboard: onboarding strip
  "onboarding.title": "Selesaikan pengaturan akun Anda",
  "onboarding.text": "Selesaikan KYC untuk membuka penarikan dana dan limit yang lebih tinggi.",
  "onboarding.progress": "Kemajuan",
  "onboarding.dismiss": "Tutup",

  // Margin health
  "margin.title": "Kesehatan margin",
  "margin.subtitle": "Di semua akun live",
  "margin.healthy": "Sehat",
  "margin.level": "Level margin",
  "margin.used": "Margin terpakai",
  "margin.free": "Margin bebas",

  // Equity / P&L. {range} = 1W, 1M, 3M, YTD, 1Y, ALL (keep as-is)
  "equity.title": "Total ekuitas",
  "equity.changeOver": "Perubahan selama {range}",
  "pnl.title": "Profit / rugi · bulan ini",
  "pnl.lowRisk": "Risiko rendah",
  "pnl.winRate": "Win rate (30h)",
  "pnl.trades": "Transaksi (30h)",
  "pnl.avgWin": "Rata-rata transaksi profit",
  "pnl.avgLoss": "Rata-rata transaksi rugi",
  "pnl.charges": "Biaya dibayar",

  // KPI cards
  "kpi.wallet": "Dompet",
  "kpi.today": "+{pct}% hari ini",
  "kpi.monthPnl": "P&L bulan ini",
  "kpi.vsLastMonth": "+{pct}% vs bulan lalu",
  "kpi.partnerEarnings": "Pendapatan mitra",
  // Copy = copy-trading earnings
  "kpi.copy": "Copy {amount}",

  // Top movers
  "movers.title": "Pergerakan teratas",
  "movers.gainers": "Naik",
  "movers.losers": "Turun",

  // Economic calendar. A = Actual, F = Forecast, P = Previous
  "calendar.title": "Kalender ekonomi",
  "calendar.subtitle": "Hari ini · waktu server GMT+3",
  "calendar.actual": "A {value} · ",
  "calendar.forecastPrevious": "F {forecast} · P {previous}",

  // News / world
  "news.title": "Berita pasar",
  "news.all": "Semua berita",
  "news.pinned": "Disematkan",
  "world.title": "Pasar & berita di seluruh dunia",
  "world.subtitle": "Berita terkini per negara dan sentimen mata uang",
  "world.stories": { other: "{count} berita hari ini" },

  // Open positions
  "positions.title": "Posisi terbuka",
  "positions.summary": { other: "{count} posisi · mengambang" },
  "positions.terminal": "Terminal",

  // Partner banner. <link> wraps the referral link
  "partner.chip": "Program mitra",
  "partner.title": "Ajak trader. Dapatkan hingga $15 per lot — seumur hidup.",
  "partner.text": "Komisi multi-tingkat, bonus CPA, dan pelacakan real-time. Tautan Anda: <link>{url}</link>",
  "partner.open": "Buka dasbor mitra",

  // Short relative times (m = minutes, h = hours, d = days)
  "time.justNow": "Baru saja",
  "time.minutesAgo": "{count} mnt lalu",
  "time.hoursAgo": "{count} jam lalu",
  "time.daysAgo": "{count} hr lalu",
  // {time} = sample value like "5m"
  "time.ago": "{time} lalu",

  // Notifications bell / panel
  "notifications.title": "Notifikasi",
  "notifications.ariaUnread": "Notifikasi, {count} belum dibaca",
  "notifications.markAll": "Tandai semua dibaca",
  "notifications.clear": "Hapus",
  "notifications.emptyTitle": "Belum ada notifikasi",
  "notifications.emptyText": "Deposit, penarikan dana, verifikasi, peringatan trading, dan balasan dari dukungan akan muncul di sini.",
  "notifications.settings": "Pengaturan notifikasi",
};
export default dashboard;
