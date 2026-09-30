// Small building blocks shared by the wallet screens: section titles, status chips, progress bars, label/value
// rows, copy / paste / share controls.
import * as React from "react";
import { Share, View, type StyleProp, type ViewStyle } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Check, ChevronLeft, ChevronRight, ClipboardPaste, Copy, Share2 } from "lucide-react-native";
import { useLocale, useT, type MessageKey } from "@/i18n";
import { Mono, PressableScale, Text } from "@/ui";
import { colors, GUTTER, HIT, radius, space } from "@/theme/tokens";
import type { DepositStatus, WithdrawalStatus } from "../api";
import { alpha } from "../lib/tint";

/* ---- section title ---- */

export function SectionTitle({ title, action, onAction, onActionPressIn, style }: { title: string; action?: string; onAction?: () => void; onActionPressIn?: () => void; style?: StyleProp<ViewStyle> }) {
  const { rtl } = useLocale();
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: GUTTER, minHeight: HIT, marginTop: space[6] }, style]}>
      <Text variant="label" tone="tertiary" accessibilityRole="header">
        {title}
      </Text>
      {action && onAction ? (
        <PressableScale onPress={onAction} onPressIn={onActionPressIn} scaleTo={1} style={{ minHeight: HIT, flexDirection: "row", alignItems: "center", gap: 2, paddingStart: space[3] }}>
          <Text variant="callout" weight="600" tone="secondary">
            {action}
          </Text>
          {rtl ? <ChevronLeft size={16} color={colors.text3} /> : <ChevronRight size={16} color={colors.text3} />}
        </PressableScale>
      ) : null}
    </View>
  );
}

/* ---- status chips (token tones, all tints derived from them; green / red stay reserved for money amounts) ---- */

export type ChipTone = "success" | "waiting" | "active" | "failed" | "neutral";
/** Settled = warm off-white, waiting for someone = gold, moving along on its own = info, not done = ember. Five tones
 *  that stay apart in the web colour family (the Client Area uses info for the same "confirming / approved / paid"). */
export const CHIP: Record<ChipTone, { fg: string; bg: string }> = {
  success: { fg: colors.cream, bg: alpha(colors.cream, 0.12) },
  waiting: { fg: colors.gold, bg: colors.goldSoft },
  active: { fg: colors.info, bg: colors.infoSoft },
  failed: { fg: colors.ember, bg: colors.emberSoft },
  neutral: { fg: colors.text2, bg: colors.surface2 },
};

export type StatusDef = { tone: ChipTone; label: MessageKey };

export const DEPOSIT_STATUS: Record<DepositStatus, StatusDef> = {
  pending: { tone: "waiting", label: "wallet.status.deposit.pending" },
  confirming: { tone: "active", label: "wallet.status.deposit.confirming" },
  credited: { tone: "success", label: "wallet.status.deposit.credited" },
  failed: { tone: "failed", label: "common.failed" },
  review: { tone: "waiting", label: "wallet.status.deposit.review" },
  unmatched: { tone: "waiting", label: "wallet.status.deposit.review" },
  rejected: { tone: "failed", label: "wallet.status.deposit.rejected" },
};

export const WITHDRAWAL_STATUS: Record<WithdrawalStatus, StatusDef> = {
  requested: { tone: "waiting", label: "wallet.status.withdrawal.requested" },
  approved: { tone: "active", label: "common.approved" },
  paid: { tone: "active", label: "wallet.status.withdrawal.paid" },
  completed: { tone: "success", label: "common.completed" },
  rejected: { tone: "failed", label: "common.rejected" },
  cancelled: { tone: "neutral", label: "common.cancelled" },
};

export const TRANSFER_STATUS: Record<string, StatusDef> = {
  pending: { tone: "waiting", label: "common.processing" },
  completed: { tone: "success", label: "common.completed" },
  failed: { tone: "failed", label: "common.failed" },
};

export function StatusChip({ tone, label, compact }: { tone: ChipTone; label: string; compact?: boolean }) {
  const c = CHIP[tone];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, height: compact ? 22 : 26, paddingHorizontal: compact ? 8 : 10, borderRadius: radius.pill, backgroundColor: c.bg, alignSelf: "flex-start" }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.fg }} />
      <Text variant="caption" weight="700" color={c.fg} numberOfLines={1} style={compact ? { fontSize: 11.5 } : undefined}>
        {label}
      </Text>
    </View>
  );
}

/** Compact status for list rows: a dot and the label in the tone colour. It never shrinks: the status is the one
 *  thing a row must always show in full (the text after it gives way instead). */
export function StatusDot({ tone, label }: { tone: ChipTone; label: string }) {
  const c = CHIP[tone];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 0 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.fg }} />
      <Text variant="caption" weight="700" color={c.fg} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/* ---- progress bar (limits, confirmations) ---- */

