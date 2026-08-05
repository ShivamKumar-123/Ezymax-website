import type { Metadata } from "next";

import { generateMetadata } from "@/utils/seo/generate-page-metadata";
import { RiskView } from "@/views/risk";

export const metadata: Metadata = generateMetadata({
  title: "Risk Disclosure",
  description:
    "Trading leveraged instruments carries a high level of risk. Read FX Artha's full risk disclosure before opening an account.",
  url: "/risk",
});

export default function Risk() {
  return <RiskView />;
}
