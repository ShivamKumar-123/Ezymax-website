// /wallet: balances (huge number on a cream block), Deposit / Withdraw / Transfer, what is in progress (deposits
// confirming, withdrawals in review), the live trading accounts to fund, and the latest activity. Opens on the
// cached overview, refreshes in the background and every 15 s while on screen; pull to refresh.
import * as React from "react";
import { View } from "react-native";
import { useIsFocused, useRouter } from "expo-router";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, History } from "lucide-react-native";
import { useT } from "@/i18n";
import { useMe, useSession } from "@/session";
import { RestrictionBanner } from "@/shell/RestrictionBanner";
import { Button, Card, ColorBlock, Display, Divider, EmptyState, IconButton, Mono, PressableScale, Screen, Skeleton, Text } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { accountCurrencyPrefix, CHAIN_LABEL, prefetchWallet, toUsd, usdtBalance, useOverview, useRecentActivity, useTradingAccounts, type ActivityItem, type Balance, type Overview, type TradingAccount } from "../api";
import { ActivityRow, ActivitySkeleton } from "../components/ActivityRow";
import { ActivitySheet, type ActivitySheetHandle } from "../components/ActivitySheet";
import { Confirmations, DEPOSIT_STATUS, SectionTitle, StatusChip, WITHDRAWAL_STATUS } from "../components/parts";
import { HeroSkeleton, KycNotice, ViewOnlyNotice, WalletState } from "../components/states";
import { WalletHeader } from "../components/WalletHeader";
import { fmtAmount } from "../lib/money";

/** Display size for a big number so it stays on one line. */
const heroSize = (s: string) => (s.length > 12 ? "lg" : s.length > 9 ? "xl" : "hero");

function BalanceHero({ b }: { b: Balance }) {
  const t = useT();
  const available = fmtAmount(b.available);
  const total = Number(b.available) + Number(b.locked);
  return (
    <ColorBlock color="cream" style={{ marginHorizontal: GUTTER }} testID="wallet-balance">
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text variant="label" color={colors.ink2}>
          {t("mobileWallet.balance.available")}
        </Text>
        <View style={{ height: 26, paddingHorizontal: space[3], borderRadius: radius.pill, backgroundColor: colors.ink, justifyContent: "center" }}>
          <Text variant="caption" weight="700" color={colors.cream}>
            {b.currency}
          </Text>
        </View>
      </View>
      <Display size={heroSize(available)} color={colors.ink} style={{ marginTop: space[3] }} numberOfLines={1} accessibilityLabel={`${available} ${b.currency}`}>
        {available}
      </Display>
      <Text variant="caption" color={colors.ink2} style={{ marginTop: space[1] }}>
        {t("wallet.transfer.creditedNote")}
      </Text>
      <View style={{ height: 1, backgroundColor: "rgba(14,14,16,0.12)", marginVertical: space[4] }} />
      <View style={{ flexDirection: "row", gap: space[8] }}>
        <View style={{ gap: 2 }}>
          <Text variant="label" color={colors.ink3}>
            {t("wallet.inProgress")}
          </Text>
          <Mono size={17} weight="bold" color={colors.ink}>
            {fmtAmount(b.locked)}
          </Mono>
        </View>
        <View style={{ gap: 2 }}>
          <Text variant="label" color={colors.ink3}>
            {t("common.total")}
          </Text>
          <Mono size={17} weight="bold" color={colors.ink}>
            {fmtAmount(total)}
          </Mono>
        </View>
      </View>
    </ColorBlock>
  );
}

