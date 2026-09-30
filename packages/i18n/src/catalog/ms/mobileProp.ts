import type { NsMessages } from "../../core";

// Kalks mobile app: Prop (challenge catalogue and checkout, live rule dashboard, payouts, certificates).
// "Kalks", "Kalks Prop", "Kalks Trader", "Kalks-Live", "USDT", "New York" and "17:00" stay as they are.
// Titles marked "display" are tall uppercase: keep them short.
const mobileProp: NsMessages<"mobileProp"> = {
  // Prop home
  "home.eyebrow": "Kalks Prop",
  "home.title": "Dapatkan dana", // display
  "home.subtitle": "Lulus cabaran, dapatkan akaun berdana dan simpan sehingga {split}% daripada keuntungan. Setiap akaun prop adalah simulasi.",
  "home.subtitleNoSplit": "Lulus cabaran, dapatkan akaun berdana dan simpan sebahagian daripada keuntungan. Setiap akaun prop adalah simulasi.",
  "home.payouts": "Pembayaran",
  "home.payoutsReady": "{amount} sedia",
  "home.payoutsNone": "Belum ada yang sedia",
  "home.certificates": "Sijil",
  "home.certCount": { other: "{count} diperoleh" },
  "home.mine": "Cabaran anda",
  "home.past": "Cabaran lepas",
  "home.showAll": "Tunjuk semua {count}",
  "home.yourCertificates": "Sijil anda",
  "home.plans": "Pilih cabaran anda",
  "home.newChallenge": "Mulakan cabaran baharu",
  "home.emptyTitle": "Tiada cabaran ditawarkan", // display
  "home.emptyBody": "Pelan cabaran baharu sedang disediakan. Sila semak semula tidak lama lagi.",
  "home.mineError": "Cabaran anda tidak dapat dimuatkan.",
  "home.plansError": "Pelan cabaran tidak dapat dimuatkan.",

  // How it works (numbered 01–04 on the Prop home)
  "how.title": "Cara ia berfungsi",
  "how.1.title": "Pilih pelan",
  "how.1.body": "Pilih model dan saiz akaun. Yuran diambil dari dompet USDT anda, sekali sahaja.",
  "how.2.title": "Capai sasaran",
  "how.2.body": "Capai sasaran keuntungan dalam had kerugian harian dan drawdown, sepanjang hari dagangan minimum.",
  "how.3.title": "Dapatkan dana",
  "how.3.body": "Lulus, dan akaun berdana anda dibuka secara automatik dengan sijil untuk dikongsi.",
  "how.4.title": "Terima bayaran",
  "how.4.body": "Mohon bahagian keuntungan anda ke dompet USDT anda pada setiap kitaran pembayaran.",
  "how.enforce": "Had disemak pada pelayan setiap saat, berdasarkan ekuiti. Anda diberi amaran pada 50, 75 dan 90% daripada kerugian harian; pelanggaran menutup setiap posisi dan menamatkan cabaran.",

  // Plan models
  "type.oneStep": "1 Langkah",
  "type.twoStep": "2 Langkah",
  "type.instant": "Segera",
  "typeText.oneStep": "Satu fasa penilaian. Capai sasaran, patuhi had, dapatkan dana.",
  "typeText.twoStep": "Dua fasa penilaian dengan sasaran lebih rendah dan had lebih luas.",
  "typeText.instant": "Tiada penilaian. Mula pada akaun berdana serta-merta, dengan had lebih ketat.",

  // Plan card
  "plan.refundable": "Yuran dikembalikan",
  "plan.fee": "Yuran",
  "plan.account": "Akaun",
  "plan.leverage": "Leveraj 1:{n}",
  "plan.target": "Sasaran",
  "plan.dailyLoss": "Kerugian harian",
  "plan.maxDD": "Drawdown maks",
  "plan.static": "statik",
  "plan.trailing": "trailing",
  "plan.start": "Mula · {fee}",

  // Checkout
  "checkout.eyebrow": "Pembayaran",
  "checkout.fee": "Yuran sekali",
  "checkout.chargedRefund": "Dibayar dari dompet USDT anda. Dikembalikan bersama pembayaran pertama anda.",
  "checkout.chargedNoRefund": "Dibayar dari dompet USDT anda. Tidak boleh dikembalikan.",
  "checkout.walletBalance": "Baki dompet: {balance} USDT",
  "checkout.shortTitle": "Dompet anda tidak mencukupi untuk yuran",
  "checkout.short": "Anda mempunyai {balance} USDT. Deposit {missing} USDT lagi untuk membayar cabaran ini.",
  "checkout.rules": "Peraturan",
  "checkout.limitsNote": "Had ialah peratusan daripada baki permulaan. Melanggar kerugian harian atau drawdown maks menggagalkan akaun dan menutup setiap posisi pada harga pasaran. Hari dagangan diset semula pada 17:00 New York.",
  "checkout.agree": "Saya telah membaca peraturan dan faham bahawa akaun ini adalah simulasi dan gagal secara automatik apabila had kerugian dilanggar.",
  "checkout.pay": "Bayar {fee}",
  "checkout.retry": "Cuba lagi · {fee}",
  "checkout.paying": "Membayar…",
  "checkout.goToMine": "Lihat cabaran saya",
  "checkout.readyTitle": "Anda sudah masuk", // display
  "checkout.readyBody": "{fee} telah dibayar dari dompet USDT anda dan akaun {phase} {size} anda telah dibuka. Peraturan berkuat kuasa mulai sekarang.",
  "checkout.savePasswords": "Simpan kata laluan ini sekarang: ia dipaparkan sekali sahaja dan kami tidak menyimpannya. Anda sentiasa boleh berdagang dengan akaun ini dari aplikasi tanpanya.",
  "checkout.passwordsShown": "Kata laluan dagangan telah dipaparkan semasa pembelian ini mula-mula berjaya. Anda boleh berdagang dengan akaun ini dari aplikasi tanpanya.",
  "checkout.viewChallenge": "Lihat cabaran",
  "checkout.readOnly": "Sesi ini tidak boleh membeli cabaran.",

  // Account credentials
  "cred.login": "Log masuk",
  "cred.server": "Pelayan",
  "cred.password": "Kata laluan dagangan",
  "cred.investorPassword": "Kata laluan pelabur (baca sahaja)",
  "cred.show": "Tunjuk kata laluan",
  "cred.hide": "Sembunyi kata laluan",
  "copied": "{what} disalin",
  "a11y.copy": "Salin {what}",

  // Challenge statuses
  "status.pendingPayment": "Menunggu pembayaran",
  "status.provisioning": "Membuka akaun",
  "status.active": "Aktif",
  "status.funded": "Berdana",
  "status.failed": "Gagal",
  "status.closed": "Ditutup",
  "status.paymentFailed": "Pembayaran gagal",
  // {phase} is the phase name from the plan, e.g. "Phase 2"
  "stage.active": "{phase} · Aktif",
  "stage.failed": "{phase} · Gagal",
  "phaseStatus.provisioning": "Membuka",
  "phaseStatus.active": "Aktif",
  "phaseStatus.passed": "Lulus",
  "phaseStatus.failed": "Gagal",
  "phaseStatus.closed": "Ditutup",

  // Challenge cards (Prop home)
  "card.target": "Sasaran keuntungan",
  "card.profit": "Keuntungan",
  "card.equity": "Ekuiti {amount}",
  "card.dailyLeft": "Baki kerugian harian {amount}",
  "card.opening": "Akaun dagangan anda sedang dibuka. Ini mengambil masa beberapa saat.",

  // Dashboard
  "dash.equity": "Ekuiti",
  "dash.balance": "Baki",
  "dash.floating": "Terapung",
  "dash.open": "Terbuka",
  "dash.sinceStart": "sejak fasa bermula",
  "dash.rules": "Peraturan",
  "dash.rulesTitle": "Peraturan cabaran ini",
  "dash.notFound": "Cabaran tidak ditemui", // display
  "dash.notFoundBody": "Ia mungkin telah dibuka dengan log masuk lain.",
  "dash.backToProp": "Kembali ke Prop",
  "live.live": "Langsung",
  "live.connecting": "Menyambung…",
  "live.offline": "Luar talian",
  // {time}: date and time of the last rule check
  "live.updated": "Disemak {time}",
  // {time}: when the phase ended
  "live.final": "Muktamad · {time}",

  // Rule names (gauges, the rule log)
  "rule.dailyLoss": "Kerugian harian",
  "rule.maxDrawdown": "Drawdown maks",
  "rule.profitTarget": "Sasaran keuntungan",
  "rule.tradingDays": "Hari dagangan",
  "rule.timeLimit": "Had masa",
  "rule.weekendHolding": "Pegangan hujung minggu",
  "rule.newsWindow": "Tetingkap berita",
  "rule.bannedStrategy": "Strategi dilarang",
  "rule.consistency": "Konsistensi",
  "rule.riskDesk": "Keputusan meja risiko",
  "ruleState.ok": "Sedang berjalan",
  "ruleState.passed": "Dipenuhi",
  "ruleState.failed": "Dilanggar",
  "ruleState.off": "Mati",

  // Gauges
  "target.ofTarget": "daripada sasaran",
  "target.of": "Sasaran {amount} ({pct}%)",
  "target.left": "{amount} lagi",
  "target.reachedBy": "Dicapai, lebih {amount}",
  "limit.left": "Baki {amount}",
  "limit.breachAt": "Dilanggar pada {amount}",
  "days": { other: "{count} hari" },
  "days.of": "{v} daripada {min}",
  "days.count": { other: "{count} hari" },
  "days.met": "Minimum dipenuhi",
  "days.toGo": { other: "{count} lagi" },
  "days.noMinimum": "Tiada minimum",
  "time.left": "Baki {d}h {h}j",
  "time.deadline": "Tamat {date}",
  "consistency.rule": "Hari terbaik ≤ {pct}% daripada keuntungan",
  "consistency.noProfit": "Belum ada keuntungan",
  "reset.title": "Kerugian harian diset semula dalam",
  "reset.note": "17:00 New York, setiap hari dagangan",

  // Funded account: payout window ring
  "payoutHero.title": "Pembayaran seterusnya",
  "payoutHero.share": "Bahagian anda setakat ini",
  "payoutHero.open": "Dibuka", // display
  "payoutHero.ready": "Sedia", // display
  "payoutHero.days": { other: "{count} hari" }, // display
  "payoutHero.eligible": "Layak sekarang pada pembahagian {split}% anda.",
  "payoutHero.opens": "Tetingkap pembayaran dibuka {date}.",
  "payoutHero.later": "Mohon pembayaran sebaik sahaja anda mempunyai keuntungan yang layak.",

  // Big states
  "hero.opening.title": "Membuka akaun anda", // display
  "hero.opening.body": "Pembayaran telah disahkan dan akaun dagangan anda sedang disediakan. Halaman ini dikemas kini dengan sendirinya.",
  "hero.closed.title": "Cabaran ditutup", // display
  "hero.closed.body": "Akaun dagangan untuk cabaran ini tidak dapat dibuka, jadi cabaran telah ditutup dan yuran dikembalikan ke dompet USDT anda. Hubungi sokongan jika anda mempunyai soalan.",
  // {reason} is the prop service's reason, in English
  "hero.closed.reason": "{reason}. Yuran telah dikembalikan ke dompet USDT anda.",
  "hero.failed.title": "{phase} gagal", // display
  "hero.failed.on": "Tamat {date}",
  // {reason} is the breach reason from the risk engine
  "hero.failed.body": "{reason}. Setiap posisi telah ditutup dan akaun dilumpuhkan.",
  "hero.failed.ruleBreached": "Satu peraturan telah dilanggar",
  // {rule} is a rule name, e.g. "Kerugian harian"
  "hero.failed.rule": "{rule}: had dilanggar",
  "hero.failed.new": "Mulakan cabaran baharu",
  "hero.passed.title": "{phase} lulus", // display
  "hero.passed.on": "Lulus {date}.",
  "hero.passed.next": "Akaun {phase} anda telah dibuka.",
  "hero.passed.nextLogin": "Akaun {phase} anda telah dibuka (#{login}).",
  "hero.passed.opening": "Akaun seterusnya anda sedang dibuka.",
  "hero.passed.certificate": "Lihat sijil",
  "hero.passed.goNext": "Pergi ke {phase}",
  "hero.funded.title": "Berdana", // display
  "hero.funded.body": "Dagangkan akaun berdana dan ambil {split}% daripada keuntungan sebagai pembayaran.",
  "hero.funded.certificate": "Lihat sijil berdana anda",

  // Warnings while trading
  "warn.lossUsed": "{pct}% daripada had kerugian hari ini digunakan",
  "warn.lossUsedBody": "Ekuiti pada atau di bawah {floor} menggagalkan akaun dan menutup setiap posisi. Baki {left} hari ini.",
  "warn.weekend": "Penutupan hujung minggu",
  "warn.weekendBody": "Pelan ini tidak membenarkan pegangan melepasi hujung minggu: posisi terbuka ditutup pada Jumaat 16:45 New York.",

  // Actions
  "action.openTrade": "Buka dalam Dagangan",
  "action.trade": "Dagang",
  "action.tradeBlocked": "Hanya akaun semasa bagi cabaran aktif boleh didagangkan.",
  "action.payouts": "Pembayaran",
  "action.support": "Hubungi sokongan",

  // Equity chart
  "chart.title": "Keluk ekuiti",
  "chart.start": "Mula",
  "chart.target": "Sasaran",
  "chart.ddFloor": "Drawdown maks",
  "chart.dailyFloor": "Kerugian harian",
  "chart.now": "Kini",
  "chart.empty": "Keluk dipaparkan selepas beberapa minit pertama dagangan.",

  // Trading stats
  "stats.title": "Statistik dagangan",
  "stats.trades": "Dagangan",
  "stats.winRate": "Kadar menang",
  "stats.profitFactor": "Faktor keuntungan",
  "stats.avgWin": "Purata untung",
  "stats.avgLoss": "Purata rugi",
  "stats.lots": "Lot",
  "stats.bestDay": "Hari terbaik {date}: {amount}",

  // Rule log
  "events.title": "Log peraturan",
  "events.empty": "Tiada amaran atau pelanggaran. Kekalkannya begitu.",
  "events.equity": "ekuiti {amount}",
  "events.limit": "had {amount}",
  "severity.breach": "Pelanggaran",
  "severity.violation": "Pencabulan",
  "severity.warning": "Amaran",
  "severity.info": "Info",

  // Closed trades
  "trades.title": "Dagangan ditutup",
  "trades.all": "Semua {count}",
  "trades.count": { other: "{count} dagangan ditutup" },
  "trades.empty": "Belum ada dagangan ditutup.",
  "trades.buy": "Beli",
  "trades.sell": "Jual",
  // compact durations: s = saat, m = minit, j = jam, h = hari
  "duration.s": "{s}s",
  "duration.ms": "{m}m {s}s",
  "duration.hm": "{h}j {m}m",
  "duration.dh": "{d}h {h}j",

  // Account details
  "account.title": "Akaun",
  "account.split": "Pembahagian anda",
  "account.initial": "Baki permulaan",
  "account.started": "Fasa bermula",
  "account.ended": "Tamat",
  "account.deadline": "Tarikh akhir",
  "account.passwordNote": "Kata laluan dagangan telah dipaparkan sekali, semasa pembelian. Buka dalam Dagangan melog masuk anda ke akaun ini tanpanya.",

  // Payouts
  "payouts.title": "Pembayaran", // display
  "payouts.available": "Tersedia sekarang",
  "payouts.eligibleCount": { other: "{eligible} daripada {count} akaun berdana layak" },
  "payouts.requests": { other: "{count} permohonan" },
  "payouts.count": { other: "{count} pembayaran" },
  "payouts.paidToDate": "Dibayar setakat ini",
  "payouts.funded": "Akaun berdana",
  "payouts.account": "{size} berdana", // display
  "payouts.quote": "Sebut harga pembayaran",
  "payouts.eligibleNow": "Layak sekarang",
  "payouts.notYet": "Belum lagi",
  "payouts.toWallet": "ke dompet anda",
  "payouts.yourSplit": "Pembahagian anda",
  "payouts.firmShare": "Bahagian syarikat",
  "payouts.alreadyRefunded": "Sudah dikembalikan",
  "payouts.withFirst": "Bersama pembayaran pertama",
  "payouts.opens": "Dibuka {date}.",
  "payouts.minimum": "Minimum {amount}.",
  "payouts.kycNote": "Sahkan identiti anda untuk memohon pembayaran ini.",
  "payouts.kycPendingNote": "Anda boleh memohon pembayaran ini sebaik sahaja pengesahan identiti anda diluluskan.",
  "payouts.readOnly": "Sesi ini tidak boleh memohon pembayaran.",
  "payouts.request": "Mohon pembayaran",
  // opens the account's live rule dashboard; short: it shares a row with Trade
  "payouts.dashboard": "Peraturan",
  "payouts.history": "Sejarah",
  "payouts.historyEmpty": "Belum ada pembayaran.",
  "payouts.emptyTitle": "Belum ada akaun berdana", // display
  "payouts.emptyBody": "Lulus cabaran untuk mendapatkan akaun berdana. Mohon pembayaran di sini sebaik sahaja ia mempunyai keuntungan yang layak.",
  "payouts.emptyAction": "Dapatkan dana",
  "payoutStatus.pending": "Sedang disemak",
  "payoutStatus.approved": "Diluluskan",
  "payoutStatus.paid": "Dibayar",
  "payoutStatus.rejected": "Ditolak",
  "payoutStatus.failed": "Gagal",
  "split.title": "Pembahagian keuntungan dan penskalaan",
  "split.upTo": "Sehingga {pct}% dengan penskalaan",
  "split.cycle": "Pembayaran",
  // {days} e.g. "14 hari"
  "split.first": "Pertama selepas {days}",
  "split.firstNow": "Dari hari pertama",
  // {months} e.g. "4 bulan"; {cap} e.g. "$2,000,000"
  "scaling.text": "Buat keuntungan {profit}% dalam {months} dan akaun berkembang sebanyak {increase}%, sehingga {cap}.",
  "scaling.none": "Pelan ini tidak menskalakan akaun.",
  "months": { other: "{count} bulan" },

  // Payout request sheet
  "request.eyebrow": "Mohon pembayaran",
  "request.profit": "Keuntungan pada akaun",
  "request.share": "Bahagian anda ({pct}%)",
  "request.feeRefund": "Bayaran balik yuran cabaran",
  "request.total": "Jumlah ke dompet anda",
  "request.note": "Seluruh keuntungan semasa ditolak daripada akaun dagangan sekarang, supaya ia tidak boleh didagangkan semasa disemak. Setelah diluluskan, bahagian anda dikreditkan ke dompet USDT anda; jika permohonan ditolak, keuntungan dikembalikan ke akaun.",
  "request.submit": "Mohon {amount}",
  "request.done": "Pembayaran dimohon",
  "request.doneBody": "{amount} akan masuk ke dompet USDT anda setelah diluluskan.",

  // Identity verification (payouts)
  "kyc.verified": "Identiti disahkan: pembayaran boleh diluluskan.",
  "kyc.pendingTitle": "Pengesahan sedang disemak",
  "kyc.pendingText": "Pengesahan anda sedang disemak. Anda boleh memohon pembayaran sebaik sahaja identiti anda disahkan.",
  "kyc.requiredTitle": "Sahkan identiti anda",
  "kyc.requiredText": "Pembayaran hanya dibuat kepada pedagang yang disahkan. Sahkan sebelum pembayaran pertama anda.",
  "kyc.rejectedText": "Pengesahan anda telah ditolak. Hantar semula untuk menerima pembayaran.",

  // Why a payout can't be requested yet
  "blocker.notYetEligible": "Tetingkap pembayaran belum dibuka.",
  "blocker.belowMinimum": "Keuntungan berada di bawah pembayaran minimum.",
  "blocker.positionsOpen": "Tutup setiap posisi terbuka untuk memohon pembayaran.",
  "blocker.payoutPending": "Satu pembayaran sudah sedang disemak.",
  "blocker.consistency": "Peraturan konsistensi tidak dipenuhi: hari terbaik anda merupakan bahagian keuntungan yang terlalu besar.",

  // Certificates
  "certs.title": "Sijil", // display
  "certs.subtitle": "Setiap fasa yang anda lulus, setiap akaun berdana dan setiap pembayaran memperoleh sijil yang boleh disahkan oleh sesiapa sahaja.",
  "certs.kind.pass": "Fasa lulus",
  "certs.kind.funded": "Pedagang berdana",
  "certs.kind.payout": "Pembayaran",
  "certs.revoked": "Dibatalkan",
  "certs.revokedBody": "Sijil ini telah dibatalkan oleh Kalks dan tidak lagi sah, jadi ia tidak boleh dikongsi.",
  "certs.meta": "{plan} · {size} · {date}",
  "certs.number": "No. {code}",
  "certs.shareImage": "Kongsi imej",
  "certs.shareLink": "Kongsi pautan",
  "certs.copyLink": "Salin pautan",
  "certs.linkCopied": "Pautan pengesahan disalin",
  "certs.shareTitle": "Sijil Kalks Prop saya",
  "certs.shareMessage": "Sijil Kalks Prop saya. Sahkannya di sini:",
  "certs.shareFailed": "Tidak dapat berkongsi sijil. Sila cuba lagi.",
  "certs.shareUnavailable": "Perkongsian tidak tersedia pada peranti ini.",
  "certs.emptyTitle": "Belum ada sijil", // display
  "certs.emptyBody": "Lulus fasa cabaran untuk memperoleh sijil pertama anda, dengan pautan awam yang boleh disahkan oleh sesiapa sahaja.",
  "certs.emptyAction": "Layari cabaran",

  // Rule words shared by the checkout and the rules sheet
  "accountSize": "Saiz akaun",
  "profitSplit": "Pembahagian keuntungan",
  "feeRefund": "Bayaran balik yuran",
  "nonRefundable": "Tidak boleh dikembalikan",
  "leverage": "Leveraj",
  "none": "Tiada",
  "allowed": "Dibenarkan",
  "notAllowed": "Tidak dibenarkan",
  "noTimeLimit": "Tiada had masa",
  // {phase} is the phase name, e.g. "Fasa 1"
  "rules.phaseTarget": "Sasaran {phase}",
  "rules.phaseMinDays": "Hari minimum {phase}",
  "rules.phaseTimeLimit": "Had masa {phase}",
  "rules.evaluation": "Penilaian",
  "rules.evaluationNone": "Tiada, berdana dari hari pertama",
  "rules.dailyLoss": "Had kerugian harian",
  "rules.dailyLossBalance": "{pct}% · {amount} · daripada baki pada 17:00 New York",
  "rules.dailyLossEquity": "{pct}% · {amount} · daripada baki atau ekuiti yang lebih tinggi pada 17:00 New York",
  "rules.ddStatic": "{pct}% statik",
  "rules.ddTrailing": "{pct}% trailing",
  "rules.ddLocks": "{dd}, dikunci pada permulaan",
  // ≤ = at most
  "rules.consistencyValue": "Hari terbaik ≤ {pct}% daripada jumlah keuntungan",
  "rules.news": "Dagangan berita",
  "rules.newsBlocked": "Tidak dalam ±{min} min berita impak tinggi",
  "rules.newsBlockedFails": "Tidak dalam ±{min} min berita impak tinggi (menggagalkan akaun)",
  "rules.weekendClosed": "Posisi ditutup Jumaat 16:45 New York",
  "rules.ea": "Expert Advisors",
  "rules.banned": "Strategi dilarang",
  "rules.splitScaling": "{split}%, berskala sehingga {max}%",
  "rules.firstPayout": "Pembayaran pertama",
  // {freq} is a lower-case payout cycle, e.g. "setiap minggu"
  "rules.firstPayoutValue": "Selepas {days}, kemudian {freq} · min {min}",
  "rules.refunded": "Dikembalikan bersama pembayaran pertama",

  // Banned trading strategies
  "banned.hft": "Dagangan frekuensi tinggi",
  "banned.latencyArbitrage": "Arbitraj kependaman",
  "banned.tickScalping": "Scalping tik",
  "banned.crossAccountCopying": "Penyalinan antara akaun",
  "banned.crossAccountHedging": "Hedging antara akaun",
  "banned.martingale": "Martingale",
  "banned.grid": "Dagangan grid",

  // Payout cycle, lower case: used inside sentences ("kemudian setiap minggu")
  "payoutFreq.weekly": "setiap minggu",
  "payoutFreq.biWeekly": "setiap 2 minggu",
  "payoutFreq.monthly": "setiap bulan",
  "payoutFreq.onDemand": "atas permintaan",

  // Errors (messages for the prop service's error codes)
  "errorLink.deposit": "Deposit",
  "errorLink.verify": "Sahkan identiti",
  "error.insufficientFunds": "Baki dompet USDT anda terlalu rendah untuk yuran ini. Buat deposit USDT dan cuba lagi.",
  "error.kycRequired": "Sahkan identiti anda sebelum memohon pembayaran.",
  "error.paymentPending": "Kami belum dapat mengesahkan pembayaran dompet. Cuba lagi dalam seminit: anda tidak akan dicaj dua kali.",
  "error.paymentFailed": "Pembayaran dompet tidak berjaya. Anda tidak dicaj.",
  "error.walletPending": "Dompet belum mengesahkan. Sila cuba lagi dalam seminit.",
  "error.walletRejected": "Dompet menolak pembayaran ini. Sila hubungi sokongan.",
  "error.provisioning": "Pembayaran diterima. Akaun dagangan anda masih sedang dibuka: ia akan dipaparkan di bawah cabaran anda dalam masa seminit.",
  "error.planUnavailable": "Pelan atau saiz ini tidak lagi tersedia. Sila pilih yang lain.",
  "error.notYetEligible": "Akaun ini belum layak untuk pembayaran.",
  "error.belowMinimum": "Keuntungan berada di bawah pembayaran minimum.",
  "error.positionsOpen": "Tutup setiap posisi terbuka sebelum memohon pembayaran.",
  "error.payoutPending": "Pembayaran untuk akaun ini sudah sedang disemak.",
  "error.consistency": "Peraturan konsistensi belum dipenuhi: hari terbaik anda merupakan bahagian keuntungan yang terlalu besar.",
  "error.notFunded": "Pembayaran tersedia pada akaun berdana sahaja.",
  "error.accountUnavailable": "Kami tidak dapat membuka akaun dagangan untuk cabaran ini, jadi yuran telah dikembalikan ke dompet USDT anda. Hubungi sokongan jika perkara ini berulang.",
  "error.idempotencyConflict": "Pembayaran ini telah digunakan untuk pembelian lain. Tutupnya dan mulakan semula.",
  "error.notActive": "Cabaran ini tidak aktif.",
  "error.accountLimit": "Anda telah mencapai bilangan maksimum akaun prop. Hubungi sokongan untuk menaikkan had.",
  "error.staffReadOnly": "Ini ialah sesi kakitangan baca sahaja. Perubahan tidak dibenarkan.",
  "error.engine": "Pelayan dagangan tidak memberi respons. Sila cuba sebentar lagi.",
  "error.generic": "Berlaku ralat. Sila cuba lagi.",
  "load.title": "Prop tidak tersedia", // display
  "load.body": "Kami tidak dapat menghubungi perkhidmatan prop. Akaun anda selamat; sila cuba lagi sebentar lagi.",
};
export default mobileProp;
