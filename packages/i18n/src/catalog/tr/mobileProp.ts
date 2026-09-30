import type { NsMessages } from "../../core";

// Kalks mobile app: Prop (challenge catalogue and checkout, live rule dashboard, payouts, certificates).
// "Kalks", "Kalks Prop", "Kalks Trader", "Kalks-Live", "USDT", "New York" and "17:00" stay as they are.
// Titles shown in tall uppercase display type are marked "display": keep them short.
const mobileProp: NsMessages<"mobileProp"> = {
  // Prop home
  "home.eyebrow": "Kalks Prop",
  "home.title": "Fonlanın", // display
  "home.subtitle": "Bir challenge'ı geçin, fonlanmış bir hesap alın ve kârın %{split} kadarına varan kısmını kazanın. Tüm prop hesapları simüledir.",
  "home.subtitleNoSplit": "Bir challenge'ı geçin, fonlanmış bir hesap alın ve kârdan pay kazanın. Tüm prop hesapları simüledir.",
  "home.payouts": "Ödemeler",
  "home.payoutsReady": "{amount} hazır",
  "home.payoutsNone": "Henüz hazır değil",
  "home.certificates": "Sertifikalar",
  "home.certCount": { one: "{count} kazanıldı", other: "{count} kazanıldı" },
  "home.mine": "Challenge'larınız",
  "home.past": "Geçmiş challenge'lar",
  "home.showAll": "Tümünü göster ({count})",
  "home.yourCertificates": "Sertifikalarınız",
  "home.plans": "Challenge'ınızı seçin",
  "home.newChallenge": "Yeni challenge başlat",
  "home.emptyTitle": "Sunulan challenge yok", // display
  "home.emptyBody": "Yeni challenge planları hazırlanıyor. Lütfen kısa süre sonra tekrar kontrol edin.",
  "home.mineError": "Challenge'larınız yüklenemedi.",
  "home.plansError": "Challenge planları yüklenemedi.",

  // How it works (numbered 01–04 on the Prop home)
  "how.title": "Nasıl çalışır",
  "how.1.title": "Plan seçin",
  "how.1.body": "Modeli ve hesap büyüklüğünü seçin. Ücret, USDT cüzdanınızdan bir kez alınır.",
  "how.2.title": "Hedefe ulaşın",
  "how.2.body": "Günlük zarar ve düşüş limitleri içinde kalarak, minimum işlem günü boyunca kâr hedefine ulaşın.",
  "how.3.title": "Fonlanın",
  "how.3.body": "Geçtiğinizde fonlanmış hesabınız, paylaşabileceğiniz bir sertifikayla otomatik olarak açılır.",
  "how.4.title": "Ödeme alın",
  "how.4.body": "Her ödeme döneminde kâr payınızı USDT cüzdanınıza talep edin.",
  "how.enforce": "Limitler sunucuda her saniye, varlık üzerinden kontrol edilir. Günlük zarar limitinin %50, %75 ve %90'ında uyarılırsınız; bir ihlal tüm pozisyonları kapatır ve challenge'ı sonlandırır.",

  // Plan models
  "type.oneStep": "1 Aşamalı",
  "type.twoStep": "2 Aşamalı",
  "type.instant": "Anında",
  "typeText.oneStep": "Tek değerlendirme aşaması. Hedefe ulaşın, limitlere uyun, fonlanın.",
  "typeText.twoStep": "Daha düşük hedefler ve daha geniş limitlerle iki değerlendirme aşaması.",
  "typeText.instant": "Değerlendirme yok. Daha sıkı limitlerle hemen fonlanmış bir hesapta başlayın.",

  // Plan card
  "plan.refundable": "Ücret iade edilir",
  "plan.fee": "Ücret",
  "plan.account": "Hesap",
  "plan.leverage": "Kaldıraç 1:{n}",
  "plan.target": "Hedef",
  "plan.dailyLoss": "Günlük zarar",
  "plan.maxDD": "Maks. düşüş",
  "plan.static": "sabit",
  "plan.trailing": "takip eden",
  "plan.start": "Başla · {fee}",

  // Checkout
  "checkout.eyebrow": "Ödeme",
  "checkout.fee": "Tek seferlik ücret",
  "checkout.chargedRefund": "USDT cüzdanınızdan ödenir. İlk ödemenizle iade edilir.",
  "checkout.chargedNoRefund": "USDT cüzdanınızdan ödenir. İade edilmez.",
  "checkout.walletBalance": "Cüzdan bakiyesi: {balance} USDT",
  "checkout.shortTitle": "Cüzdanınız ücret için yetersiz",
  "checkout.short": "Cüzdanınızda {balance} USDT var. Bu challenge'ı ödemek için {missing} USDT daha yatırın.",
  "checkout.rules": "Kurallar",
  "checkout.limitsNote": "Limitler başlangıç bakiyesinin yüzdesidir. Günlük zarar veya maks. düşüş limitinin ihlali hesabı başarısız kılar ve tüm pozisyonları piyasa fiyatından kapatır. İşlem günü New York saatiyle 17:00'de sıfırlanır.",
  "checkout.agree": "Kuralları okudum; hesabın simüle olduğunu ve bir zarar limiti ihlal edildiğinde otomatik olarak başarısız olacağını anlıyorum.",
  "checkout.pay": "{fee} öde",
  "checkout.retry": "Tekrar dene · {fee}",
  "checkout.paying": "Ödeniyor…",
  "checkout.goToMine": "Challenge'larımı gör",
  "checkout.readyTitle": "Challenge başladı", // display
  "checkout.readyBody": "{fee} USDT cüzdanınızdan ödendi ve {size} {phase} hesabınız açıldı. Kurallar şu andan itibaren geçerli.",
  "checkout.savePasswords": "Bu şifreleri şimdi kaydedin: yalnızca bir kez gösterilir ve biz saklamayız. Bu hesapta şifre olmadan da her zaman uygulamadan işlem yapabilirsiniz.",
  "checkout.passwordsShown": "İşlem şifreleri, bu satın alma ilk onaylandığında gösterildi. Bu hesapta şifre olmadan da uygulamadan işlem yapabilirsiniz.",
  "checkout.viewChallenge": "Challenge'ı görüntüle",
  "checkout.readOnly": "Bu oturumla challenge satın alınamaz.",

  // Account credentials
  "cred.login": "Giriş",
  "cred.server": "Sunucu",
  "cred.password": "İşlem şifresi",
  "cred.investorPassword": "Yatırımcı şifresi (salt okunur)",
  "cred.show": "Şifreyi göster",
  "cred.hide": "Şifreyi gizle",
  "copied": "{what} kopyalandı",
  "a11y.copy": "Kopyala: {what}",

  // Challenge statuses
  "status.pendingPayment": "Ödeme bekleniyor",
  "status.provisioning": "Hesap açılıyor",
  "status.active": "Etkin",
  "status.funded": "Fonlandı",
  "status.failed": "Başarısız",
  "status.closed": "Kapalı",
  "status.paymentFailed": "Ödeme başarısız",
  // {phase} is the phase name from the plan, e.g. "Phase 2"
  "stage.active": "{phase} · Etkin",
  "stage.failed": "{phase} · Başarısız",
  "phaseStatus.provisioning": "Açılıyor",
  "phaseStatus.active": "Aktif",
  "phaseStatus.passed": "Geçildi",
  "phaseStatus.failed": "Başarısız",
  "phaseStatus.closed": "Kapalı",

  // Challenge cards (Prop home)
  "card.target": "Kâr hedefi",
  "card.profit": "Kâr",
  "card.equity": "Varlık {amount}",
  "card.dailyLeft": "Kalan günlük zarar {amount}",
  "card.opening": "İşlem hesabınız açılıyor. Bu birkaç saniye sürer.",

  // Dashboard
  "dash.equity": "Varlık",
  "dash.balance": "Bakiye",
  "dash.floating": "Değişken",
  "dash.open": "Açık",
  "dash.sinceStart": "aşama başladığından beri",
  "dash.rules": "Kurallar",
  "dash.rulesTitle": "Bu challenge'ın kuralları",
  "dash.notFound": "Challenge bulunamadı", // display
  "dash.notFoundBody": "Başka bir girişle açılmış olabilir.",
  "dash.backToProp": "Prop'a dön",
  "live.live": "Canlı",
  "live.connecting": "Bağlanıyor…",
  "live.offline": "Çevrimdışı",
  // {time}: date and time of the last rule check
  "live.updated": "Kontrol: {time}",
  // {time}: when the phase ended
  "live.final": "Son durum · {time}",

  // Rule names (gauges, the rule log)
  "rule.dailyLoss": "Günlük zarar",
  "rule.maxDrawdown": "Maks. düşüş",
  "rule.profitTarget": "Kâr hedefi",
  "rule.tradingDays": "İşlem günleri",
  "rule.timeLimit": "Süre sınırı",
  "rule.weekendHolding": "Hafta sonu pozisyon tutma",
  "rule.newsWindow": "Haber aralığı",
  "rule.bannedStrategy": "Yasaklı strateji",
  "rule.consistency": "Tutarlılık",
  "rule.riskDesk": "Risk masası kararı",
  "ruleState.ok": "Devam ediyor",
  "ruleState.passed": "Karşılandı",
  "ruleState.failed": "İhlal edildi",
  "ruleState.off": "Kapalı",

  // Gauges
  "target.ofTarget": "tamamlandı",
  "target.of": "Hedef {amount} (%{pct})",
  "target.left": "{amount} kaldı",
  "target.reachedBy": "Ulaşıldı, {amount} fazlası",
  "limit.left": "{amount} kaldı",
  "limit.breachAt": "İhlal seviyesi {amount}",
  "days": { one: "{count} gün", other: "{count} gün" },
  "days.of": "{v} / {min}",
  "days.count": { one: "{count} gün", other: "{count} gün" },
  "days.met": "Minimum karşılandı",
  "days.toGo": { one: "{count} gün daha", other: "{count} gün daha" },
  "days.noMinimum": "Minimum yok",
  "time.left": "{d} g {h} sa kaldı",
  "time.deadline": "Bitiş: {date}",
  "consistency.rule": "En iyi gün ≤ kârın %{pct} kadarı",
  "consistency.noProfit": "Henüz kâr yok",
  "reset.title": "Günlük zarar sıfırlanmasına",
  "reset.note": "New York saatiyle 17:00, her işlem günü",

  // Funded account: payout window ring
  "payoutHero.title": "Sonraki ödeme",
  "payoutHero.share": "Şu ana kadarki payınız",
  "payoutHero.open": "Açık", // display
  "payoutHero.ready": "Hazır", // display
  "payoutHero.days": { one: "{count} gün", other: "{count} gün" }, // display
  "payoutHero.eligible": "%{split} payınızla şimdi uygun.",
  "payoutHero.opens": "Ödeme dönemi {date} tarihinde açılır.",
  "payoutHero.later": "Uygun kârınız olduğunda ödeme talep edin.",

  // Big states
  "hero.opening.title": "Hesabınız açılıyor", // display
  "hero.opening.body": "Ödeme onaylandı ve işlem hesabınız hazırlanıyor. Bu sayfa kendiliğinden güncellenir.",
  "hero.closed.title": "Challenge kapandı", // display
  "hero.closed.body": "Bu challenge'ın işlem hesabı açılamadı; bu yüzden challenge kapatıldı ve ücret USDT cüzdanınıza iade edildi. Sorularınız varsa destekle iletişime geçin.",
  // {reason} is the prop service's reason, in English
  "hero.closed.reason": "{reason}. Ücret USDT cüzdanınıza iade edildi.",
  "hero.failed.title": "{phase} başarısız", // display
  "hero.failed.on": "Bitiş: {date}",
  // {reason} is the breach reason from the risk engine
  "hero.failed.body": "{reason}. Tüm pozisyonlar kapatıldı ve hesap devre dışı bırakıldı.",
  "hero.failed.ruleBreached": "Bir kural ihlal edildi",
  // {rule} is a rule name, e.g. "Günlük zarar"
  "hero.failed.rule": "{rule}: limit ihlal edildi",
  "hero.failed.new": "Yeni challenge başlat",
  "hero.passed.title": "{phase} geçildi", // display
  "hero.passed.on": "Geçiş tarihi: {date}.",
  "hero.passed.next": "{phase} hesabınız açıldı.",
  "hero.passed.nextLogin": "{phase} hesabınız açıldı (#{login}).",
  "hero.passed.opening": "Sonraki hesabınız açılıyor.",
  "hero.passed.certificate": "Sertifikayı görüntüle",
  "hero.passed.goNext": "{phase} ile devam et",
  "hero.funded.title": "Fonlandınız", // display
  "hero.funded.body": "Fonlanmış hesapta işlem yapın ve kârın %{split} kadarını ödeme olarak alın.",
  "hero.funded.certificate": "Fonlanma sertifikanızı görüntüleyin",

  // Warnings while trading
  "warn.lossUsed": "Bugünkü zarar limitinin %{pct} kadarı kullanıldı",
  "warn.lossUsedBody": "Varlığın {floor} veya altına inmesi hesabı başarısız kılar ve tüm pozisyonları kapatır. Bugün kalan: {left}.",
  "warn.weekend": "Hafta sonu kapanışı",
  "warn.weekendBody": "Bu plan hafta sonu pozisyon tutmaya izin vermez: açık pozisyonlar Cuma 16:45'te (New York) kapatılır.",

  // Actions
  "action.openTrade": "İşlem sekmesinde aç",
  "action.trade": "İşlem yap",
  "action.tradeBlocked": "Yalnızca etkin bir challenge'ın aktif hesabında işlem yapılabilir.",
  "action.payouts": "Ödemeler",
  "action.support": "Destekle iletişime geç",

  // Equity chart
  "chart.title": "Varlık eğrisi",
  "chart.start": "Başlangıç",
  "chart.target": "Hedef",
  "chart.ddFloor": "Maks. düşüş",
  "chart.dailyFloor": "Günlük zarar",
  "chart.now": "Şimdi",
  "chart.empty": "Eğri, işlemin ilk dakikalarından sonra görünür.",

  // Trading stats
  "stats.title": "İşlem istatistikleri",
  "stats.trades": "İşlemler",
  "stats.winRate": "Kazanma oranı",
  "stats.profitFactor": "Kâr faktörü",
  "stats.avgWin": "Ort. kazanç",
  "stats.avgLoss": "Ort. kayıp",
  "stats.lots": "Lot",
  "stats.bestDay": "En iyi gün {date}: {amount}",

  // Rule log
  "events.title": "Kural kaydı",
  "events.empty": "Uyarı veya ihlal yok. Böyle devam edin.",
  "events.equity": "varlık {amount}",
  "events.limit": "limit {amount}",
  "severity.breach": "İhlal",
  "severity.violation": "Kural dışı",
  "severity.warning": "Uyarı",
  "severity.info": "Bilgi",

  // Closed trades
  "trades.title": "Kapalı işlemler",
  "trades.all": "Tümü ({count})",
  "trades.count": { one: "{count} kapalı işlem", other: "{count} kapalı işlem" },
  "trades.empty": "Henüz kapalı işlem yok.",
  "trades.buy": "Alış",
  "trades.sell": "Satış",
  // compact durations: sn = seconds, dk = minutes, sa = hours, g = days
  "duration.s": "{s} sn",
  "duration.ms": "{m} dk {s} sn",
  "duration.hm": "{h} sa {m} dk",
  "duration.dh": "{d} g {h} sa",

  // Account details
  "account.title": "Hesap",
  "account.split": "Payınız",
  "account.initial": "Başlangıç bakiyesi",
  "account.started": "Aşama başlangıcı",
  "account.ended": "Bitiş",
  "account.deadline": "Son tarih",
  "account.passwordNote": "İşlem şifreleri satın alma sırasında bir kez gösterildi. İşlem sekmesinde aç, şifre olmadan bu hesaba giriş yapmanızı sağlar.",

  // Payouts
  "payouts.title": "Ödemeler", // display
  "payouts.available": "Şu an kullanılabilir",
  "payouts.eligibleCount": {
    one: "{count} fonlanmış hesaptan {eligible} tanesi uygun",
    other: "{count} fonlanmış hesaptan {eligible} tanesi uygun",
  },
  "payouts.requests": { one: "{count} talep", other: "{count} talep" },
  "payouts.count": { one: "{count} ödeme", other: "{count} ödeme" },
  "payouts.paidToDate": "Bugüne kadar ödenen",
  "payouts.funded": "Fonlanmış hesaplar",
  "payouts.account": "{size} fonlanmış", // display
  "payouts.quote": "Ödeme hesaplaması",
  "payouts.eligibleNow": "Şimdi uygun",
  "payouts.notYet": "Henüz değil",
  "payouts.toWallet": "cüzdanınıza",
  "payouts.yourSplit": "Payınız",
  "payouts.firmShare": "Şirket payı",
  "payouts.alreadyRefunded": "Zaten iade edildi",
  "payouts.withFirst": "İlk ödemeyle",
  "payouts.opens": "{date} tarihinde açılır.",
  "payouts.minimum": "Minimum {amount}.",
  "payouts.kycNote": "Bu ödemeyi talep etmek için kimliğinizi doğrulayın.",
  "payouts.kycPendingNote": "Kimlik doğrulamanız onaylandığında bu ödemeyi talep edebilirsiniz.",
  "payouts.readOnly": "Bu oturumla ödeme talep edilemez.",
  "payouts.request": "Ödeme talep et",
  // opens the account's live rule dashboard (the web calls it "Kural paneli"); short: it shares a row with Trade
  "payouts.dashboard": "Kurallar",
  "payouts.history": "Geçmiş",
  "payouts.historyEmpty": "Henüz ödeme yok.",
  "payouts.emptyTitle": "Henüz fonlanmış hesap yok", // display
  "payouts.emptyBody": "Fonlanmış bir hesap almak için bir challenge'ı geçin. Uygun kâr oluştuğunda ödemeleri buradan talep edin.",
  "payouts.emptyAction": "Fonlanın",
  "payoutStatus.pending": "İnceleniyor",
  "payoutStatus.approved": "Onaylandı",
  "payoutStatus.paid": "Ödendi",
  "payoutStatus.rejected": "Reddedildi",
  "payoutStatus.failed": "Başarısız",
  "split.title": "Kâr paylaşımı ve büyütme",
  "split.upTo": "Büyütmeyle %{pct} seviyesine kadar",
  "split.cycle": "Ödemeler",
  // {days} e.g. "14 gün"
  "split.first": "İlki {days} sonra",
  "split.firstNow": "İlk günden itibaren",
  // {months} e.g. "4 ay"; {cap} e.g. "2.000.000 $"
  "scaling.text": "{months} içinde %{profit} kâr edin, hesabınız {cap} tutarına kadar %{increase} büyüsün.",
  "scaling.none": "Bu plan hesabı büyütmez.",
  "months": { one: "{count} ay", other: "{count} ay" },

  // Payout request sheet
  "request.eyebrow": "Ödeme talebi",
  "request.profit": "Hesaptaki kâr",
  "request.share": "Payınız (%{pct})",
  "request.feeRefund": "Challenge ücreti iadesi",
  "request.total": "Cüzdanınıza toplam",
  "request.note": "Mevcut kârın tamamı şimdi işlem hesabından düşülür; böylece inceleme sırasında işlemle kaybedilemez. Onaylandığında payınız USDT cüzdanınıza yatırılır; talep reddedilirse kâr hesaba geri eklenir.",
  "request.submit": "{amount} talep et",
  "request.done": "Ödeme talep edildi",
  "request.doneBody": "{amount}, onaylandığında USDT cüzdanınıza aktarılır.",

  // Identity verification (payouts)
  "kyc.verified": "Kimlik doğrulandı: ödemeler onaylanabilir.",
  "kyc.pendingTitle": "Doğrulama inceleniyor",
  "kyc.pendingText": "Doğrulamanız inceleniyor. Kimliğiniz doğrulandığında ödeme talep edebilirsiniz.",
  "kyc.requiredTitle": "Kimliğinizi doğrulayın",
  "kyc.requiredText": "Ödemeler yalnızca kimliği doğrulanmış trader'lara yapılır. İlk ödemenizden önce doğrulayın.",
  "kyc.rejectedText": "Doğrulamanız reddedildi. Ödeme almak için tekrar gönderin.",

  // Why a payout can't be requested yet
  "blocker.notYetEligible": "Ödeme dönemi henüz açılmadı.",
  "blocker.belowMinimum": "Kâr, minimum ödemenin altında.",
  "blocker.positionsOpen": "Ödeme talep etmek için tüm açık pozisyonları kapatın.",
  "blocker.payoutPending": "Bir ödeme zaten inceleniyor.",
  "blocker.consistency": "Tutarlılık kuralı karşılanmadı: en iyi gününüz kârın çok büyük bir bölümünü oluşturuyor.",

  // Certificates
  "certs.title": "Sertifikalar", // display
  "certs.subtitle": "Geçtiğiniz her aşama, her fonlanmış hesap ve her ödeme için herkesin doğrulayabileceği bir sertifika kazanırsınız.",
  "certs.kind.pass": "Aşama geçildi",
  "certs.kind.funded": "Fonlanmış trader",
  "certs.kind.payout": "Ödeme",
  "certs.revoked": "İptal edildi",
  "certs.revokedBody": "Bu sertifika Kalks tarafından iptal edildi ve artık geçerli değil, bu yüzden paylaşılamaz.",
  "certs.meta": "{plan} · {size} · {date}",
  "certs.number": "No. {code}",
  "certs.shareImage": "Görseli paylaş",
  "certs.shareLink": "Bağlantıyı paylaş",
  "certs.copyLink": "Bağlantıyı kopyala",
  "certs.linkCopied": "Doğrulama bağlantısı kopyalandı",
  "certs.shareTitle": "Kalks Prop sertifikam",
  "certs.shareMessage": "Kalks Prop sertifikam. Buradan doğrulayın:",
  "certs.shareFailed": "Sertifika paylaşılamadı. Lütfen tekrar deneyin.",
  "certs.shareUnavailable": "Bu cihazda paylaşım kullanılamıyor.",
  "certs.emptyTitle": "Henüz sertifika yok", // display
  "certs.emptyBody": "İlk sertifikanızı kazanmak için bir challenge aşamasını geçin; herkesin doğrulayabileceği herkese açık bir bağlantıyla birlikte gelir.",
  "certs.emptyAction": "Challenge'lara göz at",

  // Rule words shared by the checkout and the rules sheet
  "accountSize": "Hesap büyüklüğü",
  "profitSplit": "Kâr paylaşımı",
  "feeRefund": "Ücret iadesi",
  "nonRefundable": "İade edilmez",
  "leverage": "Kaldıraç",
  "none": "Yok",
  "allowed": "İzin verilir",
  "notAllowed": "İzin verilmez",
  "noTimeLimit": "Süre sınırı yok",
  // {phase} is the phase name, e.g. "Phase 1"
  "rules.phaseTarget": "{phase} hedefi",
  "rules.phaseMinDays": "{phase} minimum gün",
  "rules.phaseTimeLimit": "{phase} süre sınırı",
  "rules.evaluation": "Değerlendirme",
  "rules.evaluationNone": "Yok, ilk günden fonlanmış",
  "rules.dailyLoss": "Günlük zarar limiti",
  "rules.dailyLossBalance": "%{pct} · {amount} · New York saatiyle 17:00'deki bakiyeden",
  "rules.dailyLossEquity": "%{pct} · {amount} · New York saatiyle 17:00'deki bakiye ve varlıktan yüksek olandan",
  "rules.ddStatic": "%{pct} sabit",
  "rules.ddTrailing": "%{pct} takip eden",
  "rules.ddLocks": "{dd}, başlangıç seviyesinde sabitlenir",
  // ≤ = at most
  "rules.consistencyValue": "En iyi gün ≤ toplam kârın %{pct} kadarı",
  "rules.news": "Haber işlemi",
  "rules.newsBlocked": "Yüksek etkili haberlerin ±{min} dk öncesi/sonrası yasak",
  "rules.newsBlockedFails": "Yüksek etkili haberlerin ±{min} dk öncesi/sonrası yasak (hesap başarısız olur)",
  "rules.weekendClosed": "Pozisyonlar Cuma 16:45'te (New York) kapatılır",
  "rules.ea": "Expert Advisor'lar",
  "rules.banned": "Yasaklı stratejiler",
  "rules.splitScaling": "%{split}, %{max} seviyesine kadar artar",
  "rules.firstPayout": "İlk ödeme",
  // {freq} is a lower-case payout cycle, e.g. "haftalık"
  "rules.firstPayoutValue": "{days} sonra, ardından {freq} · min. {min}",
  "rules.refunded": "İlk ödemeyle iade edilir",

  // Banned trading strategies
  "banned.hft": "Yüksek frekanslı işlem",
  "banned.latencyArbitrage": "Gecikme arbitrajı",
  "banned.tickScalping": "Tick scalping",
  "banned.crossAccountCopying": "Hesaplar arası kopyalama",
  "banned.crossAccountHedging": "Hesaplar arası hedge",
  "banned.martingale": "Martingale",
  "banned.grid": "Grid işlem",

  // Payout cycle, lower case: used inside sentences ("ardından haftalık")
  "payoutFreq.weekly": "haftalık",
  "payoutFreq.biWeekly": "2 haftada bir",
  "payoutFreq.monthly": "aylık",
  "payoutFreq.onDemand": "talep üzerine",

  // Errors (messages for the prop service's error codes)
  "errorLink.deposit": "Para yatır",
  "errorLink.verify": "Kimliği doğrula",
  "error.insufficientFunds": "USDT cüzdan bakiyeniz bu ücret için yetersiz. USDT yatırıp tekrar deneyin.",
  "error.kycRequired": "Ödeme talep etmeden önce kimliğinizi doğrulayın.",
  "error.paymentPending": "Cüzdan ödemesini henüz onaylayamadık. Bir dakika sonra tekrar deneyin: iki kez ücret alınmaz.",
  "error.paymentFailed": "Cüzdan ödemesi gerçekleşmedi. Sizden ücret alınmadı.",
  "error.walletPending": "Cüzdan henüz onay vermedi. Lütfen bir dakika sonra tekrar deneyin.",
  "error.walletRejected": "Cüzdan bu ödemeyi reddetti. Lütfen destekle iletişime geçin.",
  "error.provisioning": "Ödeme alındı. İşlem hesabınız hâlâ açılıyor: bir dakika içinde challenge'larınız arasında görünür.",
  "error.planUnavailable": "Bu plan veya büyüklük artık kullanılamıyor. Lütfen başka birini seçin.",
  "error.notYetEligible": "Bu hesap henüz ödeme için uygun değil.",
  "error.belowMinimum": "Kâr, minimum ödeme tutarının altında.",
  "error.positionsOpen": "Ödeme talep etmeden önce tüm açık pozisyonları kapatın.",
  "error.payoutPending": "Bu hesap için bir ödeme zaten inceleniyor.",
  "error.consistency": "Tutarlılık kuralı henüz karşılanmadı: en iyi gününüz kârın çok büyük bir bölümünü oluşturuyor.",
  "error.notFunded": "Ödemeler yalnızca fonlanmış hesaplarda kullanılabilir.",
  "error.accountUnavailable": "Bu challenge'ın işlem hesabını açamadık, bu yüzden ücret USDT cüzdanınıza iade edildi. Bu tekrarlanırsa destekle iletişime geçin.",
  "error.idempotencyConflict": "Bu ödeme işlemi zaten farklı bir satın alma için kullanıldı. Kapatıp yeniden başlayın.",
  "error.notActive": "Bu challenge etkin değil.",
  "error.accountLimit": "Maksimum prop hesap sayısına ulaştınız. Limiti artırmak için destekle iletişime geçin.",
  "error.staffReadOnly": "Bu, salt okunur bir personel oturumu. Değişiklik yapılamaz.",
  "error.engine": "İşlem sunucusu yanıt vermedi. Lütfen kısa süre sonra tekrar deneyin.",
  "error.generic": "Bir sorun oluştu. Lütfen tekrar deneyin.",
  "load.title": "Prop kullanılamıyor", // display
  "load.body": "Prop hizmetine ulaşamadık. Hesaplarınız güvende; lütfen biraz sonra tekrar deneyin.",
};
export default mobileProp;
