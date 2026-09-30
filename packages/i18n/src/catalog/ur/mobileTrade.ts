import type { NsMessages } from "../../core";

// Kalks mobile app: Trade tab (chart, Sell / Buy bar, order ticket) and trade notifications.
// Trading terms follow the `order` namespace. {placeholders} hold numbers, prices, tickets and symbols.
const mobileTrade: NsMessages<"mobileTrade"> = {
  // Header
  pickSymbol: "سمبل منتخب کریں",
  searchSymbol: "سمبلز تلاش کریں",
  depth: "مارکیٹ کی گہرائی",
  alert: "قیمت کا الرٹ",
  news: "{symbol} کی خبریں",
  calendar: "{currency} اکنامک کیلنڈر",
  "account.chip": "{type} · #{login}",
  "account.manage": "اکاؤنٹس کا انتظام",
  "account.open": "اکاؤنٹ کھولیں",

  // Chart
  "chart.indicators": "انڈیکیٹرز",
  "chart.type.candles": "کینڈلز",
  "chart.type.line": "لائن",
  "ind.ma": "موونگ ایوریج 20",
  "ind.ema": "ایکسپونینشل MA 50",
  "ind.bb": "Bollinger بینڈز 20، 2",
  "ind.rsi": "RSI 14",
  "chart.noData": "اس سمبل کی ابھی کوئی چارٹ ہسٹری نہیں",
  "chart.hint": "زوم کے لیے پنچ کریں · اسکرول کے لیے ڈریگ کریں · کراس ہیئر کے لیے دبا کر رکھیں · ری سیٹ کے لیے ڈبل ٹیپ کریں",

  // Sell / Buy bar and ticket
  "bar.volume": "لاٹ",
  "ticket.title": "نیا آرڈر",
  "ticket.confirmBuy": "{volume} {symbol} خریدیں",
  "ticket.confirmSell": "{volume} {symbol} فروخت کریں",
  "ticket.atMarket": "مارکیٹ قیمت پر",
  "ticket.at": "{price} پر",
  "ticket.addSl": "اسٹاپ لاس لگائیں",
  "ticket.addTp": "ٹیک پرافٹ لگائیں",
  "ticket.ifHit": "ہٹ ہونے پر {money}",
  "ticket.required": "مارجن",
  "ticket.pip": "پِپ ویلیو",
  "ticket.after": "بعد میں فری",
  "ticket.notEnough": "اس والیوم کے لیے فری مارجن ناکافی ہے۔",
  "ticket.noSpecs": "کنٹریکٹ کی تفصیلات لوڈ ہو رہی ہیں…",
  "ticket.distance": "{n} پِپس دور",
  "ticket.price": "قیمت",

  // Rejections: a plain-language line under the reason (order.reject.<code>)
  "reject.no_money": "آپ کا فری مارجن اس آرڈر کے لیے کافی نہیں۔ والیوم کم کریں یا اس اکاؤنٹ میں فنڈز جمع کریں۔",
  "reject.insufficient_funds": "آپ کا فری مارجن اس آرڈر کے لیے کافی نہیں۔ والیوم کم کریں یا اس اکاؤنٹ میں فنڈز جمع کریں۔",
  "reject.market_closed": "یہ مارکیٹ اس وقت بند ہے۔ کھلنے پر دوبارہ کوشش کریں۔",
  "reject.invalid_volume": "اس سمبل کی حدود اور لاٹ اسٹیپ کے اندر والیوم استعمال کریں۔",
  "reject.max_lot": "یہ والیوم آپ کے اکاؤنٹ کی فی آرڈر زیادہ سے زیادہ حد سے اوپر ہے۔",
  "reject.close_only": "آپ کا اکاؤنٹ اس وقت پوزیشنز بند کر سکتا ہے لیکن نئی نہیں کھول سکتا۔",
  "reject.symbol_close_only": "اس سمبل پر اس وقت پوزیشنز بند کی جا سکتی ہیں لیکن کھولی نہیں جا سکتیں۔",
  "reject.trading_disabled": "اس اکاؤنٹ پر ٹریڈنگ بند ہے۔ تفصیلات کے لیے سپورٹ سے رابطہ کریں۔",
  "reject.symbol_halted": "اس سمبل پر ٹریڈنگ روک دی گئی ہے۔ بعد میں دوبارہ کوشش کریں۔",
  "reject.requote.title": "قیمت بدل گئی",
  "reject.requote": "آپ کا آرڈر پہنچنے کے دوران مارکیٹ بدل گئی۔ نئی قیمت دیکھیں اور دوبارہ تصدیق کریں۔",
  "reject.invalid_sl": "اسٹاپ لاس قیمت کی غلط جانب ہے، یا اس کے بہت قریب ہے۔",
  "reject.invalid_tp": "ٹیک پرافٹ قیمت کی غلط جانب ہے، یا اس کے بہت قریب ہے۔",
  "reject.invalid_price": "اس قسم کے آرڈر کے لیے یہ قیمت مارکیٹ کی غلط جانب ہے۔",
  "reject.off_market": "یہ قیمت مارکیٹ سے بہت دور ہے۔ قدر چیک کریں۔",
  "reject.stale_price": "اس سمبل کی قیمتیں لمحے بھر کے لیے رکی ہوئی ہیں۔ تھوڑی دیر بعد دوبارہ کوشش کریں۔",
  "reject.no_price": "اس وقت اس سمبل کی کوئی لائیو قیمت نہیں۔",
  "reject.read_only": "یہ لاگ اِن اکاؤنٹ دیکھ سکتا ہے لیکن ٹریڈ نہیں کر سکتا۔",
  "reject.uncertain.title": "ٹریڈ سرور سے کوئی جواب نہیں",
  "reject.uncertain": "ہو سکتا ہے آرڈر لگ گیا ہو۔ دوبارہ کوشش سے پہلے پورٹ فولیو چیک کریں۔",
  "reject.uncertain.ticket": "دوبارہ تصدیق کرنا محفوظ ہے: ایک ہی آرڈر دو بار نہیں لگ سکتا۔",

  // States
  "state.noAccount.title": "ابھی کوئی ٹریڈنگ اکاؤنٹ نہیں",
  "state.noAccount.body": "مشق کے لیے ڈیمو اکاؤنٹ کھولیں، یا حقیقی ٹریڈنگ کے لیے لائیو اکاؤنٹ۔",
  "state.noAccount.action": "اکاؤنٹ کھولیں",
  "state.connecting": "ٹریڈ سرور سے رابطہ ہو رہا ہے…",
  "state.readOnly": "یہ اکاؤنٹ یہاں صرف دیکھنے کے لیے ہے: قیمتیں اور چارٹس لائیو ہیں، ٹریڈنگ بند ہے۔",
  "state.marketClosed.title": "مارکیٹ بند",
  "state.marketClosed.body": "{symbol} اگلے سیشن کے ساتھ دوبارہ کھلے گا۔ کھلنے کے بعد آرڈرز لگائے جا سکتے ہیں۔",
  "state.streamError": "ٹریڈ سرور تک رسائی نہیں ہو رہی",
  "state.streamErrorBody": "آپ کی پوزیشنز اور آرڈرز سرور پر محفوظ ہیں۔ ہم دوبارہ رابطے کی کوشش جاری رکھے ہوئے ہیں۔",

  // Results
  "toast.filled": "{side} {volume} {symbol} فِل ہو گیا",
  "toast.at": "{price} پر",
  "toast.placed": "{symbol} پینڈنگ آرڈر لگا دیا گیا",
  "toast.duplicate": "پہلے ہی #{ticket} کے طور پر لگ چکا ہے",
  "toast.duplicateBody": "یہ آرڈر پہلے ہی سرور تک پہنچ چکا تھا؛ کچھ نیا نہیں کھولا گیا۔",
  "toast.closed": "پوزیشن #{ticket} بند ہو گئی",
  "toast.partial": "#{ticket} کے {volume} لاٹ بند ہو گئے",
  "toast.modified": "#{ticket} اپ ڈیٹ ہو گیا",
  "toast.cancelled": "آرڈر #{ticket} منسوخ ہو گیا",

  // Engine notifications while the app is open
  "notify.sl": "اسٹاپ لاس ہٹ",
  "notify.tp": "ٹیک پرافٹ ہٹ",
  "notify.order_filled": "پینڈنگ آرڈر فِل ہو گیا",
  "notify.order_triggered": "آرڈر ٹرگر ہو گیا",
  "notify.margin_call": "مارجن کال",
  "notify.stop_out": "اسٹاپ آؤٹ",
  "notify.order_rejected": "آرڈر مسترد",
  "notify.order_expired": "آرڈر کی میعاد ختم",
  "notify.order_cancelled": "آرڈر منسوخ",
};
export default mobileTrade;
