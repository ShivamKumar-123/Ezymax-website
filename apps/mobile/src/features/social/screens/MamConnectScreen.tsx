// /social/mam/connect/[id] — connect one of my live hedging accounts to a MAM programme (modal). The consent is
// explicit: the programme's current terms are shown in full and the link is sent with their SHA-256 hash
// (terms.hash from the server, exactly like the web); the engine refuses a stale hash (terms_changed) and
// stores the consent text, hash, IP and user agent. Max lot and equity stop are optional.
import * as React from "react";
import { View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, FileText } from "lucide-react-native";
import { useT } from "@/i18n";
import type { ApiError } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { invalidate, useQuery } from "@/lib/query";
import { RestrictionBanner } from "@/shell/RestrictionBanner";
import { useSession } from "@/session";
import { Banner, Button, ColorBlock, Display, FormError, Mono, Skeleton, Text } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { fetchers, keys, socialPost, validId, type Candidate, type LinkView, type ManagerDetail } from "../api";
import { ddText, mamFeesText, methodHint, methodLabel, parseAmount, pct, usd } from "../format";
import { ActionBar, FormScreen, ModalHeader, useBack } from "../components/chrome";
import { AmountField, Consent, RadioCard } from "../components/controls";
import { Avatar, RiskMeter } from "../components/identity";
import { Paragraphs, StatGrid } from "../components/primitives";
import { LoadError } from "../components/states";

export function MamConnectScreen() {
  const close = useBack("/social/mam");
  const { id } = useLocalSearchParams<{ id: string }>();
  const ok = validId(id);
  // never from the device cache: the terms (and their hash) must be the current ones
  const q = useQuery(ok ? keys.manager(id) : null, fetchers.manager(id ?? ""), { staleMs: 0 });
  const d = q.data;
  if (!ok || (!d && q.error)) {
    return (
      <FormScreen header={<ModalHeader onClose={close} />}>
        <LoadError error={ok ? q.error : { code: "not_found", message: "", status: 404 }} onRetry={() => void q.refresh()} onBack={close} />
      </FormScreen>
    );
  }
  if (!d) {
    return (
      <FormScreen header={<ModalHeader onClose={close} />}>
        <View style={{ gap: space[3] }}>
          <Skeleton w="50%" h={34} />
          <Skeleton h={80} r={22} />
          <Skeleton h={80} r={22} />
          <Skeleton h={180} r={16} />
        </View>
      </FormScreen>
    );
  }
  return <Form d={d} onClose={close} reload={() => q.refresh()} />;
}

