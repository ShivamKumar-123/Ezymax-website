// Profile › Verification (/profile/verification): the KYC status tracker, or the verification flow when there is
// something to do (start, a draft in progress, more information requested). Opens on the saved state and polls
// every 15 s while the case is with the review team.
import * as React from "react";
import { View } from "react-native";
import { Eye } from "lucide-react-native";
import { useT } from "@/i18n";
import { Banner, Skeleton, toast } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { LoadState, OfflineHint, SectionHeader, StatusChip } from "./components/bits";
import { StackScreen, type ScrollHandle } from "./components/StackScreen";
import { useMeX, useReadOnly } from "./me";
import { applyKyc, hoursLabel, useKyc } from "./kyc/api";
import { Levels, StatusTracker } from "./kyc/Status";
import type { KycState } from "./kyc/types";
import { MoreInfo, StartPanel, Wizard } from "./kyc/Wizard";

function KycSkeleton() {
  const t = useT();
  return (
    <View style={{ paddingHorizontal: GUTTER, gap: space[4] }} accessibilityLabel={t("common.loading")} accessible>
      <Skeleton h={280} r={radius.block} />
      <Skeleton w="60%" h={18} />
      <Skeleton h={64} r={radius.md} />
      <Skeleton h={64} r={radius.md} />
      <Skeleton h={64} r={radius.md} />
    </View>
  );
}

export default function VerificationScreen() {
  const t = useT();
  const me = useMeX();
  const readOnly = useReadOnly();
  const [poll, setPoll] = React.useState<number | undefined>(undefined);
  const q = useKyc(poll);
  const data = q.data;
  const [justSubmitted, setJustSubmitted] = React.useState(false);
  const [restart, setRestart] = React.useState(false);
  const scroll = React.useRef<ScrollHandle | null>(null);
  const status = data?.case?.status;

  React.useEffect(() => {
    setPoll(status === "submitted" || status === "in_review" ? 15_000 : undefined);
  }, [status]);

  const toTop = React.useCallback(() => scroll.current?.scrollTo({ y: 0, animated: true }), []);

  const mode: "loading" | "error" | "start" | "wizard" | "more_info" | "tracker" = !data
    ? q.error
      ? "error"
      : "loading"
    : !data.case || (restart && data.can_start)
      ? "start"
      : data.case.status === "draft"
        ? "wizard"
        : data.case.status === "more_info"
          ? "more_info"
          : "tracker";

  const submitted = React.useCallback(
    (s: KycState) => {
      applyKyc(s, true);
      setJustSubmitted(true);
      toTop();
      toast.show({ title: t("kyc.toast.submitted"), body: t("kyc.toast.submittedDesc", { hours: hoursLabel(t, s.review.typical_hours) }), tone: "success" });
    },
    [t, toTop],
  );

  return (
    <StackScreen
      eyebrow={t("mobileProfile.kyc.eyebrow")}
      title={t("kyc.page.title")}
      subtitle={mode === "loading" ? t("kyc.page.subtitle") : undefined}
      titleRight={data?.case && mode !== "start" ? <StatusChip label={data.case.reference} tone={data.case.status === "approved" ? "ok" : data.case.status === "rejected" ? "ember" : "neutral"} dot={false} /> : undefined}
      onRefresh={q.refresh}
      keyboard={mode === "wizard" || mode === "more_info"}
      scrollRef={scroll}
      testID="screen-verification"
    >
      {readOnly ? (
        <View style={{ paddingHorizontal: GUTTER, marginBottom: space[4] }}>
          <Banner tone="info" icon={<Eye size={18} color={colors.periwinkle} />} title={t("mobileProfile.readOnly.title")} body={t("mobileProfile.readOnly.body")} />
        </View>
      ) : null}
      {data ? <OfflineHint /> : null}
      {mode === "loading" ? (
        <KycSkeleton />
      ) : mode === "error" ? (
        <LoadState error={q.error} onRetry={() => void q.refresh()} />
      ) : mode === "start" ? (
        <StartPanel
          state={data!}
          readOnly={readOnly}
          onStarted={(s) => {
            setRestart(false);
            applyKyc(s, true);
            toTop();
          }}
        />
      ) : mode === "wizard" ? (
        <Wizard key={data!.case!.id} state={data!} onSubmitted={submitted} onStep={toTop} />
      ) : mode === "more_info" ? (
        <MoreInfo key={data!.case!.id} state={data!} onSubmitted={submitted} />
      ) : (
        <StatusTracker
          state={data!}
          justSubmitted={justSubmitted}
          readOnly={readOnly}
          onRestart={() => {
            setRestart(true);
            toTop();
          }}
        />
      )}
      {mode === "start" || mode === "tracker" ? (
        <>
          <SectionHeader title={t("mobileProfile.kyc.levelsTitle")} />
          <Levels state={data ?? null} emailVerified={me?.email_verified !== false} />
        </>
      ) : null}
    </StackScreen>
  );
}
