import type { Metadata } from "next";

import { generateMetadata } from "@/utils/seo/generate-page-metadata";
import { ProtectionView } from "@/views/protection";

export const metadata: Metadata = generateMetadata({
  title: "Protection — Trade Insurance & Risk Tools",
  description:
    "Buy a Shield plan for a day, a week or a month and cover up to 50% of what you lose over that window, paid out automatically. Plus risk tools that show the full downside first.",
  url: "/protection",
});

export default function Protection() {
  return <ProtectionView />;
}
