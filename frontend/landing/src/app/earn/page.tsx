import type { Metadata } from "next";

import { generateMetadata } from "@/utils/seo/generate-page-metadata";
import { EarnView } from "@/views/earn";

export const metadata: Metadata = generateMetadata({
  title: "Earn — Staking, Rewards & XP, Partnership",
  description:
    "Stake idle balance, earn tighter spreads through disciplined trading, and partner on real activity. Terms improve with how you trade, not how much you deposit.",
  url: "/earn",
});

export default function Earn() {
  return <EarnView />;
}
