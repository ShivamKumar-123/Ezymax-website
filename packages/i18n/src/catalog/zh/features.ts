import type { NsMessages } from "../../core";

// Product modules a broker can switch off: what a client sees in their place.
const features: NsMessages<"features"> = {
  "options.offTitle": "期权交易暂不可用",
  "options.offText": "您的账户目前不提供期权。请切换到 CFD 账户继续交易。",
};

export default features;
