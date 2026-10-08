import type { NsMessages } from "../../core";

// Product modules a broker can switch off: what a client sees in their place.
const features: NsMessages<"features"> = {
  "options.offTitle": "Opsiyon işlemleri kullanılamıyor",
  "options.offText": "Opsiyonlar şu anda hesabınız için sunulmuyor. İşlem yapmaya devam etmek için bir CFD hesabına geçin.",
};

export default features;
