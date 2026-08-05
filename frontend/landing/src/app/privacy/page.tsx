import type { Metadata } from "next";

import { generateMetadata } from "@/utils/seo/generate-page-metadata";
import { PrivacyView } from "@/views/privacy";

export const metadata: Metadata = generateMetadata({
  title: "Privacy Policy",
  description:
    "How FX Artha collects, uses, and safeguards your information when you use our website and trading platform.",
  url: "/privacy",
});

export default function Privacy() {
  return <PrivacyView />;
}
