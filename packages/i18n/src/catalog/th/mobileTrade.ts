import type { NsMessages } from "../../core";

// Kalks mobile app: Trade tab (chart, Sell / Buy bar, order ticket) and trade notifications.
// Trading terms follow the MT5 Thai localisation and the `order` namespace (Stop Loss, Take Profit stay in Latin).
const mobileTrade: NsMessages<"mobileTrade"> = {
  // Header
  pickSymbol: "เลือกสัญลักษณ์",
  searchSymbol: "ค้นหาสัญลักษณ์",
  depth: "ความลึกตลาด",
  alert: "การแจ้งเตือนราคา",
  news: "ข่าว {symbol}",
  calendar: "ปฏิทินเศรษฐกิจ {currency}",
  "account.chip": "{type} · #{login}",
  "account.manage": "จัดการบัญชี",
  "account.open": "เปิดบัญชี",

  // Chart
  "chart.indicators": "อินดิเคเตอร์",
  "chart.type.candles": "แท่งเทียน",
  "chart.type.line": "เส้น",
  "ind.ma": "Moving Average 20",
  "ind.ema": "Exponential MA 50",
  "ind.bb": "Bollinger Bands 20, 2",
  "ind.rsi": "RSI 14",
  "chart.noData": "ยังไม่มีประวัติกราฟสำหรับสัญลักษณ์นี้",
  "chart.hint": "ถ่างนิ้วเพื่อซูม · ลากเพื่อเลื่อน · แตะค้างเพื่อแสดงเส้นกากบาท · แตะสองครั้งเพื่อรีเซ็ต",

  // Sell / Buy bar and ticket
  "bar.volume": "ล็อต",
  "ticket.title": "คำสั่งใหม่",
  "ticket.confirmBuy": "ซื้อ {volume} {symbol}",
  "ticket.confirmSell": "ขาย {volume} {symbol}",
  "ticket.atMarket": "ที่ราคาตลาด",
  "ticket.at": "ที่ {price}",
  "ticket.addSl": "เพิ่ม Stop Loss",
  "ticket.addTp": "เพิ่ม Take Profit",
  "ticket.ifHit": "{money} หากถึงราคา",
  "ticket.required": "มาร์จิ้น",
  "ticket.pip": "มูลค่า Pip",
  "ticket.after": "ฟรีมาร์จิ้นหลังเปิด",
  "ticket.notEnough": "ฟรีมาร์จิ้นไม่พอสำหรับปริมาณนี้",
  "ticket.noSpecs": "กำลังโหลดรายละเอียดสัญญา…",
  "ticket.distance": "ห่าง {n} pips",
  "ticket.price": "ราคา",

  // Rejections: a plain-language line under the reason (order.reject.<code>); the engine's own detail follows it
  "reject.no_money": "ฟรีมาร์จิ้นของคุณไม่พอสำหรับคำสั่งนี้ ลดปริมาณหรือเติมเงินเข้าบัญชีนี้",
  "reject.insufficient_funds": "ฟรีมาร์จิ้นของคุณไม่พอสำหรับคำสั่งนี้ ลดปริมาณหรือเติมเงินเข้าบัญชีนี้",
  "reject.market_closed": "ตลาดนี้ปิดอยู่ในขณะนี้ โปรดลองอีกครั้งเมื่อตลาดเปิด",
  "reject.invalid_volume": "ใช้ปริมาณที่อยู่ในขีดจำกัดและขั้นล็อตของสัญลักษณ์นี้",
  "reject.max_lot": "ปริมาณนี้เกินขีดจำกัดสูงสุดต่อคำสั่งของบัญชีคุณ",
  "reject.close_only": "ขณะนี้บัญชีของคุณปิดสถานะได้ แต่เปิดสถานะใหม่ไม่ได้",
  "reject.symbol_close_only": "ขณะนี้สัญลักษณ์นี้ปิดสถานะได้ แต่เปิดใหม่ไม่ได้",
  "reject.trading_disabled": "การเทรดถูกปิดในบัญชีนี้ โปรดติดต่อฝ่ายสนับสนุนเพื่อดูรายละเอียด",
  "reject.symbol_halted": "การเทรดสัญลักษณ์นี้หยุดชั่วคราว โปรดลองอีกครั้งภายหลัง",
  "reject.requote.title": "ราคาเปลี่ยนแล้ว",
  "reject.requote": "ตลาดเคลื่อนไหวระหว่างที่คำสั่งกำลังส่ง โปรดตรวจสอบราคาใหม่แล้วยืนยันอีกครั้ง",
  "reject.invalid_sl": "Stop Loss อยู่ผิดฝั่งของราคา หรือใกล้ราคาเกินไป",
  "reject.invalid_tp": "Take Profit อยู่ผิดฝั่งของราคา หรือใกล้ราคาเกินไป",
  "reject.invalid_price": "ราคานี้อยู่ผิดฝั่งของตลาดสำหรับคำสั่งประเภทนี้",
  "reject.off_market": "ราคานี้ห่างจากราคาตลาดมากเกินไป โปรดตรวจสอบค่าอีกครั้ง",
  "reject.stale_price": "ราคาของสัญลักษณ์นี้หยุดชั่วคราว โปรดลองอีกครั้งในอีกสักครู่",
  "reject.no_price": "ขณะนี้ไม่มีราคาเรียลไทม์สำหรับสัญลักษณ์นี้",
  "reject.read_only": "ล็อกอินนี้ดูบัญชีได้ แต่เทรดไม่ได้",
  "reject.uncertain.title": "ไม่มีการตอบกลับจากเซิร์ฟเวอร์เทรด",
  "reject.uncertain": "คำสั่งอาจดำเนินการไปแล้ว โปรดตรวจสอบพอร์ตก่อนลองอีกครั้ง",
  "reject.uncertain.ticket": "ยืนยันซ้ำได้อย่างปลอดภัย: คำสั่งเดียวกันจะไม่ถูกวางซ้ำ",

  // States
  "state.noAccount.title": "ยังไม่มีบัญชีเทรด",
  "state.noAccount.body": "เปิดบัญชีทดลองเพื่อฝึกเทรด หรือบัญชีจริงเพื่อเทรดด้วยเงินจริง",
  "state.noAccount.action": "เปิดบัญชี",
  "state.connecting": "กำลังเชื่อมต่อเซิร์ฟเวอร์เทรด…",
  "state.readOnly": "บัญชีนี้ดูได้อย่างเดียวที่นี่: ราคาและกราฟเป็นแบบเรียลไทม์ แต่ปิดการเทรด",
  "state.marketClosed.title": "ตลาดปิด",
  "state.marketClosed.body": "{symbol} จะเปิดอีกครั้งในรอบการซื้อขายถัดไป วางคำสั่งได้เมื่อตลาดเปิด",
  "state.streamError": "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เทรดได้",
  "state.streamErrorBody": "สถานะและคำสั่งของคุณปลอดภัยบนเซิร์ฟเวอร์ เรากำลังพยายามเชื่อมต่อใหม่",

  // Results
  "toast.filled": "{side} {volume} {symbol} สำเร็จ",
  "toast.at": "ที่ {price}",
  "toast.placed": "วางคำสั่งรอดำเนินการ {symbol} แล้ว",
  "toast.duplicate": "วางไว้แล้วเป็น #{ticket}",
  "toast.duplicateBody": "คำสั่งนี้ถึงเซิร์ฟเวอร์ก่อนหน้านี้แล้ว ไม่มีการเปิดรายการใหม่",
  "toast.closed": "ปิดสถานะ #{ticket} แล้ว",
  "toast.partial": "ปิด {volume} ล็อตของ #{ticket} แล้ว",
  "toast.modified": "อัปเดต #{ticket} แล้ว",
  "toast.cancelled": "ยกเลิกคำสั่ง #{ticket} แล้ว",

  // Engine notifications while the app is open
  "notify.sl": "ถึง Stop Loss",
  "notify.tp": "ถึง Take Profit",
  "notify.order_filled": "คำสั่งรอดำเนินการถูกจับคู่แล้ว",
  "notify.order_triggered": "คำสั่งถูกทริกเกอร์แล้ว",
  "notify.margin_call": "Margin Call",
  "notify.stop_out": "Stop Out",
  "notify.order_rejected": "คำสั่งถูกปฏิเสธ",
  "notify.order_expired": "คำสั่งหมดอายุ",
  "notify.order_cancelled": "คำสั่งถูกยกเลิก",
};
export default mobileTrade;
