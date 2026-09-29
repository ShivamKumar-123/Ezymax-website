// Restrictions the broker set on the account (gateway: trading, close-only, deposits, withdrawals, transfers…),
// kept current by the session heartbeat. Show it on screens where the restricted action lives.
import * as React from "react";
import { ShieldAlert } from "lucide-react-native";
import { useT } from "@/i18n";
import { useSession } from "@/session";
import { Banner } from "@/ui";
import { colors } from "@/theme/tokens";

const ORDER = ["login", "trading", "close_only", "deposits", "withdrawals", "transfers", "ib", "social"];

export function RestrictionBanner({ kinds, onContact }: { kinds?: string[]; onContact?: () => void }) {
  const t = useT();
  const restricted = useSession((s) => s.restricted);
  const restrictions = useSession((s) => s.restrictions);
  const frozen = restrictions.some((r) => r.kind === "freeze");
  const show = ORDER.filter((k) => restricted.includes(k) && (!kinds || kinds.includes(k)));
  if (!show.length) return null;
  const until = (k: string) => {
    const e = restrictions.find((r) => r.kind === k)?.expires_at ?? (frozen ? restrictions.find((r) => r.kind === "freeze")?.expires_at : null);
    return e ? t("security.restricted.until", { date: new Date(e).toLocaleString() }) : null;
  };
  return (
    <Banner
      tone="warn"
      icon={<ShieldAlert size={18} color={colors.gold} />}
      title={frozen ? t("security.restricted.frozen") : t("security.restricted.title")}
      body={show.map((k) => [t.dyn(`security.restricted.kind.${k}`, k), until(k)].filter(Boolean).join(" · ")).join("\n")}
      action={onContact ? t("security.restricted.contact") : undefined}
      onAction={onContact}
    />
  );
}
