import type { NsMessages } from "../../core";

const dashboard: NsMessages<"dashboard"> = {
  // Page header (Client Area home)
  "greeting.morning": "สวัสดีตอนเช้า คุณ{name}",
  "greeting.afternoon": "สวัสดีตอนบ่าย คุณ{name}",
  "greeting.evening": "สวัสดีตอนเย็น คุณ{name}",
  "greeting.welcome": "ยินดีต้อนรับ คุณ{name}",
  "subtitle.live": "ยินดีต้อนรับสู่ Kalks นี่คือบัญชีของคุณและตลาดในวันนี้",
  "subtitle.demo": "นี่คือผลการดำเนินงานของบัญชีของคุณในวันนี้",
  launchTrader: "เปิด Kalks Trader",
  openTerminal: "เปิดเทอร์มินัลเทรด",

  // Getting started checklist
  "steps.title": "เริ่มต้นใช้งาน",
  "steps.subtitle": "ความคืบหน้าสู่การเทรดจริงของคุณ",
  "steps.progress": "{done} จาก {total}",
  "steps.account.title": "สร้างบัญชีของคุณ",
  "steps.account.text": "ลงทะเบียนเมื่อ {date}",
  "steps.email.title": "ยืนยันอีเมลของคุณ",
  "steps.email.verified": "{email} ได้รับการยืนยันแล้ว",
  "steps.email.confirm": "ยืนยัน {email} ด้วยรหัสที่เราส่งให้คุณ",
  "steps.kyc.title": "ยืนยันตัวตนของคุณ",
  "steps.kyc.verified": "ยืนยันตัวตนของคุณแล้ว ปลดล็อกการถอนเงินแล้ว",
  "steps.kyc.moreInfo": "ทีมงานของเราต้องการเอกสารจากคุณเพิ่มอีกหนึ่งฉบับ",
  "steps.kyc.review": "เอกสารของคุณอยู่ระหว่างการตรวจสอบโดยทีมยืนยันตัวตน",
  "steps.kyc.draft": "ทำต่อจากที่ค้างไว้ ใช้เวลาประมาณ 3 นาที",
  "steps.kyc.rejected": "เราไม่สามารถยืนยันเอกสารของคุณได้ คุณสามารถเริ่มใหม่ได้",
  "steps.kyc.todo": "ใช้เวลาประมาณ 3 นาที เพื่อปลดล็อกการถอนเงิน",
  "steps.accountOpen.title": "เปิดบัญชีเทรด",
  "steps.accountOpen.opened": { other: "เปิดบัญชีจริง {live} บัญชี และบัญชีทดลอง {demo} บัญชีแล้ว" },
  "steps.accountOpen.todo": "เปิดบัญชีจริงหรือบัญชีทดลอง คุณจะได้รับล็อกอินทันที",
  "steps.wallet.title": "เติมเงินเข้าวอลเล็ต",
  "steps.wallet.text": "กำลังเชื่อมต่อการฝากเงิน USDT ผ่าน TRC20",
  // Step status chips
  "steps.state.done": "เสร็จสิ้น",
  "steps.state.todo": "ต้องทำ",
  "steps.state.review": "กำลังตรวจสอบ",
  "steps.state.rejected": "ถูกปฏิเสธ",
  "steps.state.soon": "ยังไม่เริ่ม",

  // Trading accounts card
  "accounts.title": "บัญชีเทรด",
  "accounts.summary": "อิควิตี้บัญชีจริง <b>{equity}</b> · จริง {live} · ทดลอง {demo} · สถานะที่เปิดอยู่ {positions}",
  "accounts.subtitle": "บัญชีจริงและบัญชีทดลองของคุณ",
  "accounts.all": "บัญชีทั้งหมด",
  "accounts.open": "เปิดบัญชี",
  "accounts.unavailable": "ขณะนี้ไม่สามารถเข้าถึงบัญชีเทรดได้ ยอดเงินของคุณยังปลอดภัย",
  "accounts.openLive.title": "เปิดบัญชีจริง",
  "accounts.openLive.text": "ตลาดจริง เริ่มต้นด้วยยอดคงเหลือเป็นศูนย์ การฝากเงินจะเปิดพร้อมกับวอลเล็ต",
  "accounts.openDemo.title": "เปิดบัญชีทดลอง",
  "accounts.openDemo.text": "เงินเสมือนบนราคาเรียลไทม์ เติมใหม่ได้ทุกวัน",
  "accounts.more": { other: "อีก {count} บัญชี" },
  "accounts.myTitle": "บัญชีเทรดของฉัน",

  // Your account card
  "account.title": "บัญชีของคุณ",
  "account.clientId": "รหัสลูกค้า",
  "account.emailStatus": "สถานะอีเมล",
  "account.notVerified": "ยังไม่ยืนยัน",
  "account.identity": "ตัวตน",
  "account.memberSince": "เป็นสมาชิกตั้งแต่",
  "account.profile": "โปรไฟล์",

  // Kalks Trader banner
  "trader.chip": "ราคาเรียลไทม์",
  "trader.text": "ราคาและกราฟเรียลไทม์สำหรับ {count} ตราสาร ครอบคลุมฟอเร็กซ์ โลหะ ดัชนี พลังงาน คริปโต และหุ้น ใช้งานผ่านเบราว์เซอร์ ไม่ต้องติดตั้ง",

  // Market clock / heatmap
  "sessions.title": "นาฬิกาตลาด",
  "sessions.open": "ตลาดเปิด {open} จาก {total}",
  "heatmap.title": "ฮีตแมปตลาด",
  "heatmap.subtitle": "การเคลื่อนไหววันนี้จากราคาเรียลไทม์ · จุดกลวง: ตลาดปิด",
  "heatmap.up": "ขึ้น {count}",
  "heatmap.down": "ลง {count}",
  "heatmap.allMarkets": "ตลาดทั้งหมด",
  "heatmap.tipOpen": "{symbol} · ตลาดเปิด",
  "heatmap.tipClosed": "{symbol} · ตลาดปิด การเคลื่อนไหวของรอบล่าสุด",

  // Support card
  "support.title": "ต้องการความช่วยเหลือ?",
  "support.text": "เขียนถึง <mail>{email}</mail> จากอีเมลที่ลงทะเบียนไว้ และระบุรหัสลูกค้าของคุณ",
  "support.emailSupport": "อีเมลถึงฝ่ายสนับสนุน",
  "support.copied": "คัดลอกที่อยู่อีเมลแล้ว",
  "support.copyFailed": "คัดลอกไม่สำเร็จ โปรดเลือกที่อยู่อีเมลแทน",

  // Demo dashboard: onboarding strip
  "onboarding.title": "ตั้งค่าบัญชีของคุณให้เสร็จสมบูรณ์",
  "onboarding.text": "ยืนยัน KYC ให้เสร็จเพื่อปลดล็อกการถอนเงินและวงเงินที่สูงขึ้น",
  "onboarding.progress": "ความคืบหน้า",
  "onboarding.dismiss": "ปิด",

  // Margin health
  "margin.title": "สุขภาพมาร์จิ้น",
  "margin.subtitle": "จากบัญชีจริงทั้งหมด",
  "margin.healthy": "ปกติ",
  "margin.level": "ระดับมาร์จิ้น",
  "margin.used": "มาร์จิ้นที่ใช้",
  "margin.free": "ฟรีมาร์จิ้น",

  // Equity / P&L
  "equity.title": "อิควิตี้รวม",
  "equity.changeOver": "การเปลี่ยนแปลงในช่วง {range}",
  "pnl.title": "กำไร / ขาดทุน · เดือน",
  "pnl.lowRisk": "ความเสี่ยงต่ำ",
  "pnl.winRate": "อัตราชนะ (30 วัน)",
  "pnl.trades": "จำนวนเทรด (30 วัน)",
  "pnl.avgWin": "เทรดที่ได้กำไรเฉลี่ย",
  "pnl.avgLoss": "เทรดที่ขาดทุนเฉลี่ย",
  "pnl.charges": "ค่าธรรมเนียมที่จ่าย",

  // KPI cards
  "kpi.wallet": "วอลเล็ต",
  "kpi.today": "+{pct}% วันนี้",
  "kpi.monthPnl": "P&L เดือนนี้",
  "kpi.vsLastMonth": "+{pct}% เทียบกับเดือนที่แล้ว",
  "kpi.partnerEarnings": "รายได้พาร์ทเนอร์",
  "kpi.copy": "Copy {amount}",

  // Top movers
  "movers.title": "เคลื่อนไหวสูงสุด",
  "movers.gainers": "ขึ้นมากสุด",
  "movers.losers": "ลงมากสุด",

  // Economic calendar. A = Actual, F = Forecast, P = Previous
  "calendar.title": "ปฏิทินเศรษฐกิจ",
  "calendar.subtitle": "วันนี้ · เวลาเซิร์ฟเวอร์ GMT+3",
  "calendar.actual": "A {value} · ",
  "calendar.forecastPrevious": "F {forecast} · P {previous}",

  // News / world
  "news.title": "ข่าวตลาด",
  "news.all": "ข่าวทั้งหมด",
  "news.pinned": "ปักหมุด",
  "world.title": "ตลาดและข่าวทั่วโลก",
  "world.subtitle": "พาดหัวข่าวล่าสุดตามประเทศและทัศนคติต่อสกุลเงิน",
  "world.stories": { other: "{count} ข่าววันนี้" },

  // Open positions
  "positions.title": "สถานะที่เปิดอยู่",
  "positions.summary": { other: "{count} สถานะ · ลอยตัว" },
  "positions.terminal": "เทอร์มินัล",

  // Partner banner
  "partner.chip": "โปรแกรมพาร์ทเนอร์",
  "partner.title": "ชวนเทรดเดอร์ รับสูงสุด $15 ต่อล็อต ตลอดชีพ",
  "partner.text": "คอมมิชชันหลายระดับ โบนัส CPA และการติดตามแบบเรียลไทม์ ลิงก์ของคุณ: <link>{url}</link>",
  "partner.open": "เปิดแดชบอร์ดพาร์ทเนอร์",

  // Short relative times
  "time.justNow": "เมื่อสักครู่",
  "time.minutesAgo": "{count} นาทีที่แล้ว",
  "time.hoursAgo": "{count} ชม. ที่แล้ว",
  "time.daysAgo": "{count} วันที่แล้ว",
  "time.ago": "{time} ที่แล้ว",

  // Notifications bell / panel
  "notifications.title": "การแจ้งเตือน",
  "notifications.ariaUnread": "การแจ้งเตือน ยังไม่อ่าน {count} รายการ",
  "notifications.markAll": "ทำเครื่องหมายว่าอ่านทั้งหมด",
  "notifications.clear": "ล้าง",
  "notifications.emptyTitle": "ยังไม่มีการแจ้งเตือน",
  "notifications.emptyText": "การฝากเงิน การถอนเงิน การยืนยันตัวตน การแจ้งเตือนการเทรด และการตอบกลับจากฝ่ายสนับสนุนจะแสดงที่นี่",
  "notifications.settings": "การตั้งค่าการแจ้งเตือน",
};
export default dashboard;
