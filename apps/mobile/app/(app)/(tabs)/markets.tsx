// Markets tab (placeholder until the Markets module lands).
import * as React from "react";
import { useT } from "@/i18n";
import { Screen } from "@/ui";

export default function MarketsTab() {
  const t = useT();
  return <Screen title={t("mobile.tab.markets")}>{null}</Screen>;
}
