import type { Metadata } from "next";

import { generateMetadata } from "@/utils/seo/generate-page-metadata";
import { TradeView } from "@/views/trade";

export const metadata: Metadata = generateMetadata({
  title: "Trade — Forex, Indices, Commodities, Crypto",
  description:
    "Trade CFDs on four markets against a contract that locks only your margin and settles P&L automatically. Free balance stays withdrawable, even mid-trade.",
  url: "/trade",
});

export default function Trade() {
  return <TradeView />;
}
