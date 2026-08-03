import type { Metadata } from "next";

import { generateMetadata } from "@/utils/seo/generate-page-metadata";
import { CompanyView } from "@/views/company";

export const metadata: Metadata = generateMetadata({
  title: "Company — About, Protocol, Legal, Contact",
  description:
    "What FX Artha is, how the trading contract replaces broker custody, the legal structure behind it, and how to reach us.",
  url: "/company",
});

export default function Company() {
  return <CompanyView />;
}