function QuickActions() {
  const t = useT();
  const router = useRouter();
  const items = [
    { key: "deposit", label: t("common.deposit"), Icon: ArrowDownToLine, href: "/wallet/deposit", warm: prefetchWallet.deposit, primary: true },
    { key: "withdraw", label: t("common.withdraw"), Icon: ArrowUpFromLine, href: "/wallet/withdraw", warm: prefetchWallet.withdraw, primary: false },
    { key: "transfer", label: t("common.transfer"), Icon: ArrowLeftRight, href: "/wallet/transfer", warm: prefetchWallet.transfer, primary: false },
  ] as const;
  return (
    <View style={{ flexDirection: "row", gap: space[3], paddingHorizontal: GUTTER, marginTop: space[3] }}>
      {items.map(({ key, label, Icon, href, warm, primary }) => (
        <PressableScale
          key={key}
          testID={`wallet-action-${key}`}
          accessibilityLabel={label}
          onPressIn={warm}
          onPress={() => router.push(href)}
          style={{ flex: 1, height: 108, borderRadius: radius.card, padding: space[4], justifyContent: "space-between", backgroundColor: primary ? colors.ember : colors.surface, borderWidth: primary ? 0 : 1, borderColor: colors.line }}
        >
          <Icon size={24} color={primary ? colors.ink : colors.text} strokeWidth={2} />
          <Display size="xs" color={primary ? colors.ink : colors.text} numberOfLines={1}>
            {label}
          </Display>
        </PressableScale>
      ))}
    </View>
  );
}

function InProgress({ o }: { o: Overview }) {
  const t = useT();
  const router = useRouter();
  if (!o.pending_deposits.length && !o.open_withdrawals.length) return null;
  return (
    <>
      <SectionTitle title={t("wallet.inProgress")} />
      <Card padded={false} style={{ marginHorizontal: GUTTER }}>
        {o.pending_deposits.map((d, i) => {
          const st = DEPOSIT_STATUS[d.status];
          return (
            <View key={`d${d.id}`}>
              {i > 0 ? <Divider /> : null}
              <PressableScale
                scaleTo={0.985}
                onPressIn={() => (d.intent_id ? prefetchWallet.intent(d.intent_id) : prefetchWallet.history())}
                onPress={() => router.push(d.intent_id ? `/wallet/deposit?intent=${d.intent_id}` : "/wallet/history?type=deposit")}
                style={{ padding: space[4], gap: space[3] }}
                testID={`pending-deposit-${d.id}`}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
                  <Text variant="callout" weight="600" style={{ flex: 1 }} numberOfLines={1}>
                    {t("wallet.depositLine", { network: CHAIN_LABEL[d.chain].short })}
                  </Text>
                  <Mono size={15} weight="bold" tone="up">
                    {`+${fmtAmount(d.amount ?? d.expected_amount)}`}
                  </Mono>
                </View>
                {st ? <StatusChip compact tone={st.tone} label={t(st.label)} /> : null}
                {d.status !== "review" ? <Confirmations done={d.confirmations} required={d.required_confirmations} pending={d.status === "pending"} /> : null}
              </PressableScale>
            </View>
          );
        })}
        {o.open_withdrawals.map((w, i) => {
          const st = WITHDRAWAL_STATUS[w.status];
          return (
            <View key={`w${w.id}`}>
              {i > 0 || o.pending_deposits.length > 0 ? <Divider /> : null}
              <PressableScale scaleTo={0.985} onPressIn={prefetchWallet.withdraw} onPress={() => router.push("/wallet/withdraw")} style={{ padding: space[4], gap: space[2] }} testID={`open-withdrawal-${w.id}`}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
                  <Text variant="callout" weight="600" style={{ flex: 1 }} numberOfLines={1}>
                    {t("wallet.withdrawalLine", { network: CHAIN_LABEL[w.chain].short })}
                  </Text>
                  <Mono size={15} weight="bold">{`−${fmtAmount(w.amount)}`}</Mono>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], flexWrap: "wrap" }}>
                  {st ? <StatusChip compact tone={st.tone} label={t(st.label)} /> : null}
                  <Text variant="caption" tone="tertiary" style={{ flexShrink: 1 }}>
                    {t("wallet.progress.withdrawalNet", { net: fmtAmount(w.net_amount), fee: fmtAmount(w.fee) })}
                  </Text>
                </View>
              </PressableScale>
            </View>
          );
        })}
      </Card>
    </>
  );
}

