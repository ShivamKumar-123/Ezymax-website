import type { NsMessages } from "../../core";

// Product modules a broker can switch off: what a client sees in their place.
const features: NsMessages<"features"> = {
  "options.offTitle": "Biashara ya options haipatikani",
  "options.offText": "Options hazitolewi kwa akaunti yako kwa sasa. Badilisha hadi akaunti ya CFD ili uendelee kufanya biashara.",
};

export default features;
