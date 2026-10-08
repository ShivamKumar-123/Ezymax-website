import type { NsMessages } from "../../core";

// Product modules a broker can switch off: what a client sees in their place.
const features: NsMessages<"features"> = {
  "options.offTitle": "옵션 거래를 이용할 수 없습니다",
  "options.offText": "현재 고객님의 계좌에서는 옵션이 제공되지 않습니다. 거래를 계속하려면 CFD 계좌로 전환하세요.",
};

export default features;
