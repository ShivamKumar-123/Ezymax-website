import type { NsMessages } from "../../core";

// Product modules a broker can switch off: what a client sees in their place.
const features: NsMessages<"features"> = {
  "options.offTitle": "Le trading d'options n'est pas disponible",
  "options.offText": "Les options ne sont pas proposées pour votre compte pour le moment. Passez à un compte CFD pour continuer à trader.",
};

export default features;
