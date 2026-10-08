import type { NsMessages } from "../../core";

// Product modules a broker can switch off: what a client sees in their place.
const features: NsMessages<"features"> = {
  "options.offTitle": "オプション取引はご利用いただけません",
  "options.offText": "現在、お客様の口座ではオプションを提供していません。取引を続けるには CFD 口座に切り替えてください。",
};

export default features;
