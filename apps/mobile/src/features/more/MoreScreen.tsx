// The More tab: who is signed in (name, client ID, verification chip), the broker's restriction notices, the
// verification call-to-action, and a grouped menu to every module of the app. Modules the broker switched off are
// hidden (GET /api/mobile/menu, like the Client Area navigation); view-only logins see only what they were shared.
import * as React from "react";
import { View } from "react-native";
import { useRouter, type Href } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  Bell,
  BellRing,
  Bot,
  Briefcase,
  CalendarDays,
  ChartColumn,
  Eye,
  FileText,
  Fingerprint,
  Gift,
  GraduationCap,
  Handshake,
  IdCard,
  KeyRound,
  Languages,
  Layers,
  LifeBuoy,
  LogOut,
  Newspaper,
  PiggyBank,
  Scale,
  ShieldAlert,
  Trophy,
  User,
  Users,
  Wallet,
  Workflow,
  type LucideIcon,
} from "lucide-react-native";
import { LOCALES, useLocale, useT, type MessageKey } from "@/i18n";
import { APP_VERSION } from "@/lib/config";
import { prefetch, useQuery } from "@/lib/query";
import { refreshMe, signOut, useSession } from "@/session";
import { RestrictionBanner } from "@/shell/RestrictionBanner";
import { Banner, Button, ColorBlock, Display, Illustration, KalksMark, Mono, PressableScale, Screen, Text, toast, type SheetRef } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { fetchLogins, fetchMenu, fetchPrefs, fetchSessions, QK, type MenuConfig } from "@/features/profile/api";
import { Avatar, Chevron, Group, MenuRow, SectionHeader, StatusChip } from "@/features/profile/components/bits";
import { ChoiceSheet, ConfirmSheet } from "@/features/profile/components/sheets";
import { clientId } from "@/features/profile/format";
import { fetchKyc } from "@/features/profile/kyc/api";
import { initials, kycBadge, useMeX, type KycBadge } from "@/features/profile/me";

type Item = {
  key: string;
  icon: LucideIcon;
  label: MessageKey;
  hint?: MessageKey;
  href?: Href;
  /** broker module that must be on (gateway tenant config) */
  module?: string;
  /** a view-only login sees the item when it was given this section */
  section?: string;
  /** shown to view-only logins without a section (local settings, legal) */
  viewer?: boolean;
  prefetch?: () => void;
};
type GroupDef = { key: string; label: MessageKey; items: Item[] };

const warmKyc = () => prefetch(QK.kyc, fetchKyc, { persist: true, staleMs: 10_000 });

