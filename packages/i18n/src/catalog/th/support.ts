import type { NsMessages } from "../../core";

// Client Area support: live chat, launcher, support page. "Ezymex" and "Ezymex AI" stay as they are.
const support: NsMessages<"support"> = {
  // Support page
  "page.title": "ฝ่ายสนับสนุน",
  "page.subtitle": "แชทกับ Ezymex AI เพื่อรับคำตอบทันที ขอคุยกับเจ้าหน้าที่ได้ทุกเมื่อ แล้วทีมงานของเราจะรับช่วงต่อพร้อมประวัติการสนทนาทั้งหมด",
  "email.prefer": "ต้องการใช้อีเมลใช่ไหม?",
  // <email> and <id> wrap the client's email address and client ID
  "email.writeFrom": "ส่งอีเมลจาก <email>{email}</email> และระบุรหัสลูกค้าของคุณ <id>{id}</id>",
  "email.write": "ส่งอีเมลถึงฝ่ายสนับสนุน",
  "email.copyId": "คัดลอกรหัสลูกค้า",
  clientId: "รหัสลูกค้า",
  notice: "คำตอบจากทีมงานของเราจะแสดงในกระดิ่งการแจ้งเตือนด้วย และเราจะส่งอีเมลถึงคุณเมื่อคุณไม่ได้ออนไลน์ เปลี่ยนการตั้งค่านี้ได้ที่ โปรไฟล์ → การแจ้งเตือน",
  "toast.copied": "คัดลอก{what}แล้ว",
  "toast.copyFailed": "คัดลอกไม่สำเร็จ โปรดเลือกข้อความแทน",

  // Conversation status
  "status.bot": "ผู้ช่วย AI",
  "status.waiting": "อยู่ในคิว",
  "status.assigned": "กับเจ้าหน้าที่",
  "status.resolved": "สิ้นสุดแล้ว",

  // Conversation history
  "history.title": "การสนทนาของคุณ",
  "history.subtitle": "บันทึกการสนทนาจะเก็บไว้ในพื้นที่ลูกค้าของคุณ",
  "history.emptyTitle": "ยังไม่มีการสนทนา",
  "history.emptyText": "ถามคำถามในแชท แล้วการสนทนาจะแสดงที่นี่",
  conversation: "การสนทนา",
  "toast.openFailed": "ไม่สามารถเปิดการสนทนาได้",

  // Floating button
  "launcher.open": "เปิดแชทฝ่ายสนับสนุน",
  "launcher.close": "ปิดแชทฝ่ายสนับสนุน",

  // Chat
  you: "คุณ",
  agent: "เจ้าหน้าที่",
  // Fallback name for a team member without a name
  supportName: "ฝ่ายสนับสนุน",
  // File size, e.g. "120 KB · PDF"
  attachmentSize: "{size} KB · PDF",
  // Suggested first questions (sent as the client's message)
  "quick.verify": "ฉันจะยืนยันตัวตนได้อย่างไร?",
  "quick.deposit": "ฉันจะฝาก USDT ได้อย่างไร?",
  "quick.withdrawal": "เงินที่ถอนจะเข้าเมื่อไร?",
  "quick.stopOut": "Stop Out คืออะไร?",
  "header.supportTeam": "ทีมสนับสนุน",
  "header.agentSub": "ฝ่ายบริการลูกค้า · Ezymex",
  "header.connecting": "กำลังเชื่อมต่อคุณกับเจ้าหน้าที่…",
  "header.replySoon": "ทีมงานของเราจะตอบกลับที่นี่ในไม่ช้า",
  "header.helpCentre": "คำตอบจากศูนย์ช่วยเหลือ · เจ้าหน้าที่เข้าร่วมได้ทุกเมื่อ",
  "header.instant": "ตอบทันที · เจ้าหน้าที่เข้าร่วมได้ทุกเมื่อ",
  "chip.liveAgent": "เจ้าหน้าที่",
  "menu.aria": "ตัวเลือกแชท",
  "menu.talkToPerson": "คุยกับเจ้าหน้าที่",
  "menu.endChat": "จบแชท",
  "menu.newChat": "เริ่มแชทใหม่",
  closeChat: "ปิดแชท",
  unavailable: "แชทไม่พร้อมใช้งานในขณะนี้",
  greeting: "สวัสดี {name}",
  "csat.question": "แชทนี้เป็นอย่างไรบ้าง?",
  "csat.stars": { other: "{count} ดาว" },
  "csat.placeholder": "มีอะไรเพิ่มเติมไหม? (ไม่บังคับ)",
  "csat.send": "ส่งคะแนน",
  "csat.rated": "คุณให้คะแนนแชทนี้ {rating}/5",
  "composer.attach": "แนบไฟล์",
  "composer.messageTo": "ส่งข้อความถึง {name}…",
  "composer.newChat": "เริ่มแชทใหม่…",
  "composer.ask": "ถาม {name} ได้ทุกเรื่อง…",
  "composer.aria": "ข้อความ",
  disclaimer: "{name} อาจผิดพลาดได้และจะไม่ให้คำแนะนำการลงทุน แชทจะถูกบันทึกเพื่อคุณภาพการบริการ",
  "toast.chattingWith": "คุณกำลังแชทกับ {name}",
  "toast.inQueue": "คุณอยู่ในคิวรอเจ้าหน้าที่",
  "toast.notSent": "ส่งข้อความไม่สำเร็จ",
  "toast.teamUnreachable": "ไม่สามารถติดต่อทีมงานได้",
  "toast.endFailed": "ไม่สามารถจบแชทได้",
  "toast.rateFailed": "ไม่ได้บันทึกคะแนน",
  "toast.thanks": "ขอบคุณสำหรับความคิดเห็นของคุณ",
  "toast.fileTooLarge": "ไฟล์มีขนาดใหญ่เกินไป",
  "toast.fileTooLargeText": "ไฟล์มีขนาดได้สูงสุด {mb} MB",
  "toast.unsupported": "ไม่รองรับไฟล์นี้",
  "toast.unsupportedText": "แนบรูปภาพ (PNG, JPG, GIF, WEBP) หรือ PDF",
  "toast.uploadFailed": "อัปโหลดไม่สำเร็จ",
  "error.uploadFailed": "อัปโหลดไม่สำเร็จ",
};
export default support;
