import type { NsMessages } from "../../core";

// Kalks mobile app: Algo (/algo): strategies running 24/7 on the server (deployments), the kill switch, backtest
// reports, the strategy marketplace, API keys and webhooks.
// Keep as they are: Kalks, Algo, API, USDT, USD, indicator names (EMA, RSI, MACD, ATR, CCI, ADX, DI…), symbols
// (EURUSD, XAUUSD), timeframes (M15, H1, H4), "R", P&L, DD, SL / TP. Terms follow the `developer` namespace
// (backtest, deploy / men-deploy, deployment, kill switch, marketplace, webhook). Compact units: h = hari, j = jam.
// Titles marked (display) are shown in tall uppercase display type: keep them short.
const mobileAlgo: NsMessages<"mobileAlgo"> = {
  never: "tidak pernah",
  // {n} days, compact
  days: "{n} h",
  lot: "lot",
  // How long a trade was held: m = menit, j = jam, h = hari (compact)
  "dur.m": "{m}m",
  "dur.h": "{h}j",
  "dur.hm": "{h}j {m}m",
  "dur.d": "{d}h",
  "dur.dh": "{d}h {h}j",
  nTrades: { other: "{count} transaksi" },
  readOnly: "Login ini dapat melihat strategi tetapi tidak dapat mengubah apa pun.",

  /* ---------------------------------------------------------------- */
  /* Screen states                                                     */
  /* ---------------------------------------------------------------- */
  "state.unavailable.title": "Algo tidak tersedia", // (display)
  "state.unavailable.text": "Kami tidak dapat terhubung ke layanan strategi. Strategi Anda tetap berjalan di server; silakan coba lagi sebentar lagi.",
  "state.disabled.title": "Tidak tersedia", // (display)
  "state.disabled.text": "Fitur ini tidak tersedia di akun Anda.",
  "state.notFound.title": "Tidak ditemukan", // (display)
  "state.notFound.text": "Mungkin telah dihapus, atau tautannya salah.",
  "state.back": "Kembali ke Algo",

  /* ---------------------------------------------------------------- */
  /* Server errors (codes of the strategy service)                     */
  /* ---------------------------------------------------------------- */
  "error.haltedMine": "Kill switch Anda aktif. Lepaskan di layar Algo sebelum menjalankan strategi lagi.",
  "error.haltedPlatform": "Trading otomatis sedang dijeda oleh broker. Silakan coba lagi nanti.",
  // {n} = the most strategies that can run at once
  "error.limitRunning": "Anda dapat menjalankan hingga {n} strategi sekaligus. Hentikan salah satu terlebih dahulu.",
  "error.accountStatus": "Akun ini tidak dapat trading saat ini.",
  "error.alreadyRunning": "Versi ini sudah berjalan di akun tersebut.",
  "error.invalidStrategy": "Perbaiki kesalahan strategi terlebih dahulu (di Client Area atau dengan AI Trader).",
  "error.state": "Statusnya sudah berubah. Tarik ke bawah untuk melihat status terkini.",
  "error.queueFull": "Anda sudah memiliki 3 backtest dalam antrean atau sedang berjalan. Tunggu salah satu selesai.",
  "error.dailyLimit": "Anda telah mencapai batas {n} backtest hari ini.",
  "error.ownListing": "Anda tidak dapat berlangganan strategi Anda sendiri.",
  "error.subscribed": "Anda sudah berlangganan strategi ini.",
  "error.cloneNotAllowed": "Pembuat tidak mengizinkan kloning; salin ke akun Anda sebagai gantinya.",
  // {amount} in USDT
  "error.insufficientFunds": "Saldo dompet Anda di bawah {amount} USDT. Deposit USDT untuk berlangganan.",
  "error.insufficientFundsPlain": "Saldo dompet Anda terlalu rendah. Deposit USDT untuk berlangganan.",
  "error.inactive": "Langganan ini sudah tidak aktif.",
  "error.archiveRunning": "Hentikan deployment strategi ini sebelum mengarsipkannya.",
  "error.archived": "Strategi ini diarsipkan.",
  "error.finished": "Backtest ini sudah selesai.",
  "error.revoked": "Kunci ini sudah dicabut.",
  "error.notFound": "Sudah tidak ada.",
  // {tf} = timeframe (H1), {days} = number of days
  "error.rangeTooLong": "Backtest {tf} dapat mencakup paling lama {days} hari. Pilih periode yang lebih pendek.",
  "error.balanceRange": "Saldo awal harus antara 100 dan 10,000,000.",
  "error.dates": "Tanggal mulai harus sebelum tanggal akhir.",

  /* ---------------------------------------------------------------- */
  /* Home                                                              */
  /* ---------------------------------------------------------------- */
  "home.eyebrow": "Trading otomatis",
  "home.title": "Algo", // (display)
  "home.heroEyebrow": "Sedang berjalan",
  "home.heroRunning": { other: "strategi trading 24/7 di server" },
  "home.heroRealized": "P&L terealisasi",
  "home.heroOpen": "Terbuka sekarang",
  // closed trades so far
  "home.heroTrades": "Transaksi",
  "home.qaAi": "Buat dengan AI",
  "home.qaAiHint": "Jelaskan ide, dapatkan aturan pasti",
  "home.qaMarket": "Marketplace",
  "home.qaMarketHint": "Salin strategi terverifikasi",
  "home.qaKeys": "Kunci API & webhook",
  "home.qaKeysHint": "Penggunaan, pencabutan, peringatan terbaru",
  "home.running": "Deployment", // (display)
  "home.runningSub": { zero: "Tidak ada yang berjalan saat ini", other: "{count} berjalan" },
  // {n} = count shown on the filter pill
  "home.filterActive": "Aktif · {n}",
  "home.filterAll": "Semua · {n}",
  "home.strategies": "Strategi saya", // (display)
  "home.strategiesSub": { zero: "Belum ada yang disimpan", other: "{count} tersimpan" },
  "home.newWithAi": "Baru dengan AI",
  "home.backtests": "Backtest", // (display)
  "home.backtestsSub": "Pengujian terakhir, terbaru di atas",
  "home.emptyDeps": "Belum ada yang dijalankan. Buka salah satu strategi Anda di bawah dan deploy di akun demo terlebih dahulu.",
  "home.emptyActive": "Tidak ada yang berjalan saat ini. Strategi yang dihentikan ada di Semua.",
  "home.showAll": "Tampilkan semua",
  "home.emptyStrats": "Belum ada strategi milik Anda. Jelaskan ide Anda kepada AI Trader dan ide itu menjadi aturan pasti yang dapat Anda uji.",
  "home.browseMarket": "Jelajahi marketplace",
  "home.emptyBts": "Belum ada backtest. Buka strategi dan jalankan pada riwayat harga nyata.",
  "home.startEyebrow": "Memulai",
  "home.startTitle": "Jalankan strategi", // (display)
  "home.step1": "Jelaskan ide Anda kepada AI Trader: ide itu menjadi aturan pasti yang dapat Anda baca dan ubah.",
  "home.step2": "Uji aturan dengan backtest pada riwayat harga nyata, dengan biaya akun Anda.",
  "home.step3": "Jalankan 24/7 di akun demo terlebih dahulu. Jeda, hentikan, atau matikan kapan saja.",
  "home.footnote": "Strategi berjalan di server Kalks sepanjang waktu, pada bar tertutup, dengan pemeriksaan order yang sama seperti trading manual: margin, jam pasar, dan batas Anda. Buat dan edit strategi dengan AI Trader atau di Client Area.",
  "home.openWeb": "Buka pembuat strategi di web",

  /* ---------------------------------------------------------------- */
  /* Kill switch (account-wide)                                        */
  /* ---------------------------------------------------------------- */
  "kill.cardTitle": "Kill switch",
  "kill.cardBody": "Hentikan setiap strategi sekaligus dan blokir order webhook dan API.",
  "kill.stopAll": "Hentikan semua",
  "kill.onTitle": "Kill switch aktif",
  // {at} = date and time
  "kill.onSince": "Sejak {at}. Strategi dihentikan; order webhook dan API diblokir.",
  "kill.onBody": "Strategi dihentikan; order webhook dan API diblokir.",
  "kill.release": "Lepaskan",
  "kill.title": "Hentikan semuanya?", // (display)
  "kill.body": {
    zero: "Setiap strategi langsung berhenti, dan order webhook dan API diblokir sampai Anda melepaskan switch.",
    other: "{count} strategi yang berjalan langsung berhenti, dan order webhook dan API diblokir sampai Anda melepaskan switch.",
  },
  "kill.alsoClose": "Tutup juga posisinya",
  "kill.alsoCloseHint": "Menutup, pada harga pasar, setiap posisi yang dibuka oleh strategi, webhook, atau API di semua akun Anda. Transaksi manual Anda tetap terbuka.",
  "kill.confirm": "Hentikan semua sekarang",
  "kill.doneTitle": "Semua dihentikan", // (display)
  "kill.stopped": "Strategi dihentikan",
  "kill.doneBody": "Kill switch tetap aktif sampai Anda melepaskannya. Strategi yang dihentikan tidak berjalan kembali dengan sendirinya.",
  "kill.releaseTitle": "Lepaskan kill switch?", // (display)
  "kill.releaseBody": "Order webhook dan API diizinkan lagi. Strategi yang dihentikan tetap berhenti: deploy lagi saat Anda siap.",
  "kill.releasedTitle": "Switch dilepaskan", // (display)
  "kill.releasedBody": "Order webhook dan API diizinkan lagi. Deploy strategi untuk menjalankannya.",
  "kill.globalTitle": "Trading otomatis dijeda",
  "kill.globalBody": "Broker telah menjeda setiap strategi, webhook, dan order API untuk sementara. Posisi terbuka tetap mempertahankan stop-nya.",

  /* ---------------------------------------------------------------- */
  /* Deployment statuses, controls                                     */
  /* ---------------------------------------------------------------- */
  "dep.status.running": "Berjalan",
  "dep.status.paused": "Dijeda",
  "dep.status.stopped": "Dihentikan",
  "dep.status.killed": "Dimatikan",
  "dep.status.error": "Kesalahan",
  "dep.realized": "P&L terealisasi",
  "dep.trades": "Transaksi",
  "dep.winRate": "Win rate",
  "dep.open": "Terbuka",
  "dep.orders": "Order",
  "dep.openNow": "Terbuka",
  // {ago} = "5 menit lalu"
  "dep.lastCheck": "Bar terakhir diperiksa {ago}",
  // {since} = start date
  "dep.lastCheckSince": "Bar terakhir diperiksa {ago} · berjalan sejak {since}",
  // {reason} = the service's reason
  "dep.stoppedWhy": "Dihentikan: {reason}",
  "dep.stoppedTitle": "Dihentikan {at}",
  "dep.errorTitle": "Strategi mengalami kesalahan",
  // {account} = "Demo 50000083"
  "dep.eyebrow": "Deployment · {account}",
  "dep.marketplaceCopy": "Salinan marketplace",
  "dep.openStrategy": "Buka strategi",
  "dep.openSubscription": "Buka langganan saya",
  // {pct} = return %, {amount} = starting balance
  "dep.onStart": "{pct} dari {amount}",
  "dep.curveA11y": "Saldo per hari selama {days} hari, terealisasi {pnl}",
  "dep.tabLog": "Log · {n}",
  "dep.tabTrades": "Transaksi · {n}",
  "dep.tabSetup": "Pengaturan",
  "dep.noLogs": "Belum ada log: bar tertutup pertama digunakan untuk pemanasan.",
  "dep.noTrades": "Belum ada transaksi.",
  "dep.older": "Muat entri lebih lama",
  "dep.logStart": "Itu entri pertama.",
  "dep.rules": "Aturan",
  "dep.rulesHidden": "Pembuat merahasiakan aturannya: strategi berjalan di akun Anda sebagaimana dipublikasikan.",
  "dep.lotMultiplier": "Pengali lot",
  "dep.maxLots": "Lot maks per order",
  "dep.maxOpen": "Posisi terbuka maks",
  "dep.dailyLoss": "Batas rugi harian",
  "dep.started": "Dimulai",
  "dep.startBalance": "Saldo awal",
  "dep.setupNote": "Deployment menjalankan satu versi yang tepat: menyimpan versi baru tidak mengubahnya. Deploy versi baru untuk beralih.",

  "ctl.pause": "Jeda",
  "ctl.resume": "Lanjutkan",
  "ctl.stop": "Hentikan",
  "ctl.kill": "Matikan",
  "ctl.killNow": "Matikan sekarang",
  "ctl.closePositions": "Tutup posisi",
  "ctl.pauseTitle": "Jeda?", // (display)
  "ctl.pauseBody": "Tidak ada transaksi baru. Posisi terbuka tetap mempertahankan stop, target, dan breakeven-nya. Lanjutkan kapan pun Anda mau.",
  "ctl.resumeTitle": "Lanjutkan?", // (display)
  "ctl.resumeBody": "Strategi kembali trading mulai bar tertutup berikutnya.",
  "ctl.stopTitle": "Hentikan?", // (display)
  "ctl.stopBody": "Strategi berhenti permanen: tidak ada transaksi baru. Untuk menjalankannya lagi, deploy ulang.",
  "ctl.keepTitle": "Biarkan posisi tetap terbuka",
  "ctl.keepText": { other: "{count} posisi terbuka tetap mempertahankan stop dan targetnya; kelola sendiri." },
  "ctl.closeAllTitle": "Tutup sekarang",
  "ctl.closeAllText": { other: "{count} posisi terbuka ditutup pada harga pasar." },
  "ctl.killTitle": "Matikan sekarang?", // (display)
  "ctl.killBody": "Kill switch langsung menghentikan strategi ini, dan secara default menutup posisi yang dibukanya pada harga pasar.",
  "ctl.killClose": "Tutup posisinya",
  "ctl.killCloseHint": "Pada harga pasar, sekarang. Nonaktifkan untuk membiarkannya terbuka dengan stop-nya.",
  "ctl.closeTitle": "Tutup posisinya?", // (display)
  "ctl.closeBody": { other: "{count} posisi yang dibuka strategi ini ditutup pada harga pasar. Strategi tetap berjalan." },
  "ctl.done.pause": "Dijeda", // (display)
  "ctl.done.resume": "Berjalan lagi", // (display)
  "ctl.done.stop": "Dihentikan", // (display)
  "ctl.done.kill": "Dimatikan", // (display)
  "ctl.done.close": "Posisi ditutup", // (display)
  "ctl.donePause": "Tidak ada transaksi baru sampai Anda melanjutkannya.",
  "ctl.doneResume": "Strategi kembali trading mulai bar tertutup berikutnya.",
  "ctl.doneClosed": { other: "{count} posisi ditutup." },
  "ctl.doneKept": "Posisi terbukanya, jika ada, tetap terbuka dengan stop dan targetnya.",
  "ctl.doneNothing": "Tidak ada posisi terbuka untuk ditutup.",
  "ctl.closedLabel": "Ditutup",
  "ctl.failedLabel": "Tidak dapat ditutup",
  "ctl.failedTitle": { other: "{count} posisi tidak dapat ditutup" },
  "ctl.failedBody": "Pasar mungkin sedang tutup. Tutup dari Portofolio saat trading dibuka kembali.",
  // stopping or killing a marketplace copy leaves its subscription (and a paid one's renewals) running
  "ctl.copyNote": "Ini adalah salinan marketplace: menghentikannya tidak mengakhiri langganan. Untuk berhenti membayar, batalkan di Marketplace › Langganan.",

  /* ---------------------------------------------------------------- */
  /* Strategy                                                          */
  /* ---------------------------------------------------------------- */
  // {version} = version number
  "strat.eyebrow": "Strategi · v{version}",
  "strat.runningN": { other: "{count} berjalan" },
  "strat.draft": "Draf",
  "strat.ready": "Siap",
  "strat.errors": { other: "{count} kesalahan" },
  "strat.archivedTag": "Diarsipkan",
  "strat.lastBacktest": "Backtest terakhir",
  "strat.backtested": "backtest",
  "strat.notTested": "Belum di-backtest", // (display)
  "strat.notTestedBody": "Uji aturan pada riwayat harga nyata, dengan biaya akun Anda, sebelum menjalankannya.",
  "strat.runFirst": "Jalankan backtest",
  "strat.openReport": "Buka laporan lengkap",
  "strat.deployV": "Deploy v{version}",
  "strat.backtest": "Backtest",
  "strat.fixFirst": "Perbaiki ini sebelum pengujian atau deploy",
  "strat.line": "Baris {n}:",
  "strat.rules": "Aturan", // (display)
  "strat.rulesSub": "Diperiksa pada setiap bar tertutup",
  "strat.rulesCodeSub": "Sinyal kode, diperiksa pada setiap bar tertutup",
  "strat.showCode": "Tampilkan sebagai kode",
  "strat.risk": "Risiko", // (display)
  "strat.riskSub": "Ukuran, stop, jam, dan batas",
  "strat.editVisual": "Untuk mengubah aturan, tanyakan AI Trader atau edit di Client Area; setiap perubahan disimpan sebagai versi baru.",
  "strat.editCode": "Strategi kode diedit di Client Area versi web; setiap perubahan disimpan sebagai versi baru.",
  "strat.openWeb": "Edit kode di web",
  "strat.deployments": "Deployment", // (display)
  "strat.deploymentsSub": { zero: "Tidak berjalan di mana pun", other: "{count} deployment" },
  "strat.notRunning": "Tidak berjalan. Deploy di akun demo terlebih dahulu untuk melihat cara strategi bertransaksi secara live.",
  "strat.backtests": "Backtest", // (display)
  "strat.backtestsSub": { zero: "Belum ada", other: "{count} pengujian" },
  "strat.runNew": "Jalankan baru",
  "strat.noBacktests": "Belum ada backtest.",
  "strat.versions": "Versi", // (display)
  "strat.versionsSub": { other: "{count} versi" },
  "strat.current": "Saat ini",
  "strat.archive": "Arsipkan",
  "strat.archiveTitle": "Arsipkan?", // (display)
  "strat.archiveBody": "“{name}” dihapus dari daftar Anda. Backtest dan deployment sebelumnya tetap ada di riwayat Anda.",
  "strat.archived": "“{name}” diarsipkan",

  "kind.visual": "Aturan visual",
  "kind.code": "Kode",
  // Where a strategy came from
  "origin.ai": "AI Trader",
  "origin.template": "Template",
  "origin.manual": "Dibuat manual",
  "origin.marketplace": "Marketplace",

  /* ---------------------------------------------------------------- */
  /* Rules in words                                                    */
  /* ---------------------------------------------------------------- */
  "rules.buy": "Buy saat",
  "rules.sell": "Sell saat",
  "rules.exitBuy": "Tutup buy saat",
  "rules.exitSell": "Tutup sell saat",
  "rules.and": "dan",
  "rules.or": "atau",
  // {tf} = timeframe, e.g. "di H4"
  "rules.onTf": "di {tf}",
  "rules.noRules": "Belum ada aturan entry.",
  "rules.size": "Ukuran",
  "rules.stop": "Stop loss",
  "rules.target": "Take profit",
  "rules.trailing": "Trailing",
  "rules.window": "Jam trading",
  "rules.limits": "Batas",
  "rules.none": "Tidak ada",
  "rules.lots": "{lots} lot",
  "rules.riskPct": "risiko {pct}% per transaksi",
  "rules.maxLots": "maks {lots} lot",
  // points: move the stop to entry + {o} after {v} points in profit
  "rules.breakeven": "breakeven pada {v} poin (+{o})",
  "rules.allDay": "Sepanjang waktu",
  "rules.perDay": { other: "{count} transaksi per hari" },
  "rules.dailyLoss": "Berhenti untuk hari itu saat rugi {amount}",
  "rules.oneAtATime": "Satu posisi dalam satu waktu",
  "rules.closeOutside": "Menutup di luar jam trading",
  "rules.noLimits": "Tanpa batas harian",
  "op.crossesAbove": "memotong ke atas",
  "op.crossesBelow": "memotong ke bawah",
  "dist.pips": "{v} pip",
  "dist.points": "{v} poin",
  "dist.price": "di {v}",
  "dist.percent": "{v}% dari harga",
  // {v} × ATR({p})
  "dist.atr": "{v} × ATR({p})",
  "dist.level": "level {v}",
  // a multiple of the stop distance
  "dist.rr": "{v}R",
  "field.close": "Close",
  "field.open": "Open",
  "field.high": "High",
  "field.low": "Low",
  "field.hl2": "Harga median",
  "field.hlc3": "Harga tipikal",
  "field.ohlc4": "Harga rata-rata",
  "field.volume": "Volume",
  "pattern.bullish": "Candle bullish",
  "pattern.bearish": "Candle bearish",
  "pattern.bullish_engulfing": "Bullish engulfing",
  "pattern.bearish_engulfing": "Bearish engulfing",
  "pattern.hammer": "Hammer",
  "pattern.shooting_star": "Shooting star",
  "pattern.doji": "Doji",
  "pattern.inside_bar": "Inside bar",
  "ind.sma": "SMA",
  "ind.ema": "EMA",
  "ind.wma": "WMA",
  "ind.rsi": "RSI",
  "ind.macd": "MACD",
  "ind.macd_signal": "Sinyal MACD",
  "ind.macd_hist": "Histogram MACD",
  "ind.bb_upper": "Bollinger atas",
  "ind.bb_middle": "Bollinger tengah",
  "ind.bb_lower": "Bollinger bawah",
  "ind.atr": "ATR",
  "ind.stoch_k": "Stochastic %K",
  "ind.stoch_d": "Stochastic %D",
  "ind.highest": "High tertinggi",
  "ind.lowest": "Low terendah",
  "ind.cci": "CCI",
  "ind.willr": "Williams %R",
  "ind.adx": "ADX",
  "ind.plus_di": "+DI",
  "ind.minus_di": "−DI",
  "ind.momentum": "Momentum",
  "ind.roc": "ROC",
  "ind.stddev": "Standar deviasi",
  "note.noDailyLimit": "Tanpa batas transaksi harian",
  "note.noStop": "Tanpa stop loss: posisi tidak terlindungi",
  "note.riskNeedsStop": "Ukuran berbasis risiko memerlukan stop loss",
  "note.rrNeedsStop": "Take profit dalam R memerlukan stop loss",
  "note.noEntry": "Tanpa aturan entry: tambahkan kondisi buy atau sell",

  /* ---------------------------------------------------------------- */
  /* Deploy (form)                                                     */
  /* ---------------------------------------------------------------- */
  "deploy.eyebrow": "Deploy · v{version}",
  "deploy.title": "Jalankan 24/7", // (display)
  "deploy.body": "“{name}” v{version} memperdagangkan {symbol} pada setiap bar {tf} tertutup, di server Kalks, bahkan saat ponsel Anda mati. Jeda, hentikan, atau matikan kapan saja.",
  "deploy.account": "Akun",
  "deploy.equity": "Ekuitas {amount}",
  "deploy.noAccounts": "Anda memerlukan akun trading aktif. Buka akun demo untuk mencoba strategi tanpa risiko.",
  "deploy.openAccount": "Buka akun",
  "deploy.multiplier": "Pengali lot",
  "deploy.multiplierHint": "Menyesuaikan ukuran setiap order. 1× memperdagangkan ukuran bawaan strategi.",
  "deploy.maxOpen": "Posisi terbuka maks",
  "deploy.maxOpenHint": "Batas tambahan di atas aturan strategi itu sendiri.",
  "deploy.strategyDefault": "Aturan strategi",
  "deploy.dailyLoss": "Batas rugi harian",
  "deploy.dailyLossHint": "Saat kerugian tertutup dan terbuka hari itu mencapainya, tidak ada transaksi baru sampai besok (waktu server).",
  "deploy.off": "Nonaktif",
  "deploy.custom": "Kustom",
  "deploy.dailyLossAmount": "Rugi per hari",
  "deploy.lossInvalid": "Masukkan jumlah di atas 0.",
  "deploy.liveTitle": "Uang sungguhan",
  "deploy.liveBody": "Ini adalah akun live. Strategi memasang order nyata dengan uang sungguhan, dan dapat mengalami kerugian.",
  "deploy.ack": "Saya memahami bahwa strategi memperdagangkan uang sungguhan di akun live saya dan saya bertanggung jawab atasnya.",
  "deploy.note": "Trading otomatis dapat merugi. Backtest adalah simulasi dan tidak memprediksi hasil di masa depan. Ini bukan saran keuangan.",
  // {account} = "Demo 50000083"
  "deploy.confirm": "Deploy di {account}",
  "deploy.doneTitle": "Berjalan", // (display)
  "deploy.doneBody": "“{name}” v{version} berjalan di {account}.",
  "deploy.warmup": "Bar {tf} tertutup pertama digunakan untuk pemanasan; order dapat dimulai dari bar berikutnya.",
  "deploy.open": "Buka deployment",

  /* ---------------------------------------------------------------- */
  /* Backtests                                                         */
  /* ---------------------------------------------------------------- */
  "bt.status.queued": "Dalam antrean",
  "bt.status.running": "Berjalan",
  "bt.status.done": "Selesai",
  "bt.status.failed": "Gagal",
  "bt.status.cancelled": "Dibatalkan",
  "bt.stage.queued": "Menunggu worker yang kosong",
  "bt.stage.loading": "Memuat riwayat harga",
  "bt.stage.m1": "Memuat bar menit",
  "bt.stage.simulating": "Menyimulasikan transaksi",
  "bt.stage.running": "Berjalan",
  // {id} = backtest number, {version} = strategy version
  "bt.eyebrow": "Backtest #{id} · v{version}",
  "bt.title": "Backtest", // (display)
  "bt.start": "Awal {amount}",
  "bt.runningNote": "Berjalan di server: Anda dapat meninggalkan layar ini dan kembali nanti.",
  "bt.failed": "Backtest gagal",
  "bt.cancelled": "Dibatalkan", // (display)
  "bt.runAgain": "Jalankan lagi",
  "bt.net": "Profit bersih",
  // {pct} = return, {amount} = starting balance
  "bt.returnOf": "{pct} dari {amount}",
  "bt.pf": "Profit factor",
  "bt.winRate": "Win rate",
  "bt.winsOf": "{wins} dari {trades}",
  "bt.maxDd": "Drawdown maks",
  "bt.maxDdShort": "DD maks",
  "bt.sharpe": "Sharpe",
  "bt.sortino": "Sortino {v}",
  "bt.trades": "Transaksi",
  "bt.longShort": "{long} long · {short} short",
  "bt.expectancy": "Ekspektasi",
  "bt.perTrade": "per transaksi",
  "bt.equity": "Ekuitas", // (display)
  "bt.drawdown": "Drawdown",
  "bt.legendEquity": "Ekuitas",
  "bt.legendBalance": "Saldo",
  "bt.legendStart": "Awal",
  "bt.noCurve": "Bar tidak cukup untuk membuat kurva.",
  "bt.scrubHint": "Seret di sepanjang grafik, atau sentuh dan tahan, untuk membaca titik mana pun.",
  "bt.curveA11y": "Ekuitas dari {from} hingga {to}; drawdown maksimum {dd}",
  "bt.monthly": "Bulanan", // (display)
  "bt.monthlySub": "Imbal hasil tiap bulan, % dari saldo",
  "bt.noTradesMonth": "tanpa transaksi",
  "bt.statistics": "Statistik", // (display)
  "bt.tradeList": "Transaksi", // (display)
  "bt.tradeListSub": "Terbaru di atas, setelah biaya",
  "bt.truncated": "{n} transaksi pertama, terbaru di atas",
  "bt.fAll": "Semua · {n}",
  "bt.fWins": "Profit · {n}",
  "bt.fLosses": "Rugi · {n}",
  "bt.noTrades": "Aturan tidak menghasilkan transaksi pada periode ini.",
  "bt.data": "Data & biaya", // (display)
  "bt.m1Bars": "Bar menit (intrabar)",
  "bt.since": "sejak {date}",
  "bt.signals": "Sinyal",
  "bt.signalsValue": "{buy} buy · {sell} sell · {exits} exit",
  "bt.skipped": "Dilewati: {reason}",
  "bt.model": "Model",
  "bt.group": "Jenis akun",
  "bt.spread": "Spread",
  "bt.spreadValue": "{points} poin ({source})",
  "bt.commission": "Komisi",
  "bt.perLot": "{amount} per lot",
  "bt.swaps": "Swap",
  "bt.swapsOn": "Dikenakan pada setiap rollover",
  "bt.swapsOff": "Tidak dikenakan (bebas swap)",
  "bt.conversion": "Konversi P&L",
  "bt.usdBase": "Basis USD: pada harga exit",
  "bt.usdQuoted": "Dikuotasi dalam USD",
  "bt.currentRate": "Pada kurs saat ini ({rate})",
  "bt.simNote": "Backtest #{id} adalah simulasi pada harga masa lalu: eksekusi pada open bar berikutnya, stop dan target pada jalur OHLC (bar menit jika tersedia), serta spread, komisi, dan swap jenis akun Anda. Hasil masa lalu tidak memprediksi hasil di masa depan.",
  // History sources and skip reasons from the service
  "source.native": "asli",
  "source.built_from_M1": "dibangun dari M1",
  "source.built_from_M5": "dibangun dari M5",
  "source.built_from_M15": "dibangun dari M15",
  "source.built_from_M30": "dibangun dari M30",
  "source.built_from_H1": "dibangun dari H1",
  "skip.outside_trading_window": "di luar jam trading",
  "skip.position_already_open": "posisi sudah terbuka",
  "skip.daily_trade_limit": "batas transaksi harian",
  "skip.max_daily_loss": "batas rugi harian",
  "skip.market_closed": "pasar tutup",
  "skip.20_open_positions": "20 posisi sudah terbuka",
  "skip.buy_and_sell_on_the_same_bar": "buy dan sell pada bar yang sama",
  "skip.stop_distance_not_ready": "jarak stop belum siap",
  "skip.SL_level_on_the_wrong_side": "level stop di sisi yang salah",
  "skip.volume_below_the_minimum_lot": "ukuran di bawah lot minimum",
  "spreadSource.group_quote": "kuotasi live jenis akun Anda",
  "spreadSource.catalogue": "spread katalog",
  "spreadSource.fixed": "tetap",

  "btNew.title": "Jalankan backtest", // (display)
  "btNew.period": "Periode",
  "btNew.balance": "Saldo awal",
  "btNew.other": "Lainnya",
  "btNew.amount": "Jumlah",
  "btNew.costs": "Biaya dari",
  "btNew.accountType": "Jenis akun",
  "btNew.myAccount": "Akun saya",
  "btNew.costsGroupHint": "Spread, komisi, dan swap jenis akun tersebut.",
  "btNew.costsAccountHint": "Spread, komisi, dan swap grup akun tersebut.",
  "btNew.noAccounts": "Anda belum memiliki akun trading aktif.",
  "btNew.run": "Jalankan backtest",
  "btNew.note": "Periode terpanjang bergantung pada timeframe. Hingga 3 backtest dapat berjalan sekaligus.",

  // B = bulan, T = tahun
  "period.p1m": "1B",
  "period.p3m": "3B",
  "period.p6m": "6B",
  "period.p1y": "1T",
  "period.p2y": "2T",
  "period.p5y": "5T",

  // Trade exit reasons (server codes)
  "exit.sl": "Stop loss",
  "exit.tp": "Take profit",
  "exit.trailing": "Trailing stop",
  "exit.breakeven": "Breakeven",
  "exit.signal": "Sinyal",
  "exit.exit_rule": "Aturan exit",
  "exit.session": "Di luar jam",
  "exit.end_of_test": "Akhir pengujian",
  "exit.stop_out": "Stop-out",
  "exit.kill": "Kill switch",
  "exit.stopped": "Dihentikan",
  "exit.client": "Ditutup",
  "exit.close": "Ditutup",

  "stat.balance": "Saldo",
  "stat.gross": "Profit / rugi kotor",
  "stat.cagr": "Pertumbuhan tahunan (CAGR)",
  "stat.avgWinLoss": "Rata-rata profit / rugi",
  "stat.largest": "Profit / rugi terbesar",
  "stat.payoff": "Rasio payoff",
  "stat.long": "Transaksi long · win rate",
  "stat.short": "Transaksi short · win rate",
  "stat.streaks": "Profit / rugi beruntun terbanyak",
  "stat.maxDd": "Drawdown maks",
  "stat.recovery": "Recovery factor",
  "stat.sharpeSortino": "Sharpe / Sortino",
  "stat.avgBars": "Rata-rata bar dipegang",
  "stat.exposure": "Waktu di pasar",
  "stat.costs": "Komisi / swap / spread",
  "stat.bars": "Bar yang diuji",
  "stat.cpu": "Dihitung dalam",
  "stat.seconds": "{s} dtk",

  /* ---------------------------------------------------------------- */
  /* Log kinds (runtime)                                               */
  /* ---------------------------------------------------------------- */
  "log.eval": "Bar",
  "log.signal": "Sinyal",
  "log.order": "Order",
  "log.close": "Tutup",
  "log.manage": "Kelola",
  "log.error": "Kesalahan",
  "log.info": "Info",

  /* ---------------------------------------------------------------- */
  /* Marketplace                                                       */
  /* ---------------------------------------------------------------- */
  "house.badge": "Strategi internal · Dioperasikan oleh Kalks",
  "house.disclosure":
    "Strategi internal yang dioperasikan oleh Kalks: akun live milik broker yang menjalankan strategi ini. Rekam jejaknya hanya berisi transaksi live miliknya sejak dimulai; tidak ada yang disimulasikan atau diisi mundur.",
  "market.eyebrow": "Marketplace strategi",
  "market.title": "Marketplace", // (display)
  "market.subtitle": "Strategi dengan rekam jejak terverifikasi dari akun Kalks nyata. Salin ke akun Anda, atau kloning aturannya jika pembuatnya mengizinkan.",
  "market.browse": "Jelajahi",
  "market.subs": "Langganan",
  "market.subsN": "Langganan · {n}",
  "market.mine": "Listing Anda",
  "market.search": "Cari strategi, pembuat…",
  "market.clear": "Hapus pencarian",
  "market.all": "Semua",
  "market.free": "Gratis",
  "market.paid": "Berbayar",
  "market.newest": "Terbaru",
  "market.topRated": "Rating tertinggi",
  "market.popular": "Populer",
  // {price} in USDT
  "market.perMonth": "{price} USDT/bln",
  "market.by": "oleh {author}",
  "market.return": "Imbal hasil",
  "market.winRate": "Win rate",
  "market.maxDd": "DD maks",
  "market.trades": "Transaksi",
  // {type} = live / demo
  "market.verified": "{type} terverifikasi",
  "market.verifiedDays": "{type} terverifikasi · {days} hari",
  // a track record younger than a day
  "market.verifiedNew": "{type} terverifikasi · kurang dari sehari",
  "market.subscribed": "Berlangganan",
  "market.ratings": { zero: "Belum ada rating", other: "{count} rating" },
  "market.subscribers": { other: "{count} pelanggan" },
  "market.emptyTitle": "Belum ada listing", // (display)
  "market.emptyText": "Strategi muncul di sini setelah pembuatnya memublikasikannya dengan rekam jejak terverifikasi.",
  "market.noMatchTitle": "Tidak ada yang cocok", // (display)
  "market.noMatchText": "Coba pencarian atau filter lain.",
  "market.noSubsTitle": "Tidak ada langganan", // (display)
  "market.noSubsText": "Strategi yang Anda salin atau kloning dari marketplace muncul di sini.",
  "market.disclaimer": "Kinerja masa lalu tidak menjamin hasil di masa depan. Rekam jejak berasal dari akun live atau demo di Kalks dan diberi label sesuai jenisnya. Biaya platform untuk langganan berbayar: {pct}%.",
  "market.houseFootnote": "Strategi internal berjalan di akun live milik broker; rekam jejaknya hanya berisi transaksi live miliknya sendiri.",
  "market.earned": "Diperoleh",
  "market.fees": "Biaya platform",
  "market.payments": "Pembayaran",
  "market.publishWeb": "Memublikasikan strategi (dengan rekam jejak terverifikasinya) dan mengedit listing dilakukan di Client Area versi web.",
  "market.openWeb": "Buka marketplace di web",

  // Listing statuses (server values)
  "listing.pending": "Ditinjau",
  "listing.approved": "Terdaftar",
  "listing.rejected": "Ditolak",
  "listing.suspended": "Ditangguhkan",
  "listing.unlisted": "Tidak terdaftar",
  "listing.eyebrow": "Marketplace · {symbol} {tf}",
  "listing.verified": "Rekam jejak {type} terverifikasi",
  "listing.cloneAllowed": "Kloning diizinkan",
  "listing.trackReturn": "Imbal hasil terverifikasi",
  "listing.net": "Bersih",
  "listing.noCurve": "Kurva harian muncul setelah dua hari trading.",
  "listing.curveA11y": "Ekuitas per hari selama {days} hari, imbal hasil {ret}",
  "listing.trackNote": "Dari deployment milik pembuat di Kalks sejak {since}, dihitung dari deal tertutup di mesin trading: tidak pernah dimasukkan oleh pembuat.",
  "listing.btSimulated": "Backtest · simulasi",
  "listing.btNote": "Cara aturan akan bertransaksi pada harga masa lalu dengan biaya jenis akun ini. Bukan bagian dari rekam jejak live di atas.",
  "listing.btA11y": "Kurva ekuitas backtest (simulasi)",
  "listing.about": "Tentang", // (display)
  "listing.risk": "Risiko", // (display)
  "listing.rules": "Aturan", // (display)
  "listing.rulesPrivate": "Aturan bersifat privat: salin strategi untuk menjalankannya di akun Anda.",
  "listing.reviews": "Ulasan · {n}", // (display)
  "listing.noReviews": "Belum ada ulasan.",
  "listing.subscribeFree": "Berlangganan gratis",
  "listing.subscribePaid": "Berlangganan · {price} USDT / bulan",
  "listing.copying": "Menyalin di {login}",
  "listing.clonedTo": "Dikloning ke strategi Anda",
  "listing.openDeployment": "Buka deployment",
  "listing.openStrategy": "Buka strategi",
  "listing.cancel": "Batalkan",
  "listing.cancelConfirm": "Batalkan langganan",
  "listing.keep": "Pertahankan",
  "listing.cancelTitle": "Batalkan?", // (display)
  "listing.cancelCopy": "Strategi berhenti di akun Anda sekarang. Posisi terbukanya tetap terbuka dengan stop dan targetnya.",
  "listing.cancelClone": "Langganan berakhir. Strategi hasil kloning tetap ada di daftar Anda.",
  // {date} = end of the paid period
  "listing.cancelPaid": "Tetap berjalan hingga {date} dan tidak akan diperpanjang. Tidak ada pengembalian dana untuk periode berjalan.",
  "listing.cancelled": "Langganan dibatalkan",
  "listing.cancelledPaid": "Tidak akan diperpanjang",
  "listing.yours": "Listing Anda",
  "listing.manageWeb": "Kelola di web",

  /* ---------------------------------------------------------------- */
  /* Subscribe (form), subscriptions                                   */
  /* ---------------------------------------------------------------- */
  "sub.eyebrow": "Berlangganan",
  "sub.title": "Berlangganan",
  "sub.body": "oleh {author} · {symbol} {tf}",
  "sub.how": "Cara",
  "sub.copyTitle": "Salin ke akun saya",
  "sub.copyText": "Versi persis milik pembuat berjalan di akun Anda, 24/7. Aturan tetap privat.",
  "sub.copyTextOpen": "Versi persis milik pembuat berjalan di akun Anda, 24/7.",
  "sub.cloneTitle": "Kloning aturan",
  "sub.cloneText": "Aturan menjadi salah satu strategi Anda: uji, ubah, dan deploy sendiri.",
  "sub.multiplierHint": "Menyesuaikan ukuran order strategi di akun Anda.",
  "sub.price": "Harga",
  "sub.dueNow": "Dibayar sekarang",
  "sub.wallet": "Dompet (tersedia)",
  "sub.renewal": "Perpanjangan",
  "sub.noCharge": "Gratis, tidak ada tagihan",
  "sub.shortTitle": "USDT tidak cukup",
  "sub.shortBody": "Dompet Anda memerlukan setidaknya {amount} USDT yang tersedia.",
  "sub.deposit": "Deposit",
  "sub.liveBody": "Strategi memasang order nyata dengan uang sungguhan di akun ini, dan dapat mengalami kerugian.",
  "sub.ackPay": "Tagih {price} USDT dari dompet Kalks saya sekarang dan setiap 30 hari sampai saya membatalkan.",
  "sub.doneTitle": "Langganan aktif", // (display)
  // {title} = strategy, {account} = "Demo 50000083"
  "sub.doneCopy": "“{title}” berjalan di {account}.",
  "sub.doneClone": "“{title}” kini menjadi salah satu strategi Anda.",
  "sub.charged": "{amount} USDT ditagihkan dari dompet Anda.",
  // the answer to a subscribe request was lost: the app re-reads the listing before a retry
  "sub.noAnswer": "Kami tidak menerima jawaban. Langganan mungkin sudah berhasil.",
  "sub.checkingTitle": "Memeriksa langganan Anda",
  "sub.checkingBody": "Jawaban hilang di tengah jalan. Kami memeriksa ke server sebelum Anda dapat mencoba lagi, sehingga Anda tidak pernah ditagih dua kali.",
  "sub.noAnswerRetry": "Masih belum ada jawaban, dan tidak ada langganan baru di akun Anda. Anda dapat mencoba lagi.",
  "sub.notThrough": "Tidak berhasil, dan tidak ada tagihan yang tertinggal (tagihan dikembalikan ke dompet Anda). Anda dapat mencoba lagi.",
  "sub.unfinished": "Masih disiapkan di server. Periksa Marketplace › Langganan dan riwayat dompet Anda, atau hubungi dukungan, sebelum mencoba lagi.",
  "sub.free": "Langganan gratis: tidak ada tagihan.",
  "sub.copyOn": "salinan di {login}",
  "sub.cloned": "dikloning",
  "sub.renews": "diperpanjang {date}",
  "sub.ends": "berakhir {date}",
  "sub.status.active": "Aktif",
  "sub.status.cancelled": "Dibatalkan",
  "sub.status.expired": "Kedaluwarsa",
  "sub.status.past_due": "Jatuh tempo",

  "review.title": "Beri rating", // (display)
  "review.rating": "Rating Anda",
  "review.stars": { other: "{count} bintang" },
  "review.comment": "Komentar (opsional)",
  "review.placeholder": "Bagaimana hasil tradingnya bagi Anda?",
  "review.post": "Kirim ulasan",
  "review.saved": "Ulasan disimpan",
  "review.rate": "Beri rating",
  "review.edit": "Ubah ulasan",
  "review.you": "Anda",

  /* ---------------------------------------------------------------- */
  /* API keys and webhooks                                             */
  /* ---------------------------------------------------------------- */
  "keys.eyebrow": "Developer",
  "keys.title": "API", // (display)
  "keys.subtitle": "Kunci untuk program trading Anda sendiri dan URL webhook untuk peringatan (TradingView dan lainnya).",
  "keys.requests24h": "Permintaan · 24 jam terakhir",
  "keys.errors": "Kesalahan",
  // requests refused by the rate limit
  "keys.limited": "Dibatasi",
  "keys.p50": "Median",
  "keys.writes": "Order",
  "keys.keys": "Kunci API", // (display)
  "keys.keysSub": "{n} aktif · hingga 20",
  "keys.none": "Tidak ada kunci API. Buat di Client Area versi web.",
  "keys.status.active": "Aktif",
  "keys.status.revoked": "Dicabut",
  "keys.status.expired": "Kedaluwarsa",
  // API scope names, kept as in the `developer` namespace
  "keys.scope.read": "Read",
  "keys.scope.trade": "Trade",
  // {ips} = list of IP addresses
  "keys.ips": "Hanya dari {ips}",
  "keys.anyIp": "Dari alamat IP mana pun",
  "keys.expires": "Kedaluwarsa {date}",
  "keys.noExpiry": "Tidak pernah kedaluwarsa",
  "keys.lastUsed": "terakhir digunakan {ago}",
  "keys.revoke": "Cabut",
  "keys.revokeTitle": "Cabut kunci ini?", // (display)
  "keys.revokeBody": "“{name}” ({id}) langsung berhenti berfungsi untuk setiap program yang menggunakannya. Tindakan ini tidak dapat dibatalkan.",
  "keys.revoked": "“{name}” dicabut",
  "keys.webTitle": "Buat di web",
  "keys.webBody": "Kunci dan webhook baru dibuat di Client Area: secret kunci dan URL webhook ditampilkan sekali di sana, agar Anda dapat menyalinnya ke alat trading Anda.",
  "keys.openWeb": "Buka Client Area",
  "keys.killHint": "Perlu menghentikan semuanya? Kill switch di layar Algo menghentikan setiap strategi dan memblokir order webhook dan API.",

  "hooks.title": "Webhook", // (display)
  "hooks.sub": "{n} dari maksimal 20",
  "hooks.none": "Tidak ada webhook. Buat di Client Area versi web.",
  // {hint} = the URL's last characters
  "hooks.hint": "URL …{hint}",
  "hooks.accounts": { other: "{count} akun" },
  "hooks.today": { zero: "tidak ada peringatan hari ini", other: "{count} peringatan hari ini" },
  "hooks.used": "digunakan {ago}",
  "hooks.on": "Aktif",
  "hooks.off": "Nonaktif",
  "hooks.switch": "Webhook “{name}” aktif",
  "hooks.passphrase": "Perlu frasa sandi",
  "hooks.noPassphrase": "Tanpa frasa sandi",
  "hooks.delete": "Hapus",
  "hooks.deleteTitle": "Hapus webhook ini?", // (display)
  "hooks.deleteBody": "“{name}” dan URL rahasianya langsung berhenti berfungsi; peringatan yang dikirim ke sana ditolak. Tindakan ini tidak dapat dibatalkan.",
  "hooks.deleted": "“{name}” dihapus",
  "hooks.alerts": "Peringatan terbaru", // (display)
  "hooks.alertsSub": "Setiap peringatan dengan hasil tiap akun",
  // Alert statuses (server values)
  "hooks.status.accepted": "Diterima",
  "hooks.status.partial": "Sebagian",
  "hooks.status.failed": "Gagal",
  "hooks.status.received": "Masuk",
  "hooks.status.rejected": "Ditolak",
  "hooks.status.blocked": "Diblokir (kill switch)",
  // Each account's result of an alert (server values)
  "hooks.result.filled": "tereksekusi",
  "hooks.result.pending": "order dipasang",
  "hooks.result.closed": "ditutup",
  "hooks.result.nothing_to_close": "tidak ada yang ditutup",
  "hooks.result.rejected": "ditolak",
};
export default mobileAlgo;