const GROUPS: GroupDef[] = [
  {
    key: "trading",
    label: "mobileProfile.more.group.trading",
    items: [
      { key: "accounts", icon: Layers, label: "mobileProfile.more.item.accounts", href: "/accounts", section: "accounts" },
      { key: "wallet", icon: Wallet, label: "mobileProfile.more.item.wallet", href: "/wallet", module: "wallet", section: "wallet" },
      { key: "statements", icon: FileText, label: "mobileProfile.more.item.statements", href: "/reports/statements", section: "history" },
      { key: "analytics", icon: ChartColumn, label: "mobileProfile.more.item.analytics", href: "/reports/analytics", section: "history" },
    ],
  },
  {
    key: "social",
    label: "mobileProfile.more.group.social",
    items: [
      { key: "copy", icon: Users, label: "mobileProfile.more.item.copy", hint: "mobileProfile.more.hint.copy", href: "/social", module: "copy_trading" },
      { key: "pamm", icon: PiggyBank, label: "mobileProfile.more.item.pamm", hint: "mobileProfile.more.hint.pamm", href: "/social/pamm", module: "pamm" },
      { key: "mam", icon: Briefcase, label: "mobileProfile.more.item.mam", hint: "mobileProfile.more.hint.mam", href: "/social/mam", module: "copy_trading" },
    ],
  },
  {
    key: "earn",
    label: "mobileProfile.more.group.earn",
    items: [
      { key: "prop", icon: Trophy, label: "mobileProfile.more.item.prop", hint: "mobileProfile.more.hint.prop", href: "/prop", module: "prop" },
      { key: "partner", icon: Handshake, label: "mobileProfile.more.item.partner", hint: "mobileProfile.more.hint.partner", href: "/partner", module: "ib", section: "partner" },
      { key: "rewards", icon: Gift, label: "mobileProfile.more.item.rewards", href: "/rewards", module: "rewards" },
    ],
  },
  {
    key: "learn",
    label: "mobileProfile.more.group.learn",
    items: [
      { key: "academy", icon: GraduationCap, label: "mobileProfile.more.item.academy", href: "/academy", module: "academy" },
      { key: "news", icon: Newspaper, label: "mobileProfile.more.item.news", href: "/news", section: "dashboard" },
      { key: "calendar", icon: CalendarDays, label: "mobileProfile.more.item.calendar", href: "/calendar", section: "dashboard" },
    ],
  },
  {
    key: "tools",
    label: "mobileProfile.more.group.tools",
    items: [
      { key: "ai", icon: Bot, label: "mobileProfile.more.item.ai", hint: "mobileProfile.more.hint.ai", href: "/ai" },
      { key: "algo", icon: Workflow, label: "mobileProfile.more.item.algo", href: "/algo", module: "algo" },
      { key: "alerts", icon: BellRing, label: "mobileProfile.more.item.alerts", href: "/alerts" },
    ],
  },
  {
    key: "account",
    label: "mobileProfile.more.group.account",
    items: [
      { key: "profile", icon: User, label: "mobileProfile.more.item.profile", href: "/profile", prefetch: warmKyc },
      { key: "verification", icon: IdCard, label: "mobileProfile.more.item.verification", href: "/profile/verification", prefetch: warmKyc },
      {
        key: "security",
        icon: KeyRound,
        label: "mobileProfile.more.item.security",
        href: "/profile/security",
        prefetch: () => {
          prefetch(QK.sessions, fetchSessions, { persist: true });
          prefetch(QK.logins, fetchLogins, { persist: true });
        },
      },
      { key: "appLock", icon: Fingerprint, label: "mobileProfile.more.item.appLock", href: "/settings/app-lock", viewer: true },
      { key: "language", icon: Languages, label: "mobileProfile.more.item.language", href: "/profile/language", viewer: true },
      { key: "notifications", icon: Bell, label: "mobileProfile.more.item.notifications", href: "/profile/notifications", prefetch: () => prefetch(QK.prefs, fetchPrefs, { persist: true }) },
      { key: "support", icon: LifeBuoy, label: "mobileProfile.more.item.support", href: "/support" },
      { key: "legal", icon: Scale, label: "mobileProfile.more.item.legal", viewer: true },
    ],
  },
];

const KYC_CARD: Record<KycBadge["key"], { color: "ember" | "gold" | "cream" | "periwinkle"; title: MessageKey; body: MessageKey; action: MessageKey; ill: "kycPending" | null } | null> = {
  verified: null,
  none: { color: "ember", title: "mobileProfile.more.kyc.startTitle", body: "mobileProfile.more.kyc.startBody", action: "mobileProfile.more.kyc.startAction", ill: "kycPending" },
  progress: { color: "periwinkle", title: "mobileProfile.more.kyc.draftTitle", body: "mobileProfile.more.kyc.draftBody", action: "mobileProfile.more.kyc.draftAction", ill: "kycPending" },
  review: { color: "gold", title: "mobileProfile.more.kyc.reviewTitle", body: "mobileProfile.more.kyc.reviewBody", action: "mobileProfile.more.kyc.reviewAction", ill: "kycPending" },
  action: { color: "gold", title: "mobileProfile.more.kyc.moreInfoTitle", body: "mobileProfile.more.kyc.moreInfoBody", action: "mobileProfile.more.kyc.moreInfoAction", ill: "kycPending" },
  rejected: { color: "cream", title: "mobileProfile.more.kyc.rejectedTitle", body: "mobileProfile.more.kyc.rejectedBody", action: "mobileProfile.more.kyc.rejectedAction", ill: null },
};

