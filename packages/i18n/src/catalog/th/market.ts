import type { NsMessages } from "../../core";

// Ezymex Trader left panels: Market Watch (quotes list), segment chips and Navigator.
const market: NsMessages<"market"> = {
  // Market Watch header and tabs
  title: "ดูตลาด",
  collapse: "ย่อ",
  "tab.symbols": "สัญลักษณ์",
  "tab.details": "รายละเอียด",
  "tab.favourites": "รายการโปรด",
  segmentAria: "หมวดดูตลาด",
  searchPlaceholder: "ค้นหาสัญลักษณ์",
  searchAria: "ค้นหาในดูตลาด",
  clear: "ล้าง",

  // Market Watch columns
  "col.symbol": "สัญลักษณ์",
  "col.bid": "Bid",
  "col.ask": "Ask",
  "col.spread": "Sp",
  "col.spreadTitle": "สเปรด, จุด",
  "col.change": "%เปลี่ยน",

  // Row / hover card
  "row.title": "{name} · สเปรด {spread}",
  "tip.low": "L",
  "tip.high": "H",
  "tip.spread": "สเปรด",
  "tip.range": "ช่วง",
  bid: "Bid",
  ask: "Ask",

  // Empty states and footer
  "empty.favourites": "ยังไม่มีรายการโปรด คลิกขวาที่สัญลักษณ์เพื่อเพิ่ม",
  "empty.favouritesTitle": "ยังไม่มีรายการโปรด",
  "empty.noMatch": "ไม่มีสัญลักษณ์ที่ตรงกัน",
  "footer.count": "{shown} / {total} สัญลักษณ์",
  "footer.hint": "ดับเบิลคลิก: กราฟ",

  // Context menu
  "menu.newOrder": "คำสั่งใหม่",
  "menu.chartWindow": "หน้าต่างกราฟ",
  "menu.openInActive": "เปิดในกราฟที่ใช้งานอยู่",
  "menu.depth": "Depth of Market",
  "menu.specification": "ข้อมูลจำเพาะ",
  "menu.removeFavourite": "นำออกจากรายการโปรด",
  "menu.addFavourite": "เพิ่มในรายการโปรด",
  "menu.hide": "ซ่อน",
  "menu.showAll": "แสดงทั้งหมด",

  // Toasts
  "toast.hidden": "ซ่อน {symbol} จากดูตลาดแล้ว",
  "toast.hiddenDesc": "แสดงสัญลักษณ์ทั้งหมดได้จากเมนูคลิกขวา",
  "toast.opened": "เปิด {symbol} ในกราฟที่ใช้งานอยู่แล้ว",

  // Segment chips (asset classes)
  "segment.favourites": "รายการโปรด",
  "segment.forex": "ฟอเร็กซ์",
  "segment.metals": "โลหะ",
  "segment.indices": "ดัชนี",
  "segment.energies": "พลังงาน",
  "segment.crypto": "คริปโต",
  "segment.stocks": "หุ้น",
  "segment.aria": "ประเภทสินทรัพย์",
  "segment.title": { other: "{label} · {count} สัญลักษณ์" },

  // Navigator tree
  "nav.title": "ตัวนำทาง",
  "nav.indicators": "อินดิเคเตอร์",
  "nav.strategies": "กลยุทธ์",
  "nav.scripts": "สคริปต์",
  "nav.guest": "ผู้เยี่ยมชม",
  "nav.noAccount": "ยังไม่มีบัญชีเทรด",
  "nav.openAccount": "เปิดบัญชี",
  "nav.openAccountTitle": "สร้างบัญชี Ezymex ของคุณ (เปิดพื้นที่ลูกค้า)",
  "nav.signIn": "เข้าสู่ระบบ",
  "nav.signInTitle": "เข้าสู่ระบบพื้นที่ลูกค้า",
  "nav.accountType.live": "จริง",
  "nav.accountType.demo": "ทดลอง",
  "nav.category.trend": "เทรนด์",
  "nav.category.oscillators": "ออสซิลเลเตอร์",
  "nav.category.volatility": "ความผันผวน",
  "nav.category.volume": "ปริมาณ",
  "nav.category.billWilliams": "Bill Williams",
  "nav.indicatorTitle": "{description} · ดับเบิลคลิกหรือกด Enter เพื่อเพิ่มใน {symbol}, {tf}",
  "nav.strategyTitle": { other: "{server} · {login} · {count} เทรด" },
  "nav.strategyRunning": "{name} กำลังทำงานอยู่แล้ว",
  "nav.strategyAttached": "เพิ่ม {name} แล้ว",
  "nav.strategyDesc": "{login} · {server} · P&L วันนี้ {pnl}",
  "nav.script.closeAll": "ปิดสถานะทั้งหมด",
  "nav.script.closeProfitable": "ปิดสถานะที่กำไร",
  "nav.script.closeLosing": "ปิดสถานะที่ขาดทุน",
  "nav.script.deletePendings": "ลบคำสั่งรอดำเนินการทั้งหมด",
  "nav.script.breakevenAll": "คุ้มทุนทั้งหมด (SL → จุดเข้า)",
  "nav.scriptTitle": "ดับเบิลคลิกเพื่อรันในบัญชีปัจจุบัน",
  "nav.scriptsReadOnly": "สคริปต์ถูกปิดใช้งานในโหมดอ่านอย่างเดียว",
};
export default market;
