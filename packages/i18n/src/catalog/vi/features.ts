import type { NsMessages } from "../../core";

// Product modules a broker can switch off: what a client sees in their place.
const features: NsMessages<"features"> = {
  "options.offTitle": "Giao dịch quyền chọn không khả dụng",
  "options.offText": "Quyền chọn hiện không được cung cấp cho tài khoản của bạn. Hãy chuyển sang tài khoản CFD để tiếp tục giao dịch.",
};

export default features;
