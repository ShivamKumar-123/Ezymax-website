import type { NsMessages } from "../../core";

// Kalks mobile app (apps/mobile), Reports: Statements (/reports/statements) and Analytics (/reports/analytics).
// Most labels reuse the Client Area's portfolio.st.* / portfolio.an.* keys; only mobile-specific text is here.
const mobileReports: NsMessages<"mobileReports"> = {
  eyebrow: "Raporlar",
  "eyebrow.analytics": "Raporlar · USD · sunucu saati",

  // Account picker (a card that opens a sheet)
  "account.title": "Hesap",
  "account.choose": "Bir hesap seçin",
  "account.allHint": { one: "{count} gerçek hesap", other: "{count} gerçek hesap" },
  "account.change": "Hesabı değiştir",

  // Statements
  "st.day": "Gün",
  "st.pickDay": "Bir gün seçin",
  "st.pickFrom": "Başlangıç tarihi",
  "st.pickTo": "Bitiş tarihi",
  "st.include": "Dahil et",
  "st.summary": "#{login} · {period} · {format}",
  "st.preparing": "Hazırlanıyor…",
  "st.ready": "Ekstre hazır",
  "st.saved": "{file} olarak kaydedildi",
  "st.shareTitle": "Ekstreyi paylaş",
  "st.failed": "Ekstre indirilemedi",
  "st.offline": "Çevrimdışısınız. Ekstreleri indirmek için bağlanın.",
  "st.monthly.empty": "Henüz aylık ekstre yok.",
  "st.monthly.offline": "Çevrimdışısınız. Aylık ekstreleri görmek için bağlanın.",
  "st.monthly.a11y": "{month}: net {net}, {trades}. İndirmeleri açar.",
  "st.month.title": "{month} ekstresi",
  "st.month.formats": "İndirme biçimi",
  "st.prevMonth": "Önceki ay",
  "st.nextMonth": "Sonraki ay",

  // Analytics: hero and stat tiles
  "an.hero.label": "Net K/Z · {period}",
  "an.hero.return": "Getiri",
  "an.hero.trades": "İşlemler",
  "an.hero.lots": "Lot",
  "an.tile.sharpe": "Sharpe oranı",
  "an.tile.expectancy": "Beklenen değer",
  "an.tile.sortino": "Sortino {value}",
  "an.tile.avgWinLoss": "Ort. kazanç / kayıp",
  "an.tile.rr": "Kazanç : risk 1 : {value}",
  "an.tile.holdSplit": "Kazananlar {win} · kaybedenler {loss}",
  "an.tile.streaks": "Seriler",
  "an.tile.streaksSub": "Art arda kazanç / kayıp",
  "an.tile.trade": "{side} {volume} · #{ticket}",
  "an.tile.none": "Henüz işlem yok",

  // Analytics: curves
  "an.curve.hint": "Her günü görmek için grafiğe dokunup basılı tutun",
  "an.curve.drawdown": "Düşüş",
  "an.curve.a11y": "{date}: varlık {equity}, bakiye {balance}. Maksimum düşüş {drawdown}.",

  // Analytics: P&L calendar (net of closed trades per server day)
  "an.cal.title": "K/Z takvimi",
  "an.cal.subtitle": "Sunucu gününe göre kapalı işlemlerin net sonucu",
  "an.cal.subtitleEstimated": "Günlük bakiye değişimi, yatırımlar ve çekimler hariç",
  "an.cal.days": { one: "{count} işlem günü", other: "{count} işlem günü" },
  "an.cal.green": "{count} yeşil",
  "an.cal.red": "{count} kırmızı",
  "an.cal.noTrades": "Kapalı işlem yok",
  "an.cal.select": "Sonucunu görmek için bir güne dokunun",
  "an.cal.a11yDay": "{date}: {net}, {trades}",

  // Analytics: breakdowns
  "an.hour.byHour": "Saate göre net K/Z",
  "an.hour.byDayHour": "Hafta günü × saat",
  "an.hour.tap": "Ayrıntılar için bir çubuğa veya hücreye dokunun",
  "an.tapBar": "Ayrıntılar için bir çubuğa dokunun",
  "an.session.best": "En iyi",
  "an.session.asia": "Asya",
  "an.session.london": "Londra",
  "an.session.overlap": "Londra / New York",
  "an.session.newYork": "New York",
  "an.session.lateNewYork": "Geç New York",
  "an.side.split": "{long} · {short}",
  "an.flow.equityNow": "Güncel varlık",
  "an.charges.total": "Ödenen masraflar",

  // Behaviour insights (the numbers come from the reports service)
  "insight.overtrading.title": { one: "{count} günde aşırı işlem", other: "{count} günde aşırı işlem" },
  "insight.overtrading.text": "Bu günlerde {limit} işlemden fazlasını açtınız (normal bir gününüzde {median} işlem). O günlerdeki net sonuç: {net}.",
  "insight.overtrading.tip": "Günlük {cap} işlemlik bir sınır koyun.",
  "insight.revenge.title": { one: "{count} olası intikam işlemi", other: "{count} olası intikam işlemi" },
  "insight.revenge.text": "Zararla kapanan bir işlemden sonraki 15 dakika içinde, aynı veya daha büyük hacimle açılan işlemler. Bunların %{rate} kadarı kazandı; toplam sonuç {net}.",
  "insight.revenge.tip": "Bir zarardan sonra yeni işleme geçmeden önce 15 dakika ara verin.",
  "insight.risk.title": "Zararlı işlem başına risk",
  "insight.risk.text": {
    one: "Zararlı bir işlem ortalama bakiyenizin %{avg} kadarına, en fazla %{max} kadarına mal oldu. {count} zarar %2'yi aştı.",
    other: "Zararlı bir işlem ortalama bakiyenizin %{avg} kadarına, en fazla %{max} kadarına mal oldu. {count} zarar %2'yi aştı.",
  },
  "insight.risk.tip": "Pozisyon büyüklüğünü, bir zarar durdur bakiyenin en fazla %1–2'sine mal olacak şekilde ayarlayın.",
  "insight.holdLosers.title": "Zararlı işlemler kârlılardan uzun tutuluyor",
  "insight.holdLosers.text": "Zararlı işlemler ortalama {loss}, kârlı işlemler {win} açık kalıyor.",
  "insight.holdLosers.tip": "İşlemi açarken bir zarar durdur koyun ve yerinde bırakın.",
  "insight.stopOut.title": { one: "{count} stop out kapanışı", other: "{count} stop out kapanışı" },
  "insight.stopOut.text": "Pozisyonlar kendi zarar durdurunuzla değil, stop out ile kapandı.",
  "insight.stopOut.tip": "Daha küçük pozisyonlarla teminat seviyesini margin call seviyesinin üzerinde tutun.",
  "insight.slTp.title": "Zarar durdur veya kâr al ile kapanan işlemler",
  "insight.slTp.text": "{tp} işlem kâr al, {sl} işlem zarar durdur ile; kalanlar elle veya dealing desk tarafından kapandı.",
  "insight.slTp.tip": "Planlı çıkışlar sonuçları istikrarlı tutar.",
  "insight.session.title": "En iyi seans: {session}",
  "insight.session.text": "%{rate} kazanma oranıyla {trades} işlem. En zayıf: {worst} ({net}).",
  "insight.session.tip": "{session} seansına odaklanın.",
  "insight.tip": "İpucu",

  // States
  "state.updating": "Güncelleniyor…",
  "state.stale": "Kayıtlı veriler gösteriliyor. Yenilemek için aşağı çekin.",
  "state.notShared.title": "Sizinle paylaşılmadı",
  "state.footer": "Tüm tutarlar USD cinsindendir (cent hesaplar dönüştürülür). Saatler sunucu saatidir, GMT+2 / GMT+3.",
  "state.footerStatements": "Ekstreler hesabın para birimindedir (cent hesaplarda USC). Saatler sunucu saatidir, GMT+2 / GMT+3.",
};
export default mobileReports;
