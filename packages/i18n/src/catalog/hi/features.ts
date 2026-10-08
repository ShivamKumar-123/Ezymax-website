import type { NsMessages } from "../../core";

// Product modules a broker can switch off: what a client sees in their place.
const features: NsMessages<"features"> = {
  "options.offTitle": "ऑप्शंस ट्रेडिंग उपलब्ध नहीं है",
  "options.offText": "इस समय आपके अकाउंट पर ऑप्शंस उपलब्ध नहीं हैं। ट्रेडिंग जारी रखने के लिए CFD अकाउंट पर स्विच करें।",
};

export default features;
