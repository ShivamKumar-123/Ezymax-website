import type { NsMessages } from "../../core";

// Kalks mobile app: Algo (/algo): strategies running 24/7 on the server (deployments), the kill switch, backtest
// reports, the strategy marketplace, API keys and webhooks.
// Keep as they are: Kalks, Algo, API, USDT, USD, indicator names, symbols, timeframes, "R", P&L, DD, SL / TP.
// Deployment = pelancaran, backtest = ujian balik, kill switch = suis henti. (display) titles: keep them short.
const mobileAlgo: NsMessages<"mobileAlgo"> = {
  never: "tidak pernah",
  // {n} days, compact
  days: "{n} h",
  lot: "lot",
  // How long a trade was held: m = minit, j = jam, h = hari (compact)
  "dur.m": "{m}m",
  "dur.h": "{h}j",
  "dur.hm": "{h}j {m}m",
  "dur.d": "{d}h",
  "dur.dh": "{d}h {h}j",
  nTrades: { other: "{count} dagangan" },
  readOnly: "Log masuk ini boleh melihat strategi tetapi tidak boleh mengubah apa-apa.",

  /* ---------------------------------------------------------------- */
  /* Screen states                                                     */
  /* ---------------------------------------------------------------- */
  "state.unavailable.title": "Algo tidak tersedia", // (display)
  "state.unavailable.text": "Kami tidak dapat menghubungi perkhidmatan strategi. Strategi anda terus berjalan pada pelayan; sila cuba lagi sebentar lagi.",
  "state.disabled.title": "Tidak tersedia", // (display)
  "state.disabled.text": "Ciri ini tidak tersedia pada akaun anda.",
  "state.notFound.title": "Tidak ditemui", // (display)
  "state.notFound.text": "Ia mungkin telah dialih keluar, atau pautannya tidak betul.",
  "state.back": "Kembali ke Algo",

  /* ---------------------------------------------------------------- */
  /* Server errors (codes of the strategy service)                     */
  /* ---------------------------------------------------------------- */
  "error.haltedMine": "Suis henti anda dihidupkan. Lepaskannya pada skrin Algo sebelum memulakan strategi semula.",
  "error.haltedPlatform": "Dagangan automatik dijeda oleh broker buat masa ini. Sila cuba lagi kemudian.",
  // {n} = the most strategies that can run at once
  "error.limitRunning": "Anda boleh menjalankan sehingga {n} strategi pada satu masa. Hentikan satu dahulu.",
  "error.accountStatus": "Akaun ini tidak boleh berdagang buat masa ini.",
  "error.alreadyRunning": "Versi ini sudah berjalan pada akaun itu.",
  "error.invalidStrategy": "Baiki ralat strategi terlebih dahulu (di Kawasan Pelanggan atau dengan AI Trader).",
  "error.state": "Ia sudah berubah. Tarik ke bawah untuk melihat keadaan semasanya.",
  "error.queueFull": "Anda sudah mempunyai 3 ujian balik dalam giliran atau sedang berjalan. Tunggu satu selesai.",
  "error.dailyLimit": "Anda telah mencapai had hari ini sebanyak {n} ujian balik.",
  "error.ownListing": "Anda tidak boleh melanggan strategi anda sendiri.",
  "error.subscribed": "Anda sudah melanggan strategi ini.",
  "error.cloneNotAllowed": "Pengarang tidak membenarkan pengklonan; salin ke akaun anda sebaliknya.",
  // {amount} in USDT
  "error.insufficientFunds": "Baki dompet anda di bawah {amount} USDT. Deposit USDT untuk melanggan.",
  "error.insufficientFundsPlain": "Baki dompet anda terlalu rendah. Deposit USDT untuk melanggan.",
  "error.inactive": "Langganan ini tidak lagi aktif.",
  "error.archiveRunning": "Hentikan pelancaran strategi ini sebelum mengarkibkannya.",
  "error.archived": "Strategi ini telah diarkibkan.",
  "error.finished": "Ujian balik ini sudah selesai.",
  "error.revoked": "Kunci ini sudah dibatalkan.",
  "error.notFound": "Ia tidak lagi wujud.",
  // {tf} = timeframe (H1), {days} = number of days
  "error.rangeTooLong": "Ujian balik {tf} boleh merangkumi paling lama {days} hari. Pilih tempoh yang lebih pendek.",
  "error.balanceRange": "Baki permulaan mesti antara 100 dan 10,000,000.",
  "error.dates": "Tarikh mula mesti sebelum tarikh akhir.",

  /* ---------------------------------------------------------------- */
  /* Home                                                              */
  /* ---------------------------------------------------------------- */
  "home.eyebrow": "Dagangan automatik",
  "home.title": "Algo", // (display)
  "home.heroEyebrow": "Sedang berjalan",
  "home.heroRunning": { zero: "strategi berdagang 24/7 pada pelayan", other: "strategi berdagang 24/7 pada pelayan" },
  "home.heroRealized": "P&L direalisasi",
  "home.heroOpen": "Terbuka kini",
  // closed trades so far
  "home.heroTrades": "Dagangan",
  "home.qaAi": "Cipta dengan AI",
  "home.qaAiHint": "Huraikan idea, dapatkan peraturan tepat",
  "home.qaMarket": "Pasaran strategi",
  "home.qaMarketHint": "Salin strategi yang disahkan",
  "home.qaKeys": "Kunci API & webhook",
  "home.qaKeysHint": "Penggunaan, pembatalan, amaran terkini",
  "home.running": "Pelancaran", // (display)
  "home.runningSub": { zero: "Tiada yang berjalan buat masa ini", other: "{count} berjalan" },
  // {n} = count shown on the filter pill
  "home.filterActive": "Aktif · {n}",
  "home.filterAll": "Semua · {n}",
  "home.strategies": "Strategi saya", // (display)
  "home.strategiesSub": { zero: "Belum ada yang disimpan", other: "{count} disimpan" },
  "home.newWithAi": "Baharu dengan AI",
  "home.backtests": "Ujian balik", // (display)
  "home.backtestsSub": "Larian terkini, yang terbaharu dahulu",
  "home.emptyDeps": "Belum ada yang dijalankan. Buka salah satu strategi anda di bawah dan lancarkannya pada akaun demo terlebih dahulu.",
  "home.emptyActive": "Tiada yang berjalan buat masa ini. Strategi yang dihentikan berada di bawah Semua.",
  "home.showAll": "Tunjuk semua",
  "home.emptyStrats": "Belum ada strategi anda sendiri. Huraikan idea anda kepada AI Trader dan ia menjadi peraturan tepat yang boleh anda uji.",
  "home.browseMarket": "Layari pasaran strategi",
  "home.emptyBts": "Belum ada ujian balik. Buka strategi dan jalankan satu pada sejarah harga sebenar.",
  "home.startEyebrow": "Bermula",
  "home.startTitle": "Gerakkan strategi", // (display)
  "home.step1": "Huraikan idea anda kepada AI Trader: ia menjadi peraturan tepat yang boleh anda baca dan ubah.",
  "home.step2": "Uji balik peraturan pada sejarah harga sebenar, dengan kos akaun anda.",
  "home.step3": "Jalankannya 24/7 pada akaun demo terlebih dahulu. Jeda, hentikan atau matikannya pada bila-bila masa.",
  "home.footnote": "Strategi berjalan pada pelayan Kalks sepanjang masa, pada bar yang ditutup, dengan semakan pesanan yang sama seperti dagangan manual: margin, waktu pasaran, had anda. Bina dan edit strategi dengan AI Trader atau di Kawasan Pelanggan.",
  "home.openWeb": "Buka pembina strategi di web",

  /* ---------------------------------------------------------------- */
  /* Kill switch (account-wide)                                        */
  /* ---------------------------------------------------------------- */
  "kill.cardTitle": "Suis henti",
  "kill.cardBody": "Hentikan setiap strategi serentak dan sekat pesanan webhook dan API.",
  "kill.stopAll": "Henti semua",
  "kill.onTitle": "Suis henti dihidupkan",
  // {at} = date and time
  "kill.onSince": "Sejak {at}. Strategi dihentikan; pesanan webhook dan API disekat.",
  "kill.onBody": "Strategi dihentikan; pesanan webhook dan API disekat.",
  "kill.release": "Lepaskan",
  "kill.title": "Hentikan semuanya?", // (display)
  "kill.body": {
    zero: "Setiap strategi berhenti serta-merta, dan pesanan webhook dan API disekat sehingga anda melepaskan suis.",
    other: "Kesemua {count} strategi yang berjalan berhenti serta-merta, dan pesanan webhook dan API disekat sehingga anda melepaskan suis.",
  },
  "kill.alsoClose": "Tutup juga posisinya",
  "kill.alsoCloseHint": "Menutup, pada harga pasaran, setiap posisi yang dibuka oleh strategi, webhook atau API pada semua akaun anda. Dagangan manual anda sendiri kekal terbuka.",
  "kill.confirm": "Henti semua sekarang",
  "kill.doneTitle": "Semuanya dihentikan", // (display)
  "kill.stopped": "Strategi dihentikan",
  "kill.doneBody": "Suis henti kekal hidup sehingga anda melepaskannya. Strategi yang dihentikan tidak bermula semula dengan sendirinya.",
  "kill.releaseTitle": "Lepaskan suis henti?", // (display)
  "kill.releaseBody": "Pesanan webhook dan API dibenarkan semula. Strategi yang dihentikan kekal dihentikan: lancarkannya semula apabila anda bersedia.",
  "kill.releasedTitle": "Suis dilepaskan", // (display)
  "kill.releasedBody": "Pesanan webhook dan API dibenarkan semula. Lancarkan strategi untuk memulakannya.",
  "kill.globalTitle": "Dagangan automatik dijeda",
  "kill.globalBody": "Broker telah menjeda setiap strategi, webhook dan pesanan API buat masa ini. Posisi terbuka mengekalkan stop masing-masing.",

  /* ---------------------------------------------------------------- */
  /* Deployment statuses, controls                                     */
  /* ---------------------------------------------------------------- */
  "dep.status.running": "Berjalan",
  "dep.status.paused": "Dijeda",
  "dep.status.stopped": "Dihentikan",
  "dep.status.killed": "Dimatikan",
  "dep.status.error": "Ralat",
  "dep.realized": "P&L direalisasi",
  "dep.trades": "Dagangan",
  "dep.winRate": "Kadar menang",
  "dep.open": "Terbuka",
  "dep.orders": "Pesanan",
  "dep.openNow": "Terbuka",
  // {ago} = "5 minit lalu"
  "dep.lastCheck": "Bar terakhir disemak {ago}",
  // {since} = start date
  "dep.lastCheckSince": "Bar terakhir disemak {ago} · berjalan sejak {since}",
  // {reason} = the service's reason
  "dep.stoppedWhy": "Dihentikan: {reason}",
  "dep.stoppedTitle": "Dihentikan {at}",
  "dep.errorTitle": "Strategi mengalami ralat",
  // {account} = "Demo 50000083"
  "dep.eyebrow": "Pelancaran · {account}",
  "dep.marketplaceCopy": "Salinan pasaran",
  "dep.openStrategy": "Buka strategi",
  "dep.openSubscription": "Buka langganan saya",
  // {pct} = return %, {amount} = starting balance
  "dep.onStart": "{pct} atas {amount}",
  "dep.curveA11y": "Baki mengikut hari selama {days} hari, direalisasi {pnl}",
  "dep.tabLog": "Log · {n}",
  "dep.tabTrades": "Dagangan · {n}",
  "dep.tabSetup": "Persediaan",
  "dep.noLogs": "Belum ada log: bar pertama yang ditutup ialah pemanasan.",
  "dep.noTrades": "Belum ada dagangan.",
  "dep.older": "Muat entri lama",
  "dep.logStart": "Itulah entri pertama.",
  "dep.rules": "Peraturan",
  "dep.rulesHidden": "Pengarang merahsiakan peraturan: strategi berjalan pada akaun anda seperti yang diterbitkan.",
  "dep.lotMultiplier": "Pengganda lot",
  "dep.maxLots": "Lot maks setiap pesanan",
  "dep.maxOpen": "Posisi terbuka maks",
  "dep.dailyLoss": "Had kerugian harian",
  "dep.started": "Dimulakan",
  "dep.startBalance": "Baki permulaan",
  "dep.setupNote": "Pelancaran menjalankan satu versi yang tepat: menyimpan versi baharu tidak mengubahnya. Lancarkan versi baharu untuk bertukar.",

  "ctl.pause": "Jeda",
  "ctl.resume": "Sambung semula",
  "ctl.stop": "Henti",
  "ctl.kill": "Matikan",
  "ctl.killNow": "Matikan sekarang",
  "ctl.closePositions": "Tutup posisi",
  "ctl.pauseTitle": "Jeda?", // (display)
  "ctl.pauseBody": "Tiada dagangan baharu. Posisi terbuka mengekalkan stop, sasaran dan pulang modal masing-masing. Sambung semula bila-bila masa anda mahu.",
  "ctl.resumeTitle": "Sambung semula?", // (display)
  "ctl.resumeBody": "Ia berdagang semula dari bar ditutup seterusnya.",
  "ctl.stopTitle": "Hentikan?", // (display)
  "ctl.stopBody": "Ia berhenti sepenuhnya: tiada dagangan baharu. Untuk menjalankannya semula, lancarkannya semula.",
  "ctl.keepTitle": "Kekalkan posisi terbuka",
  "ctl.keepText": { other: "{count} posisi terbuka mengekalkan stop dan sasaran masing-masing; urusnya sendiri." },
  "ctl.closeAllTitle": "Tutupnya sekarang",
  "ctl.closeAllText": { other: "{count} posisi terbuka ditutup pada harga pasaran." },
  "ctl.killTitle": "Matikan sekarang?", // (display)
  "ctl.killBody": "Suis henti menghentikan strategi ini serta-merta, dan secara lalai menutup posisi yang dibukanya pada harga pasaran.",
  "ctl.killClose": "Tutup posisinya",
  "ctl.killCloseHint": "Pada harga pasaran, sekarang. Matikan untuk mengekalkannya terbuka dengan stop masing-masing.",
  "ctl.closeTitle": "Tutup posisinya?", // (display)
  "ctl.closeBody": { other: "{count} posisi yang dibuka oleh strategi ini ditutup pada harga pasaran. Strategi terus berjalan." },
  "ctl.done.pause": "Dijeda", // (display)
  "ctl.done.resume": "Berjalan semula", // (display)
  "ctl.done.stop": "Dihentikan", // (display)
  "ctl.done.kill": "Dimatikan", // (display)
  "ctl.done.close": "Posisi ditutup", // (display)
  "ctl.donePause": "Tiada dagangan baharu sehingga anda menyambungnya semula.",
  "ctl.doneResume": "Ia berdagang semula dari bar ditutup seterusnya.",
  "ctl.doneClosed": { other: "{count} posisi telah ditutup." },
  "ctl.doneKept": "Posisi terbukanya, jika ada, kekal terbuka dengan stop dan sasaran masing-masing.",
  "ctl.doneNothing": "Tiada apa-apa yang terbuka untuk ditutup.",
  "ctl.closedLabel": "Ditutup",
  "ctl.failedLabel": "Tidak dapat ditutup",
  "ctl.failedTitle": { other: "{count} posisi tidak dapat ditutup" },
  "ctl.failedBody": "Pasaran mungkin ditutup. Tutupnya dari Portfolio apabila dagangan dibuka semula.",
  // stopping or killing a marketplace copy leaves its subscription (and a paid one's renewals) running
  "ctl.copyNote": "Ini ialah salinan pasaran: menghentikannya tidak menamatkan langganan. Untuk berhenti membayar, batalkannya di bawah Pasaran strategi › Langganan.",

  /* ---------------------------------------------------------------- */
  /* Strategy                                                          */
  /* ---------------------------------------------------------------- */
  // {version} = version number
  "strat.eyebrow": "Strategi · v{version}",
  "strat.runningN": { other: "{count} berjalan" },
  "strat.draft": "Draf",
  "strat.ready": "Sedia",
  "strat.errors": { other: "{count} ralat" },
  "strat.archivedTag": "Diarkibkan",
  "strat.lastBacktest": "Ujian balik terakhir",
  "strat.backtested": "ujian balik",
  "strat.notTested": "Belum diuji balik", // (display)
  "strat.notTestedBody": "Uji peraturan pada sejarah harga sebenar, dengan kos akaun anda, sebelum anda menjalankannya.",
  "strat.runFirst": "Jalankan ujian balik",
  "strat.openReport": "Buka laporan penuh",
  "strat.deployV": "Lancarkan v{version}",
  "strat.backtest": "Ujian balik",
  "strat.fixFirst": "Baiki ini sebelum menguji atau melancarkan",
  "strat.line": "Baris {n}:",
  "strat.rules": "Peraturan", // (display)
  "strat.rulesSub": "Disemak pada setiap bar yang ditutup",
  "strat.rulesCodeSub": "Isyarat kod, disemak pada setiap bar yang ditutup",
  "strat.showCode": "Tunjuk sebagai kod",
  "strat.risk": "Risiko", // (display)
  "strat.riskSub": "Saiz, stop, waktu dan had",
  "strat.editVisual": "Untuk menukar peraturan, tanya AI Trader atau editnya di Kawasan Pelanggan; setiap perubahan disimpan sebagai versi baharu.",
  "strat.editCode": "Strategi kod diedit di Kawasan Pelanggan di web; setiap perubahan disimpan sebagai versi baharu.",
  "strat.openWeb": "Edit kod di web",
  "strat.deployments": "Pelancaran", // (display)
  "strat.deploymentsSub": { zero: "Tidak berjalan di mana-mana", other: "{count} pelancaran" },
  "strat.notRunning": "Tidak berjalan. Lancarkannya pada akaun demo terlebih dahulu untuk melihat cara ia berdagang secara langsung.",
  "strat.backtests": "Ujian balik", // (display)
  "strat.backtestsSub": { zero: "Belum ada", other: "{count} larian" },
  "strat.runNew": "Jalankan baharu",
  "strat.noBacktests": "Belum ada ujian balik.",
  "strat.versions": "Versi", // (display)
  "strat.versionsSub": { other: "{count} versi" },
  "strat.current": "Semasa",
  "strat.archive": "Arkibkan",
  "strat.archiveTitle": "Arkibkan?", // (display)
  "strat.archiveBody": "“{name}” dikeluarkan daripada senarai anda. Ujian balik dan pelancaran lepasnya kekal dalam sejarah anda.",
  "strat.archived": "“{name}” diarkibkan",

  "kind.visual": "Peraturan visual",
  "kind.code": "Kod",
  // Where a strategy came from
  "origin.ai": "AI Trader",
  "origin.template": "Templat",
  "origin.manual": "Dibina secara manual",
  "origin.marketplace": "Pasaran strategi",

  /* ---------------------------------------------------------------- */
  /* Rules in words                                                    */
  /* ---------------------------------------------------------------- */
  "rules.buy": "Beli apabila",
  "rules.sell": "Jual apabila",
  "rules.exitBuy": "Tutup belian apabila",
  "rules.exitSell": "Tutup jualan apabila",
  "rules.and": "dan",
  "rules.or": "atau",
  // {tf} = timeframe, e.g. "pada H4"
  "rules.onTf": "pada {tf}",
  "rules.noRules": "Belum ada peraturan masuk.",
  "rules.size": "Saiz",
  "rules.stop": "Henti rugi",
  "rules.target": "Ambil untung",
  "rules.trailing": "Trailing",
  "rules.window": "Waktu dagangan",
  "rules.limits": "Had",
  "rules.none": "Tiada",
  "rules.lots": "{lots} lot",
  "rules.riskPct": "Risiko {pct}% setiap dagangan",
  "rules.maxLots": "maks {lots} lot",
  // points: move the stop to entry + {o} after {v} points in profit
  "rules.breakeven": "pulang modal pada {v} mata (+{o})",
  "rules.allDay": "Sepanjang masa",
  "rules.perDay": { other: "{count} dagangan sehari" },
  "rules.dailyLoss": "Berhenti untuk hari itu pada kerugian {amount}",
  "rules.oneAtATime": "Satu posisi pada satu masa",
  "rules.closeOutside": "Ditutup di luar waktu",
  "rules.noLimits": "Tiada had harian",
  "op.crossesAbove": "melintas di atas",
  "op.crossesBelow": "melintas di bawah",
  "dist.pips": "{v} pip",
  "dist.points": "{v} mata",
  "dist.price": "pada {v}",
  "dist.percent": "{v}% daripada harga",
  // {v} × ATR({p})
  "dist.atr": "{v} × ATR({p})",
  "dist.level": "paras {v}",
  // a multiple of the stop distance
  "dist.rr": "{v}R",
  "field.close": "Tutup",
  "field.open": "Buka",
  "field.high": "Tinggi",
  "field.low": "Rendah",
  "field.hl2": "Harga median",
  "field.hlc3": "Harga tipikal",
  "field.ohlc4": "Harga purata",
  "field.volume": "Volum",
  "pattern.bullish": "Lilin bullish",
  "pattern.bearish": "Lilin bearish",
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
  "ind.macd_signal": "Isyarat MACD",
  "ind.macd_hist": "Histogram MACD",
  "ind.bb_upper": "Bollinger atas",
  "ind.bb_middle": "Bollinger tengah",
  "ind.bb_lower": "Bollinger bawah",
  "ind.atr": "ATR",
  "ind.stoch_k": "Stochastic %K",
  "ind.stoch_d": "Stochastic %D",
  "ind.highest": "Tinggi tertinggi",
  "ind.lowest": "Rendah terendah",
  "ind.cci": "CCI",
  "ind.willr": "Williams %R",
  "ind.adx": "ADX",
  "ind.plus_di": "+DI",
  "ind.minus_di": "−DI",
  "ind.momentum": "Momentum",
  "ind.roc": "ROC",
  "ind.stddev": "Sisihan piawai",
  "note.noDailyLimit": "Tiada had dagangan harian",
  "note.noStop": "Tiada henti rugi: posisi tidak dilindungi",
  "note.riskNeedsStop": "Saiz berasaskan risiko memerlukan henti rugi",
  "note.rrNeedsStop": "Ambil untung dalam R memerlukan henti rugi",
  "note.noEntry": "Tiada peraturan masuk: tambah syarat beli atau jual",

  /* ---------------------------------------------------------------- */
  /* Deploy (form)                                                     */
  /* ---------------------------------------------------------------- */
  "deploy.eyebrow": "Lancarkan · v{version}",
  "deploy.title": "Jalankan 24/7", // (display)
  "deploy.body": "“{name}” v{version} mendagangkan {symbol} pada setiap bar {tf} yang ditutup, pada pelayan Kalks, walaupun telefon anda dimatikan. Jeda, hentikan atau matikannya pada bila-bila masa.",
  "deploy.account": "Akaun",
  "deploy.equity": "Ekuiti {amount}",
  "deploy.noAccounts": "Anda memerlukan akaun dagangan aktif. Buka akaun demo untuk mencuba strategi tanpa risiko.",
  "deploy.openAccount": "Buka akaun",
  "deploy.multiplier": "Pengganda lot",
  "deploy.multiplierHint": "Menskalakan saiz setiap pesanan. 1× mendagangkan saiz strategi itu sendiri.",
  "deploy.maxOpen": "Posisi terbuka maks",
  "deploy.maxOpenHint": "Had tambahan di atas peraturan strategi itu sendiri.",
  "deploy.strategyDefault": "Peraturan strategi",
  "deploy.dailyLoss": "Had kerugian harian",
  "deploy.dailyLossHint": "Apabila kerugian ditutup dan terbuka hari itu mencapainya, tiada dagangan baharu sehingga esok (waktu pelayan).",
  "deploy.off": "Mati",
  "deploy.custom": "Tersuai",
  "deploy.dailyLossAmount": "Kerugian sehari",
  "deploy.lossInvalid": "Masukkan jumlah melebihi 0.",
  "deploy.liveTitle": "Wang sebenar",
  "deploy.liveBody": "Ini ialah akaun sebenar. Strategi meletakkan pesanan sebenar dengan wang sebenar, dan boleh kehilangannya.",
  "deploy.ack": "Saya faham bahawa strategi mendagangkan wang sebenar pada akaun sebenar saya dan saya bertanggungjawab ke atasnya.",
  "deploy.note": "Dagangan automatik boleh mengalami kerugian. Ujian balik ialah simulasi dan tidak meramalkan hasil masa hadapan. Ini bukan nasihat kewangan.",
  // {account} = "Demo 50000083"
  "deploy.confirm": "Lancarkan pada {account}",
  "deploy.doneTitle": "Sedang berjalan", // (display)
  "deploy.doneBody": "“{name}” v{version} sedang berjalan pada {account}.",
  "deploy.warmup": "Bar {tf} pertama yang ditutup ialah pemanasan; pesanan boleh bermula dari bar seterusnya.",
  "deploy.open": "Buka pelancaran",

  /* ---------------------------------------------------------------- */
  /* Backtests                                                         */
  /* ---------------------------------------------------------------- */
  "bt.status.queued": "Dalam giliran",
  "bt.status.running": "Berjalan",
  "bt.status.done": "Selesai",
  "bt.status.failed": "Gagal",
  "bt.status.cancelled": "Dibatalkan",
  "bt.stage.queued": "Menunggu pekerja yang bebas",
  "bt.stage.loading": "Memuatkan sejarah harga",
  "bt.stage.m1": "Memuatkan bar minit",
  "bt.stage.simulating": "Menyimulasikan dagangan",
  "bt.stage.running": "Berjalan",
  // {id} = backtest number, {version} = strategy version
  "bt.eyebrow": "Ujian balik #{id} · v{version}",
  "bt.title": "Ujian balik", // (display)
  "bt.start": "Permulaan {amount}",
  "bt.runningNote": "Ia berjalan pada pelayan: anda boleh meninggalkan skrin ini dan kembali kemudian.",
  "bt.failed": "Ujian balik gagal",
  "bt.cancelled": "Dibatalkan", // (display)
  "bt.runAgain": "Jalankan semula",
  "bt.net": "Untung bersih",
  // {pct} = return, {amount} = starting balance
  "bt.returnOf": "{pct} atas {amount}",
  "bt.pf": "Faktor keuntungan",
  "bt.winRate": "Kadar menang",
  "bt.winsOf": "{wins} daripada {trades}",
  "bt.maxDd": "Drawdown maks",
  "bt.maxDdShort": "DD maks",
  "bt.sharpe": "Sharpe",
  "bt.sortino": "Sortino {v}",
  "bt.trades": "Dagangan",
  "bt.longShort": "{long} long · {short} short",
  "bt.expectancy": "Jangkaan",
  "bt.perTrade": "setiap dagangan",
  "bt.equity": "Ekuiti", // (display)
  "bt.drawdown": "Drawdown",
  "bt.legendEquity": "Ekuiti",
  "bt.legendBalance": "Baki",
  "bt.legendStart": "Permulaan",
  "bt.noCurve": "Bar tidak mencukupi untuk keluk.",
  "bt.scrubHint": "Seret merentasi carta, atau sentuh dan tahan, untuk membaca mana-mana titik.",
  "bt.curveA11y": "Ekuiti dari {from} hingga {to}; drawdown maksimum {dd}",
  "bt.monthly": "Bulanan", // (display)
  "bt.monthlySub": "Pulangan setiap bulan, % daripada baki",
  "bt.noTradesMonth": "tiada dagangan",
  "bt.statistics": "Statistik", // (display)
  "bt.tradeList": "Dagangan", // (display)
  "bt.tradeListSub": "Terbaharu dahulu, selepas kos",
  "bt.truncated": "{n} dagangan pertama, terbaharu dahulu",
  "bt.fAll": "Semua · {n}",
  "bt.fWins": "Untung · {n}",
  "bt.fLosses": "Rugi · {n}",
  "bt.noTrades": "Peraturan tidak berdagang dalam tempoh ini.",
  "bt.data": "Data & kos", // (display)
  "bt.m1Bars": "Bar minit (intrabar)",
  "bt.since": "sejak {date}",
  "bt.signals": "Isyarat",
  "bt.signalsValue": "{buy} beli · {sell} jual · {exits} keluar",
  "bt.skipped": "Dilangkau: {reason}",
  "bt.model": "Model",
  "bt.group": "Jenis akaun",
  "bt.spread": "Spread",
  "bt.spreadValue": "{points} mata ({source})",
  "bt.commission": "Komisen",
  "bt.perLot": "{amount} setiap lot",
  "bt.swaps": "Swap",
  "bt.swapsOn": "Dikenakan pada setiap rollover",
  "bt.swapsOff": "Tidak dikenakan (bebas swap)",
  "bt.conversion": "Penukaran P&L",
  "bt.usdBase": "Asas USD: pada harga keluar",
  "bt.usdQuoted": "Disebut harga dalam USD",
  "bt.currentRate": "Pada kadar semasa ({rate})",
  "bt.simNote": "Ujian balik #{id} ialah simulasi pada harga lampau: pelaksanaan pada harga buka bar seterusnya, stop dan sasaran pada laluan OHLC (bar minit jika ada), spread, komisen dan swap jenis akaun anda. Hasil lalu tidak meramalkan hasil masa hadapan.",
  // History sources and skip reasons from the service
  "source.native": "asli",
  "source.built_from_M1": "dibina daripada M1",
  "source.built_from_M5": "dibina daripada M5",
  "source.built_from_M15": "dibina daripada M15",
  "source.built_from_M30": "dibina daripada M30",
  "source.built_from_H1": "dibina daripada H1",
  "skip.outside_trading_window": "di luar waktu dagangan",
  "skip.position_already_open": "posisi sudah terbuka",
  "skip.daily_trade_limit": "had dagangan harian",
  "skip.max_daily_loss": "had kerugian harian",
  "skip.market_closed": "pasaran ditutup",
  "skip.20_open_positions": "20 posisi sudah terbuka",
  "skip.buy_and_sell_on_the_same_bar": "beli dan jual pada bar yang sama",
  "skip.stop_distance_not_ready": "jarak stop belum sedia",
  "skip.SL_level_on_the_wrong_side": "paras stop di sebelah yang salah",
  "skip.volume_below_the_minimum_lot": "saiz di bawah lot minimum",
  "spreadSource.group_quote": "sebut harga langsung jenis akaun anda",
  "spreadSource.catalogue": "spread katalog",
  "spreadSource.fixed": "tetap",

  "btNew.title": "Jalankan ujian balik", // (display)
  "btNew.period": "Tempoh",
  "btNew.balance": "Baki permulaan",
  "btNew.other": "Lain",
  "btNew.amount": "Jumlah",
  "btNew.costs": "Kos daripada",
  "btNew.accountType": "Jenis akaun",
  "btNew.myAccount": "Akaun saya",
  "btNew.costsGroupHint": "Spread, komisen dan swap jenis akaun itu.",
  "btNew.costsAccountHint": "Spread, komisen dan swap kumpulan akaun itu.",
  "btNew.noAccounts": "Anda belum mempunyai akaun dagangan aktif.",
  "btNew.run": "Jalankan ujian balik",
  "btNew.note": "Tempoh terpanjang bergantung pada jangka masa. Sehingga 3 ujian balik boleh berjalan serentak.",

  "period.p1m": "1B",
  "period.p3m": "3B",
  "period.p6m": "6B",
  "period.p1y": "1T",
  "period.p2y": "2T",
  "period.p5y": "5T",

  // Trade exit reasons (server codes)
  "exit.sl": "Henti rugi",
  "exit.tp": "Ambil untung",
  "exit.trailing": "Trailing stop",
  "exit.breakeven": "Pulang modal",
  "exit.signal": "Isyarat",
  "exit.exit_rule": "Peraturan keluar",
  "exit.session": "Di luar waktu",
  "exit.end_of_test": "Akhir ujian",
  "exit.stop_out": "Stop-out",
  "exit.kill": "Suis henti",
  "exit.stopped": "Dihentikan",
  "exit.client": "Ditutup",
  "exit.close": "Ditutup",

  "stat.balance": "Baki",
  "stat.gross": "Untung / rugi kasar",
  "stat.cagr": "Pertumbuhan tahunan (CAGR)",
  "stat.avgWinLoss": "Purata untung / rugi",
  "stat.largest": "Untung / rugi terbesar",
  "stat.payoff": "Nisbah bayaran",
  "stat.long": "Dagangan long · kadar menang",
  "stat.short": "Dagangan short · kadar menang",
  "stat.streaks": "Untung / rugi berturut-turut terbanyak",
  "stat.maxDd": "Drawdown maks",
  "stat.recovery": "Faktor pemulihan",
  "stat.sharpeSortino": "Sharpe / Sortino",
  "stat.avgBars": "Purata bar dipegang",
  "stat.exposure": "Masa dalam pasaran",
  "stat.costs": "Komisen / swap / spread",
  "stat.bars": "Bar diuji",
  "stat.cpu": "Dikira dalam",
  "stat.seconds": "{s} s",

  /* ---------------------------------------------------------------- */
  /* Log kinds (runtime)                                               */
  /* ---------------------------------------------------------------- */
  "log.eval": "Bar",
  "log.signal": "Isyarat",
  "log.order": "Pesanan",
  "log.close": "Tutup",
  "log.manage": "Urus",
  "log.error": "Ralat",
  "log.info": "Info",

  /* ---------------------------------------------------------------- */
  /* Marketplace                                                       */
  /* ---------------------------------------------------------------- */
  "house.badge": "Strategi dalaman · Dikendalikan oleh Kalks",
  "house.disclosure":
    "Strategi dalaman dikendalikan oleh Kalks: akaun sebenar milik broker yang menjalankan strategi ini. Rekod prestasi hanyalah dagangan sebenarnya sendiri sejak ia bermula; tiada apa-apa yang disimulasikan atau diisi ke belakang.",
  "market.eyebrow": "Pasaran strategi",
  "market.title": "Pasaran", // (display)
  "market.subtitle": "Strategi dengan rekod prestasi yang disahkan daripada akaun Kalks sebenar. Salin satu ke akaun anda, atau klon peraturannya jika pengarang membenarkannya.",
  "market.browse": "Layari",
  "market.subs": "Langganan",
  "market.subsN": "Langganan · {n}",
  "market.mine": "Senarai anda",
  "market.search": "Cari strategi, pengarang…",
  "market.clear": "Kosongkan carian",
  "market.all": "Semua",
  "market.free": "Percuma",
  "market.paid": "Berbayar",
  "market.newest": "Terbaharu",
  "market.topRated": "Penilaian tertinggi",
  "market.popular": "Popular",
  // {price} in USDT
  "market.perMonth": "{price} USDT/bln",
  "market.by": "oleh {author}",
  "market.return": "Pulangan",
  "market.winRate": "Kadar menang",
  "market.maxDd": "DD maks",
  "market.trades": "Dagangan",
  // {type} = live / demo
  "market.verified": "{type} disahkan",
  "market.verifiedDays": "{type} disahkan · {days} hari",
  // a track record younger than a day
  "market.verifiedNew": "{type} disahkan · kurang sehari",
  "market.subscribed": "Dilanggan",
  "market.ratings": { zero: "Tiada penilaian", other: "{count} penilaian" },
  "market.subscribers": { other: "{count} pelanggan" },
  "market.emptyTitle": "Belum ada yang disenaraikan", // (display)
  "market.emptyText": "Strategi dipaparkan di sini sebaik sahaja pengarangnya menerbitkannya dengan rekod prestasi yang disahkan.",
  "market.noMatchTitle": "Tiada padanan", // (display)
  "market.noMatchText": "Cuba carian atau penapis lain.",
  "market.noSubsTitle": "Tiada langganan", // (display)
  "market.noSubsText": "Strategi yang anda salin atau klon dari pasaran strategi dipaparkan di sini.",
  "market.disclaimer": "Prestasi lalu tidak menjamin keputusan masa hadapan. Rekod prestasi datang daripada akaun sebenar atau demo di Kalks dan dilabelkan sewajarnya. Yuran platform untuk langganan berbayar: {pct}%.",
  "market.houseFootnote": "Strategi dalaman berjalan pada akaun sebenar milik broker; rekod prestasinya hanyalah dagangan sebenarnya sendiri.",
  "market.earned": "Diperoleh",
  "market.fees": "Yuran platform",
  "market.payments": "Pembayaran",
  "market.publishWeb": "Penerbitan strategi (dengan rekod prestasi yang disahkan) dan pengeditan senarai dilakukan di Kawasan Pelanggan di web.",
  "market.openWeb": "Buka pasaran strategi di web",

  // Listing statuses (server values)
  "listing.pending": "Sedang disemak",
  "listing.approved": "Disenaraikan",
  "listing.rejected": "Ditolak",
  "listing.suspended": "Digantung",
  "listing.unlisted": "Tidak disenaraikan",
  "listing.eyebrow": "Pasaran strategi · {symbol} {tf}",
  "listing.verified": "Rekod prestasi {type} yang disahkan",
  "listing.cloneAllowed": "Pengklonan dibenarkan",
  "listing.trackReturn": "Pulangan disahkan",
  "listing.net": "Bersih",
  "listing.noCurve": "Keluk harian dipaparkan selepas dua hari dagangan.",
  "listing.curveA11y": "Ekuiti mengikut hari selama {days} hari, pulangan {ret}",
  "listing.trackNote": "Daripada pelancaran pengarang sendiri di Kalks sejak {since}, dikira daripada urus niaga ditutup pada enjin dagangan: tidak sekali-kali dimasukkan oleh pengarang.",
  "listing.btSimulated": "Ujian balik · disimulasikan",
  "listing.btNote": "Cara peraturan akan berdagang pada harga lampau dengan kos jenis akaun ini. Ia bukan sebahagian daripada rekod prestasi sebenar di atas.",
  "listing.btA11y": "Keluk ekuiti ujian balik (disimulasikan)",
  "listing.about": "Perihal", // (display)
  "listing.risk": "Risiko", // (display)
  "listing.rules": "Peraturan", // (display)
  "listing.rulesPrivate": "Peraturan adalah peribadi: salin strategi untuk menjalankannya pada akaun anda.",
  "listing.reviews": "Ulasan · {n}", // (display)
  "listing.noReviews": "Belum ada ulasan.",
  "listing.subscribeFree": "Langgan secara percuma",
  "listing.subscribePaid": "Langgan · {price} USDT / bulan",
  "listing.copying": "Menyalin pada {login}",
  "listing.clonedTo": "Diklon ke strategi anda",
  "listing.openDeployment": "Buka pelancaran",
  "listing.openStrategy": "Buka strategi",
  "listing.cancel": "Batal",
  "listing.cancelConfirm": "Batalkan langganan",
  "listing.keep": "Kekalkan",
  "listing.cancelTitle": "Batalkan?", // (display)
  "listing.cancelCopy": "Strategi berhenti pada akaun anda sekarang. Posisi terbukanya kekal terbuka dengan stop dan sasaran masing-masing.",
  "listing.cancelClone": "Langganan tamat. Strategi yang diklon kekal dalam senarai anda.",
  // {date} = end of the paid period
  "listing.cancelPaid": "Ia terus berjalan sehingga {date} dan tidak akan diperbaharui. Tiada bayaran balik untuk tempoh semasa.",
  "listing.cancelled": "Langganan dibatalkan",
  "listing.cancelledPaid": "Ia tidak akan diperbaharui",
  "listing.yours": "Senarai anda",
  "listing.manageWeb": "Urus di web",

  /* ---------------------------------------------------------------- */
  /* Subscribe (form), subscriptions                                   */
  /* ---------------------------------------------------------------- */
  "sub.eyebrow": "Langgan",
  "sub.title": "Langgan",
  "sub.body": "oleh {author} · {symbol} {tf}",
  "sub.how": "Cara",
  "sub.copyTitle": "Salin ke akaun saya",
  "sub.copyText": "Versi tepat pengarang berjalan pada akaun anda, 24/7. Peraturan kekal peribadi.",
  "sub.copyTextOpen": "Versi tepat pengarang berjalan pada akaun anda, 24/7.",
  "sub.cloneTitle": "Klon peraturan",
  "sub.cloneText": "Peraturan menjadi salah satu strategi anda: uji, ubah dan lancarkannya sendiri.",
  "sub.multiplierHint": "Menskalakan saiz pesanan strategi pada akaun anda.",
  "sub.price": "Harga",
  "sub.dueNow": "Perlu dibayar sekarang",
  "sub.wallet": "Dompet (tersedia)",
  "sub.renewal": "Pembaharuan",
  "sub.noCharge": "Percuma, tiada caj",
  "sub.shortTitle": "USDT tidak mencukupi",
  "sub.shortBody": "Dompet anda memerlukan sekurang-kurangnya {amount} USDT tersedia.",
  "sub.deposit": "Deposit",
  "sub.liveBody": "Strategi meletakkan pesanan sebenar dengan wang sebenar pada akaun ini, dan boleh kehilangannya.",
  "sub.ackPay": "Caj {price} USDT daripada dompet Kalks saya sekarang dan setiap 30 hari sehingga saya membatalkannya.",
  "sub.doneTitle": "Dilanggan", // (display)
  // {title} = strategy, {account} = "Demo 50000083"
  "sub.doneCopy": "“{title}” sedang berjalan pada {account}.",
  "sub.doneClone": "“{title}” kini salah satu strategi anda.",
  "sub.charged": "{amount} USDT telah dicaj daripada dompet anda.",
  // the answer to a subscribe request was lost (connection, timeout): the app re-reads the listing before a retry
  "sub.noAnswer": "Kami tidak menerima jawapan. Langganan mungkin telah berjaya.",
  "sub.checkingTitle": "Menyemak langganan anda",
  "sub.checkingBody": "Jawapan hilang dalam perjalanan. Kami sedang menyemak dengan pelayan sebelum anda boleh cuba lagi, supaya anda tidak sekali-kali dicaj dua kali.",
  "sub.noAnswerRetry": "Masih tiada jawapan, dan tiada langganan baharu pada akaun anda. Anda boleh cuba lagi.",
  "sub.notThrough": "Ia tidak berjaya, dan tiada caj yang kekal (sebarang caj dikembalikan ke dompet anda). Anda boleh cuba lagi.",
  "sub.unfinished": "Ia masih sedang disediakan pada pelayan. Semak Pasaran strategi › Langganan dan sejarah dompet anda, atau hubungi sokongan, sebelum mencuba lagi.",
  "sub.free": "Langganan percuma: tiada caj dikenakan.",
  "sub.copyOn": "salin pada {login}",
  "sub.cloned": "diklon",
  "sub.renews": "diperbaharui {date}",
  "sub.ends": "tamat {date}",
  "sub.status.active": "Aktif",
  "sub.status.cancelled": "Dibatalkan",
  "sub.status.expired": "Tamat tempoh",
  "sub.status.past_due": "Bayaran tertunggak",

  "review.title": "Nilaikan", // (display)
  "review.rating": "Penilaian anda",
  "review.stars": { other: "{count} bintang" },
  "review.comment": "Komen (pilihan)",
  "review.placeholder": "Bagaimanakah prestasi dagangannya untuk anda?",
  "review.post": "Hantar ulasan",
  "review.saved": "Ulasan disimpan",
  "review.rate": "Nilaikan",
  "review.edit": "Edit ulasan",
  "review.you": "Anda",

  /* ---------------------------------------------------------------- */
  /* API keys and webhooks                                             */
  /* ---------------------------------------------------------------- */
  "keys.eyebrow": "Pembangun",
  "keys.title": "API", // (display)
  "keys.subtitle": "Kunci untuk program dagangan anda sendiri dan URL webhook untuk amaran (TradingView dan lain-lain).",
  "keys.requests24h": "Permintaan · 24 j lepas",
  "keys.errors": "Ralat",
  // requests refused by the rate limit
  "keys.limited": "Dihadkan",
  "keys.p50": "Median",
  "keys.writes": "Pesanan",
  "keys.keys": "Kunci API", // (display)
  "keys.keysSub": "{n} aktif · sehingga 20",
  "keys.none": "Tiada kunci API. Cipta satu di Kawasan Pelanggan di web.",
  "keys.status.active": "Aktif",
  "keys.status.revoked": "Dibatalkan",
  "keys.status.expired": "Tamat tempoh",
  "keys.scope.read": "Baca",
  "keys.scope.trade": "Dagang",
  // {ips} = list of IP addresses
  "keys.ips": "Hanya dari {ips}",
  "keys.anyIp": "Dari mana-mana alamat IP",
  "keys.expires": "Tamat tempoh {date}",
  "keys.noExpiry": "Tidak pernah tamat tempoh",
  "keys.lastUsed": "kali terakhir digunakan {ago}",
  "keys.revoke": "Batalkan",
  "keys.revokeTitle": "Batalkan kunci ini?", // (display)
  "keys.revokeBody": "“{name}” ({id}) berhenti berfungsi serta-merta untuk setiap program yang menggunakannya. Ini tidak boleh dibuat asal.",
  "keys.revoked": "“{name}” dibatalkan",
  "keys.webTitle": "Cipta di web",
  "keys.webBody": "Kunci dan webhook baharu dicipta di Kawasan Pelanggan: rahsia kunci dan URL webhook dipaparkan sekali, di mana anda boleh menyalinnya ke alat dagangan anda.",
  "keys.openWeb": "Buka Kawasan Pelanggan",
  "keys.killHint": "Perlu menghentikan semuanya? Suis henti pada skrin Algo menghentikan setiap strategi dan menyekat pesanan webhook dan API.",

  "hooks.title": "Webhook", // (display)
  "hooks.sub": "{n} daripada maksimum 20",
  "hooks.none": "Tiada webhook. Cipta satu di Kawasan Pelanggan di web.",
  // {hint} = the URL's last characters
  "hooks.hint": "URL …{hint}",
  "hooks.accounts": { other: "{count} akaun" },
  "hooks.today": { zero: "tiada amaran hari ini", other: "{count} amaran hari ini" },
  "hooks.used": "digunakan {ago}",
  "hooks.on": "Hidup",
  "hooks.off": "Mati",
  "hooks.switch": "Webhook “{name}” hidup",
  "hooks.passphrase": "Frasa laluan diperlukan",
  "hooks.noPassphrase": "Tiada frasa laluan",
  "hooks.delete": "Padam",
  "hooks.deleteTitle": "Padam webhook ini?", // (display)
  "hooks.deleteBody": "“{name}” dan URL rahsianya berhenti berfungsi serta-merta; amaran yang dihantar kepadanya ditolak. Ini tidak boleh dibuat asal.",
  "hooks.deleted": "“{name}” dipadam",
  "hooks.alerts": "Amaran terkini", // (display)
  "hooks.alertsSub": "Setiap amaran dengan hasil bagi setiap akaun",
  // Alert statuses (server values)
  "hooks.status.accepted": "Diterima",
  "hooks.status.partial": "Sebahagian selesai",
  "hooks.status.failed": "Gagal",
  "hooks.status.received": "Sampai",
  "hooks.status.rejected": "Ditolak",
  "hooks.status.blocked": "Disekat (suis henti)",
  // Each account's result of an alert (server values)
  "hooks.result.filled": "dilaksanakan",
  "hooks.result.pending": "pesanan diletakkan",
  "hooks.result.closed": "ditutup",
  "hooks.result.nothing_to_close": "tiada apa-apa untuk ditutup",
  "hooks.result.rejected": "ditolak",
};
export default mobileAlgo;
