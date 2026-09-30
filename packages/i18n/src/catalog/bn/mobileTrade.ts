import type { NsMessages } from "../../core";

// Kalks mobile app: Trade tab (chart, Sell / Buy bar, order ticket) and trade notifications.
// Trading terms follow the `order` namespace. {placeholders} hold numbers, prices, tickets and symbols.
const mobileTrade: NsMessages<"mobileTrade"> = {
  // Header
  pickSymbol: "একটি সিম্বল বেছে নিন",
  searchSymbol: "সিম্বল খুঁজুন",
  depth: "মার্কেট ডেপথ",
  alert: "প্রাইস অ্যালার্ট",
  // A header button's accessibility label
  news: "{symbol}-এর খবর",
  // A header button's accessibility label, e.g. "EUR economic calendar"
  calendar: "{currency} অর্থনৈতিক ক্যালেন্ডার",
  "account.chip": "{type} · #{login}",
  "account.manage": "অ্যাকাউন্ট পরিচালনা",
  "account.open": "অ্যাকাউন্ট খুলুন",

  // Chart
  "chart.indicators": "ইন্ডিকেটর",
  "chart.type.candles": "ক্যান্ডেল",
  "chart.type.line": "লাইন",
  "ind.ma": "মুভিং অ্যাভারেজ 20",
  "ind.ema": "এক্সপোনেনশিয়াল MA 50",
  "ind.bb": "বলিঙ্গার ব্যান্ড 20, 2",
  "ind.rsi": "RSI 14",
  "chart.noData": "এই সিম্বলের এখনো কোনো চার্ট ইতিহাস নেই",
  "chart.hint": "জুম করতে পিঞ্চ করুন · স্ক্রোল করতে টানুন · ক্রসহেয়ারের জন্য চেপে ধরে রাখুন · রিসেট করতে ডাবল-ট্যাপ করুন",

  // Sell / Buy bar and ticket
  "bar.volume": "লট",
  "ticket.title": "নতুন অর্ডার",
  "ticket.confirmBuy": "ক্রয় {volume} {symbol}",
  "ticket.confirmSell": "বিক্রয় {volume} {symbol}",
  "ticket.atMarket": "মার্কেট প্রাইসে",
  "ticket.at": "{price}-এ",
  "ticket.addSl": "স্টপ লস যোগ করুন",
  "ticket.addTp": "টেক প্রফিট যোগ করুন",
  "ticket.ifHit": "হিট হলে {money}",
  "ticket.required": "মার্জিন",
  "ticket.pip": "পিপ ভ্যালু",
  "ticket.after": "পরে ফ্রি মার্জিন",
  "ticket.notEnough": "এই ভলিউমের জন্য যথেষ্ট ফ্রি মার্জিন নেই।",
  "ticket.noSpecs": "কন্ট্র্যাক্টের বিবরণ লোড হচ্ছে…",
  "ticket.distance": "{n} পিপস দূরে",
  "ticket.price": "প্রাইস",

  // Rejections: a plain-language line under the reason (order.reject.<code>); the engine's own detail follows it
  "reject.no_money": "আপনার ফ্রি মার্জিন এই অর্ডারের জন্য যথেষ্ট নয়। ভলিউম কমান বা এই অ্যাকাউন্টে ফান্ড যোগ করুন।",
  "reject.insufficient_funds": "আপনার ফ্রি মার্জিন এই অর্ডারের জন্য যথেষ্ট নয়। ভলিউম কমান বা এই অ্যাকাউন্টে ফান্ড যোগ করুন।",
  "reject.market_closed": "এই মার্কেট এখন বন্ধ। মার্কেট খুললে আবার চেষ্টা করুন।",
  "reject.invalid_volume": "এই সিম্বলের সীমা ও লট স্টেপের মধ্যে একটি ভলিউম ব্যবহার করুন।",
  "reject.max_lot": "এই ভলিউম আপনার অ্যাকাউন্টের প্রতি অর্ডারের সর্বোচ্চ সীমার বেশি।",
  "reject.close_only": "আপনার অ্যাকাউন্টে এখন পজিশন ক্লোজ করা যায়, কিন্তু নতুন পজিশন খোলা যায় না।",
  "reject.symbol_close_only": "এই সিম্বলে এখন পজিশন ক্লোজ করা যায়, কিন্তু নতুন করে খোলা যায় না।",
  "reject.trading_disabled": "এই অ্যাকাউন্টে ট্রেডিং বন্ধ আছে। বিস্তারিত জানতে সাপোর্টে যোগাযোগ করুন।",
  "reject.symbol_halted": "এই সিম্বলে ট্রেডিং স্থগিত আছে। পরে আবার চেষ্টা করুন।",
  "reject.requote.title": "প্রাইস বদলে গেছে",
  "reject.requote": "আপনার অর্ডার পৌঁছানোর আগেই মার্কেট সরে গেছে। নতুন প্রাইস দেখে আবার নিশ্চিত করুন।",
  "reject.invalid_sl": "স্টপ লস প্রাইসের ভুল দিকে আছে, অথবা প্রাইসের খুব কাছে।",
  "reject.invalid_tp": "টেক প্রফিট প্রাইসের ভুল দিকে আছে, অথবা প্রাইসের খুব কাছে।",
  "reject.invalid_price": "এই অর্ডার টাইপের জন্য প্রাইসটি মার্কেটের ভুল দিকে আছে।",
  "reject.off_market": "এই প্রাইস মার্কেট থেকে অনেক দূরে। মানটি যাচাই করুন।",
  "reject.stale_price": "এই সিম্বলের প্রাইস কিছুক্ষণের জন্য থেমে আছে। একটু পরে আবার চেষ্টা করুন।",
  "reject.no_price": "এই মুহূর্তে এই সিম্বলের কোনো লাইভ প্রাইস নেই।",
  "reject.read_only": "এই লগইন দিয়ে অ্যাকাউন্ট দেখা যায়, কিন্তু ট্রেড করা যায় না।",
  "reject.uncertain.title": "ট্রেড সার্ভার থেকে কোনো উত্তর আসেনি",
  "reject.uncertain": "অর্ডারটি হয়তো সম্পন্ন হয়েছে। আবার চেষ্টা করার আগে পোর্টফোলিও দেখুন।",
  "reject.uncertain.ticket": "আবার নিশ্চিত করা নিরাপদ: একই অর্ডার দুবার প্লেস হতে পারে না।",

  // States
  "state.noAccount.title": "এখনো কোনো ট্রেডিং অ্যাকাউন্ট নেই",
  "state.noAccount.body": "অনুশীলনের জন্য একটি ডেমো অ্যাকাউন্ট, অথবা আসল অর্থে ট্রেডের জন্য একটি লাইভ অ্যাকাউন্ট খুলুন।",
  "state.noAccount.action": "অ্যাকাউন্ট খুলুন",
  "state.connecting": "ট্রেড সার্ভারে সংযোগ করা হচ্ছে…",
  "state.readOnly": "এখানে এই অ্যাকাউন্টটি শুধু দেখার জন্য: প্রাইস ও চার্ট লাইভ, ট্রেডিং বন্ধ।",
  "state.marketClosed.title": "মার্কেট বন্ধ",
  "state.marketClosed.body": "পরবর্তী সেশনে {symbol} আবার খুলবে। খোলার পর অর্ডার প্লেস করা যাবে।",
  "state.streamError": "ট্রেড সার্ভারে পৌঁছানো যাচ্ছে না",
  "state.streamErrorBody": "আপনার পজিশন ও অর্ডার সার্ভারে নিরাপদ আছে। আমরা আবার সংযোগের চেষ্টা চালিয়ে যাচ্ছি।",

  // Results
  "toast.filled": "{side} {volume} {symbol} পূরণ হয়েছে",
  "toast.at": "{price}-এ",
  "toast.placed": "{symbol} পেন্ডিং অর্ডার প্লেস করা হয়েছে",
  "toast.duplicate": "ইতিমধ্যে #{ticket} হিসেবে প্লেস করা হয়েছে",
  "toast.duplicateBody": "এই অর্ডার আগেই সার্ভারে পৌঁছেছিল; নতুন কিছু খোলা হয়নি।",
  "toast.closed": "পজিশন #{ticket} ক্লোজ হয়েছে",
  "toast.partial": "#{ticket}-এর {volume} লট ক্লোজ হয়েছে",
  "toast.modified": "#{ticket} আপডেট হয়েছে",
  "toast.cancelled": "অর্ডার #{ticket} বাতিল হয়েছে",

  // Engine notifications while the app is open
  "notify.sl": "স্টপ লস হিট",
  "notify.tp": "টেক প্রফিট হিট",
  "notify.order_filled": "পেন্ডিং অর্ডার পূরণ হয়েছে",
  "notify.order_triggered": "অর্ডার ট্রিগার হয়েছে",
  "notify.margin_call": "মার্জিন কল",
  "notify.stop_out": "স্টপ আউট",
  "notify.order_rejected": "অর্ডার প্রত্যাখ্যাত",
  "notify.order_expired": "অর্ডারের মেয়াদ শেষ",
  "notify.order_cancelled": "অর্ডার বাতিল হয়েছে",
};
export default mobileTrade;
