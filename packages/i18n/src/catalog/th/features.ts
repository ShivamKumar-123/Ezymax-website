import type { NsMessages } from "../../core";

// Product modules a broker can switch off: what a client sees in their place.
const features: NsMessages<"features"> = {
  "options.offTitle": "ไม่สามารถเทรดออปชันได้",
  "options.offText": "ขณะนี้ออปชันไม่ได้เปิดให้บริการสำหรับบัญชีของคุณ สลับไปใช้บัญชี CFD เพื่อเทรดต่อ",
};

export default features;
