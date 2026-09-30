import type { NsMessages } from "../../core";

// Kalks mobile app, Reports: Statements and Analytics (most labels reuse portfolio.st.* / portfolio.an.*).
const mobileReports: NsMessages<"mobileReports"> = {
  eyebrow: "Laporan",
  "eyebrow.analytics": "Laporan · USD · waktu server",

  // Account picker (a card that opens a sheet)
  "account.title": "Akun",
  "account.choose": "Pilih akun",
  "account.allHint": { other: "{count} akun live" },
  "account.change": "Ganti akun",

  // Statements
  "st.day": "Hari",
  "st.pickDay": "Pilih hari",
  "st.pickFrom": "Tanggal mulai",
  "st.pickTo": "Tanggal akhir",
  "st.include": "Sertakan",
  "st.summary": "#{login} · {period} · {format}",
  "st.preparing": "Menyiapkan…",
  "st.ready": "Laporan siap",
  "st.saved": "Disimpan sebagai {file}",
  "st.shareTitle": "Bagikan laporan",
  "st.failed": "Laporan tidak dapat diunduh",
  "st.offline": "Anda sedang offline. Sambungkan ke internet untuk mengunduh laporan.",
  "st.monthly.empty": "Belum ada laporan bulanan.",
  "st.monthly.offline": "Anda sedang offline. Sambungkan ke internet untuk melihat laporan bulanan.",
  "st.monthly.a11y": "{month}: bersih {net}, {trades}. Membuka unduhan.",
  "st.month.title": "Laporan {month}",
  "st.month.formats": "Unduh sebagai",
  "st.prevMonth": "Bulan sebelumnya",
  "st.nextMonth": "Bulan berikutnya",

  // Analytics: hero and stat tiles
  "an.hero.label": "P&L bersih · {period}",
  "an.hero.return": "Imbal hasil",
  "an.hero.trades": "Transaksi",
  "an.hero.lots": "Lot",
  "an.tile.sharpe": "Rasio Sharpe",
  "an.tile.expectancy": "Ekspektasi",
  "an.tile.sortino": "Sortino {value}",
  "an.tile.avgWinLoss": "Rata-rata profit / rugi",
  "an.tile.rr": "Rasio R:R 1 : {value}",
  "an.tile.holdSplit": "Profit {win} · rugi {loss}",
  "an.tile.streaks": "Beruntun",
  "an.tile.streaksSub": "Profit / rugi berturut-turut",
  "an.tile.trade": "{side} {volume} · #{ticket}",
  "an.tile.none": "Belum ada transaksi",

  // Analytics: curves
  "an.curve.hint": "Tekan lama grafik untuk melihat setiap hari",
  "an.curve.drawdown": "Drawdown",
  "an.curve.a11y": "Ekuitas {equity}, saldo {balance} pada {date}. Drawdown maksimum {drawdown}.",

  // Analytics: P&L calendar (net of closed trades per server day)
  "an.cal.title": "Kalender P&L",
  "an.cal.subtitle": "Hasil bersih transaksi tertutup per hari server",
  "an.cal.subtitleEstimated": "Perubahan saldo harian, tanpa deposit dan penarikan",
  "an.cal.days": { other: "{count} hari trading" },
  "an.cal.green": "{count} hijau",
  "an.cal.red": "{count} merah",
  "an.cal.noTrades": "Tidak ada transaksi tertutup",
  "an.cal.select": "Ketuk hari untuk melihat hasilnya",
  "an.cal.a11yDay": "{date}: {net}, {trades}",

  // Analytics: breakdowns
  "an.hour.byHour": "P&L bersih per jam",
  "an.hour.byDayHour": "Hari × jam",
  "an.hour.tap": "Ketuk batang atau sel untuk detail",
  "an.tapBar": "Ketuk batang untuk detail",
  "an.session.best": "Terbaik",
  "an.session.asia": "Asia",
  "an.session.london": "London",
  "an.session.overlap": "London / New York",
  "an.session.newYork": "New York",
  "an.session.lateNewYork": "New York akhir",
  "an.side.split": "{long} · {short}",
  "an.flow.equityNow": "Ekuitas saat ini",
  "an.charges.total": "Biaya dibayar",

  // Behaviour insights (the numbers come from the reports service)
  "insight.overtrading.title": { other: "Overtrading pada {count} hari" },
  "insight.overtrading.text": "Pada hari-hari ini Anda membuka lebih dari {limit} transaksi (hari biasa Anda {median}). Hasil bersih pada hari-hari tersebut: {net}.",
  "insight.overtrading.tip": "Tetapkan batas harian {cap} transaksi.",
  "insight.revenge.title": { other: "{count} kemungkinan revenge trade" },
  "insight.revenge.text": "Transaksi yang dibuka dalam 15 menit setelah penutupan yang rugi, dengan ukuran sama atau lebih besar. Win rate-nya {rate}% dengan total {net}.",
  "insight.revenge.tip": "Jeda 15 menit setelah rugi sebelum transaksi berikutnya.",
  "insight.risk.title": "Risiko per transaksi rugi",
  "insight.risk.text": { other: "Satu transaksi rugi rata-rata menghabiskan {avg}% saldo Anda, paling banyak {max}%. {count} kerugian melebihi 2%." },
  "insight.risk.tip": "Atur ukuran posisi agar stop-loss menghabiskan paling banyak 1–2% saldo.",
  "insight.holdLosers.title": "Transaksi rugi ditahan lebih lama daripada transaksi profit",
  "insight.holdLosers.text": "Transaksi rugi terbuka rata-rata {loss}, transaksi profit {win}.",
  "insight.holdLosers.tip": "Pasang stop-loss saat membuka transaksi dan jangan dipindahkan.",
  "insight.stopOut.title": { other: "{count} penutupan stop-out" },
  "insight.stopOut.text": "Posisi ditutup oleh stop-out margin, bukan oleh stop-loss Anda sendiri.",
  "insight.stopOut.tip": "Jaga level margin di atas level margin call dengan posisi yang lebih kecil.",
  "insight.slTp.title": "Transaksi yang ditutup oleh stop-loss atau take-profit",
  "insight.slTp.text": "{tp} oleh take-profit, {sl} oleh stop-loss, sisanya ditutup manual atau oleh desk.",
  "insight.slTp.tip": "Exit yang terencana menjaga hasil tetap konsisten.",
  "insight.session.title": "Sesi terbaik: {session}",
  "insight.session.text": "{trades} transaksi dengan win rate {rate}%. Terlemah: {worst} ({net}).",
  "insight.session.tip": "Fokus pada sesi {session}.",
  "insight.tip": "Tips",

  // States
  "state.updating": "Memperbarui…",
  "state.stale": "Menampilkan data tersimpan. Tarik ke bawah untuk memuat ulang.",
  "state.notShared.title": "Tidak dibagikan dengan Anda",
  "state.footer": "Semua jumlah dalam USD (akun sen dikonversi). Waktu dalam waktu server, GMT+2 / GMT+3.",
  "state.footerStatements": "Laporan dalam mata uang akun (USC untuk akun sen). Waktu dalam waktu server, GMT+2 / GMT+3.",
};
export default mobileReports;
