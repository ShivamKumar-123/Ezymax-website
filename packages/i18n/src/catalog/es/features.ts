import type { NsMessages } from "../../core";

// Product modules a broker can switch off: what a client sees in their place.
const features: NsMessages<"features"> = {
  "options.offTitle": "El trading de opciones no está disponible",
  "options.offText": "Las opciones no están disponibles para su cuenta en este momento. Cambie a una cuenta de CFD para seguir operando.",
};

export default features;
