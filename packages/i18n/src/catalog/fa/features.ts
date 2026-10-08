import type { NsMessages } from "../../core";

// Product modules a broker can switch off: what a client sees in their place.
const features: NsMessages<"features"> = {
  "options.offTitle": "معاملات اختیار معامله در دسترس نیست",
  "options.offText": "در حال حاضر اختیار معامله برای حساب شما ارائه نمی‌شود. برای ادامهٔ معامله به یک حساب CFD بروید.",
};

export default features;
