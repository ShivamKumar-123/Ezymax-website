// /algo/keys — API keys and webhooks, read-only with the safe changes: revoke a key, switch a webhook off / on, delete a
// webhook (its secret URL stops working at once). Creating them stays on the web (a key's secret and a webhook's URL
// are shown once, where they can be copied into trading tools), so this screen links there. Usage of the last 24 h
// and recent alerts with each account's result. The broker's "api" module switch applies (server side).
import * as React from "react";
import { Platform, Switch, View } from "react-native";
import { KeyRound, ShieldCheck, Webhook as WebhookIcon } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import type { ApiError } from "@/lib/api";
import { useQuery } from "@/lib/query";
import { Button, Card, ColorBlock, Display, FormError, Mono, Screen, Text, toast, type SheetRef } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { algoDelete, algoPatch, algoPost, fetchers, keys, refreshAlgo, type ApiKey, type Webhook, type WebhookEvent } from "../api";
import { Note, SectionTitle, Tag } from "../components/bits";
import { TopBar, Title } from "../components/chrome";
import { BlockSkeleton, LoadError, RowsSkeleton } from "../components/states";
import { ago, int, kindLabel } from "../format";
import { useBack, usePoll, useReadOnly } from "../hooks";
import { ConfirmSheet, type ConfirmSpec } from "../sheets/ConfirmSheet";
import { openClientArea } from "../web";

