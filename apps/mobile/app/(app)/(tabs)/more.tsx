// More tab (placeholder until the More module lands).
import * as React from "react";
import { useT } from "@/i18n";
import { Screen } from "@/ui";

export default function MoreTab() {
  const t = useT();
  return <Screen title={t("mobile.tab.more")}>{null}</Screen>;
}
