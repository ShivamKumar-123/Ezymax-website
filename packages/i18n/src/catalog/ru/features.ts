import type { NsMessages } from "../../core";

// Product modules a broker can switch off: what a client sees in their place.
const features: NsMessages<"features"> = {
  "options.offTitle": "Торговля опционами недоступна",
  "options.offText": "Опционы сейчас недоступны для вашего счёта. Переключитесь на CFD-счёт, чтобы продолжить торговлю.",
};

export default features;
