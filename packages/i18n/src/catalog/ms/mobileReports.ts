import type { NsMessages } from "../../core";

// Kalks mobile app (apps/mobile), Reports: Statements (/reports/statements) and Analytics (/reports/analytics).
// Most labels reuse the Client Area's portfolio.st.* / portfolio.an.* keys; only mobile-specific text is here.
const mobileReports: NsMessages<"mobileReports"> = {
  eyebrow: "Laporan",
  "eyebrow.analytics": "Laporan · USD · waktu pelayan",

  // Account picker (a card that opens a sheet)
  "account.title": "Akaun",
  "account.choose": "Pilih akaun",
  "account.allHint": { other: "{count} akaun sebenar" },
  "account.change": "Tukar akaun",

  // Statements
  "st.day": "Hari",
  "st.pickDay": "Pilih hari",
  "st.pickFrom": "Tarikh mula",
  "st.pickTo": "Tarikh akhir",
  "st.include": "Sertakan",
  "st.summary": "#{login} · {period} · {format}",
  "st.preparing": "Menyediakan…",
  "st.ready": "Penyata sedia",
  "st.saved": "Disimpan sebagai {file}",
  "st.shareTitle": "Kongsi penyata",
  "st.failed": "Penyata tidak dapat dimuat turun",
  "st.offline": "Anda di luar talian. Sambung untuk memuat turun penyata.",
  "st.monthly.empty": "Belum ada bulan penyata.",
  "st.monthly.offline": "Anda di luar talian. Sambung untuk melihat penyata bulanan.",
  "st.monthly.a11y": "{month}: bersih {net}, {trades}. Membuka muat turun.",
  "st.month.title": "Penyata {month}",
  "st.month.formats": "Muat turun sebagai",
  "st.prevMonth": "Bulan sebelumnya",
  "st.nextMonth": "Bulan seterusnya",

  // Analytics: hero and stat tiles
  "an.hero.label": "P&L bersih · {period}",
  "an.hero.return": "Pulangan",
  "an.hero.trades": "Dagangan",
  "an.hero.lots": "Lot",
  "an.tile.sharpe": "Nisbah Sharpe",
  "an.tile.expectancy": "Jangkaan",
  "an.tile.sortino": "Sortino {value}",
  "an.tile.avgWinLoss": "Purata untung / rugi",
  "an.tile.rr": "Ganjaran : risiko 1 : {value}",
  "an.tile.holdSplit": "Untung {win} · rugi {loss}",
  "an.tile.streaks": "Rentetan",
  "an.tile.streaksSub": "Untung / rugi berturut-turut",
  "an.tile.trade": "{side} {volume} · #{ticket}",
  "an.tile.none": "Belum ada dagangan",

  // Analytics: curves
  "an.curve.hint": "Sentuh dan tahan carta untuk melihat setiap hari",
  "an.curve.drawdown": "Drawdown",
  "an.curve.a11y": "Ekuiti {equity}, baki {balance} pada {date}. Drawdown maksimum {drawdown}.",

  // Analytics: P&L calendar (net of closed trades per server day)
  "an.cal.title": "Kalendar P&L",
  "an.cal.subtitle": "Hasil bersih dagangan ditutup bagi setiap hari pelayan",
  "an.cal.subtitleEstimated": "Perubahan baki harian, tidak termasuk deposit dan pengeluaran",
  "an.cal.days": { other: "{count} hari dagangan" },
  "an.cal.green": "{count} hijau",
  "an.cal.red": "{count} merah",
  "an.cal.noTrades": "Tiada dagangan ditutup",
  "an.cal.select": "Ketik hari untuk melihat hasilnya",
  "an.cal.a11yDay": "{date}: {net}, {trades}",

  // Analytics: breakdowns
  "an.hour.byHour": "P&L bersih mengikut jam",
  "an.hour.byDayHour": "Hari × jam",
  "an.hour.tap": "Ketik bar atau sel untuk butiran",
  "an.tapBar": "Ketik bar untuk butiran",
  "an.session.best": "Terbaik",
  "an.session.asia": "Asia",
  "an.session.london": "London",
  "an.session.overlap": "London / New York",
  "an.session.newYork": "New York",
  "an.session.lateNewYork": "Lewat New York",
  "an.side.split": "{long} · {short}",
  "an.flow.equityNow": "Ekuiti kini",
  "an.charges.total": "Caj dibayar",

  // Behaviour insights (the numbers come from the reports service)
  "insight.overtrading.title": { other: "Dagangan berlebihan pada {count} hari" },
  "insight.overtrading.text": "Pada hari-hari ini anda meletakkan lebih daripada {limit} dagangan (hari biasa anda ialah {median}). Hasil bersih pada hari tersebut: {net}.",
  "insight.overtrading.tip": "Tetapkan had harian {cap} dagangan.",
  "insight.revenge.title": { other: "{count} kemungkinan dagangan membalas dendam" },
  "insight.revenge.text": "Dagangan yang dibuka dalam 15 minit selepas penutupan rugi, pada saiz yang sama atau lebih besar. Ia menang {rate}% daripada masa dengan jumlah {net}.",
  "insight.revenge.tip": "Berhenti seketika selama 15 minit selepas kerugian sebelum dagangan seterusnya.",
  "insight.risk.title": "Risiko setiap dagangan rugi",
  "insight.risk.text": { other: "Dagangan rugi menelan purata {avg}% daripada baki anda, paling banyak {max}%. {count} kerugian melebihi 2%." },
  "insight.risk.tip": "Tetapkan saiz posisi supaya henti rugi menelan paling banyak 1–2% daripada baki.",
  "insight.holdLosers.title": "Dagangan rugi dipegang lebih lama daripada dagangan untung",
  "insight.holdLosers.text": "Dagangan rugi kekal terbuka {loss} secara purata, dagangan untung {win}.",
  "insight.holdLosers.tip": "Letakkan henti rugi semasa membuka dagangan dan biarkan ia di situ.",
  "insight.stopOut.title": { other: "{count} penutupan stop-out" },
  "insight.stopOut.text": "Posisi ditutup oleh stop-out margin, bukan oleh henti rugi anda sendiri.",
  "insight.stopOut.tip": "Kekalkan tahap margin di atas tahap margin call dengan posisi yang lebih kecil.",
  "insight.slTp.title": "Dagangan ditutup oleh henti rugi atau ambil untung",
  "insight.slTp.text": "{tp} oleh ambil untung, {sl} oleh henti rugi, selebihnya ditutup secara manual atau oleh meja urus niaga.",
  "insight.slTp.tip": "Keluar yang dirancang memastikan hasil yang konsisten.",
  "insight.session.title": "Sesi terbaik: {session}",
  "insight.session.text": "{trades} dagangan dengan kadar menang {rate}%. Paling lemah: {worst} ({net}).",
  "insight.session.tip": "Fokus pada sesi {session}.",
  "insight.tip": "Tip",

  // States
  "state.updating": "Mengemas kini…",
  "state.stale": "Memaparkan data yang disimpan. Tarik ke bawah untuk muat semula.",
  "state.notShared.title": "Tidak dikongsi dengan anda",
  "state.footer": "Semua jumlah dalam USD (akaun sen ditukar). Masa dalam waktu pelayan, GMT+2 / GMT+3.",
  "state.footerStatements": "Penyata dalam mata wang akaun (USC untuk akaun sen). Masa dalam waktu pelayan, GMT+2 / GMT+3.",
};
export default mobileReports;
