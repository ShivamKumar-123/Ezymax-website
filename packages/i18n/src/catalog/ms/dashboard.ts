import type { NsMessages } from "../../core";

const dashboard: NsMessages<"dashboard"> = {
  // Page header (Client Area home). {name} = client's first name
  "greeting.morning": "Selamat pagi, {name}",
  "greeting.afternoon": "Selamat petang, {name}",
  "greeting.evening": "Selamat malam, {name}",
  "greeting.welcome": "Selamat datang, {name}",
  "subtitle.live": "Selamat datang ke Kalks. Berikut ialah akaun anda dan pasaran hari ini.",
  "subtitle.demo": "Berikut ialah prestasi akaun anda hari ini.",
  launchTrader: "Lancarkan Kalks Trader",
  openTerminal: "Buka terminal dagangan",

  // Getting started checklist
  "steps.title": "Bermula",
  "steps.subtitle": "Kemajuan anda ke arah dagangan sebenar",
  "steps.progress": "{done} daripada {total}",
  "steps.account.title": "Cipta akaun anda",
  "steps.account.text": "Didaftarkan pada {date}.",
  "steps.email.title": "Sahkan e-mel anda",
  "steps.email.verified": "{email} telah disahkan.",
  "steps.email.confirm": "Sahkan {email} dengan kod yang kami hantar kepada anda.",
  "steps.kyc.title": "Sahkan identiti anda",
  "steps.kyc.verified": "Identiti anda telah disahkan. Pengeluaran telah dibuka.",
  "steps.kyc.moreInfo": "Pasukan kami memerlukan satu lagi dokumen daripada anda.",
  "steps.kyc.review": "Dokumen anda sedang disemak oleh pasukan pengesahan kami.",
  "steps.kyc.draft": "Sambung dari tempat anda berhenti. Mengambil masa kira-kira 3 minit.",
  "steps.kyc.rejected": "Kami tidak dapat mengesahkan dokumen anda. Anda boleh mulakan semula.",
  "steps.kyc.todo": "Mengambil masa kira-kira 3 minit. Membuka pengeluaran.",
  "steps.accountOpen.title": "Buka akaun dagangan",
  "steps.accountOpen.opened": { other: "{live} akaun sebenar dan {demo} akaun demo dibuka." },
  "steps.accountOpen.todo": "Buka akaun sebenar atau demo; log masuk anda dikeluarkan dengan segera.",
  "steps.wallet.title": "Dana dompet anda",
  "steps.wallet.text": "Deposit USDT melalui TRC20 sedang disambungkan.",
  // Step status chips
  "steps.state.done": "Selesai",
  "steps.state.todo": "Perlu dibuat",
  "steps.state.review": "Sedang disemak",
  "steps.state.rejected": "Ditolak",
  "steps.state.soon": "Belum bermula",

  // Trading accounts card. <b> wraps the equity amount
  "accounts.title": "Akaun dagangan",
  "accounts.summary": "Ekuiti sebenar <b>{equity}</b> · {live} sebenar · {demo} demo · {positions} posisi terbuka",
  "accounts.subtitle": "Akaun sebenar dan demo anda",
  "accounts.all": "Semua akaun",
  "accounts.open": "Buka akaun",
  "accounts.unavailable": "Akaun dagangan tidak tersedia buat masa ini. Baki anda selamat.",
  "accounts.openLive.title": "Buka akaun sebenar",
  "accounts.openLive.text": "Pasaran sebenar. Bermula dengan baki sifar; pendanaan dibuka bersama dompet.",
  "accounts.openDemo.title": "Buka akaun demo",
  "accounts.openDemo.text": "Dana maya pada harga masa nyata, boleh diisi semula setiap hari.",
  "accounts.more": { other: "{count} akaun lagi" },
  "accounts.myTitle": "Akaun dagangan saya",

  // Your account card
  "account.title": "Akaun anda",
  "account.clientId": "ID pelanggan",
  "account.emailStatus": "Status e-mel",
  "account.notVerified": "Belum disahkan",
  "account.identity": "Identiti",
  "account.memberSince": "Ahli sejak",
  "account.profile": "Profil",

  // Kalks Trader banner
  "trader.chip": "Harga langsung",
  "trader.text": "Sebut harga dan carta masa nyata untuk {count} instrumen merentasi forex, logam, indeks, tenaga, kripto dan saham. Berjalan dalam pelayar anda, tiada apa-apa untuk dipasang.",

  // Market clock / heatmap
  "sessions.title": "Jam pasaran",
  "sessions.open": "{open} daripada {total} pasaran dibuka",
  "heatmap.title": "Peta haba pasaran",
  "heatmap.subtitle": "Pergerakan hari ini daripada harga langsung · titik kosong: pasaran ditutup",
  "heatmap.up": "{count} naik",
  "heatmap.down": "{count} turun",
  "heatmap.allMarkets": "Semua pasaran",
  "heatmap.tipOpen": "{symbol} · pasaran dibuka",
  "heatmap.tipClosed": "{symbol} · pasaran ditutup, pergerakan sesi terakhir",

  // Support card. <mail> wraps the support email address
  "support.title": "Perlukan bantuan?",
  "support.text": "Tulis kepada <mail>{email}</mail> daripada alamat berdaftar anda dan sertakan ID pelanggan anda.",
  "support.emailSupport": "E-mel sokongan",
  "support.copied": "Alamat e-mel disalin",
  "support.copyFailed": "Tidak dapat menyalin, sila pilih alamat tersebut",

  // Demo dashboard: onboarding strip
  "onboarding.title": "Selesaikan persediaan akaun anda",
  "onboarding.text": "Lengkapkan KYC untuk membuka pengeluaran dan had yang lebih tinggi.",
  "onboarding.progress": "Kemajuan",
  "onboarding.dismiss": "Ketepikan",

  // Margin health
  "margin.title": "Kesihatan margin",
  "margin.subtitle": "Merentasi semua akaun sebenar",
  "margin.healthy": "Sihat",
  "margin.level": "Tahap margin",
  "margin.used": "Margin digunakan",
  "margin.free": "Margin bebas",

  // Equity / P&L. {range} = 1W, 1M, 3M, YTD, 1Y, ALL (keep as-is)
  "equity.title": "Jumlah ekuiti",
  "equity.changeOver": "Perubahan dalam {range}",
  "pnl.title": "Untung / rugi · bulan",
  "pnl.lowRisk": "Risiko rendah",
  "pnl.winRate": "Kadar menang (30h)",
  "pnl.trades": "Dagangan (30h)",
  "pnl.avgWin": "Purata dagangan untung",
  "pnl.avgLoss": "Purata dagangan rugi",
  "pnl.charges": "Caj dibayar",

  // KPI cards
  "kpi.wallet": "Dompet",
  "kpi.today": "+{pct}% hari ini",
  "kpi.monthPnl": "Untung/Rugi bulan",
  "kpi.vsLastMonth": "+{pct}% berbanding bulan lepas",
  "kpi.partnerEarnings": "Pendapatan rakan kongsi",
  "kpi.copy": "Copy {amount}",

  // Top movers
  "movers.title": "Pergerakan teratas",
  "movers.gainers": "Naik",
  "movers.losers": "Turun",

  // Economic calendar. A = Actual, F = Forecast, P = Previous
  "calendar.title": "Kalendar ekonomi",
  "calendar.subtitle": "Hari ini · waktu pelayan GMT+3",
  "calendar.actual": "A {value} · ",
  "calendar.forecastPrevious": "R {forecast} · S {previous}",

  // News / world
  "news.title": "Berita pasaran",
  "news.all": "Semua berita",
  "news.pinned": "Disematkan",
  "world.title": "Pasaran & berita di seluruh dunia",
  "world.subtitle": "Tajuk berita langsung mengikut negara dan sentimen mata wang",
  "world.stories": { other: "{count} berita hari ini" },

  // Open positions
  "positions.title": "Posisi terbuka",
  "positions.summary": { other: "{count} posisi · terapung" },
  "positions.terminal": "Terminal",

  // Partner banner. <link> wraps the referral link
  "partner.chip": "Program rakan kongsi",
  "partner.title": "Jemput pedagang. Peroleh sehingga $15 setiap lot — seumur hidup.",
  "partner.text": "Komisen berbilang peringkat, bonus CPA dan penjejakan masa nyata. Pautan anda: <link>{url}</link>",
  "partner.open": "Buka papan pemuka rakan kongsi",

  // Short relative times (m = minutes, h = hours, d = days)
  "time.justNow": "Baru sahaja",
  "time.minutesAgo": "{count}m lalu",
  "time.hoursAgo": "{count}j lalu",
  "time.daysAgo": "{count}h lalu",
  "time.ago": "{time} lalu",

  // Notifications bell / panel
  "notifications.title": "Pemberitahuan",
  "notifications.ariaUnread": "Pemberitahuan, {count} belum dibaca",
  "notifications.markAll": "Tanda semua sudah dibaca",
  "notifications.clear": "Kosongkan",
  "notifications.emptyTitle": "Belum ada pemberitahuan",
  "notifications.emptyText": "Deposit, pengeluaran, pengesahan, amaran dagangan dan balasan daripada sokongan dipaparkan di sini.",
  "notifications.settings": "Tetapan pemberitahuan",
};
export default dashboard;