function Form({ d, onClose, reload }: { d: ManagerDetail; onClose: () => void; reload: () => Promise<void> }) {
  const t = useT();
  const router = useRouter();
  const restricted = useSession((s) => s.restricted.includes("social"));
  const m = d.manager;
  const [login, setLogin] = React.useState<number | null>(() => d.accounts.find((a) => a.eligible)?.login ?? null);
  const [maxLot, setMaxLot] = React.useState("");
  const [equityStop, setEquityStop] = React.useState("");
  const [accept, setAccept] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<ApiError | null>(null);
  const [linked, setLinked] = React.useState<LinkView | null>(null);
  const hash = React.useRef(d.terms.hash);

  // new terms (after a terms_changed answer): the consent must be given again
  React.useEffect(() => {
    if (hash.current !== d.terms.hash) {
      hash.current = d.terms.hash;
      setAccept(false);
    }
  }, [d.terms.hash]);

  const chosen: Candidate | undefined = d.accounts.find((a) => a.login === login);
  const ml = parseAmount(maxLot);
  const es = parseAmount(equityStop);
  const maxLotErr = maxLot && !(ml !== null && ml >= 0.01 && ml <= 100) ? t("mobileSocial.connect.err.maxLot") : undefined;
  const stopErr = equityStop && !(es !== null && es > 0 && (!chosen || es < chosen.equity)) ? t("mobileSocial.connect.err.equityStop") : undefined;
  const invalid = !chosen || !!maxLotErr || !!stopErr || !accept || d.own;

  const submit = async () => {
    if (invalid || !chosen) return;
    setBusy(true);
    setErr(null);
    const body: Record<string, unknown> = { managerId: m.id, login: chosen.login, termsHash: d.terms.hash, accept: true };
    if (ml !== null) body.maxLot = ml;
    if (es !== null) body.equityStop = es;
    const r = await socialPost<{ link: LinkView }>("mam/links", body);
    setBusy(false);
    if (!r.ok) {
      haptic.error();
      setErr(r.error);
      if (r.error.code === "terms_changed") void reload();
      return;
    }
    haptic.success();
    invalidate("social:mam:");
    setLinked(r.data.link);
  };

  if (linked) {
    return (
      <FormScreen
        header={<ModalHeader onClose={onClose} />}
        footer={
          <ActionBar>
            <Button label={t("common.done")} variant="ghost" full={false} style={{ paddingHorizontal: space[5] }} onPress={onClose} />
            <Button
              label={t("mobileSocial.mam.details")}
              style={{ flex: 1 }}
              onPress={() => {
                router.back();
                router.push(`/social/mam/links/${linked.id}`);
              }}
            />
          </ActionBar>
        }
      >
        <Animated.View entering={FadeIn.duration(200)}>
          <ColorBlock color="periwinkle">
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", marginBottom: space[4] }}>
              <Check size={30} color={colors.periwinkle} strokeWidth={3} />
            </View>
            <Text variant="label" color={colors.ink2}>
              {m.name}
            </Text>
            <Display size="xl" color={colors.ink}>
              {t("mobileSocial.connect.done.title")}
            </Display>
            <Text color={colors.ink} style={{ marginTop: space[2], lineHeight: 21 }} testID="connect-result">
              {t("mobileSocial.connect.done.text", { login: linked.login, name: m.name })}
            </Text>
          </ColorBlock>
        </Animated.View>
      </FormScreen>
    );
  }

  return (
    <FormScreen
      header={<ModalHeader onClose={onClose} eyebrow={m.name} />}
      footer={
        <ActionBar>
          <Button testID="connect-grant" label={t("mobileSocial.connect.grant")} style={{ flex: 1 }} loading={busy} disabled={invalid || restricted} onPress={() => void submit()} />
        </ActionBar>
      }
    >
      <View style={{ gap: space[5] }}>
        <Display size="xl" accessibilityRole="header">
          {t("mobileSocial.connect.title")}
        </Display>
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: space[3], padding: space[4], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}
        >
          <Avatar name={m.nickname ?? m.name} size={48} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text variant="headline" weight="700" numberOfLines={1}>
              {m.name}
            </Text>
            <Text variant="caption" tone="tertiary" numberOfLines={2}>
              {t("mobileSocial.connect.sub", { name: m.nickname ?? t("mobileSocial.connect.theManager"), method: methodLabel(m.method, t), fees: mamFeesText(m, t) })}
            </Text>
          </View>
          {m.track ? <RiskMeter risk={m.track.riskScore} /> : null}
        </View>
        {m.track ? (
          <StatGrid
            columns={3}
            items={[
              { label: t("mobileSocial.mam.return1y"), value: pct(m.track.return1y, 1), tone: m.track.return1y > 0 ? "up" : m.track.return1y < 0 ? "down" : undefined },
              { label: t("mobileSocial.maxDd"), value: ddText(m.track.maxDd) },
              { label: t("common.accounts"), value: String(m.accounts) },
            ]}
          />
        ) : null}
        <Text variant="caption" tone="secondary">
          {methodHint(m.method, t)}
        </Text>
        {m.description ? <Text tone="secondary">{m.description}</Text> : null}
        <RestrictionBanner kinds={["social"]} />
        {d.own ? <Banner tone="info" title={t("mobileSocial.connect.own")} /> : null}

        <View style={{ gap: space[2] }}>
          <Text variant="label" tone="tertiary">
            {t("mobileSocial.connect.account")}
          </Text>
          {d.accounts.length === 0 ? (
            <View style={{ gap: space[3], padding: space[4], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
              <Text tone="secondary">{t("mobileSocial.connect.noLive")}</Text>
              <Button label={t("mobileSocial.connect.openAccount")} variant="secondary" size="md" onPress={() => router.push("/accounts/new")} />
            </View>
          ) : (
            <View style={{ gap: space[2] }} accessibilityRole="radiogroup">
              {d.accounts.map((a) => (
                <RadioCard
                  key={a.login}
                  testID={`connect-account-${a.login}`}
                  selected={login === a.login}
                  disabled={!a.eligible}
                  onPress={() => setLogin(a.login)}
                  title={`#${a.login}`}
                  text={a.eligible ? `${a.group} · ${t("mobileSocial.connect.positions", { count: a.positions })}` : (a.reason ?? "")}
                  right={
                    <Mono size={14} weight="bold">
                      {usd(a.equity)}
                    </Mono>
                  }
                />
              ))}
            </View>
          )}
        </View>

        <AmountField
          testID="connect-maxlot"
          label={t("mobileSocial.connect.maxLot")}
          value={maxLot}
          onChange={setMaxLot}
          unit={t("mobileSocial.lotsUnit")}
          placeholder={t("mobileSocial.noCap")}
          hint={t("mobileSocial.settings.emptyNoCap")}
          error={maxLotErr}
        />
        <AmountField
          testID="connect-stop"
          label={t("mobileSocial.connect.equityStop")}
          value={equityStop}
          onChange={setEquityStop}
          prefix="$"
          unit="USD"
          placeholder={t("common.off")}
          hint={t("mobileSocial.settings.emptyOff")}
          error={stopErr}
        />
        <Text variant="caption" tone="tertiary" style={{ lineHeight: 17 }}>
          {t("mobileSocial.connect.stopNote")}
        </Text>

        <View style={{ gap: space[2] }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
            <FileText size={16} color={colors.text3} />
            <Text variant="label" tone="tertiary">
              {t("mobileSocial.connect.terms")}
            </Text>
          </View>
          <View testID="mam-terms" style={{ padding: space[4], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
            <Paragraphs text={d.terms.text} />
          </View>
        </View>
        <Consent testID="connect-accept" checked={accept} onChange={setAccept}>
          {t("mobileSocial.connect.consent", { name: m.nickname ?? t("mobileSocial.connect.theManager"), account: chosen ? `#${chosen.login}` : t("mobileSocial.connect.theAccount") })}
        </Consent>
        <FormError message={err?.message} />
      </View>
    </FormScreen>
  );
}
