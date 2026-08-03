import type { Metadata } from "next";

import { generateMetadata } from "@/utils/seo/generate-page-metadata";
import { ProtectionView } from "@/views/protection";

export const metadata: Metadata = generateMetadata({
  title: "Protection — Trade Insurance & Risk Tools",
  description:
    "Switch on insurance before an eligible trade and cover up to 75% of a loss, paid automatically at close from an on-chain pool. Plus risk tools that show the full downside first.",
  url: "/protection",
});

export default function Protection() {
  return <ProtectionView />;
}
