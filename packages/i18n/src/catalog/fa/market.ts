import type { NsMessages } from "../../core";

// Kalks Trader left panels: Market Watch (quotes list), segment chips and Navigator.
const market: NsMessages<"market"> = {
  // Market Watch header and tabs
  title: "دیده‌بان بازار",
  collapse: "جمع کردن",
  "tab.symbols": "نمادها",
  "tab.details": "جزئیات",
  "tab.favourites": "علاقه‌مندی‌ها",
  segmentAria: "بخش دیده‌بان بازار",
  searchPlaceholder: "جستجوی نماد",
  searchAria: "جستجو در دیده‌بان بازار",
  clear: "پاک کردن",

  // Market Watch columns (shown uppercase)
  "col.symbol": "نماد",
  "col.bid": "Bid",
  "col.ask": "Ask",
  "col.spread": "اسپرد",
  "col.spreadTitle": "اسپرد، پوینت",
  "col.change": "تغییر%",

  // Row / hover card
  "row.title": "{name} · اسپرد {spread}",
  "tip.low": "کف",
  "tip.high": "سقف",
  "tip.spread": "اسپرد",
  "tip.range": "دامنه",
  bid: "Bid",
  ask: "Ask",

  // Empty states and footer
  "empty.favourites": "هنوز علاقه‌مندی ندارید. برای افزودن روی یک نماد راست‌کلیک کنید.",
  "empty.favouritesTitle": "هنوز علاقه‌مندی ندارید",
  "empty.noMatch": "نمادی یافت نشد.",
  "footer.count": "{shown} / {total} نماد",
  "footer.hint": "دوبار کلیک: نمودار",

  // Context menu
  "menu.newOrder": "سفارش جدید",
  "menu.chartWindow": "پنجره نمودار",
  "menu.openInActive": "باز کردن در نمودار فعال",
  "menu.depth": "عمق بازار",
  "menu.specification": "مشخصات",
  "menu.removeFavourite": "حذف از علاقه‌مندی‌ها",
  "menu.addFavourite": "افزودن به علاقه‌مندی‌ها",
  "menu.hide": "پنهان کردن",
  "menu.showAll": "نمایش همه",

  // Toasts
  "toast.hidden": "{symbol} از دیده‌بان بازار پنهان شد",
  "toast.hiddenDesc": "همه نمادها را از منوی راست‌کلیک نمایش دهید.",
  "toast.opened": "{symbol} در نمودار فعال باز شد",

  // Segment chips (asset classes)
  "segment.favourites": "علاقه‌مندی‌ها",
  "segment.forex": "فارکس",
  "segment.metals": "فلزات",
  "segment.indices": "شاخص‌ها",
  "segment.energies": "انرژی",
  "segment.crypto": "رمزارز",
  "segment.stocks": "سهام",
  "segment.aria": "کلاس دارایی",
  "segment.title": { one: "{label} · {count} نماد", other: "{label} · {count} نماد" },

  // Navigator tree
  "nav.title": "ناوبر",
  "nav.indicators": "اندیکاتورها",
  "nav.strategies": "استراتژی‌ها",
  "nav.scripts": "اسکریپت‌ها",
  "nav.guest": "مهمان",
  "nav.noAccount": "هنوز حساب معاملاتی ندارید",
  "nav.openAccount": "افتتاح حساب",
  "nav.openAccountTitle": "حساب Kalks خود را بسازید (پنل کاربری باز می‌شود)",
  "nav.signIn": "ورود",
  "nav.signInTitle": "ورود به پنل کاربری",
  "nav.accountType.live": "واقعی",
  "nav.accountType.demo": "دمو",
  "nav.category.trend": "روند",
  "nav.category.oscillators": "اسیلاتورها",
  "nav.category.volatility": "نوسان",
  "nav.category.volume": "حجم",
  "nav.category.billWilliams": "Bill Williams",
  "nav.indicatorTitle": "{description} · برای افزودن به {symbol}، {tf} دوبار کلیک کنید یا Enter بزنید",
  "nav.strategyTitle": { one: "{server} · {login} · {count} معامله", other: "{server} · {login} · {count} معامله" },
  "nav.strategyRunning": "{name} از قبل در حال اجراست",
  "nav.strategyAttached": "{name} افزوده شد",
  "nav.strategyDesc": "{login} · {server} · سود و زیان امروز {pnl}",
  "nav.script.closeAll": "بستن همه پوزیشن‌ها",
  "nav.script.closeProfitable": "بستن پوزیشن‌های سودده",
  "nav.script.closeLosing": "بستن پوزیشن‌های زیان‌ده",
  "nav.script.deletePendings": "حذف همه سفارش‌های معلق",
  "nav.script.breakevenAll": "سربه‌سر کردن همه (SL ← قیمت ورود)",
  "nav.scriptTitle": "برای اجرا روی حساب فعلی دوبار کلیک کنید",
  "nav.scriptsReadOnly": "اسکریپت‌ها در حالت فقط‌خواندنی غیرفعال هستند",
};
export default market;
