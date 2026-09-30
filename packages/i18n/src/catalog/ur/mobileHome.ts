import type { NsMessages } from "../../core";

// Kalks mobile app: Home tab. Headings are shown in tall display type: keep them short.
const mobileHome: NsMessages<"mobileHome"> = {
  "greet.morning": "صبح بخیر، {name}",
  "greet.afternoon": "سلام، {name}",
  "greet.evening": "شام بخیر، {name}",
  equity: "ایکویٹی",
  closedToday: "آج بند شدہ",
  openPnl: "اوپن P&L",
  allLive: "تمام لائیو اکاؤنٹس {amount}",
  "quick.deposit": "ڈپازٹ",
  "quick.withdraw": "رقم نکالیں",
  "quick.transfer": "ٹرانسفر",
  "quick.trade": "ٹریڈ",
  movers: "سب سے زیادہ حرکت",
  news: "سرخیاں",
  allNews: "تمام خبریں",
  notifications: "اطلاعات",
  "kyc.title": "اپنی شناخت کی تصدیق کریں",
  "kyc.body": "تصدیق سے لائیو ٹریڈنگ اور رقم نکالنے کی سہولت کھل جاتی ہے۔ اس میں چند منٹ لگتے ہیں۔",
  "kyc.pending": "تصدیق زیر جائزہ ہے",
  "kyc.pendingBody": "ہم آپ کی دستاویزات چیک کر رہے ہیں۔ مکمل ہونے پر آپ کو اطلاع ملے گی۔",
  "kyc.action": "جاری رکھیں",
  "noAccount.title": "اپنا پہلا اکاؤنٹ کھولیں",
  "noAccount.body": "ورچوئل فنڈز کے ساتھ ڈیمو اکاؤنٹ سیکنڈوں میں تیار ہو جاتا ہے۔ جب تیار ہوں تو لائیو پر جائیں۔",
  "noAccount.action": "اکاؤنٹ کھولیں",
  "news.empty": "اس وقت کوئی سرخی نہیں۔",
  "a11y.bell": "اطلاعات، {count} غیر پڑھی ہوئی",

  // Explore: one colour block per module (title on two short lines at most, hint on two lines)
  "explore.title": "دریافت کریں",
  "explore.copy": "کاپی ٹریڈنگ",
  "explore.copyHint": "آزمودہ ٹریڈرز کو فالو کریں",
  "explore.prop": "پراپ چیلنج",
  "explore.propHint": "ٹریڈنگ کے لیے فنڈنگ حاصل کریں",
  "explore.academy": "اکیڈمی",
  "explore.academyHint": "قدم بہ قدم ٹریڈنگ سیکھیں",
  "explore.ai": "AI ٹریڈر",
  "explore.aiHint": "اپنے آئیڈیا کو اسٹریٹیجی میں بدلیں",
  "explore.invite": "دوستوں کو مدعو کریں",
  "explore.inviteHint": "ان کی ٹریڈنگ پر کمائیں",
};
export default mobileHome;
