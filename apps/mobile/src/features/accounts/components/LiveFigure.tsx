// Account money that moves with prices, as leaf components. For the account the app trades on, the engine's equity
// frames (the trading core's live money, at most 4 a second) drive the figure; otherwise it is the last polled value
// (figures.ts). Either way only the number re-renders, never the row, the list or the screen.
import * as React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { useAccountLive, useTrade } from "@/features/trading/live";
import { useT } from "@/i18n";
import { fmtMoney } from "@/lib/format";
import { Banner, Mono } from "@/ui";
import { colors } from "@/theme/tokens";
import { useFigures, useFiguresOf, type Figures } from "../figures";
import { curOf, fitMono, fmtLevel, levelTone, money, toUsd } from "../format";
import type { Account } from "../types";
import { Tag } from "./Chrome";

export type LiveField = "equity" | "balance" | "freeMargin" | "margin" | "profit" | "marginLevel";

type Source = Pick<Account, "balance" | "equity" | "margin" | "freeMargin" | "marginLevel" | "profit">;

type Props = {
  a: Account;
  field: LiveField;
  size: number;
  /** fit the text into this width (points) by lowering the size, never below `min` */
  fit?: { width: number; min?: number };
  weight?: "regular" | "medium" | "bold";
  /** ink on a colour block; otherwise cream, or the money colours for P&L and a margin level at risk */
  ink?: boolean;
  /** line box as a multiple of `size` (the largest size, so a figure that shrinks to fit never moves what sits under it) */
  lineHeight?: number;
};

function textOf(a: Account, field: LiveField, src: Source): { value: string; color: string | undefined } {
  if (field === "marginLevel") {
    const tone = levelTone(src);
    return { value: fmtLevel(src), color: tone === "risk" ? colors.down : tone === "warn" ? colors.gold : undefined };
  }
  if (field === "profit") {
    const v = src.profit;
    return { value: money(v, a, { signed: true }), color: v > 0 ? colors.up : v < 0 ? colors.down : undefined };
  }
  return { value: money(src[field], a), color: undefined };
}

function Figure({ a, field, size, fit, weight = "medium", ink, lineHeight = 1.25, src }: Props & { src: Source }) {
  const t = textOf(a, field, src);
  const s = fit ? fitMono(t.value, fit.width, size, fit.min) : size;
  // the line box comes from the largest size: a live number that gets longer (and smaller to fit) keeps its height,
  // so nothing under it moves while it streams
  return (
    <Mono size={s} weight={weight} color={ink ? colors.ink : (t.color ?? colors.text)} numberOfLines={1} style={{ lineHeight: Math.round(size * lineHeight) }}>
      {t.value}
    </Mono>
  );
}

/** Any account: the last polled figures. */
function Polled(props: Props) {
  const polled = useFigures(props.a);
  return <Figure {...props} src={{ ...polled, balance: props.a.balance }} />;
}

/** The followed account: the stream's live money (the polled figures until the first frame). */
function Streaming(props: Props) {
  const polled = useFigures(props.a);
  const live = useAccountLive();
  const src: Source = live
    ? { balance: live.balance, equity: live.equity, margin: live.margin, freeMargin: live.freeMargin, marginLevel: live.marginLevel, profit: live.profit }
    : { ...polled, balance: props.a.balance };
  return <Figure {...props} src={src} />;
}

export const LiveFigure = React.memo(function LiveFigure(props: Props) {
  // the engine stream is open on this account (the trading core follows the active account only)
  const followed = useTrade((s) => s.login === props.a.login && s.status === "open");
  return followed ? <Streaming {...props} /> : <Polled {...props} />;
});

/* ---- leaf badges and blocks that depend on the polled figures ---- */

/** "Margin 1,240%" on an account card (nothing while no margin is used). */
export const MarginLevelTag = React.memo(function MarginLevelTag({ a }: { a: Account }) {
  const t = useT();
  const f = useFigures(a);
  const tone = levelTone(f);
  if (!tone) return null;
  return <Tag label={t("mobileAccounts.list.marginLevel", { value: fmtLevel(f) })} tone={tone === "ok" ? "outline" : tone} mono />;
});

/** The floating P&L on an account card. */
export const ProfitText = React.memo(function ProfitText({ a, size = 12.5 }: { a: Account; size?: number }) {
  const f = useFigures(a);
  const v = f.profit;
  return (
    <Mono size={size} weight="medium" tone={v > 0 ? "up" : v < 0 ? "down" : "secondary"} numberOfLines={1} style={{ flexShrink: 0 }}>
      {fmtMoney(v, { currency: curOf(a), signed: true })}
    </Mono>
  );
});

/** Health of the margin level for the margin section's heading. */
export const HealthTag = React.memo(function HealthTag({ a }: { a: Account }) {
  const t = useT();
  const f: Figures = useFigures(a);
  const tone = levelTone(f);
  if (f.marginCall || tone === "risk") return <Tag label={t("mobileAccounts.detail.health.risk")} tone="risk" />;
  if (tone === null) return <Tag label={t("mobileAccounts.detail.health.none")} tone="outline" />;
  // healthy reads neutral (cream): the block tones are ember-family now, and orange next to gold "Watch" and red
  // "At risk" would read as a warning
  if (tone === "ok") return <Tag label={t("mobileAccounts.detail.health.ok")} tone="cream" />;
  return <Tag label={t("mobileAccounts.detail.health.warn")} tone="warn" />;
});

/** The margin-call notice, shown only while the engine reports one. */
export const MarginCallBanner = React.memo(function MarginCallBanner({ a, style }: { a: Account; style?: StyleProp<ViewStyle> }) {
  const t = useT();
  const f = useFigures(a);
  if (!f.marginCall) return null;
  return <Banner tone="error" title={t("mobileAccounts.detail.marginCall", { level: fmtLevel(f) })} style={style} />;
});

/** Equity and free margin of several accounts in USD (cent accounts converted), from the polled figures. */
export function useTotals(accounts: Account[]) {
  const figs = useFiguresOf(accounts);
  let equity = 0;
  let free = 0;
  figs.forEach((f, i) => {
    const a = accounts[i]!;
    equity += toUsd(a, f.equity);
    free += toUsd(a, f.freeMargin);
  });
  return { equity, free };
}
