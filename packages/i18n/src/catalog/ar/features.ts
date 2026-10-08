import type { NsMessages } from "../../core";

// Product modules a broker can switch off: what a client sees in their place.
const features: NsMessages<"features"> = {
  "options.offTitle": "تداول الخيارات غير متاح",
  "options.offText": "الخيارات غير متاحة لحسابك حاليًا. انتقل إلى حساب CFD لمواصلة التداول.",
};

export default features;
