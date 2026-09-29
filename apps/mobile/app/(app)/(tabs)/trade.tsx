// Trade tab (placeholder until the Trade module lands).
import * as React from "react";
import { useT } from "@/i18n";
import { Screen } from "@/ui";

export default function TradeTab() {
  const t = useT();
  return <Screen title={t("mobile.tab.trade")}>{null}</Screen>;
}
