import type { NsMessages } from "../../core";

// Kalks mobile app: Home tab. Headings are shown in tall uppercase display type: keep them short.
const mobileHome: NsMessages<"mobileHome"> = {
  "greet.morning": "শুভ সকাল, {name}",
  "greet.afternoon": "শুভ অপরাহ্ন, {name}",
  "greet.evening": "শুভ সন্ধ্যা, {name}",
  equity: "ইকুইটি",
  closedToday: "আজ ক্লোজ হওয়া",
  openPnl: "খোলা P&L",
  allLive: "সব লাইভ অ্যাকাউন্ট {amount}",
  "quick.deposit": "জমা",
  "quick.withdraw": "উত্তোলন",
  "quick.transfer": "ট্রান্সফার",
  "quick.trade": "ট্রেড",
  movers: "শীর্ষ মুভার",
  news: "শিরোনাম",
  allNews: "সব খবর",
  notifications: "নোটিফিকেশন",
  "kyc.title": "আপনার পরিচয় যাচাই করুন",
  "kyc.body": "ভেরিফিকেশনে লাইভ ট্রেডিং ও উত্তোলন চালু হয়। মাত্র কয়েক মিনিট লাগে।",
  "kyc.pending": "ভেরিফিকেশন পর্যালোচনায়",
  "kyc.pendingBody": "আমরা আপনার ডকুমেন্ট যাচাই করছি। শেষ হলে আপনি একটি নোটিফিকেশন পাবেন।",
  "kyc.action": "চালিয়ে যান",
  "noAccount.title": "আপনার প্রথম অ্যাকাউন্ট খুলুন",
  "noAccount.body": "ভার্চুয়াল ফান্ডসহ একটি ডেমো অ্যাকাউন্ট কয়েক সেকেন্ডেই প্রস্তুত। প্রস্তুত হলে লাইভে যান।",
  "noAccount.action": "অ্যাকাউন্ট খুলুন",
  "news.empty": "এই মুহূর্তে কোনো শিরোনাম নেই।",
  "a11y.bell": "নোটিফিকেশন, {count}টি অপঠিত",

  // Explore: one colour block per module (title in display type on two short lines at most, hint on two lines)
  "explore.title": "ঘুরে দেখুন",
  "explore.copy": "কপি ট্রেডিং",
  "explore.copyHint": "প্রমাণিত ট্রেডারদের অনুসরণ করুন",
  "explore.prop": "প্রপ চ্যালেঞ্জ",
  "explore.propHint": "ট্রেড করার জন্য ফান্ড পান",
  "explore.academy": "অ্যাকাডেমি",
  "explore.academyHint": "ধাপে ধাপে ট্রেডিং শিখুন",
  "explore.ai": "AI ট্রেডার",
  "explore.aiHint": "আইডিয়াকে স্ট্র্যাটেজিতে রূপ দিন",
  "explore.invite": "বন্ধুদের আমন্ত্রণ জানান",
  "explore.inviteHint": "তারা ট্রেড করলেই আপনার আয়",
};
export default mobileHome;
