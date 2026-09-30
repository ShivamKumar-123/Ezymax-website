import type { NsMessages } from "../../core";

// Kalks mobile app: app shell, onboarding and the states every screen shares.
const mobile: NsMessages<"mobile"> = {
  // Tab bar (short: one word each)
  "tab.home": "หน้าหลัก",
  "tab.markets": "ตลาด",
  "tab.trade": "เทรด",
  "tab.portfolio": "พอร์ต",
  "tab.more": "เพิ่มเติม",

  // Onboarding (3 slides). Titles are shown in tall display type: keep them short.
  "onboarding.skip": "ข้าม",
  "onboarding.next": "ถัดไป",
  "onboarding.getStarted": "เริ่มต้นใช้งาน",
  "onboarding.haveAccount": "ฉันมีบัญชีแล้ว",
  "onboarding.welcome.title": "ก้าวสู่ตลาด",
  "onboarding.welcome.body": "ฟอเร็กซ์ โลหะ ดัชนี พลังงาน คริปโต และหุ้นในบัญชีเดียว พร้อมเติมเงินด้วย USDT ได้ทันที",
  "onboarding.markets.title": "ทุกติก เรียลไทม์",
  "onboarding.markets.body": "ราคา Bid และ Ask จริง กราฟของคุณเอง และซื้อขายได้ในแตะเดียว ออกแบบมาเพื่อมือถือ",
  "onboarding.security.title": "ปลอดภัยแน่นหนา",
  "onboarding.security.body": "รหัสทางอีเมลเมื่อใช้อุปกรณ์ใหม่ รหัสยืนยันสำหรับการถอนเงิน และที่เก็บที่ปลอดภัยสำหรับเซสชันของคุณ",
  "onboarding.step": "{n} จาก {total}",

  // Shared states
  "state.offline.title": "ขาดการเชื่อมต่อ",
  "state.offline.body": "โปรดตรวจสอบการเชื่อมต่ออินเทอร์เน็ต ราคาและบัญชีของคุณจะเชื่อมต่อใหม่อัตโนมัติ",
  "state.reconnecting": "กำลังเชื่อมต่อใหม่…",
  "state.error.title": "เกิดข้อผิดพลาด",
  "state.error.body": "ไม่สามารถโหลดข้อมูลนี้ได้ ดึงลงหรือแตะเพื่อลองอีกครั้ง",
  "state.maintenance.title": "ปิดปรับปรุงระบบ",
  "state.maintenance.body": "เรากำลังอัปเกรด Kalks สถานะและเงินทุนของคุณปลอดภัย โปรดกลับมาอีกครั้งในไม่ช้า",
  "state.sessionExpired": "เซสชันของคุณสิ้นสุดแล้ว โปรดเข้าสู่ระบบอีกครั้ง",
  "state.updated": "อัปเดต {time}",
  "state.pullToRefresh": "ดึงลงเพื่อรีเฟรช",

  viewOnly: "สิทธิ์ดูอย่างเดียว",
  viewOnlyBody: "ล็อกอินนี้ดูบัญชีที่แชร์ได้ แต่ไม่สามารถแก้ไขได้",

  // Common short labels
  "action.retry": "ลองอีกครั้ง",
  "action.openWeb": "เปิดในพื้นที่ลูกค้า",
  "action.signOut": "ออกจากระบบ",
  "action.seeAll": "ดูทั้งหมด",
  "a11y.close": "ปิด",
  "a11y.back": "ย้อนกลับ",
};
export default mobile;
