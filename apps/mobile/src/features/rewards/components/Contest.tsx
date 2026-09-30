// Contest pieces: the featured contest as a colour block (prize pool in huge type, time left, the reader's rank),
// a compact card for the others, the leaderboard row and the rank badge.
import * as React from "react";
import { View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { useT } from "@/i18n";
import { ColorBlock, Display, Mono, PressableScale, Text } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { Flip, Tag } from "../../partner/components/Chrome";
import { tint } from "../../partner/tint";
import { date, isPast, isRunning, isUpcoming, projectedPrize, scoreText, scoreTone, scoringLabel, statusLabel, tradesHint, usdShort } from "../format";
import type { Contest, ContestCard, Standing } from "../types";
import { Countdown } from "./Countdown";

export function KindTag({ kind, onColor }: { kind: Contest["kind"]; onColor?: boolean }) {
  const t = useT();
  if (onColor) return <Tag label={kind === "live" ? t("common.live") : t("common.demo")} tone="cream" />;
  return <Tag label={kind === "live" ? t("common.live") : t("common.demo")} tone={kind === "live" ? "ember" : "periwinkle"} />;
}

/** Gold / cream / ember for the podium, a quiet circle for the rest; "—" before a rank exists. */
export function RankBadge({ rank, size = 34 }: { rank: number | null; size?: number }) {
  const bg = rank === 1 ? colors.gold : rank === 2 ? colors.cream : rank === 3 ? colors.ember : colors.surface2;
  const ink = rank !== null && rank <= 3;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
      <Mono size={size > 36 ? 16 : 13} weight="bold" color={ink ? colors.ink : colors.text2}>
        {rank ?? "—"}
      </Mono>
    </View>
  );
}

/** The featured contest (running first, else the next to start). */
export const ContestBlock = React.memo(function ContestBlock({ c, onOpen, onWarm }: { c: ContestCard; onOpen: (id: number) => void; onWarm?: (id: number) => void }) {
  const t = useT();
  const running = isRunning(c);
  const me = c.myEntry;
  return (
    <ColorBlock color={c.kind === "live" ? "ember" : "periwinkle"} padded={false}>
      <PressableScale onPress={() => onOpen(c.id)} onPressIn={() => onWarm?.(c.id)} accessibilityLabel={`${c.name}, ${t("mobileRewards.contest.prizePool")} ${usdShort(c.prizePool)}`} testID={`contest-${c.id}`} style={{ padding: space[6], gap: space[4] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <KindTag kind={c.kind} onColor />
          <Text variant="label" color={colors.ink2} numberOfLines={1} style={{ flex: 1 }}>
            {running ? t("mobileRewards.contest.liveNow") : t("mobileRewards.contest.startsOn", { date: date(c.startsAt, false) })}
          </Text>
          <Flip>
            <ChevronRight size={20} color={colors.ink} />
          </Flip>
        </View>
        <Display size="lg" color={colors.ink} numberOfLines={2}>
          {c.name}
        </Display>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space[4] }}>
          <View style={{ gap: 2 }}>
            <Text variant="label" color={colors.ink2}>
              {t("mobileRewards.contest.prizePool")}
            </Text>
            <Mono size={34} weight="bold" color={colors.ink} numberOfLines={1} adjustsFontSizeToFit>
              {usdShort(c.prizePool)}
            </Mono>
          </View>
          <View style={{ alignItems: "flex-end", gap: 2 }}>
            <Text variant="label" color={colors.ink2}>
              {running ? t("mobileRewards.contest.endsIn") : t("mobileRewards.contest.startsIn")}
            </Text>
            <Countdown to={running ? c.endsAt : c.startsAt} size={17} color={colors.ink} />
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: space[4], paddingTop: space[3], borderTopWidth: 1, borderTopColor: tint.inkLine }}>
          <Mini label={t("mobileRewards.contest.rankedBy")} value={scoringLabel(t, c.scoring)} />
          <Mini label={t("mobileRewards.contest.entrants")} value={c.maxEntrants ? `${c.entrants} / ${c.maxEntrants}` : String(c.entrants)} />
          {me ? <Mini label={t("mobileRewards.contest.yourRank")} value={me.rank ? `#${me.rank}` : "—"} /> : <Mini label={t("mobileRewards.contest.prizes")} value={String(c.prizes.reduce((s, p) => s + (p.rankTo - p.rankFrom + 1), 0))} />}
        </View>
      </PressableScale>
    </ColorBlock>
  );
});

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
      <Text variant="label" color={colors.ink2} numberOfLines={1} style={{ fontSize: 10.5 }}>
        {label}
      </Text>
      <Text variant="callout" weight="700" color={colors.ink} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export const CONTEST_ROW_HEIGHT = 96;