function OtherAssets({ balances }: { balances: Balance[] }) {
  const t = useT();
  const others = balances.filter((b) => b.currency !== "USDT" && (Number(b.available) > 0 || Number(b.locked) > 0));
  if (!others.length) return null;
  return (
    <>
      <SectionTitle title={t("mobileWallet.balance.otherAssets")} />
      <Card padded={false} style={{ marginHorizontal: GUTTER }}>
        {others.map((b, i) => (
          <View key={b.currency}>
            {i > 0 ? <Divider /> : null}
            <View style={{ minHeight: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: space[4], gap: space[3] }}>
              <Text variant="headline" weight="700" style={{ flex: 1 }}>
                {b.currency}
              </Text>
              <View style={{ alignItems: "flex-end" }}>
                <Mono size={15} weight="bold">
                  {fmtAmount(b.available)}
                </Mono>
                {Number(b.locked) > 0 ? (
                  <Text variant="caption" tone="tertiary">
                    {`${t("wallet.inProgress")} ${fmtAmount(b.locked)}`}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        ))}
      </Card>
    </>
  );
}

const liveAccounts = (accounts: TradingAccount[] | undefined) => (accounts ?? []).filter((a) => a.type === "live" && a.status !== "disabled" && a.status !== "expired");

function AccountsSection() {
  const t = useT();
  const router = useRouter();
  const q = useTradingAccounts();
  const live = liveAccounts(q.data?.accounts);
  // not loaded and not loadable (offline, or a view-only login without the accounts section): nothing to offer here
  if (!q.data && q.error) return null;
  return (
    <>
      <SectionTitle title={t("wallet.fundTradingAccount")} action={live.length ? t("common.transfer") : undefined} onAction={() => router.push("/wallet/transfer")} onActionPressIn={prefetchWallet.transfer} />
      {q.loading ? (
        <Skeleton w={undefined} h={72} r={radius.card} style={{ marginHorizontal: GUTTER }} />
      ) : live.length === 0 ? (
        <Card style={{ marginHorizontal: GUTTER, gap: space[3] }}>
          <Text variant="headline" weight="700">
            {t("wallet.transfer.noLiveTitle")}
          </Text>
          <Text variant="callout" tone="secondary">
            {t("wallet.transfer.noLiveText")}
          </Text>
          <Button label={t("wallet.transfer.openLive")} variant="secondary" size="md" full={false} onPress={() => router.push("/accounts/new")} />
        </Card>
      ) : (
        <Card padded={false} style={{ marginHorizontal: GUTTER }}>
          {live.map((a, i) => (
            <View key={a.login}>
              {i > 0 ? <Divider /> : null}
              <PressableScale scaleTo={0.985} onPressIn={prefetchWallet.transfer} onPress={() => router.push(`/wallet/transfer?to=${a.login}`)} style={{ minHeight: 68, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4] }} testID={`fund-${a.login}`}>
                <View style={{ height: 24, paddingHorizontal: space[2], borderRadius: radius.pill, backgroundColor: "rgba(242,106,61,0.14)", justifyContent: "center" }}>
                  <Text variant="label" tone="ember" style={{ fontSize: 10 }}>
                    {t("wallet.liveBadge")}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text variant="callout" weight="600" numberOfLines={1}>
                    {`${a.groupName} · #${a.login}`}
                  </Text>
                  <Text variant="caption" tone="tertiary" numberOfLines={1}>
                    {`${t("common.balance")} ${accountCurrencyPrefix(a)}${fmtAmount(a.balance)}${a.cent ? ` · ≈ $${fmtAmount(toUsd(a, a.balance))}` : ""}`}
                  </Text>
                </View>
                <Text variant="callout" weight="700" tone="ember">
                  {t("wallet.fund.topUp")}
                </Text>
              </PressableScale>
            </View>
          ))}
        </Card>
      )}
    </>
  );
}

function Recent({ onOpen }: { onOpen: (a: ActivityItem) => void }) {
  const t = useT();
  const router = useRouter();
  const q = useRecentActivity(useIsFocused());
  const items = q.data?.items ?? [];
  return (
    <>
      <SectionTitle title={t("wallet.recent.title")} action={items.length ? t("mobile.action.seeAll") : undefined} onAction={() => router.push("/wallet/history")} onActionPressIn={prefetchWallet.history} />
      {q.loading ? (
        <ActivitySkeleton rows={4} />
      ) : items.length === 0 ? (
        q.error ? (
          <Text variant="callout" tone="tertiary" style={{ paddingHorizontal: GUTTER }}>
            {t("mobile.state.error.body")}
          </Text>
        ) : (
          <EmptyState illustration="emptyHistory" size={200} title={t("wallet.recent.emptyTitle")} body={t("wallet.recent.emptyText")} action={t("wallet.recent.firstDeposit")} onAction={() => router.push("/wallet/deposit")} style={{ paddingVertical: space[4] }} />
        )
      ) : (
        <View>
          {items.map((a, i) => (
            <View key={`${a.type}${a.id}`}>
              {i > 0 ? <Divider inset={GUTTER + 52} /> : null}
              <ActivityRow item={a} onPress={onOpen} />
            </View>
          ))}
        </View>
      )}
    </>
  );
}

export function WalletScreen() {
  const t = useT();
  const router = useRouter();
  const focused = useIsFocused();
  const me = useMe();
  // a view-only login sees balances and history only (the Client Area hides the money pages from it too)
  const viewer = useSession((s) => !!s.viewer);
  const overview = useOverview(focused);
  // the sections poll their own data; these handles are for pull to refresh
  const recent = useRecentActivity(false);
  const accounts = useTradingAccounts(false, !viewer);
  const sheet = React.useRef<ActivitySheetHandle>(null);
  const open = React.useCallback((a: ActivityItem) => sheet.current?.open(a), []);
  const refresh = React.useCallback(async () => {
    await Promise.all([overview.refresh(), recent.refresh(), viewer ? null : accounts.refresh()]);
  }, [overview.refresh, recent.refresh, accounts.refresh, viewer]);

  const header = (
    <WalletHeader
      eyebrow={t("mobileWallet.eyebrow")}
      title={t("wallet.wallet")}
      right={<IconButton accessibilityLabel={t("wallet.history.title")} icon={<History size={20} color={colors.text} />} onPress={() => router.push("/wallet/history")} />}
    />
  );
  const o = overview.data;

  if (!o && overview.error)
    return (
      <Screen tabBar={false} header={header} onRefresh={refresh}>
        <WalletState error={overview.error} onRetry={() => void overview.refresh()} />
      </Screen>
    );

  return (
    <Screen tabBar={false} header={header} onRefresh={refresh}>
      {o ? <BalanceHero b={usdtBalance(o)} /> : <HeroSkeleton />}
      {viewer ? null : <QuickActions />}
      <View style={{ paddingHorizontal: GUTTER, gap: space[3], marginTop: space[4] }}>
        <ViewOnlyNotice />
        <RestrictionBanner kinds={["deposits", "withdrawals", "transfers"]} onContact={() => router.push("/support")} />
        <KycNotice status={me?.kyc_status} />
      </View>
      {o ? <InProgress o={o} /> : null}
      {o ? <OtherAssets balances={o.balances} /> : null}
      {viewer ? null : <AccountsSection />}
      <Recent onOpen={open} />
      <View style={{ height: space[6] }} />
      <ActivitySheet ref={sheet} />
    </Screen>
  );
}
