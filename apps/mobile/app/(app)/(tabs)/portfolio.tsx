// Portfolio tab (placeholder until the Portfolio module lands).
import * as React from "react";
import { useT } from "@/i18n";
import { Screen } from "@/ui";

export default function PortfolioTab() {
  const t = useT();
  return <Screen title={t("mobile.tab.portfolio")}>{null}</Screen>;
}