/** Any other contest: kind, name, dates or time left, pool, and the reader's result when entered. */
export const ContestRow = React.memo(function ContestRow({ c, onOpen, onWarm }: { c: ContestCard; onOpen: (id: number) => void; onWarm?: (id: number) => void }) {
  const t = useT();
  const running = isRunning(c);
  const me = c.myEntry;
  const prize = me ? (isPast(c) ? projectedPrize(c, me) : me.prize) : null;
  return (
    <PressableScale onPress={() => onOpen(c.id)} onPressIn={() => onWarm?.(c.id)} scaleTo={0.985} accessibilityLabel={`${c.name}, ${statusLabel(t, c.status)}`} testID={`contest-${c.id}`} style={{ height: CONTEST_ROW_HEIGHT - space[3], borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: space[5], flexDirection: "row", alignItems: "center", gap: space[4] }}>
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <View style={{ flexDirection: "row", gap: space[2], alignItems: "center" }}>
          <KindTag kind={c.kind} />
          {/* a running contest says when it ends below; the others show their state */}
          {running ? null : <Tag label={statusLabel(t, c.status)} tone={isUpcoming(c) ? "outline" : "muted"} />}
        </View>
        <Text variant="headline" weight="700" numberOfLines={1}>
          {c.name}
        </Text>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {running ? t("mobileRewards.contest.endsOn", { date: date(c.endsAt) }) : isUpcoming(c) ? t("mobileRewards.contest.startsOn", { date: date(c.startsAt) }) : t("mobileRewards.contest.endedOn", { date: date(c.endsAt) })}
          {me ? ` · ${me.rank ? t("mobileRewards.contest.youAre", { rank: me.rank }) : t("mobileRewards.contest.joined")}` : ""}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Mono size={17} weight="bold" color={prize ? colors.up : colors.text}>
          {usdShort(prize ?? c.prizePool)}
        </Mono>
        <Text variant="caption" tone="tertiary">
          {prize ? t("mobileRewards.contest.yourPrize") : t("mobileRewards.contest.pool")}
        </Text>
      </View>
    </PressableScale>
  );
});

export const STANDING_ROW_HEIGHT = 68;

export const StandingRow = React.memo(function StandingRow({ c, s }: { c: Contest; s: Standing }) {
  const t = useT();
  const dq = s.status === "disqualified";
  const prize = projectedPrize(c, s);
  const tone = scoreTone(c, s);
  const hint = dq ? t("mobileRewards.status.disqualified") : tradesHint(t, c, s);
  return (
    <View style={{ height: STANDING_ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[5], backgroundColor: s.me ? tint.emberRow : undefined }} accessible accessibilityLabel={`${s.rank ? `#${s.rank}` : ""} ${s.name}${s.me ? ` (${t("mobileRewards.you")})` : ""}, ${scoreText(t, c, s)}`}>
      <RankBadge rank={dq ? null : s.rank} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Text variant="callout" weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>
            {s.name}
          </Text>
          {s.me ? <Tag label={t("mobileRewards.you")} tone="ember" /> : null}
        </View>
        <Text variant="caption" tone={hint ? "gold" : "tertiary"} numberOfLines={1}>
          {hint ?? [s.country?.toUpperCase(), t("mobileRewards.contest.trades", { count: s.trades }), s.me && s.login ? `#${s.login}` : null].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 3 }}>
        <Mono size={15} weight="bold" color={dq ? colors.text3 : tone === "up" ? colors.up : tone === "down" ? colors.down : colors.text}>
          {scoreText(t, c, s)}
        </Mono>
        {prize && !dq ? (
          <Text variant="caption" tone="gold">
            {usdShort(prize)}
          </Text>
        ) : null}
      </View>
    </View>
  );
});