export function KeysScreen() {
  const t = useT();
  const back = useBack("/algo");
  const readOnly = useReadOnly();
  const keysQ = useQuery(keys.keys, fetchers.keys, { persist: true, staleMs: 10_000, intervalMs: usePoll(30_000) });
  const hooksQ = useQuery(keys.webhooks, fetchers.webhooks, { persist: true, staleMs: 10_000, intervalMs: usePoll(15_000) });
  const confirmRef = React.useRef<SheetRef>(null);
  const [confirm, setConfirm] = React.useState<ConfirmSpec | null>(null);
  const [toggling, setToggling] = React.useState<number | null>(null);
  const [toggleErr, setToggleErr] = React.useState<ApiError | null>(null);

  const refresh = React.useCallback(() => Promise.all([keysQ.refresh(), hooksQ.refresh()]), [keysQ, hooksQ]);
  const ask = (spec: ConfirmSpec) => {
    setConfirm(spec);
    requestAnimationFrame(() => confirmRef.current?.present());
  };

  const revoke = React.useCallback(
    (k: ApiKey) =>
      ask({
        title: t("mobileAlgo.keys.revokeTitle"),
        body: t("mobileAlgo.keys.revokeBody", { name: k.name, id: k.keyId }),
        confirm: t("mobileAlgo.keys.revoke"),
        danger: true,
        testID: "revoke-key",
        run: () => algoPost(`keys/${k.id}/revoke`, {}),
        onDone: () => {
          refreshAlgo();
          toast.show({ title: t("mobileAlgo.keys.revoked", { name: k.name }), tone: "success" });
        },
      }),
    [t],
  );
  const remove = React.useCallback(
    (h: Webhook) =>
      ask({
        title: t("mobileAlgo.hooks.deleteTitle"),
        body: t("mobileAlgo.hooks.deleteBody", { name: h.name }),
        confirm: t("mobileAlgo.hooks.delete"),
        danger: true,
        testID: "delete-hook",
        run: () => algoDelete(`webhooks/${h.id}`),
        onDone: () => {
          refreshAlgo();
          toast.show({ title: t("mobileAlgo.hooks.deleted", { name: h.name }), tone: "success" });
        },
      }),
    [t],
  );
  const toggle = React.useCallback(
    async (h: Webhook, on: boolean) => {
      setToggling(h.id);
      setToggleErr(null);
      const r = await algoPatch(`webhooks/${h.id}`, { status: on ? "active" : "disabled" });
      if (!r.ok) setToggleErr(r.error);
      await hooksQ.refresh();
      setToggling(null);
    },
    [hooksQ],
  );

  const blocking = !keysQ.data && !hooksQ.data ? (keysQ.error ?? hooksQ.error) : undefined;
  if (blocking) {
    return (
      <Screen scroll={false} tabBar={false}>
        <TopBar onBack={back} />
        <LoadError error={blocking} onRetry={() => void refresh()} onBack={back} style={{ flex: 1, justifyContent: "center" }} />
      </Screen>
    );
  }

  const k = keysQ.data;
  const h = hooksQ.data;
  const activeKeys = (k?.items ?? []).filter((x) => x.status === "active").length;
  // keys that still work first, revoked and expired ones after them (the server's order within each)
  const keyItems = k ? [...k.items].sort((a, b) => Number(b.status === "active") - Number(a.status === "active")) : [];

  return (
    <Screen tabBar={false} onRefresh={refresh} header={<TopBar onBack={back} />}>
      <View style={{ gap: space[8], paddingBottom: space[6] }} testID="keys-screen">
        <Title eyebrow={t("mobileAlgo.keys.eyebrow")} title={t("mobileAlgo.keys.title")} size="hero">
          <Text tone="secondary" style={{ marginTop: space[2] }}>
            {t("mobileAlgo.keys.subtitle")}
          </Text>
        </Title>

        {k ? (
          <ColorBlock color="cream" style={{ marginHorizontal: GUTTER, gap: space[4] }} testID="keys-usage">
            <View style={{ gap: 2 }}>
              <Text variant="label" color={colors.ink2}>
                {t("mobileAlgo.keys.requests24h")}
              </Text>
              <Display size="hero" color={colors.ink} style={{ fontSize: 64, lineHeight: 66 }}>
                {int(k.usage.requests24h)}
              </Display>
            </View>
            <View style={{ flexDirection: "row", gap: space[3] }}>
              <InkStat label={t("mobileAlgo.keys.errors")} value={int(k.usage.errors24h)} />
              <InkStat label={t("mobileAlgo.keys.limited")} value={int(k.usage.rateLimited24h)} />
              <InkStat label={t("mobileAlgo.keys.p50")} value={`${Math.round(k.usage.p50)} ms`} />
              <InkStat label={t("mobileAlgo.keys.writes")} value={int(k.usage.writes24h)} />
            </View>
          </ColorBlock>
        ) : (
          <BlockSkeleton height={190} />
        )}

        <View style={{ gap: space[3] }}>
          <SectionTitle title={t("mobileAlgo.keys.keys")} sub={k ? t("mobileAlgo.keys.keysSub", { n: activeKeys }) : undefined} />
          <View style={{ paddingHorizontal: GUTTER, gap: space[3] }}>
            {!k ? (
              keysQ.error ? (
                <Text tone="tertiary">{keysQ.error.message}</Text>
              ) : (
                <RowsSkeleton rows={2} />
              )
            ) : keyItems.length ? (
              keyItems.map((x) => <KeyCard key={x.id} k={x} readOnly={readOnly} onRevoke={revoke} />)
            ) : (
              <Empty icon={<KeyRound size={20} color={colors.text3} />} text={t("mobileAlgo.keys.none")} />
            )}
          </View>
        </View>

        <View style={{ gap: space[3] }}>
          <SectionTitle title={t("mobileAlgo.hooks.title")} sub={h ? t("mobileAlgo.hooks.sub", { n: h.items.length }) : undefined} />
          <View style={{ paddingHorizontal: GUTTER, gap: space[3] }}>
            <FormError message={toggleErr?.message} />
            {!h ? (
              hooksQ.error ? (
                <Text tone="tertiary">{hooksQ.error.message}</Text>
              ) : (
                <RowsSkeleton rows={2} />
              )
            ) : h.items.length ? (
              h.items.map((x) => <HookCard key={x.id} h={x} readOnly={readOnly} busy={toggling === x.id} onToggle={toggle} onDelete={remove} />)
            ) : (
              <Empty icon={<WebhookIcon size={20} color={colors.text3} />} text={t("mobileAlgo.hooks.none")} />
            )}
          </View>
        </View>

        {h && h.events.length ? (
          <View style={{ gap: space[3] }}>
            <SectionTitle title={t("mobileAlgo.hooks.alerts")} sub={t("mobileAlgo.hooks.alertsSub")} />
            <Card style={{ marginHorizontal: GUTTER, paddingVertical: space[1] }}>
              {h.events.slice(0, 12).map((e, i, arr) => (
                <EventRow key={e.id} e={e} hook={h.items.find((x) => x.id === e.webhookId)?.name} last={i === arr.length - 1} />
              ))}
            </Card>
          </View>
        ) : null}

        <View style={{ paddingHorizontal: GUTTER, gap: space[4] }}>
          <Card style={{ gap: space[3] }}>
            <View style={{ flexDirection: "row", gap: space[2], alignItems: "center" }}>
              <ShieldCheck size={18} color={colors.gold} />
              <Text variant="headline" weight="700">
                {t("mobileAlgo.keys.webTitle")}
              </Text>
            </View>
            <Text tone="secondary">{t("mobileAlgo.keys.webBody")}</Text>
            {readOnly ? null : <Button testID="keys-open-web" label={t("mobileAlgo.keys.openWeb")} variant="secondary" size="md" full={false} onPress={() => openClientArea("/developer")} />}
          </Card>
          <Note>{t("mobileAlgo.keys.killHint")}</Note>
        </View>
      </View>
      <ConfirmSheet ref={confirmRef} spec={confirm} />
    </Screen>
  );
}

function InkStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <Mono size={16} weight="bold" color={colors.ink} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Mono>
      <Text variant="label" color={colors.ink2} numberOfLines={2} style={{ fontSize: 9.5, letterSpacing: 0.6 }}>
        {label}
      </Text>
    </View>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={{ flexDirection: "row", gap: space[3], alignItems: "center", padding: space[5], borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, borderStyle: "dashed" }}>
      {icon}
      <Text tone="secondary" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

const KeyCard = React.memo(function KeyCard({ k, readOnly, onRevoke }: { k: ApiKey; readOnly: boolean; onRevoke: (k: ApiKey) => void }) {
  const t = useT();
  const f = useFormat();
  const active = k.status === "active";
  return (
    <Card style={{ gap: space[3], opacity: active ? 1 : 0.7 }} testID={`key-${k.id}`}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <Text variant="headline" weight="700" numberOfLines={1} style={{ flex: 1 }}>
          {k.name}
        </Text>
        <Tag compact tone={active ? "gold" : "neutral"} dot={active} label={t.dyn(`mobileAlgo.keys.status.${k.status}`, k.status)} />
      </View>
      <Mono size={13} tone="secondary" selectable>
        {k.keyId}
      </Mono>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        <Tag compact tone="cream" label={`${kindLabel(t, k.accountType)} ${k.login}`} />
        {k.scopes.map((s) => (
          <Tag key={s} compact tone={s === "trade" ? "ember" : "neutral"} label={t.dyn(`mobileAlgo.keys.scope.${s}`, s)} />
        ))}
      </View>
      <View style={{ gap: 2 }}>
        <Text variant="caption" tone="tertiary">
          {k.ipWhitelist.length ? t("mobileAlgo.keys.ips", { ips: k.ipWhitelist.join(", ") }) : t("mobileAlgo.keys.anyIp")}
        </Text>
        <Text variant="caption" tone="tertiary">
          {[k.expiresAt ? t("mobileAlgo.keys.expires", { date: f.date(k.expiresAt) }) : t("mobileAlgo.keys.noExpiry"), t("mobileAlgo.keys.lastUsed", { ago: ago(t, f, k.lastUsedAt) }) + (k.lastIp ? ` · ${k.lastIp}` : "")].join(" · ")}
        </Text>
      </View>
      {active && !readOnly ? <Button testID={`key-${k.id}-revoke`} label={t("mobileAlgo.keys.revoke")} variant="danger" size="sm" full={false} onPress={() => onRevoke(k)} /> : null}
    </Card>
  );
});

