import type { NsMessages } from "../../core";

// Kalks mobile app: Trade tab (chart, Sell / Buy bar, order ticket) and trade notifications.
// Trading terms follow the MT5 Turkish wording of the `order` namespace (Zarar durdur, Kâr al, Teminat).
const mobileTrade: NsMessages<"mobileTrade"> = {
  // Header
  pickSymbol: "Sembol seçin",
  searchSymbol: "Sembol ara",
  depth: "Piyasa derinliği",
  alert: "Fiyat uyarısı",
  news: "{symbol} haberleri", // a header button's accessibility label
  calendar: "{currency} ekonomik takvimi", // a header button's accessibility label, e.g. "EUR ekonomik takvimi"
  "account.chip": "{type} · #{login}",
  "account.manage": "Hesapları yönet",
  "account.open": "Hesap aç",

  // Chart
  "chart.indicators": "Göstergeler",
  "chart.type.candles": "Mum",
  "chart.type.line": "Çizgi",
  "ind.ma": "Hareketli ortalama 20",
  "ind.ema": "Üstel hareketli ort. 50",
  "ind.bb": "Bollinger Bantları 20, 2",
  "ind.rsi": "RSI 14",
  "chart.noData": "Bu sembol için henüz grafik geçmişi yok",
  "chart.hint": "İki parmakla yakınlaştırın · kaydırmak için sürükleyin · artı imleci için basılı tutun · sıfırlamak için çift dokunun",

  // Sell / Buy bar and ticket
  "bar.volume": "Lot",
  "ticket.title": "Yeni emir",
  "ticket.confirmBuy": "Al {volume} {symbol}",
  "ticket.confirmSell": "Sat {volume} {symbol}",
  "ticket.atMarket": "piyasa fiyatından",
  "ticket.at": "{price} fiyatından",
  "ticket.addSl": "Zarar durdur ekle",
  "ticket.addTp": "Kâr al ekle",
  "ticket.ifHit": "Tetiklenirse {money}",
  "ticket.required": "Teminat",
  "ticket.pip": "Pip değeri",
  "ticket.after": "Kalan serbest",
  "ticket.notEnough": "Bu hacim için serbest teminat yetersiz.",
  "ticket.noSpecs": "Kontrat bilgileri yükleniyor…",
  "ticket.distance": "{n} pip uzakta",
  "ticket.price": "Fiyat",

  // Rejections: a plain-language line under the reason (order.reject.<code>); the engine's own detail follows it
  "reject.no_money": "Serbest teminatınız bu emri karşılamıyor. Hacmi düşürün veya bu hesaba para yatırın.",
  "reject.insufficient_funds": "Serbest teminatınız bu emri karşılamıyor. Hacmi düşürün veya bu hesaba para yatırın.",
  "reject.market_closed": "Bu piyasa şu anda kapalı. Açıldığında tekrar deneyin.",
  "reject.invalid_volume": "Bu sembolün limitleri ve lot adımı içinde bir hacim girin.",
  "reject.max_lot": "Bu hacim, hesabınız için emir başına izin verilen maksimumu aşıyor.",
  "reject.close_only": "Hesabınız şu anda pozisyon kapatabilir ancak yeni pozisyon açamaz.",
  "reject.symbol_close_only": "Bu sembolde şu anda pozisyon kapatılabilir ancak açılamaz.",
  "reject.trading_disabled": "Bu hesapta işlem kapalı. Ayrıntılar için destekle iletişime geçin.",
  "reject.symbol_halted": "Bu sembolde işlem durduruldu. Daha sonra tekrar deneyin.",
  "reject.requote.title": "Fiyat değişti",
  "reject.requote": "Emriniz iletilirken piyasa hareket etti. Yeni fiyatı kontrol edip tekrar onaylayın.",
  "reject.invalid_sl": "Zarar durdur seviyesi fiyatın yanlış tarafında veya fiyata çok yakın.",
  "reject.invalid_tp": "Kâr al seviyesi fiyatın yanlış tarafında veya fiyata çok yakın.",
  "reject.invalid_price": "Bu fiyat, bu emir türü için piyasanın yanlış tarafında.",
  "reject.off_market": "Bu fiyat piyasadan çok uzak. Değeri kontrol edin.",
  "reject.stale_price": "Bu sembolün fiyatları kısa süreliğine duraklatıldı. Birazdan tekrar deneyin.",
  "reject.no_price": "Bu sembol için şu anda canlı fiyat yok.",
  "reject.read_only": "Bu giriş hesabı görüntüleyebilir ancak işlem yapamaz.",
  "reject.uncertain.title": "İşlem sunucusundan yanıt yok",
  "reject.uncertain": "Emir iletilmiş olabilir. Tekrar denemeden önce Portföy'ü kontrol edin.",
  "reject.uncertain.ticket": "Tekrar onaylamak güvenlidir: aynı emir iki kez verilemez.",

  // States
  "state.noAccount.title": "Henüz işlem hesabı yok",
  "state.noAccount.body": "Pratik için bir demo hesap, gerçek parayla işlem için bir gerçek hesap açın.",
  "state.noAccount.action": "Hesap aç",
  "state.connecting": "İşlem sunucusuna bağlanılıyor…",
  "state.readOnly": "Bu hesap burada yalnızca görüntülenebilir: fiyatlar ve grafikler canlı, işlem kapalı.",
  "state.marketClosed.title": "Piyasa kapalı",
  "state.marketClosed.body": "{symbol} bir sonraki seansta yeniden açılır. Açıldığında emir verebilirsiniz.",
  "state.streamError": "İşlem sunucusuna ulaşılamıyor",
  "state.streamErrorBody": "Pozisyonlarınız ve emirleriniz sunucuda güvende. Yeniden bağlanmayı denemeye devam ediyoruz.",

  // Results
  "toast.filled": "{side} {volume} {symbol} emri gerçekleşti",
  "toast.at": "{price} fiyatından",
  "toast.placed": "{symbol} bekleyen emri verildi",
  "toast.duplicate": "Zaten #{ticket} olarak verildi",
  "toast.duplicateBody": "Bu emir sunucuya daha önce ulaşmıştı; yeni bir işlem açılmadı.",
  "toast.closed": "#{ticket} pozisyonu kapatıldı",
  "toast.partial": "#{ticket} pozisyonunun {volume} lotu kapatıldı",
  "toast.modified": "#{ticket} güncellendi",
  "toast.cancelled": "#{ticket} emri iptal edildi",

  // Engine notifications while the app is open
  "notify.sl": "Zarar durdur tetiklendi",
  "notify.tp": "Kâr al tetiklendi",
  "notify.order_filled": "Bekleyen emir gerçekleşti",
  "notify.order_triggered": "Emir tetiklendi",
  "notify.margin_call": "Margin call",
  "notify.stop_out": "Stop out",
  "notify.order_rejected": "Emir reddedildi",
  "notify.order_expired": "Emrin süresi doldu",
  "notify.order_cancelled": "Emir iptal edildi",
};
export default mobileTrade;
