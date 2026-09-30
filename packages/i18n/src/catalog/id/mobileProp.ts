import type { NsMessages } from "../../core";

// Kalks mobile app: Prop (challenge catalogue and checkout, live rule dashboard, payouts, certificates).
// "Kalks", "Kalks Prop", "Kalks Trader", "Kalks-Live", "USDT", "New York" and "17:00" stay as they are.
// Terms follow the `prop` namespace (challenge, funded, bagi hasil, pembayaran). Compact units: j = jam, h = hari.
// Titles shown in tall uppercase display type are marked "display": keep them short.
const mobileProp: NsMessages<"mobileProp"> = {
  // Prop home
  "home.eyebrow": "Kalks Prop",
  "home.title": "Dapatkan modal", // display
  "home.subtitle": "Lulus challenge, dapatkan akun funded, dan raih hingga {split}% dari profit. Setiap akun prop adalah akun simulasi.",
  "home.subtitleNoSplit": "Lulus challenge, dapatkan akun funded, dan raih bagian dari profit. Setiap akun prop adalah akun simulasi.",
  "home.payouts": "Pembayaran",
  "home.payoutsReady": "{amount} siap",
  "home.payoutsNone": "Belum ada yang siap",
  "home.certificates": "Sertifikat",
  "home.certCount": { other: "{count} diperoleh" },
  "home.mine": "Challenge Anda",
  "home.past": "Challenge sebelumnya",
  "home.showAll": "Tampilkan semua {count}",
  "home.yourCertificates": "Sertifikat Anda",
  "home.plans": "Pilih challenge Anda",
  "home.newChallenge": "Mulai challenge baru",
  "home.emptyTitle": "Belum ada challenge", // display
  "home.emptyBody": "Paket challenge baru sedang disiapkan. Silakan periksa kembali nanti.",
  "home.mineError": "Challenge Anda tidak dapat dimuat.",
  "home.plansError": "Paket challenge tidak dapat dimuat.",

  // How it works (numbered 01–04 on the Prop home)
  "how.title": "Cara kerjanya",
  "how.1.title": "Pilih paket",
  "how.1.body": "Pilih model dan ukuran akun. Biaya diambil dari dompet USDT Anda, sekali saja.",
  "how.2.title": "Capai target",
  "how.2.body": "Raih target profit tanpa melanggar batas kerugian harian dan drawdown, dengan memenuhi jumlah hari trading minimum.",
  "how.3.title": "Dapatkan modal",
  "how.3.body": "Lulus, dan akun funded Anda terbuka otomatis beserta sertifikat untuk dibagikan.",
  "how.4.title": "Terima pembayaran",
  "how.4.body": "Ajukan bagian profit Anda ke dompet USDT Anda setiap siklus pembayaran.",
  "how.enforce": "Batas diperiksa di server setiap detik, berdasarkan ekuitas. Anda diperingatkan pada 50, 75, dan 90% dari batas kerugian harian; pelanggaran menutup semua posisi dan mengakhiri challenge.",

  // Plan models
  "type.oneStep": "1-Tahap",
  "type.twoStep": "2-Tahap",
  "type.instant": "Instan",
  "typeText.oneStep": "Satu fase evaluasi. Capai target, patuhi batas, dan dapatkan akun funded.",
  "typeText.twoStep": "Dua fase evaluasi dengan target lebih rendah dan batas lebih longgar.",
  "typeText.instant": "Tanpa evaluasi. Langsung mulai di akun funded, dengan batas lebih ketat.",

  // Plan card
  "plan.refundable": "Biaya dikembalikan",
  "plan.fee": "Biaya",
  "plan.account": "Akun",
  "plan.leverage": "Leverage 1:{n}",
  "plan.target": "Target",
  "plan.dailyLoss": "Rugi harian",
  "plan.maxDD": "Drawdown maks",
  "plan.static": "statis",
  "plan.trailing": "trailing",
  "plan.start": "Mulai · {fee}",

  // Checkout
  "checkout.eyebrow": "Checkout",
  "checkout.fee": "Biaya sekali bayar",
  "checkout.chargedRefund": "Dibayar dari dompet USDT Anda. Dikembalikan bersama pembayaran pertama Anda.",
  "checkout.chargedNoRefund": "Dibayar dari dompet USDT Anda. Tidak dapat dikembalikan.",
  "checkout.walletBalance": "Saldo dompet: {balance} USDT",
  "checkout.shortTitle": "Saldo dompet Anda kurang untuk biaya ini",
  "checkout.short": "Anda memiliki {balance} USDT. Deposit {missing} USDT lagi untuk membayar challenge ini.",
  "checkout.rules": "Aturan",
  "checkout.limitsNote": "Batas dihitung sebagai persentase dari saldo awal. Melanggar batas kerugian harian atau drawdown maks membuat akun gagal dan menutup semua posisi pada harga pasar. Hari trading direset pukul 17:00 New York.",
  "checkout.agree": "Saya telah membaca aturan dan memahami bahwa akun ini adalah akun simulasi dan otomatis gagal jika batas kerugian dilanggar.",
  "checkout.pay": "Bayar {fee}",
  "checkout.retry": "Coba lagi · {fee}",
  "checkout.paying": "Membayar…",
  "checkout.goToMine": "Lihat challenge saya",
  "checkout.readyTitle": "Challenge siap", // display
  "checkout.readyBody": "{fee} telah dibayar dari dompet USDT Anda dan akun {size} {phase} Anda sudah terbuka. Aturan berlaku mulai sekarang.",
  "checkout.savePasswords": "Simpan kata sandi ini sekarang: kata sandi hanya ditampilkan sekali dan tidak kami simpan. Anda tetap dapat trading di akun ini dari aplikasi tanpa kata sandi.",
  "checkout.passwordsShown": "Kata sandi trading ditampilkan saat pembelian ini pertama kali berhasil. Anda dapat trading di akun ini dari aplikasi tanpa kata sandi.",
  "checkout.viewChallenge": "Lihat challenge",
  "checkout.readOnly": "Sesi ini tidak dapat membeli challenge.",

  // Account credentials
  "cred.login": "Login",
  "cred.server": "Server",
  "cred.password": "Kata sandi trading",
  "cred.investorPassword": "Kata sandi investor (hanya baca)",
  "cred.show": "Tampilkan kata sandi",
  "cred.hide": "Sembunyikan kata sandi",
  "copied": "{what} tersalin",
  "a11y.copy": "Salin {what}",

  // Challenge statuses
  "status.pendingPayment": "Menunggu pembayaran",
  "status.provisioning": "Membuka akun",
  "status.active": "Aktif",
  "status.funded": "Funded",
  "status.failed": "Gagal",
  "status.closed": "Ditutup",
  "status.paymentFailed": "Pembayaran gagal",
  // {phase} is the phase name from the plan, e.g. "Fase 2"
  "stage.active": "{phase} · Aktif",
  "stage.failed": "{phase} · Gagal",
  "phaseStatus.provisioning": "Sedang dibuka",
  "phaseStatus.active": "Live",
  "phaseStatus.passed": "Lulus",
  "phaseStatus.failed": "Gagal",
  "phaseStatus.closed": "Ditutup",

  // Challenge cards (Prop home)
  "card.target": "Target profit",
  "card.profit": "Profit",
  "card.equity": "Ekuitas {amount}",
  "card.dailyLeft": "Sisa rugi harian {amount}",
  "card.opening": "Akun trading Anda sedang dibuka. Ini memerlukan beberapa detik.",

  // Dashboard
  "dash.equity": "Ekuitas",
  "dash.balance": "Saldo",
  "dash.floating": "Mengambang",
  "dash.open": "Terbuka",
  "dash.sinceStart": "sejak fase dimulai",
  "dash.rules": "Aturan",
  "dash.rulesTitle": "Aturan challenge ini",
  "dash.notFound": "Challenge tidak ditemukan", // display
  "dash.notFoundBody": "Challenge ini mungkin dibuka dengan login lain.",
  "dash.backToProp": "Kembali ke Prop",
  "live.live": "Live",
  "live.connecting": "Menghubungkan…",
  "live.offline": "Offline",
  // {time}: date and time of the last rule check
  "live.updated": "Diperiksa {time}",
  // {time}: when the phase ended
  "live.final": "Final · {time}",

  // Rule names (gauges, the rule log)
  "rule.dailyLoss": "Kerugian harian",
  "rule.maxDrawdown": "Drawdown maks",
  "rule.profitTarget": "Target profit",
  "rule.tradingDays": "Hari trading",
  "rule.timeLimit": "Batas waktu",
  "rule.weekendHolding": "Menahan posisi akhir pekan",
  "rule.newsWindow": "Jendela berita",
  "rule.bannedStrategy": "Strategi terlarang",
  "rule.consistency": "Konsistensi",
  "rule.riskDesk": "Keputusan risk desk",
  "ruleState.ok": "Berjalan",
  "ruleState.passed": "Terpenuhi",
  "ruleState.failed": "Dilanggar",
  "ruleState.off": "Nonaktif",

  // Gauges
  "target.ofTarget": "dari target",
  "target.of": "Target {amount} ({pct}%)",
  "target.left": "Kurang {amount} lagi",
  "target.reachedBy": "Tercapai, lebih {amount}",
  "limit.left": "Sisa {amount}",
  "limit.breachAt": "Pelanggaran di {amount}",
  "days": { other: "{count} hari" },
  "days.of": "{v} dari {min}",
  "days.count": { other: "{count} hari" },
  "days.met": "Minimum terpenuhi",
  "days.toGo": { other: "Kurang {count} lagi" },
  "days.noMinimum": "Tanpa minimum",
  "time.left": "Sisa {d}h {h}j",
  "time.deadline": "Berakhir {date}",
  "consistency.rule": "Hari terbaik ≤ {pct}% dari profit",
  "consistency.noProfit": "Belum ada profit",
  "reset.title": "Kerugian harian direset dalam",
  "reset.note": "17:00 New York, setiap hari trading",

  // Funded account: payout window ring
  "payoutHero.title": "Pembayaran berikutnya",
  "payoutHero.share": "Bagian Anda sejauh ini",
  "payoutHero.open": "Terbuka", // display
  "payoutHero.ready": "Siap", // display
  "payoutHero.days": { other: "{count} hari" }, // display
  "payoutHero.eligible": "Memenuhi syarat sekarang dengan bagi hasil {split}% Anda.",
  "payoutHero.opens": "Jendela pembayaran dibuka {date}.",
  "payoutHero.later": "Ajukan pembayaran setelah Anda memiliki profit yang memenuhi syarat.",

  // Big states
  "hero.opening.title": "Membuka akun Anda", // display
  "hero.opening.body": "Pembayaran telah dikonfirmasi dan akun trading Anda sedang disiapkan. Halaman ini diperbarui secara otomatis.",
  "hero.closed.title": "Challenge ditutup", // display
  "hero.closed.body": "Akun trading untuk challenge ini tidak dapat dibuka, sehingga challenge ditutup dan biayanya dikembalikan ke dompet USDT Anda. Hubungi dukungan jika ada pertanyaan.",
  // {reason} is the prop service's reason, in English
  "hero.closed.reason": "{reason}. Biaya telah dikembalikan ke dompet USDT Anda.",
  "hero.failed.title": "{phase} gagal", // display
  "hero.failed.on": "Berakhir {date}",
  // {reason} is the breach reason from the risk engine
  "hero.failed.body": "{reason}. Semua posisi telah ditutup dan akun dinonaktifkan.",
  "hero.failed.ruleBreached": "Aturan telah dilanggar",
  // {rule} is a rule name, e.g. "Kerugian harian"
  "hero.failed.rule": "{rule}: batas dilanggar",
  "hero.failed.new": "Mulai challenge baru",
  "hero.passed.title": "{phase} lulus", // display
  "hero.passed.on": "Lulus {date}.",
  "hero.passed.next": "Akun {phase} Anda sudah terbuka.",
  "hero.passed.nextLogin": "Akun {phase} Anda sudah terbuka (#{login}).",
  "hero.passed.opening": "Akun berikutnya sedang dibuka.",
  "hero.passed.certificate": "Lihat sertifikat",
  "hero.passed.goNext": "Ke {phase}",
  "hero.funded.title": "Funded", // display
  "hero.funded.body": "Trading di akun funded dan ambil {split}% profit sebagai pembayaran.",
  "hero.funded.certificate": "Lihat sertifikat funded Anda",

  // Warnings while trading
  "warn.lossUsed": "{pct}% dari batas kerugian hari ini terpakai",
  "warn.lossUsedBody": "Ekuitas pada atau di bawah {floor} membuat akun gagal dan menutup semua posisi. Sisa hari ini: {left}.",
  "warn.weekend": "Penutupan akhir pekan",
  "warn.weekendBody": "Paket ini tidak mengizinkan menahan posisi selama akhir pekan: posisi terbuka ditutup pada Jumat 16:45 New York.",

  // Actions
  "action.openTrade": "Buka di Trading",
  "action.trade": "Trading",
  "action.tradeBlocked": "Hanya akun live dari challenge aktif yang dapat digunakan untuk trading.",
  "action.payouts": "Pembayaran",
  "action.support": "Hubungi dukungan",

  // Equity chart
  "chart.title": "Kurva ekuitas",
  "chart.start": "Awal",
  "chart.target": "Target",
  "chart.ddFloor": "Drawdown maks",
  "chart.dailyFloor": "Kerugian harian",
  "chart.now": "Kini",
  "chart.empty": "Kurva muncul setelah beberapa menit pertama trading.",

  // Trading stats
  "stats.title": "Statistik trading",
  "stats.trades": "Transaksi",
  "stats.winRate": "Win rate",
  "stats.profitFactor": "Profit factor",
  "stats.avgWin": "Rata-rata profit",
  "stats.avgLoss": "Rata-rata rugi",
  "stats.lots": "Lot",
  "stats.bestDay": "Hari terbaik {date}: {amount}",

  // Rule log
  "events.title": "Log aturan",
  "events.empty": "Tidak ada peringatan atau pelanggaran. Pertahankan.",
  "events.equity": "ekuitas {amount}",
  "events.limit": "batas {amount}",
  "severity.breach": "Pelanggaran berat",
  "severity.violation": "Pelanggaran",
  "severity.warning": "Peringatan",
  "severity.info": "Info",

  // Closed trades
  "trades.title": "Transaksi tertutup",
  "trades.all": "Semua {count}",
  "trades.count": { other: "{count} transaksi tertutup" },
  "trades.empty": "Belum ada transaksi tertutup.",
  "trades.buy": "Buy",
  "trades.sell": "Sell",
  // compact durations: d = detik, m = menit, j = jam, h = hari
  "duration.s": "{s}d",
  "duration.ms": "{m}m {s}d",
  "duration.hm": "{h}j {m}m",
  "duration.dh": "{d}h {h}j",

  // Account details
  "account.title": "Akun",
  "account.split": "Bagian Anda",
  "account.initial": "Saldo awal",
  "account.started": "Fase dimulai",
  "account.ended": "Berakhir",
  "account.deadline": "Tenggat",
  "account.passwordNote": "Kata sandi trading ditampilkan sekali, saat pembelian. Buka di Trading memasukkan Anda ke akun ini tanpa kata sandi.",

  // Payouts
  "payouts.title": "Pembayaran", // display
  "payouts.available": "Tersedia sekarang",
  "payouts.eligibleCount": { other: "{eligible} dari {count} akun funded memenuhi syarat" },
  "payouts.requests": { other: "{count} permintaan" },
  "payouts.count": { other: "{count} pembayaran" },
  "payouts.paidToDate": "Dibayar hingga kini",
  "payouts.funded": "Akun funded",
  "payouts.account": "{size} funded", // display
  "payouts.quote": "Estimasi pembayaran",
  "payouts.eligibleNow": "Memenuhi syarat sekarang",
  "payouts.notYet": "Belum",
  "payouts.toWallet": "ke dompet Anda",
  "payouts.yourSplit": "Bagian Anda",
  "payouts.firmShare": "Bagian perusahaan",
  "payouts.alreadyRefunded": "Sudah dikembalikan",
  "payouts.withFirst": "Bersama pembayaran pertama",
  "payouts.opens": "Dibuka {date}.",
  "payouts.minimum": "Minimum {amount}.",
  "payouts.kycNote": "Verifikasi identitas Anda untuk mengajukan pembayaran ini.",
  "payouts.kycPendingNote": "Anda dapat mengajukan pembayaran ini setelah verifikasi identitas Anda disetujui.",
  "payouts.readOnly": "Sesi ini tidak dapat mengajukan pembayaran.",
  "payouts.request": "Ajukan pembayaran",
  // opens the account's live rule dashboard; short: it shares a row with Trading
  "payouts.dashboard": "Aturan",
  "payouts.history": "Riwayat",
  "payouts.historyEmpty": "Belum ada pembayaran.",
  "payouts.emptyTitle": "Belum ada akun funded", // display
  "payouts.emptyBody": "Lulus challenge untuk mendapatkan akun funded. Ajukan pembayaran di sini setelah akun memiliki profit yang memenuhi syarat.",
  "payouts.emptyAction": "Dapatkan modal",
  "payoutStatus.pending": "Sedang ditinjau",
  "payoutStatus.approved": "Disetujui",
  "payoutStatus.paid": "Dibayar",
  "payoutStatus.rejected": "Ditolak",
  "payoutStatus.failed": "Gagal",
  "split.title": "Bagi hasil dan scaling",
  "split.upTo": "Hingga {pct}% dengan scaling",
  "split.cycle": "Pembayaran",
  // {days} e.g. "14 hari"
  "split.first": "Pertama setelah {days}",
  "split.firstNow": "Sejak hari pertama",
  // {months} e.g. "4 bulan"; {cap} e.g. "$2,000,000"
  "scaling.text": "Raih profit {profit}% selama {months} dan akun bertambah {increase}%, hingga {cap}.",
  "scaling.none": "Paket ini tidak menambah ukuran akun.",
  "months": { other: "{count} bulan" },

  // Payout request sheet
  "request.eyebrow": "Ajukan pembayaran",
  "request.profit": "Profit pada akun",
  "request.share": "Bagian Anda ({pct}%)",
  "request.feeRefund": "Pengembalian biaya challenge",
  "request.total": "Total ke dompet Anda",
  "request.note": "Seluruh profit saat ini diambil dari akun trading sekarang, sehingga tidak dapat hilang karena trading selama ditinjau. Setelah disetujui, bagian Anda dikreditkan ke dompet USDT Anda; jika permintaan ditolak, profit dikembalikan ke akun.",
  "request.submit": "Ajukan {amount}",
  "request.done": "Pembayaran diajukan",
  "request.doneBody": "{amount} masuk ke dompet USDT Anda setelah disetujui.",

  // Identity verification (payouts)
  "kyc.verified": "Identitas terverifikasi: pembayaran dapat disetujui.",
  "kyc.pendingTitle": "Verifikasi sedang ditinjau",
  "kyc.pendingText": "Verifikasi Anda sedang ditinjau. Anda dapat mengajukan pembayaran setelah identitas Anda terverifikasi.",
  "kyc.requiredTitle": "Verifikasi identitas Anda",
  "kyc.requiredText": "Pembayaran hanya diberikan kepada trader terverifikasi. Verifikasi sebelum pembayaran pertama Anda.",
  "kyc.rejectedText": "Verifikasi Anda ditolak. Kirim ulang untuk menerima pembayaran.",

  // Why a payout can't be requested yet
  "blocker.notYetEligible": "Jendela pembayaran belum dibuka.",
  "blocker.belowMinimum": "Profit di bawah pembayaran minimum.",
  "blocker.positionsOpen": "Tutup semua posisi terbuka untuk mengajukan pembayaran.",
  "blocker.payoutPending": "Pembayaran sedang ditinjau.",
  "blocker.consistency": "Aturan konsistensi belum terpenuhi: porsi hari terbaik Anda terlalu besar dari total profit.",

  // Certificates
  "certs.title": "Sertifikat", // display
  "certs.subtitle": "Setiap fase yang Anda lulusi, setiap akun funded, dan setiap pembayaran mendapat sertifikat yang dapat diverifikasi siapa saja.",
  "certs.kind.pass": "Fase lulus",
  "certs.kind.funded": "Trader funded",
  "certs.kind.payout": "Pembayaran",
  "certs.revoked": "Dicabut",
  "certs.revokedBody": "Sertifikat ini telah dicabut oleh Kalks dan tidak berlaku lagi, sehingga tidak dapat dibagikan.",
  "certs.meta": "{plan} · {size} · {date}",
  "certs.number": "No. {code}",
  "certs.shareImage": "Bagikan gambar",
  "certs.shareLink": "Bagikan tautan",
  "certs.copyLink": "Salin tautan",
  "certs.linkCopied": "Tautan verifikasi tersalin",
  "certs.shareTitle": "Sertifikat Kalks Prop saya",
  "certs.shareMessage": "Sertifikat Kalks Prop saya. Verifikasi di sini:",
  "certs.shareFailed": "Tidak dapat membagikan sertifikat. Silakan coba lagi.",
  "certs.shareUnavailable": "Berbagi tidak tersedia di perangkat ini.",
  "certs.emptyTitle": "Belum ada sertifikat", // display
  "certs.emptyBody": "Lulus satu fase challenge untuk mendapatkan sertifikat pertama Anda, dengan tautan publik yang dapat diverifikasi siapa saja.",
  "certs.emptyAction": "Lihat challenge",

  // Rule words shared by the checkout and the rules sheet
  "accountSize": "Ukuran akun",
  "profitSplit": "Bagi hasil",
  "feeRefund": "Pengembalian biaya",
  "nonRefundable": "Tidak dapat dikembalikan",
  "leverage": "Leverage",
  "none": "Tidak ada",
  "allowed": "Diizinkan",
  "notAllowed": "Tidak diizinkan",
  "noTimeLimit": "Tanpa batas waktu",
  // {phase} is the phase name, e.g. "Fase 1"
  "rules.phaseTarget": "Target {phase}",
  "rules.phaseMinDays": "Hari minimum {phase}",
  "rules.phaseTimeLimit": "Batas waktu {phase}",
  "rules.evaluation": "Evaluasi",
  "rules.evaluationNone": "Tidak ada, funded sejak hari pertama",
  "rules.dailyLoss": "Batas kerugian harian",
  "rules.dailyLossBalance": "{pct}% · {amount} · dari saldo pukul 17:00 New York",
  "rules.dailyLossEquity": "{pct}% · {amount} · dari nilai tertinggi antara saldo dan ekuitas pukul 17:00 New York",
  "rules.ddStatic": "{pct}% statis",
  "rules.ddTrailing": "{pct}% trailing",
  "rules.ddLocks": "{dd}, terkunci di awal",
  // ≤ = at most
  "rules.consistencyValue": "Hari terbaik ≤ {pct}% dari total profit",
  "rules.news": "Trading saat berita",
  "rules.newsBlocked": "Tidak dalam ±{min} mnt dari berita berdampak tinggi",
  "rules.newsBlockedFails": "Tidak dalam ±{min} mnt dari berita berdampak tinggi (akun gagal)",
  "rules.weekendClosed": "Posisi ditutup Jumat 16:45 New York",
  "rules.ea": "Expert Advisor",
  "rules.banned": "Strategi terlarang",
  "rules.splitScaling": "{split}%, meningkat hingga {max}%",
  "rules.firstPayout": "Pembayaran pertama",
  // {freq} is a lower-case payout cycle, e.g. "mingguan"
  "rules.firstPayoutValue": "Setelah {days}, lalu {freq} · min {min}",
  "rules.refunded": "Dikembalikan bersama pembayaran pertama",

  // Banned trading strategies
  "banned.hft": "Trading frekuensi tinggi",
  "banned.latencyArbitrage": "Arbitrase latensi",
  "banned.tickScalping": "Tick scalping",
  "banned.crossAccountCopying": "Menyalin antar akun",
  "banned.crossAccountHedging": "Hedging antar akun",
  "banned.martingale": "Martingale",
  "banned.grid": "Grid trading",

  // Payout cycle, lower case: used inside sentences ("lalu mingguan")
  "payoutFreq.weekly": "mingguan",
  "payoutFreq.biWeekly": "setiap 2 minggu",
  "payoutFreq.monthly": "bulanan",
  "payoutFreq.onDemand": "sesuai permintaan",

  // Errors (messages for the prop service's error codes)
  "errorLink.deposit": "Deposit",
  "errorLink.verify": "Verifikasi identitas",
  "error.insufficientFunds": "Saldo dompet USDT Anda tidak cukup untuk biaya ini. Deposit USDT dan coba lagi.",
  "error.kycRequired": "Verifikasi identitas Anda sebelum mengajukan pembayaran.",
  "error.paymentPending": "Kami belum dapat mengonfirmasi pembayaran dompet. Coba lagi dalam satu menit: Anda tidak akan ditagih dua kali.",
  "error.paymentFailed": "Pembayaran dompet tidak berhasil. Anda tidak dikenakan biaya.",
  "error.walletPending": "Dompet belum mengonfirmasi. Silakan coba lagi dalam satu menit.",
  "error.walletRejected": "Dompet menolak pembayaran ini. Silakan hubungi dukungan.",
  "error.provisioning": "Pembayaran diterima. Akun trading Anda masih dalam proses pembukaan: akun akan muncul di challenge Anda dalam satu menit.",
  "error.planUnavailable": "Paket atau ukuran ini sudah tidak tersedia. Silakan pilih yang lain.",
  "error.notYetEligible": "Akun ini belum memenuhi syarat untuk pembayaran.",
  "error.belowMinimum": "Profit di bawah pembayaran minimum.",
  "error.positionsOpen": "Tutup semua posisi terbuka sebelum mengajukan pembayaran.",
  "error.payoutPending": "Pembayaran untuk akun ini sedang ditinjau.",
  "error.consistency": "Aturan konsistensi belum terpenuhi: porsi hari terbaik Anda terlalu besar dari total profit.",
  "error.notFunded": "Pembayaran hanya tersedia untuk akun funded.",
  "error.accountUnavailable": "Kami tidak dapat membuka akun trading untuk challenge ini, sehingga biaya dikembalikan ke dompet USDT Anda. Hubungi dukungan jika hal ini terus terjadi.",
  "error.idempotencyConflict": "Checkout ini sudah digunakan untuk pembelian lain. Tutup lalu mulai lagi.",
  "error.notActive": "Challenge ini tidak aktif.",
  "error.accountLimit": "Anda telah mencapai jumlah maksimum akun prop. Hubungi dukungan untuk menaikkan batas.",
  "error.staffReadOnly": "Ini adalah sesi staf hanya baca. Perubahan tidak diizinkan.",
  "error.engine": "Server trading tidak merespons. Silakan coba lagi sebentar lagi.",
  "error.generic": "Terjadi kesalahan. Silakan coba lagi.",
  "load.title": "Prop tidak tersedia", // display
  "load.body": "Kami tidak dapat terhubung ke layanan prop. Akun Anda aman; silakan coba lagi sebentar lagi.",
};
export default mobileProp;
