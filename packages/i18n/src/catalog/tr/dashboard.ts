import type { NsMessages } from "../../core";

const dashboard: NsMessages<"dashboard"> = {
  // Page header
  "greeting.morning": "Günaydın, {name}",
  "greeting.afternoon": "İyi günler, {name}",
  "greeting.evening": "İyi akşamlar, {name}",
  "greeting.welcome": "Hoş geldiniz, {name}",
  "subtitle.live": "Kalks'a hoş geldiniz. Hesabınız ve bugünün piyasaları burada.",
  "subtitle.demo": "Hesaplarınızın bugünkü performansı burada.",
  launchTrader: "Kalks Trader'ı başlat",
  openTerminal: "İşlem terminalini aç",

  // Getting started checklist
  "steps.title": "Başlarken",
  "steps.subtitle": "Gerçek işleme doğru ilerlemeniz",
  "steps.progress": "{done}/{total}",
  "steps.account.title": "Hesabınızı oluşturun",
  "steps.account.text": "Kayıt tarihi: {date}.",
  "steps.email.title": "E-postanızı doğrulayın",
  "steps.email.verified": "{email} doğrulandı.",
  "steps.email.confirm": "Size gönderdiğimiz kodla {email} adresini onaylayın.",
  "steps.kyc.title": "Kimliğinizi doğrulayın",
  "steps.kyc.verified": "Kimliğiniz doğrulandı. Para çekme işlemleri açıldı.",
  "steps.kyc.moreInfo": "Ekibimizin sizden bir belge daha alması gerekiyor.",
  "steps.kyc.review": "Belgeleriniz doğrulama ekibimizde inceleniyor.",
  "steps.kyc.draft": "Kaldığınız yerden devam edin. Yaklaşık 3 dakika sürer.",
  "steps.kyc.rejected": "Belgelerinizi doğrulayamadık. Yeniden başlayabilirsiniz.",
  "steps.kyc.todo": "Yaklaşık 3 dakika sürer. Para çekme işlemlerini açar.",
  "steps.accountOpen.title": "İşlem hesabı açın",
  "steps.accountOpen.opened": { other: "{live} gerçek ve {demo} demo hesap açık." },
  "steps.accountOpen.todo": "Gerçek veya demo hesap açın; giriş bilgileriniz anında oluşturulur.",
  "steps.wallet.title": "Cüzdanınıza para yatırın",
  "steps.wallet.text": "TRC20 üzerinden USDT yatırma işlemleri bağlanıyor.",
  // Step status chips
  "steps.state.done": "Tamamlandı",
  "steps.state.todo": "Yapılacak",
  "steps.state.review": "İncelemede",
  "steps.state.rejected": "Reddedildi",
  "steps.state.soon": "Başlanmadı",

  // Trading accounts card
  "accounts.title": "İşlem hesapları",
  "accounts.summary": "Gerçek varlık <b>{equity}</b> · {live} gerçek · {demo} demo · {positions} açık pozisyon",
  "accounts.subtitle": "Gerçek ve demo hesaplarınız",
  "accounts.all": "Tüm hesaplar",
  "accounts.open": "Hesap aç",
  "accounts.unavailable": "İşlem hesapları şu anda kullanılamıyor. Bakiyeleriniz güvende.",
  "accounts.openLive.title": "Gerçek hesap açın",
  "accounts.openLive.text": "Gerçek piyasalar. Sıfır bakiyeyle başlar; cüzdanınızdan para yatırın.",
  "accounts.openDemo.title": "Demo hesap açın",
  "accounts.openDemo.text": "Gerçek zamanlı fiyatlarla sanal fonlar, her gün yenilenebilir.",
  "accounts.more": { other: "{count} hesap daha" },
  "accounts.myTitle": "İşlem hesaplarım",

  // Your account card
  "account.title": "Hesabınız",
  "account.clientId": "Müşteri ID",
  "account.emailStatus": "E-posta durumu",
  "account.notVerified": "Doğrulanmadı",
  "account.identity": "Kimlik",
  "account.memberSince": "Üyelik tarihi",
  "account.profile": "Profil",

  // Kalks Trader banner
  "trader.chip": "Canlı fiyatlar",
  "trader.text": "Forex, metaller, endeksler, enerji, kripto ve hisse senetlerinde {count} enstrüman için gerçek zamanlı kotasyonlar ve grafikler. Tarayıcınızda çalışır, kurulum gerekmez.",

  // Market clock / heatmap
  "sessions.title": "Piyasa saati",
  "sessions.open": "{total} piyasadan {open} tanesi açık",
  "heatmap.title": "Piyasa ısı haritası",
  "heatmap.subtitle": "Canlı fiyatlarla bugünkü hareket · içi boş nokta: piyasa kapalı",
  "heatmap.up": "{count} yükselen",
  "heatmap.down": "{count} düşen",
  "heatmap.allMarkets": "Tüm piyasalar",
  "heatmap.tipOpen": "{symbol} · piyasa açık",
  "heatmap.tipClosed": "{symbol} · piyasa kapalı, son seansın hareketi",

  // Support card
  "support.title": "Yardıma mı ihtiyacınız var?",
  "support.text": "Kayıtlı adresinizden <mail>{email}</mail> adresine yazın ve müşteri ID'nizi ekleyin.",
  "support.emailSupport": "Desteğe e-posta gönder",
  "support.copied": "E-posta adresi kopyalandı",
  "support.copyFailed": "Kopyalanamadı, lütfen adresi elle seçin",

  // Demo dashboard: onboarding strip
  "onboarding.title": "Hesap kurulumunuzu tamamlayın",
  "onboarding.text": "Para çekme ve daha yüksek limitler için KYC'yi tamamlayın.",
  "onboarding.progress": "İlerleme",
  "onboarding.dismiss": "Kapat",

  // Margin health
  "margin.title": "Teminat durumu",
  "margin.subtitle": "Tüm gerçek hesaplarda",
  "margin.healthy": "Sağlıklı",
  "margin.level": "Teminat seviyesi",
  "margin.used": "Kullanılan teminat",
  "margin.free": "Serbest teminat",

  // Equity / P&L
  "equity.title": "Toplam varlık",
  "equity.changeOver": "{range} değişim",
  "pnl.title": "Kâr / zarar · ay",
  "pnl.lowRisk": "Düşük risk",
  "pnl.winRate": "Kazanma oranı (30g)",
  "pnl.trades": "İşlemler (30g)",
  "pnl.avgWin": "Ort. kazançlı işlem",
  "pnl.avgLoss": "Ort. zararlı işlem",
  "pnl.charges": "Ödenen ücretler",

  // KPI cards
  "kpi.wallet": "Cüzdan",
  "kpi.today": "Bugün +{pct}%",
  "kpi.monthPnl": "Aylık K/Z",
  "kpi.vsLastMonth": "Geçen aya göre +{pct}%",
  "kpi.partnerEarnings": "Ortaklık kazançları",
  "kpi.copy": "Copy {amount}",

  // Top movers
  "movers.title": "En çok hareket edenler",
  "movers.gainers": "Yükselenler",
  "movers.losers": "Düşenler",

  // Economic calendar. G = Gerçekleşen, B = Beklenti, Ö = Önceki
  "calendar.title": "Ekonomik takvim",
  "calendar.subtitle": "Bugün · sunucu saati GMT+3",
  "calendar.actual": "G {value} · ",
  "calendar.forecastPrevious": "B {forecast} · Ö {previous}",

  // News / world
  "news.title": "Piyasa haberleri",
  "news.all": "Tüm haberler",
  "news.pinned": "Sabitlendi",
  "world.title": "Dünyada piyasalar ve haberler",
  "world.subtitle": "Ülkelere göre canlı manşetler ve para birimi eğilimi",
  "world.stories": { other: "Bugün {count} haber" },

  // Open positions
  "positions.title": "Açık pozisyonlar",
  "positions.summary": { other: "{count} pozisyon · değişken" },
  "positions.terminal": "Terminal",

  // Partner banner
  "partner.chip": "Ortaklık programı",
  "partner.title": "Trader davet edin. Lot başına 15 $'a kadar, ömür boyu kazanın.",
  "partner.text": "Çok katmanlı komisyonlar, CPA bonusları ve gerçek zamanlı takip. Bağlantınız: <link>{url}</link>",
  "partner.open": "Ortaklık panelini aç",

  // Short relative times (dk = dakika, sa = saat, g = gün)
  "time.justNow": "Az önce",
  "time.minutesAgo": "{count} dk önce",
  "time.hoursAgo": "{count} sa önce",
  "time.daysAgo": "{count} g önce",
  "time.ago": "{time} önce",

  // Notifications bell / panel
  "notifications.title": "Bildirimler",
  "notifications.ariaUnread": "Bildirimler, {count} okunmamış",
  "notifications.markAll": "Tümünü okundu işaretle",
  "notifications.clear": "Temizle",
  "notifications.emptyTitle": "Henüz bildirim yok",
  "notifications.emptyText": "Para yatırma, çekme, doğrulama, işlem uyarıları ve destek yanıtları burada görünür.",
  "notifications.settings": "Bildirim ayarları",

  // Client Area redesign: side menu, dashboard overview
  "chrome.expand": "Menüyü genişlet",
  "chrome.collapse": "Menüyü daralt",
  "chrome.menu": "Menü",
  "home.todayPnl": "Bugünkü K/Z",
  "home.walletBalance": "Cüzdan bakiyesi",
  "home.rewardsEarnings": "Ödüller ve IB kazançları",
  "home.todayPct": "Bugün %{pct}",
  "home.floating": "Değişken K/Z",
  "home.rewards": "Ödüller",
  "home.accountsChip": "{live} gerçek · {positions} açık pozisyon",
  "home.statistics": "İstatistikler",
  "home.pnl": "K/Z",
  "home.weekly": "Haftalık",
  "home.monthly": "Aylık",
  "home.lastYear": "Geçen yıl",
  "home.noHistory": "Gerçek hesaplarınızda işlem oldukça varlık geçmişiniz burada görünür.",
  "home.thisPeriod": "Bu dönem",
  "home.previousPeriod": "Önceki dönem",
  "home.yourAccounts": "Hesaplarınız",
  "home.tradingAccount": "İşlem hesabı",
  "home.accountInfo": "Hesap bilgileri",
  "home.accountName": "Hesap adı",
  "home.leverage": "Kaldıraç",
  "home.previous": "Önceki hesap",
  "home.next": "Sonraki hesap",
  "home.showBalances": "Bakiyeleri göster",
  "home.hideBalances": "Bakiyeleri gizle",
  "home.trade": "İşlem yap",
  "home.history": "Geçmiş",
  "home.funding": "Fonlama",
  "home.linked": "Bağlı",
  "home.connected": "Bağlandı",
  "home.subscriptions": { other: "{count} aktif abonelik" },
  "home.points": "{points} puan",
  "home.redeem": "Kullan",
  "home.networkUnavailable": "Duraklatıldı",
  "home.totalBalance": "Toplam bakiye",
  "home.totalBalanceSub": "Gerçek hesaplar ve cüzdan",
  "home.transferFunds": "Para transferi",
  "home.quickActions": "Hızlı işlemler",
  "home.later": "Sonra",
  "home.viewDetails": "Ayrıntıları gör",
  "home.verifyNow": "Şimdi doğrula",
  "home.fundTitle": "Cüzdanınıza para yatırın",
  "home.fundText": "Gerçek hesapta işleme başlamak için USDT yatırın.",
  "home.depositNow": "Şimdi yatır",
  "home.tradingTitle": "İşlem",
  "home.marketsTitle": "Piyasalar",
  "home.moreTitle": "Size özel",
};
export default dashboard;