export function ProgressBar({ value, color = colors.ember, height = 6 }: { value: number; color?: string; height?: number }) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: colors.surface3, overflow: "hidden" }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}>
      <View style={{ width: `${pct * 100}%`, height: "100%", borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

/** "12 / 15 confirmations" with a bar; `state` adds the phase on the other side (off where a status chip says it). */
export function Confirmations({ done, required, credited, pending, state = true }: { done: number; required: number; credited?: boolean; pending?: boolean; state?: boolean }) {
  const t = useT();
  const n = credited ? required : Math.min(done, required);
  return (
    <View style={{ gap: space[2] }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: space[3] }}>
        <Text variant="caption" tone="secondary">
          {t("wallet.activity.confirmations", { done: n, required })}
        </Text>
        {state ? (
          <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ flexShrink: 1 }}>
            {credited ? t("wallet.confirmations.complete") : pending ? t("wallet.confirmations.firstBlock") : t("wallet.confirmations.confirming")}
          </Text>
        ) : null}
      </View>
      <ProgressBar value={required ? n / required : 0} color={credited ? colors.cream : colors.ember} />
    </View>
  );
}

/* ---- label / value rows ---- */

export function InfoRow({ label, value, mono, trailing, last }: { label: string; value: React.ReactNode; mono?: boolean; trailing?: React.ReactNode; last?: boolean }) {
  return (
    <View style={{ minHeight: 52, flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: space[2], borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.line }}>
      <Text variant="callout" tone="tertiary" style={{ flexShrink: 0, maxWidth: "42%" }}>
        {label}
      </Text>
      <View style={{ flex: 1, alignItems: "flex-end" }}>
        {typeof value === "string" ? (
          mono ? (
            <Mono size={14} weight="medium" selectable>
              {value}
            </Mono>
          ) : (
            <Text variant="callout" weight="600" selectable>
              {value}
            </Text>
          )
        ) : (
          value
        )}
      </View>
      {trailing}
    </View>
  );
}

/** Label above, big tabular value below (quote tiles, limits). */
export function Tile({ label, value, tone, style }: { label: string; value: string; tone?: "up" | "primary"; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flex: 1, backgroundColor: colors.surface2, borderRadius: radius.md, paddingHorizontal: space[3], paddingVertical: space[3], gap: 4 }, style]}>
      <Text variant="label" tone="tertiary" numberOfLines={1}>
        {label}
      </Text>
      <Mono size={15} weight="bold" tone={tone ?? "primary"} numberOfLines={1}>
        {value}
      </Mono>
    </View>
  );
}

/* ---- copy / share / paste ---- */

/** Copies `value`; the label turns into "Copied" with a check for a moment. */
export function CopyButton({ value, label, compact, onCopied, accessibilityLabel }: { value: string; label?: string; compact?: boolean; onCopied?: () => void; accessibilityLabel?: string }) {
  const t = useT();
  const [done, setDone] = React.useState(false);
  React.useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => setDone(false), 1600);
    return () => clearTimeout(id);
  }, [done]);
  const copy = async () => {
    await Clipboard.setStringAsync(value).catch(() => false);
    setDone(true);
    onCopied?.();
  };
  const Icon = done ? Check : Copy;
  const text = done ? t("common.copied") : (label ?? t("common.copy"));
  if (compact)
    return (
      <PressableScale onPress={copy} accessibilityLabel={accessibilityLabel ?? `${t("common.copy")} ${label ?? ""}`.trim()} scaleTo={0.92} style={{ width: HIT, height: HIT, alignItems: "center", justifyContent: "center" }}>
        <Icon size={18} color={done ? CHIP.success.fg : colors.text2} />
      </PressableScale>
    );
  return <ActionChip icon={<Icon size={17} color={done ? CHIP.success.fg : colors.text} />} label={text} onPress={copy} accessibilityLabel={accessibilityLabel ?? (label ? `${t("common.copy")} ${label}` : undefined)} />;
}

export function ShareButton({ message, label }: { message: string; label?: string }) {
  const t = useT();
  return (
    <ActionChip
      icon={<Share2 size={17} color={colors.text} />}
      label={label ?? t("mobileWallet.share")}
      onPress={() => {
        void Share.share({ message }).catch(() => {});
      }}
    />
  );
}

/** Reads the clipboard into a field (tx hash, destination address). */
export function PasteButton({ onPaste }: { onPaste: (text: string) => void }) {
  const t = useT();
  return (
    <PressableScale
      onPress={async () => {
        const s = await Clipboard.getStringAsync().catch(() => "");
        if (s) onPaste(s.trim());
      }}
      accessibilityLabel={t("mobileWallet.paste")}
      scaleTo={0.94}
      style={{ height: 34, paddingHorizontal: space[3], borderRadius: radius.pill, backgroundColor: colors.surface3, flexDirection: "row", alignItems: "center", gap: 6 }}
    >
      <ClipboardPaste size={15} color={colors.text} />
      <Text variant="caption" weight="700">
        {t("mobileWallet.paste")}
      </Text>
    </PressableScale>
  );
}

/** Pill-shaped secondary action with an icon (copy, share). */
export function ActionChip({ icon, label, onPress, accessibilityLabel }: { icon: React.ReactNode; label: string; onPress: () => void; accessibilityLabel?: string }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? label}
      style={{ flex: 1, height: HIT + 4, borderRadius: radius.pill, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.lineStrong, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space[2], paddingHorizontal: space[4] }}
    >
      {icon}
      <Text variant="callout" weight="700" numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}
