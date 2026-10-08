import type { NsMessages } from "../../core";

// Product modules a broker can switch off: what a client sees in their place.
const features: NsMessages<"features"> = {
  "options.offTitle": "Il trading di opzioni non è disponibile",
  "options.offText": "Le opzioni non sono disponibili per il tuo conto al momento. Passa a un conto CFD per continuare a fare trading.",
};

export default features;
