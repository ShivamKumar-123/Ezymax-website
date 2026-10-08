import type { NsMessages } from "../../core";

// Ezymex Trader left panels: Market Watch (quotes list), segment chips and Navigator.
const market: NsMessages<"market"> = {
  // Market Watch header and tabs
  title: "مراقبة السوق",
  collapse: "طي",
  "tab.symbols": "الرموز",
  "tab.details": "التفاصيل",
  "tab.favourites": "المفضّلة",
  segmentAria: "قسم مراقبة السوق",
  searchPlaceholder: "بحث عن رمز",
  searchAria: "البحث في مراقبة السوق",
  clear: "مسح",

  // Market Watch columns
  "col.symbol": "الرمز",
  "col.bid": "Bid",
  "col.ask": "Ask",
  "col.spread": "سبريد",
  "col.spreadTitle": "السبريد، نقاط",
  "col.change": "تغيّر%",

  // Row / hover card
  "row.title": "{name} · السبريد {spread}",
  "tip.low": "أد",
  "tip.high": "أع",
  "tip.spread": "سبريد",
  "tip.range": "النطاق",
  bid: "Bid",
  ask: "Ask",

  // Empty states and footer
  "empty.favourites": "لا توجد مفضّلات بعد. انقر بزر الماوس الأيمن على رمز لإضافته.",
  "empty.favouritesTitle": "لا توجد مفضّلات بعد",
  "empty.noMatch": "لا توجد رموز مطابقة.",
  "footer.count": "{shown} / {total} رمز",
  "footer.hint": "نقر مزدوج: رسم بياني",

  // Context menu
  "menu.newOrder": "أمر جديد",
  "menu.chartWindow": "نافذة الرسم البياني",
  "menu.openInActive": "فتح في الرسم البياني النشط",
  "menu.depth": "عمق السوق",
  "menu.specification": "المواصفات",
  "menu.removeFavourite": "إزالة من المفضّلة",
  "menu.addFavourite": "إضافة إلى المفضّلة",
  "menu.hide": "إخفاء",
  "menu.showAll": "إظهار الكل",

  // Toasts
  "toast.hidden": "تم إخفاء {symbol} من مراقبة السوق",
  "toast.hiddenDesc": "أظهر جميع الرموز من قائمة السياق.",
  "toast.opened": "تم فتح {symbol} في الرسم البياني النشط",

  // Segment chips (asset classes)
  "segment.favourites": "المفضّلة",
  "segment.forex": "فوركس",
  "segment.metals": "المعادن",
  "segment.indices": "المؤشرات",
  "segment.energies": "الطاقة",
  "segment.crypto": "العملات المشفرة",
  "segment.stocks": "الأسهم",
  "segment.aria": "فئة الأصول",
  "segment.title": {
    zero: "{label} · لا توجد رموز",
    one: "{label} · رمز واحد",
    two: "{label} · رمزان",
    few: "{label} · {count} رموز",
    many: "{label} · {count} رمزًا",
    other: "{label} · {count} رمز",
  },

  // Navigator tree
  "nav.title": "المتصفح",
  "nav.indicators": "المؤشرات",
  "nav.strategies": "الاستراتيجيات",
  "nav.scripts": "السكربتات",
  "nav.guest": "زائر",
  "nav.noAccount": "لا يوجد حساب تداول بعد",
  "nav.openAccount": "فتح حساب",
  "nav.openAccountTitle": "أنشئ حسابك في Ezymex (يفتح منطقة العملاء)",
  "nav.signIn": "تسجيل الدخول",
  "nav.signInTitle": "تسجيل الدخول إلى منطقة العملاء",
  "nav.accountType.live": "حقيقي",
  "nav.accountType.demo": "تجريبي",
  "nav.category.trend": "الاتجاه",
  "nav.category.oscillators": "المذبذبات",
  "nav.category.volatility": "التقلّب",
  "nav.category.volume": "الحجم",
  "nav.category.billWilliams": "Bill Williams",
  "nav.indicatorTitle": "{description} · انقر نقرًا مزدوجًا أو اضغط Enter لإرفاقه بـ {symbol}، {tf}",
  "nav.strategyTitle": {
    zero: "{server} · {login} · لا توجد صفقات",
    one: "{server} · {login} · صفقة واحدة",
    two: "{server} · {login} · صفقتان",
    few: "{server} · {login} · {count} صفقات",
    many: "{server} · {login} · {count} صفقة",
    other: "{server} · {login} · {count} صفقة",
  },
  "nav.strategyRunning": "{name} قيد التشغيل بالفعل",
  "nav.strategyAttached": "تم إرفاق {name}",
  "nav.strategyDesc": "{login} · {server} · ر/خ اليوم {pnl}",
  "nav.script.closeAll": "إغلاق جميع الصفقات",
  "nav.script.closeProfitable": "إغلاق الرابحة",
  "nav.script.closeLosing": "إغلاق الخاسرة",
  "nav.script.deletePendings": "حذف جميع الأوامر المعلّقة",
  "nav.script.breakevenAll": "التعادل للكل (SL ← الدخول)",
  "nav.scriptTitle": "انقر نقرًا مزدوجًا للتشغيل على الحساب الحالي",
  "nav.scriptsReadOnly": "السكربتات معطّلة في وضع القراءة فقط",
};
export default market;