const HookCard = React.memo(function HookCard({ h, readOnly, busy, onToggle, onDelete }: { h: Webhook; readOnly: boolean; busy: boolean; onToggle: (h: Webhook, on: boolean) => void; onDelete: (h: Webhook) => void }) {
  const t = useT();
  const f = useFormat();
  const on = h.status === "active";
  return (
    <Card style={{ gap: space[3] }} testID={`hook-${h.id}`}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="headline" weight="700" numberOfLines={1}>
            {h.name}
          </Text>
          <Text variant="caption" tone="tertiary" numberOfLines={2}>
            {[t("mobileAlgo.hooks.hint", { hint: h.tokenHint }), t("mobileAlgo.hooks.accounts", { count: h.routes ?? 0 }), t("mobileAlgo.hooks.today", { count: h.events24h ?? 0 }), t("mobileAlgo.hooks.used", { ago: ago(t, f, h.lastUsedAt) })].join(" · ")}
          </Text>
        </View>
        {readOnly ? (
          <Tag compact tone={on ? "gold" : "neutral"} label={on ? t("mobileAlgo.hooks.on") : t("mobileAlgo.hooks.off")} />
        ) : (
          <Switch
            testID={`hook-${h.id}-switch`}
            value={on}
            disabled={busy}
            onValueChange={(v) => onToggle(h, v)}
            accessibilityLabel={t("mobileAlgo.hooks.switch", { name: h.name })}
            trackColor={{ false: colors.surface3, true: colors.ember }}
            thumbColor={Platform.OS === "ios" ? undefined : colors.cream}
            ios_backgroundColor={colors.surface3}
            {...(Platform.OS === "web" ? ({ activeThumbColor: colors.cream } as object) : null)}
          />
        )}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        <Tag compact tone={h.passphrase ? "sand" : "warn"} label={h.passphrase ? t("mobileAlgo.hooks.passphrase") : t("mobileAlgo.hooks.noPassphrase")} />
      </View>
      {readOnly ? null : <Button testID={`hook-${h.id}-delete`} label={t("mobileAlgo.hooks.delete")} variant="danger" size="sm" full={false} onPress={() => onDelete(h)} />}
    </Card>
  );
});

const EVENT_TONE: Record<string, "gold" | "warn" | "neutral"> = { accepted: "gold", partial: "warn", received: "neutral" };

function EventRow({ e, hook, last }: { e: WebhookEvent; hook?: string; last: boolean }) {
  const t = useT();
  const f = useFormat();
  const p = e.payload ?? {};
  const alert = [String(p.action ?? "?").toUpperCase(), String(p.symbol ?? ""), p.volume !== undefined ? String(p.volume) : ""].filter(Boolean).join(" ");
  const results = e.results.map((r) => `${r.login}: ${t.dyn(`mobileAlgo.hooks.result.${r.status}`, r.status)}${r.error ? ` (${r.error})` : ""}`).join(" · ");
  return (
    <View style={{ paddingVertical: space[3], gap: 4, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.line }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <Mono size={13} weight="bold" style={{ flex: 1 }} numberOfLines={1}>
          {alert}
        </Mono>
        <Tag compact tone={EVENT_TONE[e.status] ?? "warn"} label={t.dyn(`mobileAlgo.hooks.status.${e.status}`, e.status)} />
      </View>
      <Text variant="caption" tone="tertiary" numberOfLines={1}>
        {[f.dateTime(e.receivedAt), hook, e.ip].filter(Boolean).join(" · ")}
      </Text>
      {e.error || results ? (
        <Text variant="caption" tone="secondary" numberOfLines={3}>
          {e.error ?? results}
        </Text>
      ) : null}
    </View>
  );
}

export default KeysScreen;
