import type { NsMessages } from "../../core";

// Kalks mobile app: Markets tab (watchlist). Segment names, Bid / Ask and search reuse the `market` namespace.
const mobileMarkets: NsMessages<"mobileMarkets"> = {
  eyebrow: "ราคาเรียลไทม์",
  "empty.favourites.title": "ยังไม่มีรายการโปรด",
  "empty.favourites.body": "แตะค้างที่สัญลักษณ์ใดก็ได้เพื่อปักหมุดไว้ที่นี่",
  "empty.favourites.action": "ดูฟอเร็กซ์",
  "fav.added": "เพิ่ม {symbol} ในรายการโปรดแล้ว",
  "fav.removed": "นำ {symbol} ออกจากรายการโปรดแล้ว",
  "a11y.row": "{symbol}, {name} เปิดกราฟ แตะค้างเพื่อเพิ่มหรือนำออกจากรายการโปรด",
  "a11y.search": "ค้นหาสัญลักษณ์",
  cancel: "ยกเลิก",
  "status.connecting": "กำลังเชื่อมต่อราคา…",
  "status.offline": "ราคาหยุดชั่วคราว: ไม่มีการเชื่อมต่อ",
};
export default mobileMarkets;
