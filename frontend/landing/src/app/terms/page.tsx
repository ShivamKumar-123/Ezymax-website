import type { Metadata } from "next";

import { generateMetadata } from "@/utils/seo/generate-page-metadata";
import { TermsView } from "@/views/terms";

export const metadata: Metadata = generateMetadata({
  title: "Terms of Service",
  description:
    "The agreement governing your access to and use of the FX Artha website, trading platform, and related services.",
  url: "/terms",
});

export default function Terms() {
  return <TermsView />;
}
