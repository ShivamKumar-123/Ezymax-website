// One commission line (fixed height, memoised): what it is for, the client, the amount and its state. A line the
// broker rejected or voided carries its reason as a label (the self-referral check, a deal the desk reopened…).
import * as React from "react";
import { View } from "react-native";
import { BadgeDollarSign, GitFork, Layers, Percent, SlidersHorizontal, Undo2 } from "lucide-react-native";
import { useT, type T } from "@/i18n";
import { Mono, PressableScale, Text } from "@/ui";
import { colors, space } from "@/theme/tokens";
import { ago, commissionLine, statusLabel, usd } from "../format";
import type { CommissionRow as Row } from "../types";
import { Tag, type TagTone } from "./Chrome";

export const COMMISSION_ROW_HEIGHT = 76;

const ICONS = { lot: Layers, split: GitFork, rebate: Percent, cpa: BadgeDollarSign, clawback: Undo2, adjustment: SlidersHorizontal } as const;

export function statusTone(s: string): TagTone {
  if (s === "paid") return "ok";
  if (s === "approved") return "periwinkle";
  if (s === "pending") return "warn";
  if (s === "rejected") return "risk";
  return "muted";
}

/** "+$12.00" / "−$3.20"; struck through when the line was rejected or voided (it no longer counts); a line that
 *  rounds to $0.00 is grey, never green or red. */
export function lineAmount(e: Row) {
  const dead = e.status === "rejected" || e.status === "void";
  const cents = Math.round(e.amount * 100);
  return { text: usd(e.amount, true), color: dead || cents === 0 ? colors.text3 : cents > 0 ? colors.up : colors.down, dead };
}

/** Whose line: the client's name, or "You (rebate)" for the rebate a partner's own IB passes on (the server's text). */
export const clientName = (t: T, e: Row) => (e.client.name === "You (rebate)" ? t("mobilePartner.com.youRebate") : e.client.name || t("mobilePartner.com.client", { id: e.client.id }));

/** `compact`: inside a card (the dashboard), where the tier is left out of the line so the time still fits. */
export const CommissionLine = React.memo(function CommissionLine({ e, first, compact, onOpen }: { e: Row; first?: boolean; compact?: boolean; onOpen?: (e: Row) => void }) {
  const t = useT();
  const Icon = ICONS[e.kind as keyof typeof ICONS] ?? Layers;
  const amount = lineAmount(e);
  const reason = e.note && (e.status === "rejected" || e.status === "void" || e.kind === "clawback" || e.kind === "adjustment") ? e.note : null;
  const body = (
    <View style={{ height: COMMISSION_ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[5], borderTopWidth: first ? 0 : 1, borderTopColor: colors.line }}>
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: e.kind === "cpa" ? colors.gold : colors.surface2, alignItems: "center", justifyContent: "center" }}>
        <Icon size={17} color={e.kind === "cpa" ? colors.ink : colors.text2} strokeWidth={1.9} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text variant="callout" weight="700" numberOfLines={1}>
          {clientName(t, e)}
        </Text>
        {reason ? (
          <Tag label={reason} tone={e.status === "void" ? "muted" : "warn"} caps={false} />
        ) : (
          // on a narrow phone the line gives way, the time stays whole (a row: it follows the reading direction)
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, minWidth: 0 }}>
            <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ flexShrink: 1 }}>
              {commissionLine(t, e, compact)}
            </Text>
            <Text variant="caption" tone="tertiary">
              ·
            </Text>
            <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ flexShrink: 0 }}>
              {ago(t, e.createdAt)}
            </Text>
          </View>
        )}
      </View>
      <View style={{ alignItems: "flex-end", gap: 5, maxWidth: "40%" }}>
        <Mono size={15} weight="bold" color={amount.color} numberOfLines={1} style={amount.dead ? { textDecorationLine: "line-through" } : null}>
          {amount.text}
        </Mono>
        <Tag label={statusLabel(t, e.status)} tone={statusTone(e.status)} />
      </View>
    </View>
  );
  if (!onOpen) return body;
  return (
    <PressableScale onPress={() => onOpen(e)} scaleTo={0.985} accessibilityLabel={`${clientName(t, e)}, ${commissionLine(t, e)}, ${amount.text}, ${statusLabel(t, e.status)}${reason ? `, ${reason}` : ""}`}>
      {body}
    </PressableScale>
  );
});
