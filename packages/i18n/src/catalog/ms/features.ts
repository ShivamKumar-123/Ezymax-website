import type { NsMessages } from "../../core";

// Product modules a broker can switch off: what a client sees in their place.
const features: NsMessages<"features"> = {
  "options.offTitle": "Dagangan opsyen tidak tersedia",
  "options.offText": "Opsyen tidak ditawarkan untuk akaun anda buat masa ini. Tukar ke akaun CFD untuk terus berdagang.",
};

export default features;
