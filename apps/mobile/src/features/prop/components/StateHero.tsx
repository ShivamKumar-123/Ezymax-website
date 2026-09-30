// The big moments of a challenge: breached (prop challenge art), passed or funded (prop passed art), still
// opening, payment failed, closed (the engine wouldn't open the next account, e.g. the broker's account limit: the
// service refunds the fee and closes the challenge). Warnings while trading (daily loss used, weekend close) are
// quieter banners.
import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { AlertTriangle, CalendarClock } from "lucide-react-native";
import { i18n, useT } from "@/i18n";
import { Banner, Button, ColorBlock, Display, Illustration, Text } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { fmtDate, fmtDateTime, usd } from "../format";
import type { View as RuleView } from "../rules";
import { ruleLabel, tradable } from "../rules";
import type { Certificate, ChallengeDetail, PhaseAccount } from "../types";
import { inkSoft } from "./bits";

/**
 * Why the phase failed. The service writes it in English with the numbers ("Daily loss limit reached: equity
 * 4835.00 ≤ 4850.00 …"): shown as is to English readers, others get the rule's name in their language.
 */
function reasonOf(t: ReturnType<typeof useT>, c: ChallengeDetail, a: PhaseAccount): string {
  const ev = c.events.find((e) => e.accountId === a.id && e.severity === "breach");
  const code = a.endReason && /^[a-z_]+$/.test(a.endReason) ? a.endReason : ev?.rule ?? null;
  if (i18n.locale === "en") {
    if (ev?.message) return ev.message;
    if (c.failureReason && c.current?.id === a.id) return c.failureReason;
  }
  if (code) return t("mobileProp.hero.failed.rule", { rule: ruleLabel(t, code) });
  return a.endReason ?? t("mobileProp.hero.failed.ruleBreached");
}

