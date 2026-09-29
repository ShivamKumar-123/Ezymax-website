import type { NsMessages } from "../../core";

// Kalks Trader left panels: Market Watch (quotes list), segment chips and Navigator.
const market: NsMessages<"market"> = {
  // Market Watch header and tabs
  title: "মার্কেট ওয়াচ",
  collapse: "সংকুচিত করুন",
  "tab.symbols": "সিম্বল",
  "tab.details": "বিস্তারিত",
  "tab.favourites": "পছন্দের",
  segmentAria: "মার্কেট ওয়াচ সেগমেন্ট",
  searchPlaceholder: "সিম্বল খুঁজুন",
  searchAria: "মার্কেট ওয়াচে খুঁজুন",
  clear: "মুছুন",

  // Market Watch columns (shown uppercase)
  "col.symbol": "সিম্বল",
  "col.bid": "বিড",
  "col.ask": "আস্ক",
  "col.spread": "স্প্রে.",
  "col.spreadTitle": "স্প্রেড, পয়েন্ট",
  "col.change": "পরি.%",

  // Row / hover card
  "row.title": "{name} · স্প্রেড {spread}",
  "tip.low": "নি",
  "tip.high": "উ",
  "tip.spread": "স্প্রেড",
  "tip.range": "রেঞ্জ",
  bid: "বিড",
  ask: "আস্ক",

  // Empty states and footer
  "empty.favourites": "এখনো কোনো পছন্দের সিম্বল নেই। যোগ করতে কোনো সিম্বলে রাইট-ক্লিক করুন।",
  "empty.noMatch": "কোনো সিম্বল মেলেনি।",
  "footer.count": "{shown} / {total}টি সিম্বল",
  "footer.hint": "ডাবল-ক্লিক: চার্ট",

  // Context menu
  "menu.newOrder": "নতুন অর্ডার",
  "menu.chartWindow": "চার্ট উইন্ডো",
  "menu.openInActive": "সক্রিয় চার্টে খুলুন",
  "menu.depth": "মার্কেট ডেপথ",
  "menu.specification": "স্পেসিফিকেশন",
  "menu.removeFavourite": "পছন্দের তালিকা থেকে সরান",
  "menu.addFavourite": "পছন্দের তালিকায় যোগ করুন",
  "menu.hide": "লুকান",
  "menu.showAll": "সব দেখান",

  // Toasts
  "toast.hidden": "{symbol} মার্কেট ওয়াচ থেকে লুকানো হয়েছে",
  "toast.hiddenDesc": "কনটেক্সট মেনু থেকে সব সিম্বল দেখান।",
  "toast.opened": "{symbol} সক্রিয় চার্টে খোলা হয়েছে",

  // Segment chips (asset classes)
  "segment.favourites": "পছন্দের",
  "segment.forex": "ফরেক্স",
  "segment.metals": "মেটাল",
  "segment.indices": "সূচক",
  "segment.energies": "এনার্জি",
  "segment.crypto": "ক্রিপ্টো",
  "segment.stocks": "স্টক",
  "segment.aria": "অ্যাসেট ক্লাস",
  "segment.title": { one: "{label} · {count}টি সিম্বল", other: "{label} · {count}টি সিম্বল" },

  // Navigator tree
  "nav.title": "নেভিগেটর",
  "nav.indicators": "ইন্ডিকেটর",
  "nav.strategies": "স্ট্র্যাটেজি",
  "nav.scripts": "স্ক্রিপ্ট",
  "nav.guest": "অতিথি",
  "nav.noAccount": "এখনো কোনো ট্রেডিং অ্যাকাউন্ট নেই",
  "nav.openAccount": "অ্যাকাউন্ট খুলুন",
  "nav.openAccountTitle": "আপনার Kalks অ্যাকাউন্ট তৈরি করুন (ক্লায়েন্ট এরিয়া খুলবে)",
  "nav.signIn": "সাইন ইন",
  "nav.signInTitle": "ক্লায়েন্ট এরিয়ায় সাইন ইন করুন",
  "nav.accountType.live": "লাইভ",
  "nav.accountType.demo": "ডেমো",
  "nav.category.trend": "ট্রেন্ড",
  "nav.category.oscillators": "অসিলেটর",
  "nav.category.volatility": "ভোলাটিলিটি",
  "nav.category.volume": "ভলিউম",
  "nav.category.billWilliams": "Bill Williams",
  "nav.indicatorTitle": "{description} · {symbol}, {tf}-এ যুক্ত করতে ডাবল-ক্লিক করুন বা Enter চাপুন",
  "nav.strategyTitle": { one: "{server} · {login} · {count}টি ট্রেড", other: "{server} · {login} · {count}টি ট্রেড" },
  "nav.strategyRunning": "{name} ইতিমধ্যে চলছে",
  "nav.strategyAttached": "{name} যুক্ত হয়েছে",
  "nav.strategyDesc": "{login} · {server} · আজকের P&L {pnl}",
  "nav.script.closeAll": "সব পজিশন ক্লোজ করুন",
  "nav.script.closeProfitable": "লাভজনকগুলো ক্লোজ করুন",
  "nav.script.closeLosing": "লোকসানিগুলো ক্লোজ করুন",
  "nav.script.deletePendings": "সব পেন্ডিং মুছুন",
  "nav.script.breakevenAll": "সব ব্রেকইভেন (SL → এন্ট্রি)",
  "nav.scriptTitle": "বর্তমান অ্যাকাউন্টে চালাতে ডাবল-ক্লিক করুন",
  "nav.scriptsReadOnly": "রিড-অনলি মোডে স্ক্রিপ্ট বন্ধ থাকে",
};
export default market;
