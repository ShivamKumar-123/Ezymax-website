import type { NsMessages } from "../../core";

// Product modules a broker can switch off: what a client sees in their place.
const features: NsMessages<"features"> = {
  "options.offTitle": "Optionshandel ist nicht verfügbar",
  "options.offText": "Optionen werden für Ihr Konto derzeit nicht angeboten. Wechseln Sie zu einem CFD-Konto, um weiter zu handeln.",
};

export default features;
