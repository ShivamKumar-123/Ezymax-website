import type { NsMessages } from "../../core";

// Kalks mobile app, Reports: Statements (/reports/statements) and Analytics (/reports/analytics).
// Most labels reuse the Client Area's portfolio.st.* / portfolio.an.* keys; only mobile-specific text is here.
const mobileReports: NsMessages<"mobileReports"> = {
  eyebrow: "รายงาน",
  "eyebrow.analytics": "รายงาน · USD · เวลาเซิร์ฟเวอร์",

  // Account picker (a card that opens a sheet)
  "account.title": "บัญชี",
  "account.choose": "เลือกบัญชี",
  "account.allHint": { other: "บัญชีจริง {count} บัญชี" },
  "account.change": "เปลี่ยนบัญชี",

  // Statements
  "st.day": "วัน",
  "st.pickDay": "เลือกวัน",
  "st.pickFrom": "วันที่เริ่มต้น",
  "st.pickTo": "วันที่สิ้นสุด",
  "st.include": "รวม",
  "st.summary": "#{login} · {period} · {format}",
  "st.preparing": "กำลังเตรียม…",
  "st.ready": "รายงานบัญชีพร้อมแล้ว",
  "st.saved": "บันทึกเป็น {file} แล้ว",
  "st.shareTitle": "แชร์รายงานบัญชี",
  "st.failed": "ไม่สามารถดาวน์โหลดรายงานบัญชีได้",
  "st.offline": "คุณออฟไลน์อยู่ โปรดเชื่อมต่อเพื่อดาวน์โหลดรายงานบัญชี",
  "st.monthly.empty": "ยังไม่มีรายงานบัญชีรายเดือน",
  "st.monthly.offline": "คุณออฟไลน์อยู่ โปรดเชื่อมต่อเพื่อดูรายงานบัญชีรายเดือน",
  "st.monthly.a11y": "{month}: สุทธิ {net}, {trades} เปิดรายการดาวน์โหลด",
  "st.month.title": "รายงานบัญชี {month}",
  "st.month.formats": "ดาวน์โหลดเป็น",
  "st.prevMonth": "เดือนก่อนหน้า",
  "st.nextMonth": "เดือนถัดไป",

  // Analytics: hero and stat tiles
  "an.hero.label": "P&L สุทธิ · {period}",
  "an.hero.return": "ผลตอบแทน",
  "an.hero.trades": "เทรด",
  "an.hero.lots": "ล็อต",
  "an.tile.sharpe": "Sharpe Ratio",
  "an.tile.expectancy": "ค่าคาดหวัง",
  "an.tile.sortino": "Sortino {value}",
  "an.tile.avgWinLoss": "กำไร / ขาดทุนเฉลี่ย",
  "an.tile.rr": "ผลตอบแทน : ความเสี่ยง 1 : {value}",
  "an.tile.holdSplit": "เทรดกำไร {win} · เทรดขาดทุน {loss}",
  "an.tile.streaks": "สถิติติดต่อกัน",
  "an.tile.streaksSub": "ชนะ / แพ้ติดต่อกัน",
  "an.tile.trade": "{side} {volume} · #{ticket}",
  "an.tile.none": "ยังไม่มีเทรด",

  // Analytics: curves
  "an.curve.hint": "แตะค้างที่กราฟเพื่อดูแต่ละวัน",
  "an.curve.drawdown": "Drawdown",
  "an.curve.a11y": "อิควิตี้ {equity} ยอดคงเหลือ {balance} ณ {date} Drawdown สูงสุด {drawdown}",

  // Analytics: P&L calendar (net of closed trades per server day)
  "an.cal.title": "ปฏิทิน P&L",
  "an.cal.subtitle": "ผลสุทธิของเทรดที่ปิดแล้วต่อวันตามเวลาเซิร์ฟเวอร์",
  "an.cal.subtitleEstimated": "การเปลี่ยนแปลงยอดคงเหลือรายวัน ไม่รวมการฝากและถอนเงิน",
  "an.cal.days": { other: "{count} วันเทรด" },
  "an.cal.green": "เขียว {count}",
  "an.cal.red": "แดง {count}",
  "an.cal.noTrades": "ไม่มีเทรดที่ปิดแล้ว",
  "an.cal.select": "แตะวันเพื่อดูผลลัพธ์",
  "an.cal.a11yDay": "{date}: {net}, {trades}",

  // Analytics: breakdowns
  "an.hour.byHour": "P&L สุทธิตามชั่วโมง",
  "an.hour.byDayHour": "วันในสัปดาห์ × ชั่วโมง",
  "an.hour.tap": "แตะแท่งหรือช่องเพื่อดูรายละเอียด",
  "an.tapBar": "แตะแท่งเพื่อดูรายละเอียด",
  "an.session.best": "ดีที่สุด",
  "an.session.asia": "เอเชีย",
  "an.session.london": "ลอนดอน",
  "an.session.overlap": "ลอนดอน / นิวยอร์ก",
  "an.session.newYork": "นิวยอร์ก",
  "an.session.lateNewYork": "นิวยอร์กช่วงท้าย",
  "an.side.split": "{long} · {short}",
  "an.flow.equityNow": "อิควิตี้ปัจจุบัน",
  "an.charges.total": "ค่าใช้จ่ายที่ชำระ",

  // Behaviour insights (the numbers come from the reports service)
  "insight.overtrading.title": { other: "เทรดมากเกินไป {count} วัน" },
  "insight.overtrading.text": "ในวันเหล่านี้คุณเปิดเทรดมากกว่า {limit} รายการ (วันปกติของคุณคือ {median}) ผลสุทธิในวันเหล่านั้น: {net}",
  "insight.overtrading.tip": "กำหนดเพดานไว้ที่ {cap} เทรดต่อวัน",
  "insight.revenge.title": { other: "อาจเป็นการเทรดเพื่อเอาคืน {count} รายการ" },
  "insight.revenge.text": "เทรดที่เปิดภายใน 15 นาทีหลังปิดขาดทุน ด้วยขนาดเท่าเดิมหรือใหญ่กว่า ชนะ {rate}% ของครั้ง รวมเป็น {net}",
  "insight.revenge.tip": "พัก 15 นาทีหลังขาดทุนก่อนเปิดเทรดถัดไป",
  "insight.risk.title": "ความเสี่ยงต่อเทรดที่ขาดทุน",
  "insight.risk.text": { other: "เทรดที่ขาดทุนทำให้เสียเงินเฉลี่ย {avg}% ของยอดคงเหลือ สูงสุด {max}% มี {count} รายการที่ขาดทุนเกิน 2%" },
  "insight.risk.tip": "กำหนดขนาดสถานะให้ Stop Loss หนึ่งครั้งเสียไม่เกิน 1–2% ของยอดคงเหลือ",
  "insight.holdLosers.title": "ถือเทรดขาดทุนนานกว่าเทรดกำไร",
  "insight.holdLosers.text": "เทรดที่ขาดทุนเปิดค้างไว้เฉลี่ย {loss} ส่วนเทรดที่กำไร {win}",
  "insight.holdLosers.tip": "ตั้ง Stop Loss ตั้งแต่เปิดเทรดและอย่าเลื่อนออก",
  "insight.stopOut.title": { other: "ถูกปิดด้วย Stop Out {count} ครั้ง" },
  "insight.stopOut.text": "สถานะถูกปิดโดย Stop Out ของมาร์จิ้น ไม่ใช่ Stop Loss ของคุณเอง",
  "insight.stopOut.tip": "รักษาระดับมาร์จิ้นให้สูงกว่าระดับ Margin Call ด้วยสถานะที่เล็กลง",
  "insight.slTp.title": "เทรดที่ปิดด้วย Stop Loss หรือ Take Profit",
  "insight.slTp.text": "ปิดด้วย Take Profit {tp} ปิดด้วย Stop Loss {sl} ที่เหลือปิดด้วยตนเองหรือโดยดีลลิ่งเดสก์",
  "insight.slTp.tip": "การวางแผนจุดออกล่วงหน้าช่วยให้ผลลัพธ์สม่ำเสมอ",
  "insight.session.title": "ช่วงตลาดที่ดีที่สุด: {session}",
  "insight.session.text": "{trades} เทรด อัตราชนะ {rate}% อ่อนที่สุด: {worst} ({net})",
  "insight.session.tip": "โฟกัสที่ช่วงตลาด {session}",
  "insight.tip": "คำแนะนำ",

  // States
  "state.updating": "กำลังอัปเดต…",
  "state.stale": "แสดงข้อมูลที่บันทึกไว้ ดึงลงเพื่อรีเฟรช",
  "state.notShared.title": "ไม่ได้แชร์กับคุณ",
  "state.footer": "จำนวนเงินทั้งหมดเป็น USD (แปลงค่าบัญชีเซนต์แล้ว) เวลาเป็นเวลาเซิร์ฟเวอร์ GMT+2 / GMT+3",
  "state.footerStatements": "รายงานบัญชีเป็นสกุลเงินของบัญชี (USC สำหรับบัญชีเซนต์) เวลาเป็นเวลาเซิร์ฟเวอร์ GMT+2 / GMT+3",
};
export default mobileReports;