function StateHero({ c, a, onCertificate, onPhase }: { c: ChallengeDetail; a: PhaseAccount; onCertificate: (cert: Certificate) => void; onPhase: (phaseIndex: number) => void }) {
  const t = useT();
  const router = useRouter();

  if (c.status === "payment_failed")
    return (
      <ColorBlock color="cream" style={{ marginHorizontal: GUTTER, gap: space[3] }}>
        <Display size="md" color={colors.ink}>
          {t("mobileProp.status.paymentFailed")}
        </Display>
        <Text variant="callout" color={inkSoft}>
          {c.failureReason ?? t("mobileProp.error.paymentFailed")}
        </Text>
      </ColorBlock>
    );

  // closed with the account still unopened: the service gave up on it and refunded the fee (never "opening")
  if (c.status === "closed" && (a.status === "provisioning" || !a.login))
    return (
      <ColorBlock color="cream" style={{ marginHorizontal: GUTTER, gap: space[3] }}>
        <Display size="md" color={colors.ink}>
          {t("mobileProp.hero.closed.title")}
        </Display>
        <Text variant="callout" color={inkSoft}>
          {c.failureReason && i18n.locale === "en" ? t("mobileProp.hero.closed.reason", { reason: c.failureReason.replace(/\.$/, "") }) : t("mobileProp.hero.closed.body")}
        </Text>
        <Button label={t("mobileProp.action.support")} onPress={() => router.push("/support")} full={false} size="md" variant="secondary" style={{ backgroundColor: colors.ink, borderColor: colors.ink }} />
      </ColorBlock>
    );

  if (a.status === "provisioning" || c.status === "provisioning" || c.status === "pending_payment")
    return (
      <ColorBlock color="periwinkle" style={{ marginHorizontal: GUTTER, gap: space[3] }}>
        <Display size="md" color={colors.ink}>
          {t("mobileProp.hero.opening.title")}
        </Display>
        <Text variant="callout" color={inkSoft}>
          {t("mobileProp.hero.opening.body")}
        </Text>
      </ColorBlock>
    );

  if (a.status === "failed")
    return (
      <View style={{ marginHorizontal: GUTTER, borderRadius: radius.block, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: space[6], gap: space[3], alignItems: "center" }} accessibilityRole="alert">
        <Illustration name="propChallenge" width={220} height={170} />
        <Display size="lg" align="center">
          {t("mobileProp.hero.failed.title", { phase: a.phase })}
        </Display>
        {a.endedAt ? (
          <Text tone="secondary" align="center">
            {t("mobileProp.hero.failed.on", { date: fmtDateTime(a.endedAt) })}
          </Text>
        ) : null}
        <Text variant="callout" tone="secondary" align="center">
          {t("mobileProp.hero.failed.body", { reason: reasonOf(t, c, a) })}
        </Text>
        <Button label={t("mobileProp.hero.failed.new")} onPress={() => router.navigate("/prop")} full={false} size="md" style={{ marginTop: space[2] }} />
      </View>
    );

  if (a.status === "passed") {
    const cert = c.certificates.find((x) => !x.revoked && x.kind === "pass" && x.phase === a.phase);
    const next = c.current && c.current.id !== a.id ? c.current : null;
    return (
      <ColorBlock color="mint" style={{ marginHorizontal: GUTTER, gap: space[3], alignItems: "center" }}>
        <Illustration name="propPassed" width={220} height={170} />
        <Display size="lg" color={colors.ink} align="center">
          {t("mobileProp.hero.passed.title", { phase: a.phase })}
        </Display>
        <Text variant="callout" color={inkSoft} align="center">
          {a.endedAt ? t("mobileProp.hero.passed.on", { date: fmtDate(a.endedAt) }) + " " : ""}
          {next ? (next.login ? t("mobileProp.hero.passed.nextLogin", { phase: next.phase, login: next.login }) : t("mobileProp.hero.passed.next", { phase: next.phase })) : t("mobileProp.hero.passed.opening")}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space[2], marginTop: space[1] }}>
          {cert ? <Button label={t("mobileProp.hero.passed.certificate")} onPress={() => onCertificate(cert)} full={false} size="md" variant="secondary" style={{ backgroundColor: colors.ink, borderColor: colors.ink }} /> : null}
          {next ? <Button label={t("mobileProp.hero.passed.goNext", { phase: next.phase })} onPress={() => onPhase(next.phaseIndex)} full={false} size="md" variant="cream" /> : null}
        </View>
      </ColorBlock>
    );
  }

  if (a.funded && c.status === "funded" && a.status === "active") {
    const cert = c.certificates.find((x) => !x.revoked && x.kind === "funded");
    return (
      <ColorBlock color="gold" style={{ marginHorizontal: GUTTER, gap: space[3], flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1, gap: space[2] }}>
          <Display size="lg" color={colors.ink}>
            {t("mobileProp.hero.funded.title")}
          </Display>
          <Text variant="callout" color={inkSoft}>
            {t("mobileProp.hero.funded.body", { split: c.split })}
          </Text>
          {cert ? (
            <Text variant="callout" weight="700" color={colors.ink} onPress={() => onCertificate(cert)} accessibilityRole="link" style={{ paddingVertical: space[2] }}>
              {t("mobileProp.hero.funded.certificate")}
            </Text>
          ) : null}
        </View>
        <Illustration name="propPassed" width={110} height={96} />
      </ColorBlock>
    );
  }
  return null;
}

/** Quiet warnings while the account trades. */
function Warnings({ c, a, v }: { c: ChallengeDetail; a: PhaseAccount; v: RuleView }) {
  const t = useT();
  if (!tradable(c, a)) return null;
  const items: React.ReactNode[] = [];
  const used = v.dailyLimit > 0 ? v.dailyUsed / v.dailyLimit : 0;
  if (v.live && used >= 0.5)
    items.push(
      <Banner
        key="loss"
        tone="warn"
        icon={<AlertTriangle size={18} color={colors.gold} />}
        title={t("mobileProp.warn.lossUsed", { pct: Math.round(used * 100) })}
        body={t("mobileProp.warn.lossUsedBody", { floor: usd(v.dailyFloor), left: usd(Math.max(0, v.dailyLimit - v.dailyUsed)) })}
      />,
    );
  if (v.weekendWindow && !c.plan.weekendHolding)
    items.push(<Banner key="wk" tone="info" icon={<CalendarClock size={18} color={colors.text2} />} title={t("mobileProp.warn.weekend")} body={t("mobileProp.warn.weekendBody")} />);
  if (!items.length) return null;
  return <View style={{ marginHorizontal: GUTTER, gap: space[2] }}>{items}</View>;
}

const StateHeroMemo = React.memo(StateHero);
export { StateHeroMemo as StateHero };

const WarningsMemo = React.memo(Warnings);
export { WarningsMemo as Warnings };
