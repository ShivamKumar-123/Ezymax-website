import type { NsMessages } from "../../core";

// Product modules a broker can switch off: what a client sees in their place.
const features: NsMessages<"features"> = {
  "options.offTitle": "A negociação de opções não está disponível",
  "options.offText": "As opções não estão disponíveis para sua conta no momento. Mude para uma conta de CFD para continuar negociando.",
};

export default features;
