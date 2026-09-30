import type { NsMessages } from "../../core";

// Kalks mobile app: Algo (/algo): strategies running 24/7 on the server (deployments), the kill switch, backtest
// reports, the strategy marketplace, API keys and webhooks.
// Kept as they are: Kalks, Algo, API, USDT, USD, indicator names (EMA, RSI, MACD, ATR, CCI, ADX, DI…), symbols
// (EURUSD, XAUUSD), timeframes (M15, H1, H4), "R" (a multiple of the stop distance), pip, DD, SL / TP. K/Z = P&L.
// Titles marked (display) are shown in tall uppercase display type: keep them short.
// "Dağıtım" = one strategy version running on one trading account. "Acil durdurma" = the kill switch.
const mobileAlgo: NsMessages<"mobileAlgo"> = {
  never: "hiç",
  // {n} days, compact
  days: "{n} g",
  lot: "lot",
  // How long a trade was held: dk = minutes, sa = hours, g = days (compact)
  "dur.m": "{m} dk",
  "dur.h": "{h} sa",
  "dur.hm": "{h} sa {m} dk",
  "dur.d": "{d} g",
  "dur.dh": "{d} g {h} sa",
  nTrades: { one: "{count} işlem", other: "{count} işlem" },
  readOnly: "Bu giriş stratejileri görüntüleyebilir ancak hiçbir şeyi değiştiremez.",

  /* ---------------------------------------------------------------- */
  /* Screen states                                                     */
  /* ---------------------------------------------------------------- */
  "state.unavailable.title": "Algo kullanılamıyor", // (display)
  "state.unavailable.text": "Strateji hizmetine ulaşamadık. Stratejileriniz sunucuda çalışmaya devam ediyor; lütfen biraz sonra tekrar deneyin.",
  "state.disabled.title": "Kullanılamıyor", // (display)
  "state.disabled.text": "Bu özellik hesabınızda kullanılamıyor.",
  "state.notFound.title": "Bulunamadı", // (display)
  "state.notFound.text": "Kaldırılmış olabilir veya bağlantı hatalı.",
  "state.back": "Algo'ya dön",

  /* ---------------------------------------------------------------- */
  /* Server errors (codes of the strategy service)                     */
  /* ---------------------------------------------------------------- */
  "error.haltedMine": "Acil durdurmanız açık. Stratejileri yeniden başlatmadan önce Algo ekranından kaldırın.",
  "error.haltedPlatform": "Otomatik işlemler şu anda aracı kurum tarafından duraklatıldı. Lütfen daha sonra tekrar deneyin.",
  // {n} = the most strategies that can run at once
  "error.limitRunning": "Aynı anda en fazla {n} strateji çalıştırabilirsiniz. Önce birini durdurun.",
  "error.accountStatus": "Bu hesap şu anda işlem yapamaz.",
  "error.alreadyRunning": "Bu sürüm o hesapta zaten çalışıyor.",
  "error.invalidStrategy": "Önce stratejinin hatalarını düzeltin (Müşteri Alanı'nda veya AI Trader ile).",
  "error.state": "Durumu zaten değişti. Güncel durumunu görmek için aşağı çekin.",
  "error.queueFull": "Sırada bekleyen veya çalışan 3 backtestiniz zaten var. Birinin bitmesini bekleyin.",
  "error.dailyLimit": "Bugünkü {n} backtest sınırına ulaştınız.",
  "error.ownListing": "Kendi stratejinize abone olamazsınız.",
  "error.subscribed": "Bu stratejiye zaten abonesiniz.",
  "error.cloneNotAllowed": "Yazar klonlamaya izin vermiyor; bunun yerine hesabınıza kopyalayın.",
  // {amount} in USDT
  "error.insufficientFunds": "Cüzdan bakiyeniz {amount} USDT'nin altında. Abone olmak için USDT yatırın.",
  "error.insufficientFundsPlain": "Cüzdan bakiyeniz çok düşük. Abone olmak için USDT yatırın.",
  "error.inactive": "Bu abonelik artık aktif değil.",
  "error.archiveRunning": "Arşivlemeden önce bu stratejinin dağıtımlarını durdurun.",
  "error.archived": "Bu strateji arşivlendi.",
  "error.finished": "Bu backtest zaten bitti.",
  "error.revoked": "Bu anahtar zaten iptal edildi.",
  "error.notFound": "Artık mevcut değil.",
  // {tf} = timeframe (H1), {days} = number of days
  "error.rangeTooLong": "{tf} backtestleri en fazla {days} günü kapsayabilir. Daha kısa bir dönem seçin.",
  "error.balanceRange": "Başlangıç bakiyesi 100 ile 10.000.000 arasında olmalıdır.",
  "error.dates": "Başlangıç tarihi bitiş tarihinden önce olmalıdır.",

  /* ---------------------------------------------------------------- */
  /* Home                                                              */
  /* ---------------------------------------------------------------- */
  "home.eyebrow": "Otomatik işlem",
  "home.title": "Algo", // (display)
  "home.heroEyebrow": "Şu an çalışan",
  "home.heroRunning": {
    zero: "strateji sunucuda 7/24 işlem yapıyor",
    one: "strateji sunucuda 7/24 işlem yapıyor",
    other: "strateji sunucuda 7/24 işlem yapıyor",
  },
  "home.heroRealized": "Gerçekleşen K/Z",
  "home.heroOpen": "Şu an açık",
  // closed trades so far
  "home.heroTrades": "İşlemler",
  "home.qaAi": "AI ile oluştur",
  "home.qaAiHint": "Bir fikir anlatın, kesin kurallar alın",
  "home.qaMarket": "Pazar yeri",
  "home.qaMarketHint": "Doğrulanmış stratejileri kopyalayın",
  "home.qaKeys": "API anahtarları ve webhook'lar",
  "home.qaKeysHint": "Kullanım, iptal, son uyarılar",
  "home.running": "Dağıtımlar", // (display)
  "home.runningSub": { zero: "Şu anda çalışan yok", one: "{count} çalışıyor", other: "{count} çalışıyor" },
  // {n} = count shown on the filter pill
  "home.filterActive": "Aktif · {n}",
  "home.filterAll": "Tümü · {n}",
  "home.strategies": "Stratejilerim", // (display)
  "home.strategiesSub": { zero: "Henüz kayıtlı yok", one: "{count} kayıtlı", other: "{count} kayıtlı" },
  "home.newWithAi": "AI ile yeni",
  "home.backtests": "Backtestler", // (display)
  "home.backtestsSub": "Son çalıştırmalar, en yeniden eskiye",
  "home.emptyDeps": "Henüz hiçbir şey çalışmadı. Aşağıdaki stratejilerinizden birini açın ve önce bir demo hesapta dağıtın.",
  "home.emptyActive": "Şu anda çalışan bir şey yok. Durdurulan stratejiler Tümü altında.",
  "home.showAll": "Tümünü göster",
  "home.emptyStrats": "Henüz size ait bir strateji yok. Fikrinizi AI Trader'a anlatın; test edebileceğiniz kesin kurallara dönüşsün.",
  "home.browseMarket": "Pazar yerine göz at",
  "home.emptyBts": "Henüz backtest yok. Bir strateji açın ve gerçek fiyat geçmişinde çalıştırın.",
  "home.startEyebrow": "Başlarken",
  "home.startTitle": "Stratejinizi çalıştırın", // (display)
  "home.step1": "Fikrinizi AI Trader'a anlatın: okuyup değiştirebileceğiniz kesin kurallara dönüşür.",
  "home.step2": "Kuralları hesabınızın maliyetleriyle gerçek fiyat geçmişinde backtest edin.",
  "home.step3": "Önce bir demo hesapta 7/24 çalıştırın. İstediğiniz zaman duraklatın, durdurun veya sonlandırın.",
  "home.footnote": "Stratejiler Kalks sunucularında 7/24, kapanan barlar üzerinde ve manuel işlemdekiyle aynı emir kontrolleriyle çalışır: teminat, piyasa saatleri, limitleriniz. Stratejileri AI Trader ile veya Müşteri Alanı'nda oluşturup düzenleyin.",
  "home.openWeb": "Web'de strateji oluşturucuyu aç",

  /* ---------------------------------------------------------------- */
  /* Kill switch (account-wide)                                        */
  /* ---------------------------------------------------------------- */
  "kill.cardTitle": "Acil durdurma",
  "kill.cardBody": "Tüm stratejileri tek seferde durdurun, webhook ve API emirlerini engelleyin.",
  "kill.stopAll": "Tümünü durdur",
  "kill.onTitle": "Acil durdurma açık",
  // {at} = date and time
  "kill.onSince": "{at} tarihinden beri. Stratejiler durduruldu; webhook ve API emirleri engelleniyor.",
  "kill.onBody": "Stratejiler durduruldu; webhook ve API emirleri engelleniyor.",
  "kill.release": "Kaldır",
  "kill.title": "Her şey durdurulsun mu?", // (display)
  "kill.body": {
    zero: "Tüm stratejiler anında durur; siz acil durdurmayı kaldırana kadar webhook ve API emirleri engellenir.",
    one: "Çalışan strateji anında durur; siz acil durdurmayı kaldırana kadar webhook ve API emirleri engellenir.",
    other: "Çalışan {count} stratejinin tamamı anında durur; siz acil durdurmayı kaldırana kadar webhook ve API emirleri engellenir.",
  },
  "kill.alsoClose": "Pozisyonlarını da kapat",
  "kill.alsoCloseHint": "Tüm hesaplarınızda bir strateji, webhook veya API tarafından açılan her pozisyonu piyasa fiyatından kapatır. Kendi manuel işlemleriniz açık kalır.",
  "kill.confirm": "Şimdi tümünü durdur",
  "kill.doneTitle": "Her şey durduruldu", // (display)
  "kill.stopped": "Stratejiler durduruldu",
  "kill.doneBody": "Acil durdurma siz kaldırana kadar açık kalır. Durdurulan stratejiler kendiliğinden yeniden başlamaz.",
  "kill.releaseTitle": "Acil durdurma kaldırılsın mı?", // (display)
  "kill.releaseBody": "Webhook ve API emirlerine yeniden izin verilir. Durdurulan stratejiler durmuş kalır: hazır olduğunuzda yeniden dağıtın.",
  "kill.releasedTitle": "Acil durdurma kaldırıldı", // (display)
  "kill.releasedBody": "Webhook ve API emirlerine yeniden izin veriliyor. Başlatmak için bir strateji dağıtın.",
  "kill.globalTitle": "Otomatik işlemler duraklatıldı",
  "kill.globalBody": "Aracı kurum şimdilik tüm strateji, webhook ve API emirlerini duraklattı. Açık pozisyonlar stoplarını korur.",

  /* ---------------------------------------------------------------- */
  /* Deployment statuses, controls                                     */
  /* ---------------------------------------------------------------- */
  "dep.status.running": "Çalışıyor",
  "dep.status.paused": "Duraklatıldı",
  "dep.status.stopped": "Durduruldu",
  "dep.status.killed": "Sonlandırıldı",
  "dep.status.error": "Hata",
  "dep.realized": "Gerçekleşen K/Z",
  "dep.trades": "İşlemler",
  "dep.winRate": "Kazanma oranı",
  "dep.open": "Açık",
  "dep.orders": "Emirler",
  "dep.openNow": "Açık",
  // {ago} = "5 dakika önce"
  "dep.lastCheck": "Son bar {ago} kontrol edildi",
  // {since} = start date
  "dep.lastCheckSince": "Son bar {ago} kontrol edildi · {since} tarihinden beri çalışıyor",
  // {reason} = the service's reason, e.g. "stopped by the owner"
  "dep.stoppedWhy": "Durduruldu: {reason}",
  "dep.stoppedTitle": "Durduruldu: {at}",
  "dep.errorTitle": "Strateji bir hatayla karşılaştı",
  // {account} = "Demo 50000083"
  "dep.eyebrow": "Dağıtım · {account}",
  "dep.marketplaceCopy": "Pazar yeri kopyası",
  "dep.openStrategy": "Stratejiyi aç",
  "dep.openSubscription": "Aboneliklerimi aç",
  // {pct} = return %, {amount} = starting balance
  "dep.onStart": "{amount} üzerinde {pct}",
  "dep.curveA11y": "{days} gün boyunca günlük bakiye, gerçekleşen {pnl}",
  "dep.tabLog": "Günlük · {n}",
  "dep.tabTrades": "İşlemler · {n}",
  "dep.tabSetup": "Kurulum",
  "dep.noLogs": "Henüz kayıt yok: ilk kapanan bar ısınma içindir.",
  "dep.noTrades": "Henüz işlem yok.",
  "dep.older": "Daha eski kayıtları yükle",
  "dep.logStart": "İlk kayıt bu.",
  "dep.rules": "Kurallar",
  "dep.rulesHidden": "Yazar kuralları gizli tutuyor: strateji hesabınızda yayınlandığı şekliyle çalışır.",
  "dep.lotMultiplier": "Lot çarpanı",
  "dep.maxLots": "Emir başına maks. lot",
  "dep.maxOpen": "Maks. açık pozisyon",
  "dep.dailyLoss": "Günlük zarar limiti",
  "dep.started": "Başlangıç",
  "dep.startBalance": "Başlangıç bakiyesi",
  "dep.setupNote": "Bir dağıtım tek bir kesin sürümü çalıştırır: yeni bir sürüm kaydetmek onu değiştirmez. Geçmek için yeni sürümü dağıtın.",

  "ctl.pause": "Duraklat",
  "ctl.resume": "Devam ettir",
  "ctl.stop": "Durdur",
  "ctl.kill": "Sonlandır",
  "ctl.killNow": "Şimdi sonlandır",
  "ctl.closePositions": "Pozisyonları kapat",
  "ctl.pauseTitle": "Duraklatılsın mı?", // (display)
  "ctl.pauseBody": "Yeni işlem açılmaz. Açık pozisyonlar stop, hedef ve başabaş ayarlarını korur. İstediğiniz zaman devam ettirin.",
  "ctl.resumeTitle": "Devam ettirilsin mi?", // (display)
  "ctl.resumeBody": "Bir sonraki kapanan bardan itibaren yeniden işlem yapar.",
  "ctl.stopTitle": "Durdurulsun mu?", // (display)
  "ctl.stopBody": "Kalıcı olarak durur: yeni işlem açılmaz. Yeniden çalıştırmak için tekrar dağıtın.",
  "ctl.keepTitle": "Pozisyonları açık tut",
  "ctl.keepText": {
    one: "Açık pozisyon stop ve hedefini korur; onu kendiniz yönetin.",
    other: "{count} açık pozisyon stop ve hedeflerini korur; onları kendiniz yönetin.",
  },
  "ctl.closeAllTitle": "Şimdi kapat",
  "ctl.closeAllText": {
    one: "Açık pozisyon piyasa fiyatından kapatılır.",
    other: "{count} açık pozisyon piyasa fiyatından kapatılır.",
  },
  "ctl.killTitle": "Sonlandırılsın mı?", // (display)
  "ctl.killBody": "Acil durdurma bu stratejiyi anında durdurur ve varsayılan olarak açtığı pozisyonları piyasa fiyatından kapatır.",
  "ctl.killClose": "Pozisyonlarını kapat",
  "ctl.killCloseHint": "Şimdi, piyasa fiyatından. Stoplarıyla açık tutmak için kapatın.",
  "ctl.closeTitle": "Pozisyonları kapatılsın mı?", // (display)
  "ctl.closeBody": {
    one: "Bu stratejinin açtığı pozisyon piyasa fiyatından kapatılır. Strateji çalışmaya devam eder.",
    other: "Bu stratejinin açtığı {count} pozisyon piyasa fiyatından kapatılır. Strateji çalışmaya devam eder.",
  },
  "ctl.done.pause": "Duraklatıldı", // (display)
  "ctl.done.resume": "Yeniden çalışıyor", // (display)
  "ctl.done.stop": "Durduruldu", // (display)
  "ctl.done.kill": "Sonlandırıldı", // (display)
  "ctl.done.close": "Pozisyonlar kapatıldı", // (display)
  "ctl.donePause": "Siz devam ettirene kadar yeni işlem açılmaz.",
  "ctl.doneResume": "Bir sonraki kapanan bardan itibaren yeniden işlem yapar.",
  "ctl.doneClosed": { one: "{count} pozisyon kapatıldı.", other: "{count} pozisyon kapatıldı." },
  "ctl.doneKept": "Varsa açık pozisyonları stop ve hedefleriyle açık kalır.",
  "ctl.doneNothing": "Kapatılacak açık bir şey yoktu.",
  "ctl.closedLabel": "Kapatıldı",
  "ctl.failedLabel": "Kapatılamadı",
  "ctl.failedTitle": { one: "{count} pozisyon kapatılamadı", other: "{count} pozisyon kapatılamadı" },
  "ctl.failedBody": "Piyasa kapalı olabilir. İşlem yeniden açıldığında Portföy'den kapatın.",
  // stopping or killing a marketplace copy leaves its subscription (and a paid one's renewals) running
  "ctl.copyNote": "Bu bir pazar yeri kopyası: durdurmak aboneliği sonlandırmaz. Ödemeyi durdurmak için Pazar yeri › Abonelikler bölümünden iptal edin.",

  /* ---------------------------------------------------------------- */
  /* Strategy                                                          */
  /* ---------------------------------------------------------------- */
  // {version} = version number
  "strat.eyebrow": "Strateji · v{version}",
  "strat.runningN": { one: "Çalışıyor", other: "{count} çalışıyor" },
  "strat.draft": "Taslak",
  "strat.ready": "Hazır",
  "strat.errors": { one: "{count} hata", other: "{count} hata" },
  "strat.archivedTag": "Arşivlendi",
  "strat.lastBacktest": "Son backtest",
  "strat.backtested": "backtest",
  "strat.notTested": "Henüz test edilmedi", // (display)
  "strat.notTestedBody": "Kuralları çalıştırmadan önce hesabınızın maliyetleriyle gerçek fiyat geçmişinde test edin.",
  "strat.runFirst": "Backtest çalıştır",
  "strat.openReport": "Tam raporu aç",
  "strat.deployV": "v{version} dağıt",
  "strat.backtest": "Backtest",
  "strat.fixFirst": "Test veya dağıtımdan önce bunları düzeltin",
  "strat.line": "Satır {n}:",
  "strat.rules": "Kurallar", // (display)
  "strat.rulesSub": "Her kapanan barda kontrol edilir",
  "strat.rulesCodeSub": "Kodun sinyalleri, her kapanan barda kontrol edilir",
  "strat.showCode": "Kod olarak göster",
  "strat.risk": "Risk", // (display)
  "strat.riskSub": "Büyüklük, stoplar, saatler ve limitler",
  "strat.editVisual": "Kuralları değiştirmek için AI Trader'a sorun veya Müşteri Alanı'nda düzenleyin; her değişiklik yeni bir sürüm olarak kaydedilir.",
  "strat.editCode": "Kod stratejileri web'deki Müşteri Alanı'nda düzenlenir; her değişiklik yeni bir sürüm olarak kaydedilir.",
  "strat.openWeb": "Kodu web'de düzenle",
  "strat.deployments": "Dağıtımlar", // (display)
  "strat.deploymentsSub": { zero: "Hiçbir yerde çalışmıyor", one: "{count} dağıtım", other: "{count} dağıtım" },
  "strat.notRunning": "Çalışmıyor. Canlıda nasıl işlem yaptığını görmek için önce bir demo hesapta dağıtın.",
  "strat.backtests": "Backtestler", // (display)
  "strat.backtestsSub": { zero: "Henüz yok", one: "{count} çalıştırma", other: "{count} çalıştırma" },
  "strat.runNew": "Yeni çalıştır",
  "strat.noBacktests": "Henüz backtest yok.",
  "strat.versions": "Sürümler", // (display)
  "strat.versionsSub": { one: "{count} sürüm", other: "{count} sürüm" },
  "strat.current": "Güncel",
  "strat.archive": "Arşivle",
  "strat.archiveTitle": "Arşivlensin mi?", // (display)
  "strat.archiveBody": "“{name}” listenizden kaldırılır. Backtestleri ve geçmiş dağıtımları geçmişinizde kalır.",
  "strat.archived": "“{name}” arşivlendi",

  "kind.visual": "Görsel kurallar",
  "kind.code": "Kod",
  // Where a strategy came from
  "origin.ai": "AI Trader",
  "origin.template": "Şablon",
  "origin.manual": "Elle oluşturuldu",
  "origin.marketplace": "Pazar yeri",

  /* ---------------------------------------------------------------- */
  /* Rules in words                                                    */
  /* ---------------------------------------------------------------- */
  "rules.buy": "Alış koşulu",
  "rules.sell": "Satış koşulu",
  "rules.exitBuy": "Alış kapanış koşulu",
  "rules.exitSell": "Satış kapanış koşulu",
  "rules.and": "ve",
  "rules.or": "veya",
  // {tf} = timeframe, e.g. "H4 üzerinde"
  "rules.onTf": "{tf} üzerinde",
  "rules.noRules": "Henüz giriş kuralı yok.",
  "rules.size": "Büyüklük",
  "rules.stop": "Zarar durdur",
  "rules.target": "Kâr al",
  "rules.trailing": "İz süren stop",
  "rules.window": "İşlem saatleri",
  "rules.limits": "Limitler",
  "rules.none": "Yok",
  "rules.lots": "{lots} lot",
  "rules.riskPct": "İşlem başına %{pct} risk",
  "rules.maxLots": "maks. {lots} lot",
  // points: move the stop to entry + {o} after {v} points in profit
  "rules.breakeven": "{v} puanda başabaş (+{o})",
  "rules.allDay": "Günün her saati",
  "rules.perDay": { one: "Günde {count} işlem", other: "Günde {count} işlem" },
  "rules.dailyLoss": "{amount} zararda gün için durur",
  "rules.oneAtATime": "Aynı anda tek pozisyon",
  "rules.closeOutside": "Saatler dışında kapatır",
  "rules.noLimits": "Günlük limit yok",
  "op.crossesAbove": "yukarı keser",
  "op.crossesBelow": "aşağı keser",
  "dist.pips": "{v} pip",
  "dist.points": "{v} puan",
  "dist.price": "fiyatta {v}",
  "dist.percent": "fiyatın %{v} kadarı",
  // {v} × ATR({p})
  "dist.atr": "{v} × ATR({p})",
  "dist.level": "{v} seviyesi",
  // a multiple of the stop distance
  "dist.rr": "{v}R",
  "field.close": "Kapanış",
  "field.open": "Açılış",
  "field.high": "Yüksek",
  "field.low": "Düşük",
  "field.hl2": "Medyan fiyat",
  "field.hlc3": "Tipik fiyat",
  "field.ohlc4": "Ortalama fiyat",
  "field.volume": "Hacim",
  "pattern.bullish": "Yükseliş mumu",
  "pattern.bearish": "Düşüş mumu",
  "pattern.bullish_engulfing": "Yükseliş yutan",
  "pattern.bearish_engulfing": "Düşüş yutan",
  "pattern.hammer": "Çekiç",
  "pattern.shooting_star": "Kayan yıldız",
  "pattern.doji": "Doji",
  "pattern.inside_bar": "İç bar",
  "ind.sma": "SMA",
  "ind.ema": "EMA",
  "ind.wma": "WMA",
  "ind.rsi": "RSI",
  "ind.macd": "MACD",
  "ind.macd_signal": "MACD sinyali",
  "ind.macd_hist": "MACD histogramı",
  "ind.bb_upper": "Üst Bollinger",
  "ind.bb_middle": "Orta Bollinger",
  "ind.bb_lower": "Alt Bollinger",
  "ind.atr": "ATR",
  "ind.stoch_k": "Stochastic %K",
  "ind.stoch_d": "Stochastic %D",
  "ind.highest": "En yüksek zirve",
  "ind.lowest": "En düşük dip",
  "ind.cci": "CCI",
  "ind.willr": "Williams %R",
  "ind.adx": "ADX",
  "ind.plus_di": "+DI",
  "ind.minus_di": "−DI",
  "ind.momentum": "Momentum",
  "ind.roc": "ROC",
  "ind.stddev": "Std. sapma",
  "note.noDailyLimit": "Günlük işlem limiti yok",
  "note.noStop": "Zarar durdur yok: pozisyonlar korumasız",
  "note.riskNeedsStop": "Riske dayalı büyüklük için zarar durdur gerekir",
  "note.rrNeedsStop": "R cinsinden kâr al için zarar durdur gerekir",
  "note.noEntry": "Giriş kuralı yok: bir alış veya satış koşulu ekleyin",

  /* ---------------------------------------------------------------- */
  /* Deploy (form)                                                     */
  /* ---------------------------------------------------------------- */
  "deploy.eyebrow": "Dağıt · v{version}",
  "deploy.title": "7/24 çalıştır", // (display)
  "deploy.body": "“{name}” v{version}, telefonunuz kapalıyken bile Kalks sunucularında kapanan her {tf} barında {symbol} işlemi yapar. İstediğiniz zaman duraklatın, durdurun veya sonlandırın.",
  "deploy.account": "Hesap",
  "deploy.equity": "{amount} varlık",
  "deploy.noAccounts": "Aktif bir işlem hesabına ihtiyacınız var. Stratejileri risksiz denemek için bir demo hesap açın.",
  "deploy.openAccount": "Hesap aç",
  "deploy.multiplier": "Lot çarpanı",
  "deploy.multiplierHint": "Her emrin büyüklüğünü ölçekler. 1× ile strateji kendi büyüklüğüyle işlem yapar.",
  "deploy.maxOpen": "Maks. açık pozisyon",
  "deploy.maxOpenHint": "Stratejinin kendi kurallarına ek bir üst sınır.",
  "deploy.strategyDefault": "Stratejinin kuralı",
  "deploy.dailyLoss": "Günlük zarar limiti",
  "deploy.dailyLossHint": "Günün kapalı ve açık zararı bu tutara ulaştığında ertesi güne kadar yeni işlem açılmaz (sunucu saati).",
  "deploy.off": "Kapalı",
  "deploy.custom": "Özel",
  "deploy.dailyLossAmount": "Günlük zarar",
  "deploy.lossInvalid": "0'ın üzerinde bir tutar girin.",
  "deploy.liveTitle": "Gerçek para",
  "deploy.liveBody": "Bu bir gerçek hesap. Strateji gerçek parayla gerçek emirler verir ve para kaybedebilir.",
  "deploy.ack": "Stratejinin gerçek hesabımda gerçek parayla işlem yaptığını ve bundan benim sorumlu olduğumu anlıyorum.",
  "deploy.note": "Otomatik işlem para kaybettirebilir. Backtestler simülasyondur ve gelecekteki sonuçları öngörmez. Bu yatırım tavsiyesi değildir.",
  // {account} = "Demo 50000083"
  "deploy.confirm": "{account} hesabında dağıt",
  "deploy.doneTitle": "Çalışıyor", // (display)
  "deploy.doneBody": "“{name}” v{version}, {account} hesabında çalışıyor.",
  "deploy.warmup": "İlk kapanan {tf} barı ısınma içindir; emirler bir sonrakinden itibaren başlayabilir.",
  "deploy.open": "Dağıtımı aç",

  /* ---------------------------------------------------------------- */
  /* Backtests                                                         */
  /* ---------------------------------------------------------------- */
  "bt.status.queued": "Sırada",
  "bt.status.running": "Çalışıyor",
  "bt.status.done": "Tamamlandı",
  "bt.status.failed": "Başarısız",
  "bt.status.cancelled": "İptal edildi",
  "bt.stage.queued": "Boş bir işlemci bekleniyor",
  "bt.stage.loading": "Fiyat geçmişi yükleniyor",
  "bt.stage.m1": "Dakikalık barlar yükleniyor",
  "bt.stage.simulating": "İşlemler simüle ediliyor",
  "bt.stage.running": "Çalışıyor",
  // {id} = backtest number, {version} = strategy version
  "bt.eyebrow": "Backtest #{id} · v{version}",
  "bt.title": "Backtest", // (display)
  "bt.start": "Başlangıç {amount}",
  "bt.runningNote": "Sunucuda çalışır: bu ekrandan çıkıp geri dönebilirsiniz.",
  "bt.failed": "Backtest başarısız oldu",
  "bt.cancelled": "İptal edildi", // (display)
  "bt.runAgain": "Yeniden çalıştır",
  "bt.net": "Net kâr",
  // {pct} = return, {amount} = starting balance
  "bt.returnOf": "{amount} üzerinde {pct}",
  "bt.pf": "Kâr faktörü",
  "bt.winRate": "Kazanma oranı",
  "bt.winsOf": "{trades} işlemden {wins}",
  "bt.maxDd": "Maks. düşüş",
  "bt.maxDdShort": "Maks. DD",
  "bt.sharpe": "Sharpe",
  "bt.sortino": "Sortino {v}",
  "bt.trades": "İşlemler",
  "bt.longShort": "{long} long · {short} short",
  "bt.expectancy": "Beklenen değer",
  "bt.perTrade": "işlem başına",
  "bt.equity": "Varlık", // (display)
  "bt.drawdown": "Düşüş",
  "bt.legendEquity": "Varlık",
  "bt.legendBalance": "Bakiye",
  "bt.legendStart": "Başlangıç",
  "bt.noCurve": "Eğri için yeterli bar yok.",
  "bt.scrubHint": "Herhangi bir noktayı okumak için grafiğin üzerinde sürükleyin veya basılı tutun.",
  "bt.curveA11y": "{from} ile {to} arası varlık; maksimum düşüş {dd}",
  "bt.monthly": "Aylık", // (display)
  "bt.monthlySub": "Her ayın getirisi, bakiyenin yüzdesi olarak",
  "bt.noTradesMonth": "işlem yok",
  "bt.statistics": "İstatistikler", // (display)
  "bt.tradeList": "İşlemler", // (display)
  "bt.tradeListSub": "En yeniden eskiye, maliyetler sonrası",
  "bt.truncated": "İlk {n} işlem, en yeniden eskiye",
  "bt.fAll": "Tümü · {n}",
  "bt.fWins": "Kazanç · {n}",
  "bt.fLosses": "Kayıp · {n}",
  "bt.noTrades": "Kurallar bu dönemde işlem yapmadı.",
  "bt.data": "Veri ve maliyetler", // (display)
  "bt.m1Bars": "Dakikalık barlar (bar içi)",
  "bt.since": "{date} tarihinden itibaren",
  "bt.signals": "Sinyaller",
  "bt.signalsValue": "{buy} alış · {sell} satış · {exits} çıkış",
  "bt.skipped": "Atlanan: {reason}",
  "bt.model": "Model",
  "bt.group": "Hesap türü",
  "bt.spread": "Spread",
  "bt.spreadValue": "{points} puan ({source})",
  "bt.commission": "Komisyon",
  "bt.perLot": "Lot başına {amount}",
  "bt.swaps": "Swap",
  "bt.swapsOn": "Her rollover'da tahsil edilir",
  "bt.swapsOff": "Tahsil edilmez (swapsız)",
  "bt.conversion": "K/Z dönüşümü",
  "bt.usdBase": "USD baz: çıkış fiyatından",
  "bt.usdQuoted": "USD kotasyonlu",
  "bt.currentRate": "Güncel kurdan ({rate})",
  "bt.simNote": "Backtest #{id}, geçmiş fiyatlar üzerinde bir simülasyondur: gerçekleşmeler bir sonraki barın açılışında, stop ve hedefler bir OHLC yolu üzerinde (mevcut olduğunda dakikalık barlarla), hesap türünüzün spread, komisyon ve swap değerleriyle. Geçmiş sonuçlar gelecekteki sonuçları öngörmez.",
  // History sources and skip reasons from the service
  "source.native": "yerel",
  "source.built_from_M1": "M1'den oluşturuldu",
  "source.built_from_M5": "M5'ten oluşturuldu",
  "source.built_from_M15": "M15'ten oluşturuldu",
  "source.built_from_M30": "M30'dan oluşturuldu",
  "source.built_from_H1": "H1'den oluşturuldu",
  "skip.outside_trading_window": "işlem saatleri dışında",
  "skip.position_already_open": "zaten açık bir pozisyon vardı",
  "skip.daily_trade_limit": "günlük işlem limiti",
  "skip.max_daily_loss": "günlük zarar limiti",
  "skip.market_closed": "piyasa kapalı",
  "skip.20_open_positions": "zaten 20 açık pozisyon var",
  "skip.buy_and_sell_on_the_same_bar": "aynı barda alış ve satış",
  "skip.stop_distance_not_ready": "stop mesafesi henüz hazır değil",
  "skip.SL_level_on_the_wrong_side": "stop seviyesi yanlış tarafta",
  "skip.volume_below_the_minimum_lot": "büyüklük minimum lotun altında",
  "spreadSource.group_quote": "hesap türünüzün canlı kotasyonu",
  "spreadSource.catalogue": "katalog spread'i",
  "spreadSource.fixed": "sabit",

  "btNew.title": "Backtest çalıştır", // (display)
  "btNew.period": "Dönem",
  "btNew.balance": "Başlangıç bakiyesi",
  "btNew.other": "Diğer",
  "btNew.amount": "Tutar",
  "btNew.costs": "Maliyet kaynağı",
  "btNew.accountType": "Hesap türü",
  "btNew.myAccount": "Hesabım",
  "btNew.costsGroupHint": "O hesap türünün spread, komisyon ve swap değerleri.",
  "btNew.costsAccountHint": "O hesabın grubunun spread, komisyon ve swap değerleri.",
  "btNew.noAccounts": "Henüz aktif bir işlem hesabınız yok.",
  "btNew.run": "Backtest çalıştır",
  "btNew.note": "En uzun dönem zaman dilimine bağlıdır. Aynı anda en fazla 3 backtest çalışabilir.",

  // A = ay (month), Y = yıl (year)
  "period.p1m": "1A",
  "period.p3m": "3A",
  "period.p6m": "6A",
  "period.p1y": "1Y",
  "period.p2y": "2Y",
  "period.p5y": "5Y",

  // Trade exit reasons (server codes)
  "exit.sl": "Zarar durdur",
  "exit.tp": "Kâr al",
  "exit.trailing": "İz süren stop",
  "exit.breakeven": "Başabaş",
  "exit.signal": "Sinyal",
  "exit.exit_rule": "Çıkış kuralı",
  "exit.session": "Saat dışı",
  "exit.end_of_test": "Test sonu",
  "exit.stop_out": "Stop out",
  "exit.kill": "Acil durdurma",
  "exit.stopped": "Durduruldu",
  "exit.client": "Kapatıldı",
  "exit.close": "Kapatıldı",

  "stat.balance": "Bakiye",
  "stat.gross": "Brüt kâr / zarar",
  "stat.cagr": "Yıllık büyüme (CAGR)",
  "stat.avgWinLoss": "Ortalama kazanç / kayıp",
  "stat.largest": "En büyük kazanç / kayıp",
  "stat.payoff": "Ödeme oranı",
  "stat.long": "Long işlemler · kazanma oranı",
  "stat.short": "Short işlemler · kazanma oranı",
  "stat.streaks": "Art arda en çok kazanç / kayıp",
  "stat.maxDd": "Maks. düşüş",
  "stat.recovery": "Toparlanma faktörü",
  "stat.sharpeSortino": "Sharpe / Sortino",
  "stat.avgBars": "Ortalama tutulan bar",
  "stat.exposure": "Piyasada kalma süresi",
  "stat.costs": "Komisyon / swap / spread",
  "stat.bars": "Test edilen bar",
  "stat.cpu": "Hesaplama süresi",
  "stat.seconds": "{s} sn",

  /* ---------------------------------------------------------------- */
  /* Log kinds (runtime)                                               */
  /* ---------------------------------------------------------------- */
  "log.eval": "Bar",
  "log.signal": "Sinyal",
  "log.order": "Emir",
  "log.close": "Kapanış",
  "log.manage": "Yönetim",
  "log.error": "Hata",
  "log.info": "Bilgi",

  /* ---------------------------------------------------------------- */
  /* Marketplace                                                       */
  /* ---------------------------------------------------------------- */
  "house.badge": "Kurum stratejisi · Kalks tarafından işletilir",
  "house.disclosure":
    "Kalks tarafından işletilen kurum stratejisi: bu stratejiyi çalıştıran, aracı kuruma ait bir gerçek hesap. Performans geçmişi yalnızca başlangıcından bu yana kendi gerçek işlemlerini içerir; hiçbir şey simüle edilmemiş veya geriye dönük doldurulmamıştır.",
  "market.eyebrow": "Strateji pazar yeri",
  "market.title": "Pazar yeri", // (display)
  "market.subtitle": "Gerçek Kalks hesaplarından doğrulanmış performans geçmişine sahip stratejiler. Birini hesabınıza kopyalayın veya yazar izin veriyorsa kurallarını klonlayın.",
  "market.browse": "Göz at",
  "market.subs": "Abonelikler",
  "market.subsN": "Abonelikler · {n}",
  "market.mine": "İlanlarınız",
  "market.search": "Strateji, yazar ara…",
  "market.clear": "Aramayı temizle",
  "market.all": "Tümü",
  "market.free": "Ücretsiz",
  "market.paid": "Ücretli",
  "market.newest": "En yeni",
  "market.topRated": "En yüksek puanlı",
  "market.popular": "Popüler",
  // {price} in USDT
  "market.perMonth": "{price} USDT/ay",
  "market.by": "{author} tarafından",
  "market.return": "Getiri",
  "market.winRate": "Kazanma oranı",
  "market.maxDd": "Maks. DD",
  "market.trades": "İşlemler",
  // {type} = Gerçek / Demo
  "market.verified": "{type} · doğrulanmış",
  "market.verifiedDays": "doğrulanmış {type} · {days} gün",
  // a track record younger than a day
  "market.verifiedNew": "doğrulanmış {type} · bir günden az",
  "market.subscribed": "Abone olundu",
  "market.ratings": { zero: "Değerlendirme yok", one: "{count} değerlendirme", other: "{count} değerlendirme" },
  "market.subscribers": { one: "{count} abone", other: "{count} abone" },
  "market.emptyTitle": "Henüz ilan yok", // (display)
  "market.emptyText": "Stratejiler, yazarları doğrulanmış bir performans geçmişiyle yayınladığında burada görünür.",
  "market.noMatchTitle": "Eşleşme yok", // (display)
  "market.noMatchText": "Başka bir arama veya filtre deneyin.",
  "market.noSubsTitle": "Abonelik yok", // (display)
  "market.noSubsText": "Pazar yerinden kopyaladığınız veya klonladığınız stratejiler burada görünür.",
  "market.disclaimer": "Geçmiş performans gelecekteki sonuçları garanti etmez. Performans geçmişleri Kalks'taki gerçek veya demo hesaplardan gelir ve buna göre etiketlenir. Ücretli aboneliklerde platform ücreti: %{pct}.",
  "market.houseFootnote": "Kurum stratejileri aracı kuruma ait gerçek hesaplarda çalışır; performans geçmişleri yalnızca kendi gerçek işlemlerinden oluşur.",
  "market.earned": "Kazanılan",
  "market.fees": "Platform ücretleri",
  "market.payments": "Ödemeler",
  "market.publishWeb": "Bir stratejiyi (doğrulanmış performans geçmişiyle) yayınlamak ve bir ilanı düzenlemek web'deki Müşteri Alanı'nda yapılır.",
  "market.openWeb": "Pazar yerini web'de aç",

  // Listing statuses (server values)
  "listing.pending": "İncelemede",
  "listing.approved": "Listelendi",
  "listing.rejected": "Reddedildi",
  "listing.suspended": "Askıya alındı",
  "listing.unlisted": "Liste dışı",
  "listing.eyebrow": "Pazar yeri · {symbol} {tf}",
  "listing.verified": "Doğrulanmış {type} performans geçmişi",
  "listing.cloneAllowed": "Klonlamaya izin verilir",
  "listing.trackReturn": "Doğrulanmış getiri",
  "listing.net": "Net",
  "listing.noCurve": "Günlük eğri, iki günlük işlemden sonra görünür.",
  "listing.curveA11y": "{days} gün boyunca günlük varlık, getiri {ret}",
  "listing.trackNote": "Yazarın {since} tarihinden bu yana Kalks'taki kendi dağıtımından, işlem motorundaki kapanan anlaşmalardan hesaplanır: asla yazar tarafından girilmez.",
  "listing.btSimulated": "Backtest · simülasyon",
  "listing.btNote": "Kuralların bu hesap türünün maliyetleriyle geçmiş fiyatlarda nasıl işlem yapacağını gösterir. Yukarıdaki gerçek performans geçmişinin parçası değildir.",
  "listing.btA11y": "Backtest varlık eğrisi (simülasyon)",
  "listing.about": "Hakkında", // (display)
  "listing.risk": "Risk", // (display)
  "listing.rules": "Kurallar", // (display)
  "listing.rulesPrivate": "Kurallar gizli: hesabınızda çalıştırmak için stratejiyi kopyalayın.",
  "listing.reviews": "Değerlendirmeler · {n}", // (display)
  "listing.noReviews": "Henüz değerlendirme yok.",
  "listing.subscribeFree": "Ücretsiz abone ol",
  "listing.subscribePaid": "Abone ol · {price} USDT / ay",
  "listing.copying": "{login} hesabında kopyalanıyor",
  "listing.clonedTo": "Stratejilerinize klonlandı",
  "listing.openDeployment": "Dağıtımı aç",
  "listing.openStrategy": "Stratejiyi aç",
  "listing.cancel": "İptal et",
  "listing.cancelConfirm": "Aboneliği iptal et",
  "listing.keep": "Vazgeç",
  "listing.cancelTitle": "İptal edilsin mi?", // (display)
  "listing.cancelCopy": "Strateji hesabınızda şimdi durur. Açık pozisyonları stop ve hedefleriyle açık kalır.",
  "listing.cancelClone": "Abonelik sona erer. Klonlanan strateji listenizde kalır.",
  // {date} = end of the paid period
  "listing.cancelPaid": "{date} tarihine kadar çalışmaya devam eder ve yenilenmez. Mevcut dönem için iade yapılmaz.",
  "listing.cancelled": "Abonelik iptal edildi",
  "listing.cancelledPaid": "Yenilenmeyecek",
  "listing.yours": "İlanınız",
  "listing.manageWeb": "Web'de yönet",

  /* ---------------------------------------------------------------- */
  /* Subscribe (form), subscriptions                                   */
  /* ---------------------------------------------------------------- */
  "sub.eyebrow": "Abone ol",
  "sub.title": "Abone ol",
  "sub.body": "{author} tarafından · {symbol} {tf}",
  "sub.how": "Nasıl",
  "sub.copyTitle": "Hesabıma kopyala",
  "sub.copyText": "Yazarın tam sürümü hesabınızda 7/24 çalışır. Kurallar gizli kalır.",
  "sub.copyTextOpen": "Yazarın tam sürümü hesabınızda 7/24 çalışır.",
  "sub.cloneTitle": "Kuralları klonla",
  "sub.cloneText": "Kurallar stratejilerinizden biri olur: kendiniz test edin, değiştirin ve dağıtın.",
  "sub.multiplierHint": "Stratejinin emir büyüklüklerini hesabınızda ölçekler.",
  "sub.price": "Fiyat",
  "sub.dueNow": "Şimdi ödenecek",
  "sub.wallet": "Cüzdan (kullanılabilir)",
  "sub.renewal": "Yenileme",
  "sub.noCharge": "Ücretsiz, hiçbir ücret alınmaz",
  "sub.shortTitle": "Yetersiz USDT",
  "sub.shortBody": "Cüzdanınızda en az {amount} USDT kullanılabilir olmalıdır.",
  "sub.deposit": "Para yatır",
  "sub.liveBody": "Strateji bu hesapta gerçek parayla gerçek emirler verir ve para kaybedebilir.",
  "sub.ackPay": "Kalks cüzdanımdan şimdi ve iptal edene kadar her 30 günde bir {price} USDT tahsil edilsin.",
  "sub.doneTitle": "Abone olundu", // (display)
  // {title} = strategy, {account} = "Demo 50000083"
  "sub.doneCopy": "“{title}”, {account} hesabında çalışıyor.",
  "sub.doneClone": "“{title}” artık stratejilerinizden biri.",
  "sub.charged": "Cüzdanınızdan {amount} USDT tahsil edildi.",
  // the answer to a subscribe request was lost (connection, timeout): the app re-reads the listing before a retry
  "sub.noAnswer": "Yanıt alamadık. Abonelik gerçekleşmiş olabilir.",
  "sub.checkingTitle": "Aboneliğiniz kontrol ediliyor",
  "sub.checkingBody": "Yanıt yolda kayboldu. Tekrar denemenize izin vermeden önce sunucuyla kontrol ediyoruz; böylece asla iki kez ücret alınmaz.",
  "sub.noAnswerRetry": "Hâlâ yanıt yok ve hesabınızda yeni bir abonelik de yok. Tekrar deneyebilirsiniz.",
  "sub.notThrough": "Gerçekleşmedi ve üzerinizde hiçbir ücret kalmadı (alınan ücret cüzdanınıza iade edilir). Tekrar deneyebilirsiniz.",
  "sub.unfinished": "Sunucuda hâlâ kuruluyor. Tekrar denemeden önce Pazar yeri › Abonelikler bölümünü ve cüzdan geçmişinizi kontrol edin veya destekle iletişime geçin.",
  "sub.free": "Ücretsiz abonelik: hiçbir ücret alınmadı.",
  "sub.copyOn": "{login} hesabında kopya",
  "sub.cloned": "klonlandı",
  "sub.renews": "yenileme {date}",
  "sub.ends": "bitiş {date}",
  "sub.status.active": "Aktif",
  "sub.status.cancelled": "İptal edildi",
  "sub.status.expired": "Süresi doldu",
  "sub.status.past_due": "Ödeme gecikti",

  "review.title": "Puan verin", // (display)
  "review.rating": "Puanınız",
  "review.stars": { one: "{count} yıldız", other: "{count} yıldız" },
  "review.comment": "Yorum (isteğe bağlı)",
  "review.placeholder": "Sizin için nasıl işlem yaptı?",
  "review.post": "Değerlendirme gönder",
  "review.saved": "Değerlendirme kaydedildi",
  "review.rate": "Puan ver",
  "review.edit": "Değerlendirmeyi düzenle",
  "review.you": "Siz",

  /* ---------------------------------------------------------------- */
  /* API keys and webhooks                                             */
  /* ---------------------------------------------------------------- */
  "keys.eyebrow": "Geliştiriciler",
  "keys.title": "API", // (display)
  "keys.subtitle": "Kendi işlem programlarınız için anahtarlar ve uyarılar için webhook URL'leri (TradingView ve diğerleri).",
  "keys.requests24h": "İstekler · son 24 sa",
  "keys.errors": "Hatalar",
  // requests refused by the rate limit
  "keys.limited": "Sınırlanan",
  "keys.p50": "Medyan",
  "keys.writes": "Emirler",
  "keys.keys": "API anahtarları", // (display)
  "keys.keysSub": "{n} aktif · en fazla 20",
  "keys.none": "API anahtarı yok. Web'deki Müşteri Alanı'nda bir tane oluşturun.",
  "keys.status.active": "Aktif",
  "keys.status.revoked": "İptal edildi",
  "keys.status.expired": "Süresi doldu",
  "keys.scope.read": "Okuma",
  "keys.scope.trade": "İşlem",
  // {ips} = list of IP addresses
  "keys.ips": "Yalnızca şu IP'lerden: {ips}",
  "keys.anyIp": "Herhangi bir IP adresinden",
  "keys.expires": "Son geçerlilik {date}",
  "keys.noExpiry": "Süresi dolmaz",
  "keys.lastUsed": "son kullanım: {ago}",
  "keys.revoke": "İptal et",
  "keys.revokeTitle": "Anahtar iptal edilsin mi?", // (display)
  "keys.revokeBody": "“{name}” ({id}), onu kullanan tüm programlar için anında çalışmayı durdurur. Bu işlem geri alınamaz.",
  "keys.revoked": "“{name}” iptal edildi",
  "keys.webTitle": "Web'de oluşturun",
  "keys.webBody": "Yeni anahtarlar ve webhook'lar Müşteri Alanı'nda oluşturulur: bir anahtarın gizli değeri ve bir webhook'un URL'si orada yalnızca bir kez gösterilir, böylece bunları işlem araçlarınıza kopyalayabilirsiniz.",
  "keys.openWeb": "Müşteri Alanı'nı aç",
  "keys.killHint": "Her şeyi durdurmanız mı gerekiyor? Algo ekranındaki acil durdurma tüm stratejileri durdurur ve webhook ile API emirlerini engeller.",

  "hooks.title": "Webhook'lar", // (display)
  "hooks.sub": "{n} / en fazla 20",
  "hooks.none": "Webhook yok. Web'deki Müşteri Alanı'nda bir tane oluşturun.",
  // {hint} = the URL's last characters
  "hooks.hint": "URL …{hint}",
  "hooks.accounts": { one: "{count} hesap", other: "{count} hesap" },
  "hooks.today": { zero: "bugün uyarı yok", one: "bugün {count} uyarı", other: "bugün {count} uyarı" },
  "hooks.used": "son kullanım: {ago}",
  "hooks.on": "Açık",
  "hooks.off": "Kapalı",
  "hooks.switch": "“{name}” webhook'u açık",
  "hooks.passphrase": "Parola gerekli",
  "hooks.noPassphrase": "Parola yok",
  "hooks.delete": "Sil",
  "hooks.deleteTitle": "Bu webhook silinsin mi?", // (display)
  "hooks.deleteBody": "“{name}” ve gizli URL'si anında çalışmayı durdurur; ona gönderilen uyarılar reddedilir. Bu işlem geri alınamaz.",
  "hooks.deleted": "“{name}” silindi",
  "hooks.alerts": "Son uyarılar", // (display)
  "hooks.alertsSub": "Her uyarı, tüm hesapların sonuçlarıyla",
  // Alert statuses (server values)
  "hooks.status.accepted": "Kabul edildi",
  "hooks.status.partial": "Kısmen tamamlandı",
  "hooks.status.failed": "Başarısız",
  "hooks.status.received": "Alındı",
  "hooks.status.rejected": "Reddedildi",
  "hooks.status.blocked": "Engellendi (acil durdurma)",
  // Each account's result of an alert (server values)
  "hooks.result.filled": "gerçekleşti",
  "hooks.result.pending": "emir verildi",
  "hooks.result.closed": "kapatıldı",
  "hooks.result.nothing_to_close": "kapatılacak bir şey yok",
  "hooks.result.rejected": "reddedildi",
};
export default mobileAlgo;
