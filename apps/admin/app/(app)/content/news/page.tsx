"use client";

import { IS_DEMO } from "@kalks/mock/mode";
import { LiveNewsCms } from "@/components/news-live/cms";
import NewsCurationPage from "../page";

export default function NewsPage() {
  // live builds: real feed on services/news; demo builds keep the curation showcase
  return IS_DEMO ? <NewsCurationPage /> : <LiveNewsCms />;
}
