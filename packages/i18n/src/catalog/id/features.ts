import type { NsMessages } from "../../core";

// Product modules a broker can switch off: what a client sees in their place.
const features: NsMessages<"features"> = {
  "options.offTitle": "Trading opsi tidak tersedia",
  "options.offText": "Opsi saat ini tidak tersedia untuk akun Anda. Beralih ke akun CFD untuk melanjutkan trading.",
};

export default features;
