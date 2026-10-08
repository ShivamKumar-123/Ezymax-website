import type { NsMessages } from "../../core";

// Product modules a broker can switch off: what a client sees in their place.
const features: NsMessages<"features"> = {
  "options.offTitle": "آپشنز ٹریڈنگ دستیاب نہیں ہے",
  "options.offText": "اس وقت آپ کے اکاؤنٹ کے لیے آپشنز دستیاب نہیں ہیں۔ ٹریڈنگ جاری رکھنے کے لیے CFD اکاؤنٹ پر جائیں۔",
};

export default features;
