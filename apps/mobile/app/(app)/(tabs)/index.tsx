// Home tab (placeholder until the Home module lands).
import * as React from "react";
import { useT } from "@/i18n";
import { Screen } from "@/ui";

export default function HomeTab() {
  const t = useT();
  return <Screen title={t("mobile.tab.home")}>{null}</Screen>;
}