/** Opens a legal page in the in-app browser (Safari View Controller / Custom Tab). */
export async function openLegal(url: string, failed: string) {
  try {
    await WebBrowser.openBrowserAsync(url, { toolbarColor: colors.bg, controlsColor: colors.ember, dismissButtonStyle: "close", enableBarCollapsing: true, readerMode: false, presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
  } catch {
    toast.show({ title: failed, tone: "error" });
  }
}

const LEGAL_FALLBACK: MenuConfig["legal"] = [
  { key: "terms", url: "https://kalkstrade.com/terms" },
  { key: "privacy", url: "https://kalkstrade.com/privacy" },
  { key: "risk", url: "https://kalkstrade.com/risk-warning" },
  { key: "disclaimer", url: "https://kalkstrade.com/risk" },
  { key: "restricted", url: "https://kalkstrade.com/restricted-countries" },
];

export default function MoreScreen() {
  const t = useT();
  const router = useRouter();
  const me = useMeX();
  const viewer = useSession((s) => s.viewer);
  const { locale } = useLocale();
  const menu = useQuery(QK.menu, fetchMenu, { persist: true, staleMs: 5 * 60_000, enabled: !viewer });
  const legalSheet = React.useRef<SheetRef>(null);
  const outSheet = React.useRef<SheetRef>(null);
  const [leaving, setLeaving] = React.useState(false);
  const badge = kycBadge(me);
  const staffRo = me?.impersonation?.mode === "read_only";
  const card = viewer ? null : KYC_CARD[badge.key];
  const languageName = LOCALES.find((l) => l.code === locale)?.name;

  const refresh = React.useCallback(async () => {
    await Promise.all([refreshMe(), viewer ? null : menu.refresh()]);
  }, [menu, viewer]);

  const groups = React.useMemo(() => {
    const modules = menu.data?.modules ?? {};
    const visible = (it: Item) => {
      if (it.module && modules[it.module] === false) return false;
      if (viewer) return it.viewer || (!!it.section && viewer.sections.includes(it.section));
      return true;
    };
    return GROUPS.map((g) => ({ ...g, items: g.items.filter(visible) })).filter((g) => g.items.length);
  }, [menu.data, viewer]);

  const legal = menu.data?.legal?.length ? menu.data.legal : LEGAL_FALLBACK;

  const header = (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: space[2], paddingBottom: space[2] }}>
      <Text variant="label" tone="tertiary">
        {t("mobile.tab.more")}
      </Text>
      <PressableScale
        onPress={viewer ? undefined : () => router.push("/profile")}
        onPressIn={viewer ? undefined : warmKyc}
        scaleTo={viewer ? 1 : 0.985}
        accessibilityRole={viewer ? "header" : "button"}
        accessibilityLabel={viewer ? me?.name : t("mobileProfile.more.openProfile")}
        testID="more-profile"
        style={{ flexDirection: "row", alignItems: "center", gap: space[4], marginTop: space[3] }}
      >
        <Avatar text={initials(me?.name)} size={64} color={viewer ? colors.gold : colors.periwinkle} />
        <View style={{ flex: 1, gap: 4 }}>
          <Display size="lg" numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
            {me?.name || "—"}
          </Display>
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {me?.email}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], flexWrap: "wrap", marginTop: 2 }}>
            {viewer ? <StatusChip label={t("mobile.viewOnly")} tone="gold" /> : <StatusChip label={t(badge.label)} tone={badge.tone} />}
            <Mono size={12} tone="tertiary">
              {clientId(me?.id)}
            </Mono>
          </View>
        </View>
        {!viewer ? <Chevron /> : null}
      </PressableScale>
    </View>
  );

  return (
    <Screen header={header} onRefresh={refresh}>
      <View style={{ paddingHorizontal: GUTTER, gap: space[3], marginTop: space[3] }}>
        {viewer ? <Banner tone="info" icon={<Eye size={18} color={colors.periwinkle} />} title={t("mobileProfile.more.viewerOf", { name: me?.name ?? "" })} body={t("mobile.viewOnlyBody")} /> : null}
        {staffRo ? <Banner tone="warn" icon={<ShieldAlert size={18} color={colors.gold} />} title={t("mobileProfile.more.staffReadOnly")} /> : null}
        <RestrictionBanner onContact={viewer ? undefined : () => router.push("/support")} />
      </View>

      {card ? (
        <PressableScale onPress={() => router.push("/profile/verification")} onPressIn={warmKyc} haptics="tap" accessibilityLabel={`${t(card.title)}. ${t(card.body)}`} testID="more-kyc-card" style={{ marginHorizontal: GUTTER, marginTop: space[4] }}>
        <ColorBlock color={card.color} style={{ padding: space[5], minHeight: 176 }}>
          <View style={{ gap: space[2], paddingEnd: card.ill ? 112 : 0 }}>
            <Display size="md" color={colors.ink}>
              {t(card.title)}
            </Display>
            <Text variant="callout" color={colors.ink2}>
              {t(card.body)}
            </Text>
            <View style={{ alignSelf: "flex-start", marginTop: space[1], flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: space[4], borderRadius: radius.pill, backgroundColor: colors.ink }}>
              <Text variant="callout" weight="700" color={colors.cream}>
                {t(card.action)}
              </Text>
              <Chevron color={colors.cream} size={16} />
            </View>
          </View>
          {card.ill ? <Illustration name={card.ill} width={132} height={132} style={{ position: "absolute", bottom: 0, end: 0 }} /> : null}
        </ColorBlock>
        </PressableScale>
      ) : null}

      {groups.map((g) => (
        <View key={g.key}>
          <SectionHeader title={t(g.label)} />
          <Group>
            {g.items.map((it) => (
              <MenuRow
                key={it.key}
                icon={it.icon}
                title={t(it.label)}
                hint={it.hint ? t(it.hint) : undefined}
                testID={`more-${it.key}`}
                value={it.key === "language" ? languageName : it.key === "verification" && !viewer ? <StatusChip label={t(badge.label)} tone={badge.tone} /> : undefined}
                onPressIn={it.prefetch}
                onPress={() => (it.key === "legal" ? legalSheet.current?.present() : it.href ? router.push(it.href) : undefined)}
              />
            ))}
          </Group>
        </View>
      ))}

      <View style={{ paddingHorizontal: GUTTER, marginTop: space[8], gap: space[5], alignItems: "center" }}>
        <Button label={t("mobile.action.signOut")} variant="secondary" icon={<LogOut size={18} color={colors.text} />} onPress={() => outSheet.current?.present()} testID="more-sign-out" />
        <View style={{ alignItems: "center", gap: space[2], opacity: 0.8 }}>
          <KalksMark size={22} color={colors.text3} />
          <Mono size={11} tone="tertiary">
            {t("mobileProfile.version", { version: APP_VERSION })}
          </Mono>
        </View>
      </View>

      <ChoiceSheet
        ref={legalSheet}
        title={t("mobileProfile.legal.title")}
        body={t("mobileProfile.legal.subtitle")}
        choices={legal.map((l) => ({
          key: l.key,
          icon: FileText,
          title: t.dyn(`mobileProfile.legal.${l.key}`, l.key),
          onPress: () => {
            legalSheet.current?.dismiss();
            void openLegal(l.url, t("mobileProfile.legal.openFailed"));
          },
        }))}
      />

      <ConfirmSheet
        ref={outSheet}
        title={t("mobileProfile.signOut.title")}
        body={t("mobileProfile.signOut.body")}
        confirm={t("mobileProfile.signOut.confirm")}
        busy={leaving}
        busyLabel={t("mobileProfile.signOut.busy")}
        testID="sign-out-sheet"
        onConfirm={async () => {
          setLeaving(true);
          await signOut();
        }}
      />
    </Screen>
  );
}
