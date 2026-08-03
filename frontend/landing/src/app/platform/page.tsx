import type { Metadata } from "next";

import { generateMetadata } from "@/utils/seo/generate-page-metadata";
import { PlatformView } from "@/views/platform";

export const metadata: Metadata = generateMetadata({
  title: "Platform — Web, MT5, Copy Trading, Prop",
  description:
    "Trade in the browser, connect MT5, mirror a verified trader, or trade funded capital — every route settles on the same contract with the same rules.",
  url: "/platform",
});

export default function Platform() {
  return <PlatformView />;
}
