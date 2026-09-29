import type { NsMessages } from "../../core";

// Kalks Trader left panels: Market Watch (quotes list), segment chips and Navigator.
const market: NsMessages<"market"> = {
  // Market Watch header and tabs
  title: "مارکیٹ واچ",
  collapse: "سمیٹیں",
  "tab.symbols": "سمبلز",
  "tab.details": "تفصیلات",
  "tab.favourites": "پسندیدہ",
  segmentAria: "مارکیٹ واچ سیگمنٹ",
  searchPlaceholder: "سمبل تلاش کریں",
  searchAria: "مارکیٹ واچ میں تلاش کریں",
  clear: "صاف کریں",

  // Market Watch columns
  "col.symbol": "سمبل",
  "col.bid": "بِڈ",
  "col.ask": "آسک",
  "col.spread": "اسپریڈ",
  "col.spreadTitle": "اسپریڈ، پوائنٹس",
  "col.change": "تبدیلی%",

  // Row / hover card
  "row.title": "{name} · اسپریڈ {spread}",
  "tip.low": "L",
  "tip.high": "H",
  "tip.spread": "اسپریڈ",
  "tip.range": "رینج",
  bid: "بِڈ",
  ask: "آسک",

  // Empty states and footer
  "empty.favourites": "ابھی کوئی پسندیدہ نہیں۔ شامل کرنے کے لیے کسی سمبل پر رائٹ کلک کریں۔",
  "empty.noMatch": "کوئی سمبل مماثل نہیں۔",
  "footer.count": "{shown} / {total} سمبلز",
  "footer.hint": "ڈبل کلک: چارٹ",

  // Context menu
  "menu.newOrder": "نیا آرڈر",
  "menu.chartWindow": "چارٹ ونڈو",
  "menu.openInActive": "فعال چارٹ میں کھولیں",
  "menu.depth": "مارکیٹ کی گہرائی",
  "menu.specification": "تفصیلات",
  "menu.removeFavourite": "پسندیدہ سے ہٹائیں",
  "menu.addFavourite": "پسندیدہ میں شامل کریں",
  "menu.hide": "چھپائیں",
  "menu.showAll": "سب دکھائیں",

  // Toasts
  "toast.hidden": "{symbol} مارکیٹ واچ سے چھپا دیا گیا",
  "toast.hiddenDesc": "کانٹیکسٹ مینو سے تمام سمبلز دکھائیں۔",
  "toast.opened": "{symbol} فعال چارٹ میں کھل گیا",

  // Segment chips (asset classes)
  "segment.favourites": "پسندیدہ",
  "segment.forex": "فاریکس",
  "segment.metals": "دھاتیں",
  "segment.indices": "انڈیکسز",
  "segment.energies": "توانائی",
  "segment.crypto": "کرپٹو",
  "segment.stocks": "اسٹاکس",
  "segment.aria": "اثاثہ جات کی قسم",
  "segment.title": { one: "{label} · {count} سمبل", other: "{label} · {count} سمبلز" },

  // Navigator tree
  "nav.title": "نیویگیٹر",
  "nav.indicators": "انڈیکیٹرز",
  "nav.strategies": "اسٹریٹجیز",
  "nav.scripts": "اسکرپٹس",
  "nav.guest": "مہمان",
  "nav.noAccount": "ابھی کوئی ٹریڈنگ اکاؤنٹ نہیں",
  "nav.openAccount": "اکاؤنٹ کھولیں",
  "nav.openAccountTitle": "اپنا Kalks اکاؤنٹ بنائیں (کلائنٹ ایریا کھلے گا)",
  "nav.signIn": "سائن اِن",
  "nav.signInTitle": "کلائنٹ ایریا میں سائن اِن کریں",
  "nav.accountType.live": "لائیو",
  "nav.accountType.demo": "ڈیمو",
  "nav.category.trend": "ٹرینڈ",
  "nav.category.oscillators": "آسیلیٹرز",
  "nav.category.volatility": "اتار چڑھاؤ",
  "nav.category.volume": "والیوم",
  "nav.category.billWilliams": "Bill Williams",
  "nav.indicatorTitle": "{description} · {symbol}، {tf} پر لگانے کے لیے ڈبل کلک کریں یا Enter دبائیں",
  "nav.strategyTitle": { one: "{server} · {login} · {count} ٹریڈ", other: "{server} · {login} · {count} ٹریڈز" },
  "nav.strategyRunning": "{name} پہلے سے چل رہی ہے",
  "nav.strategyAttached": "{name} لگا دی گئی",
  "nav.strategyDesc": "{login} · {server} · آج کا P&L {pnl}",
  "nav.script.closeAll": "تمام پوزیشنز بند کریں",
  "nav.script.closeProfitable": "منافع والی بند کریں",
  "nav.script.closeLosing": "نقصان والی بند کریں",
  "nav.script.deletePendings": "تمام پینڈنگ آرڈرز حذف کریں",
  "nav.script.breakevenAll": "سب کو بریک ایون کریں (SL ← انٹری)",
  "nav.scriptTitle": "موجودہ اکاؤنٹ پر چلانے کے لیے ڈبل کلک کریں",
  "nav.scriptsReadOnly": "صرف پڑھنے کے موڈ میں اسکرپٹس غیر فعال ہیں",
};
export default market;
