import type { NsMessages } from "../../core";

// Kalks mobile app: Home tab. Headings are shown in tall display type: keep them short.
const mobileHome: NsMessages<"mobileHome"> = {
  "greet.morning": "สวัสดีตอนเช้า คุณ{name}",
  "greet.afternoon": "สวัสดีตอนบ่าย คุณ{name}",
  "greet.evening": "สวัสดีตอนเย็น คุณ{name}",
  equity: "อิควิตี้",
  closedToday: "ปิดวันนี้",
  openPnl: "P&L ลอยตัว",
  allLive: "บัญชีจริงทั้งหมด {amount}",
  "quick.deposit": "ฝากเงิน",
  "quick.withdraw": "ถอนเงิน",
  "quick.transfer": "โอนเงิน",
  "quick.trade": "เทรด",
  movers: "เคลื่อนไหวสูงสุด",
  news: "พาดหัวข่าว",
  allNews: "ข่าวทั้งหมด",
  notifications: "การแจ้งเตือน",
  "kyc.title": "ยืนยันตัวตนของคุณ",
  "kyc.body": "การยืนยันตัวตนจะปลดล็อกการเทรดจริงและการถอนเงิน ใช้เวลาเพียงไม่กี่นาที",
  "kyc.pending": "การยืนยันตัวตนอยู่ระหว่างตรวจสอบ",
  "kyc.pendingBody": "เรากำลังตรวจสอบเอกสารของคุณ คุณจะได้รับการแจ้งเตือนเมื่อเสร็จสิ้น",
  "kyc.action": "ดำเนินการต่อ",
  "noAccount.title": "เปิดบัญชีแรกของคุณ",
  "noAccount.body": "บัญชีทดลองพร้อมเงินเสมือนพร้อมใช้งานในไม่กี่วินาที เริ่มเทรดจริงเมื่อคุณพร้อม",
  "noAccount.action": "เปิดบัญชี",
  "news.empty": "ยังไม่มีพาดหัวข่าวในขณะนี้",
  "a11y.bell": "การแจ้งเตือน ยังไม่อ่าน {count} รายการ",

  // Explore: one colour block per module (title on two short lines at most, hint on two lines)
  "explore.title": "สำรวจ",
  "explore.copy": "Copy Trading",
  "explore.copyHint": "ติดตามเทรดเดอร์ที่มีผลงานจริง",
  "explore.prop": "ชาเลนจ์ Prop",
  "explore.propHint": "รับเงินทุนไปเทรด",
  "explore.academy": "Academy",
  "explore.academyHint": "เรียนเทรดทีละขั้นตอน",
  "explore.ai": "AI Trader",
  "explore.aiHint": "เปลี่ยนไอเดียเป็นกลยุทธ์",
  "explore.invite": "ชวนเพื่อน",
  "explore.inviteHint": "รับรายได้เมื่อเพื่อนเทรด",
};
export default mobileHome;
