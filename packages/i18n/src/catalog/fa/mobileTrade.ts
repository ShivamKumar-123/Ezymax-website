import type { NsMessages } from "../../core";

// Kalks mobile app: Trade tab (chart, Sell / Buy bar, order ticket) and trade notifications.
// Trading terms follow the MT5 Persian localisation and the `order` namespace.
const mobileTrade: NsMessages<"mobileTrade"> = {
  // Header
  pickSymbol: "انتخاب نماد",
  searchSymbol: "جستجوی نمادها",
  depth: "عمق بازار",
  alert: "هشدار قیمت",
  news: "اخبار {symbol}",
  calendar: "تقویم اقتصادی {currency}",
  "account.chip": "{type} · #{login}",
  "account.manage": "مدیریت حساب‌ها",
  "account.open": "افتتاح حساب",

  // Chart
  "chart.indicators": "اندیکاتورها",
  "chart.type.candles": "شمعی",
  "chart.type.line": "خطی",
  "ind.ma": "میانگین متحرک 20",
  "ind.ema": "میانگین متحرک نمایی 50",
  "ind.bb": "باندهای بولینگر 20، 2",
  "ind.rsi": "RSI 14",
  "chart.noData": "هنوز تاریخچه نموداری برای این نماد وجود ندارد",
  "chart.hint": "برای بزرگ‌نمایی دو انگشت را باز کنید · برای پیمایش بکشید · برای خط‌کش متقاطع لمس کنید و نگه دارید · برای بازنشانی دو بار ضربه بزنید",

  // Sell / Buy bar and ticket
  "bar.volume": "لات",
  "ticket.title": "سفارش جدید",
  "ticket.confirmBuy": "خرید {volume} {symbol}",
  "ticket.confirmSell": "فروش {volume} {symbol}",
  "ticket.atMarket": "به قیمت بازار",
  "ticket.at": "در {price}",
  "ticket.addSl": "افزودن حد ضرر",
  "ticket.addTp": "افزودن حد سود",
  "ticket.ifHit": "{money} در صورت فعال شدن",
  "ticket.required": "مارجین",
  "ticket.pip": "ارزش پیپ",
  "ticket.after": "آزاد پس از سفارش",
  "ticket.notEnough": "مارجین آزاد برای این حجم کافی نیست.",
  "ticket.noSpecs": "در حال بارگذاری مشخصات قرارداد…",
  "ticket.distance": "{n} پیپ فاصله",
  "ticket.price": "قیمت",

  // Rejections: a plain-language line under the reason
  "reject.no_money": "مارجین آزاد شما برای این سفارش کافی نیست. حجم را کاهش دهید یا به این حساب وجه واریز کنید.",
  "reject.insufficient_funds": "مارجین آزاد شما برای این سفارش کافی نیست. حجم را کاهش دهید یا به این حساب وجه واریز کنید.",
  "reject.market_closed": "این بازار در حال حاضر بسته است. پس از باز شدن دوباره تلاش کنید.",
  "reject.invalid_volume": "حجمی در محدوده مجاز و گام لات این نماد وارد کنید.",
  "reject.max_lot": "این حجم بیشتر از حداکثر مجاز هر سفارش برای حساب شماست.",
  "reject.close_only": "در حال حاضر فقط می‌توانید پوزیشن‌ها را ببندید و امکان باز کردن پوزیشن جدید ندارید.",
  "reject.symbol_close_only": "در حال حاضر این نماد فقط قابل بستن است، نه باز کردن.",
  "reject.trading_disabled": "معامله در این حساب غیرفعال است. برای جزئیات با پشتیبانی تماس بگیرید.",
  "reject.symbol_halted": "معامله روی این نماد متوقف شده است. بعداً دوباره تلاش کنید.",
  "reject.requote.title": "قیمت تغییر کرد",
  "reject.requote": "بازار در حین ارسال سفارش شما حرکت کرد. قیمت جدید را بررسی و دوباره تأیید کنید.",
  "reject.invalid_sl": "حد ضرر در سمت اشتباه قیمت یا بیش از حد نزدیک به آن است.",
  "reject.invalid_tp": "حد سود در سمت اشتباه قیمت یا بیش از حد نزدیک به آن است.",
  "reject.invalid_price": "این قیمت برای این نوع سفارش در سمت اشتباه بازار است.",
  "reject.off_market": "این قیمت بیش از حد از بازار فاصله دارد. مقدار را بررسی کنید.",
  "reject.stale_price": "قیمت‌های این نماد لحظه‌ای متوقف شده‌اند. کمی بعد دوباره تلاش کنید.",
  "reject.no_price": "در حال حاضر قیمت زنده‌ای برای این نماد وجود ندارد.",
  "reject.read_only": "با این ورود می‌توانید حساب را ببینید، اما امکان معامله ندارید.",
  "reject.uncertain.title": "پاسخی از سرور معاملاتی دریافت نشد",
  "reject.uncertain": "ممکن است انجام شده باشد. پیش از تلاش دوباره، پورتفولیو را بررسی کنید.",
  "reject.uncertain.ticket": "تأیید دوباره بی‌خطر است: یک سفارش دو بار ثبت نمی‌شود.",

  // States
  "state.noAccount.title": "هنوز حساب معاملاتی ندارید",
  "state.noAccount.body": "برای تمرین یک حساب دمو یا برای معامله واقعی یک حساب واقعی باز کنید.",
  "state.noAccount.action": "افتتاح حساب",
  "state.connecting": "در حال اتصال به سرور معاملاتی…",
  "state.readOnly": "این حساب اینجا فقط‌خواندنی است: قیمت‌ها و نمودارها زنده‌اند، اما معامله غیرفعال است.",
  "state.marketClosed.title": "بازار بسته است",
  "state.marketClosed.body": "{symbol} با جلسه بعدی دوباره باز می‌شود. پس از باز شدن می‌توانید سفارش ثبت کنید.",
  "state.streamError": "اتصال به سرور معاملاتی برقرار نیست",
  "state.streamErrorBody": "پوزیشن‌ها و سفارش‌های شما روی سرور امن هستند. در حال تلاش برای اتصال مجدد هستیم.",

  // Results
  "toast.filled": "{side} {volume} {symbol} اجرا شد",
  "toast.at": "در {price}",
  "toast.placed": "سفارش معلق {symbol} ثبت شد",
  "toast.duplicate": "قبلاً با شماره #{ticket} ثبت شده است",
  "toast.duplicateBody": "این سفارش قبلاً به سرور رسیده بود؛ پوزیشن جدیدی باز نشد.",
  "toast.closed": "پوزیشن #{ticket} بسته شد",
  "toast.partial": "{volume} لات از #{ticket} بسته شد",
  "toast.modified": "#{ticket} به‌روز شد",
  "toast.cancelled": "سفارش #{ticket} لغو شد",

  // Engine notifications while the app is open
  "notify.sl": "حد ضرر فعال شد",
  "notify.tp": "حد سود فعال شد",
  "notify.order_filled": "سفارش معلق اجرا شد",
  "notify.order_triggered": "سفارش فعال شد",
  "notify.margin_call": "مارجین کال",
  "notify.stop_out": "استاپ‌اوت",
  "notify.order_rejected": "سفارش رد شد",
  "notify.order_expired": "سفارش منقضی شد",
  "notify.order_cancelled": "سفارش لغو شد",
};
export default mobileTrade;
