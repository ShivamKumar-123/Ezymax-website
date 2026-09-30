import type { NsMessages } from "../../core";

// Kalks mobile app: Trade tab (chart, Sell / Buy bar, order ticket) and trade notifications.
// Trading terms follow the MetaTrader 5 wording of the `order` namespace.
// {placeholders} hold numbers, prices, tickets and symbols: keep them, never translate them.
const mobileTrade: NsMessages<"mobileTrade"> = {
  // Header
  pickSymbol: "اختر رمزًا",
  searchSymbol: "بحث عن رموز",
  depth: "عمق السوق",
  alert: "تنبيه سعري",
  news: "أخبار {symbol}", // a header button's accessibility label
  calendar: "التقويم الاقتصادي لـ {currency}", // a header button's accessibility label, e.g. "التقويم الاقتصادي لـ EUR"
  "account.chip": "{type} · #{login}",
  "account.manage": "إدارة الحسابات",
  "account.open": "فتح حساب",

  // Chart
  "chart.indicators": "المؤشرات",
  "chart.type.candles": "الشموع",
  "chart.type.line": "الخط",
  "ind.ma": "المتوسط المتحرك 20",
  "ind.ema": "المتوسط المتحرك الأسي 50",
  "ind.bb": "نطاقات بولينجر 20، 2",
  "ind.rsi": "RSI 14",
  "chart.noData": "لا يوجد سجل رسم بياني لهذا الرمز بعد",
  "chart.hint": "باعد بإصبعين للتكبير · اسحب للتمرير · اضغط مطولًا لإظهار التقاطع · اضغط مرتين لإعادة الضبط",

  // Sell / Buy bar and ticket
  "bar.volume": "اللوتات",
  "ticket.title": "أمر جديد",
  "ticket.confirmBuy": "شراء {volume} {symbol}",
  "ticket.confirmSell": "بيع {volume} {symbol}",
  "ticket.atMarket": "بسعر السوق",
  "ticket.at": "عند {price}",
  "ticket.addSl": "إضافة إيقاف الخسارة",
  "ticket.addTp": "إضافة جني الربح",
  "ticket.ifHit": "{money} عند التفعيل",
  "ticket.required": "الهامش",
  "ticket.pip": "قيمة النقطة",
  "ticket.after": "الهامش الحر بعده",
  "ticket.notEnough": "الهامش الحر غير كافٍ لهذا الحجم.",
  "ticket.noSpecs": "جارٍ تحميل مواصفات العقد…",
  "ticket.distance": "على بُعد {n} نقطة",
  "ticket.price": "السعر",

  // Rejections: a plain-language line under the reason (order.reject.<code>); the engine's own detail follows it
  "reject.no_money": "هامشك الحر لا يغطي هذا الأمر. خفّض الحجم أو أضف أموالًا إلى هذا الحساب.",
  "reject.insufficient_funds": "هامشك الحر لا يغطي هذا الأمر. خفّض الحجم أو أضف أموالًا إلى هذا الحساب.",
  "reject.market_closed": "هذا السوق مغلق حاليًا. حاول مرة أخرى عند افتتاحه.",
  "reject.invalid_volume": "استخدم حجمًا ضمن حدود هذا الرمز وخطوة اللوت.",
  "reject.max_lot": "هذا الحجم يتجاوز الحد الأقصى لكل أمر في حسابك.",
  "reject.close_only": "يمكن لحسابك إغلاق الصفقات، لكن لا يمكنه فتح صفقات جديدة حاليًا.",
  "reject.symbol_close_only": "يمكن إغلاق صفقات هذا الرمز، لكن لا يمكن فتحها حاليًا.",
  "reject.trading_disabled": "التداول متوقف على هذا الحساب. تواصل مع الدعم لمعرفة التفاصيل.",
  "reject.symbol_halted": "التداول على هذا الرمز متوقف مؤقتًا. حاول مرة أخرى لاحقًا.",
  "reject.requote.title": "تغيّر السعر",
  "reject.requote": "تحرّك السوق أثناء إرسال أمرك. تحقّق من السعر الجديد وأكّد مرة أخرى.",
  "reject.invalid_sl": "إيقاف الخسارة في الجانب الخاطئ من السعر، أو قريب منه جدًا.",
  "reject.invalid_tp": "جني الربح في الجانب الخاطئ من السعر، أو قريب منه جدًا.",
  "reject.invalid_price": "هذا السعر في الجانب الخاطئ من السوق لهذا النوع من الأوامر.",
  "reject.off_market": "هذا السعر بعيد جدًا عن السوق. تحقّق من القيمة.",
  "reject.stale_price": "أسعار هذا الرمز متوقفة للحظات. حاول مرة أخرى بعد قليل.",
  "reject.no_price": "لا يوجد سعر مباشر لهذا الرمز حاليًا.",
  "reject.read_only": "يمكن لتسجيل الدخول هذا عرض الحساب دون التداول.",
  "reject.uncertain.title": "لا استجابة من خادم التداول",
  "reject.uncertain": "ربما تم تنفيذه. تحقّق من «الصفقات» قبل المحاولة مرة أخرى.",
  "reject.uncertain.ticket": "التأكيد مرة أخرى آمن: لا يمكن وضع الأمر نفسه مرتين.",

  // States
  "state.noAccount.title": "لا يوجد حساب تداول بعد",
  "state.noAccount.body": "افتح حسابًا تجريبيًا للتدرّب، أو حسابًا حقيقيًا للتداول الفعلي.",
  "state.noAccount.action": "فتح حساب",
  "state.connecting": "جارٍ الاتصال بخادم التداول…",
  "state.readOnly": "هذا الحساب للعرض فقط هنا: الأسعار والرسوم البيانية مباشرة، والتداول متوقف.",
  "state.marketClosed.title": "السوق مغلق",
  "state.marketClosed.body": "يُفتح {symbol} مجددًا مع الجلسة التالية. يمكن وضع الأوامر بمجرد افتتاحه.",
  "state.streamError": "تعذّر الوصول إلى خادم التداول",
  "state.streamErrorBody": "صفقاتك وأوامرك في أمان على الخادم. نواصل محاولة إعادة الاتصال.",

  // Results
  "toast.filled": "تم تنفيذ {side} {volume} {symbol}",
  "toast.at": "عند {price}",
  "toast.placed": "تم وضع أمر معلّق على {symbol}",
  "toast.duplicate": "تم وضعه بالفعل برقم #{ticket}",
  "toast.duplicateBody": "وصل هذا الأمر إلى الخادم من قبل؛ ولم يُفتح أي شيء جديد.",
  "toast.closed": "تم إغلاق الصفقة #{ticket}",
  "toast.partial": "تم إغلاق {volume} لوت من #{ticket}",
  "toast.modified": "تم تحديث #{ticket}",
  "toast.cancelled": "تم إلغاء الأمر #{ticket}",

  // Engine notifications while the app is open
  "notify.sl": "تم الوصول إلى إيقاف الخسارة",
  "notify.tp": "تم الوصول إلى جني الربح",
  "notify.order_filled": "تم تنفيذ الأمر المعلّق",
  "notify.order_triggered": "تم تفعيل الأمر",
  "notify.margin_call": "نداء الهامش",
  "notify.stop_out": "الإيقاف الإجباري",
  "notify.order_rejected": "تم رفض الأمر",
  "notify.order_expired": "انتهت صلاحية الأمر",
  "notify.order_cancelled": "تم إلغاء الأمر",
};
export default mobileTrade;
