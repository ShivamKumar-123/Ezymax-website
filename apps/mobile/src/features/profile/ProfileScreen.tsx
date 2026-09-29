// Profile (/profile): the client's record as registered with the broker, read-only like the Client Area's live
// profile (there is no self-service profile edit): name and date of birth are corrected during verification and
// locked after it (D92); phone, address and email changes go through support with the rules shown here.
import * as React from "react";
import { Linking, View } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Bell, Copy, IdCard, KeyRound, Lock, Mail, MapPin, MessageCircle, Phone, UserRound } from "lucide-react-native";
import { useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { prefetch, useQuery } from "@/lib/query";
import { refreshMe } from "@/session";
import { Button, ColorBlock, Display, IconButton, Mono, PressableScale, Text, toast, type SheetRef } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { fetchLogins, fetchMenu, fetchPrefs, fetchSessions, QK } from "./api";
import { Chevron, Group, KeyValue, MenuRow, Note, SectionHeader, StatusChip } from "./components/bits";
import { ChoiceSheet } from "./components/sheets";
import { StackScreen } from "./components/StackScreen";
import { calendarDay, clientId, countryName, day } from "./format";
import { useKyc } from "./kyc/api";
import { kycBadge, useMeX } from "./me";

const SUPPORT_FALLBACK = "support@kalkstrade.com";

export default function ProfileScreen() {
  const t = useT();
  const router = useRouter();
  const me = useMeX();
  const kyc = useKyc();
  const menu = useQuery(QK.menu, fetchMenu, { persist: true, staleMs: 5 * 60_000 });
  const correction = React.useRef<SheetRef>(null);
  const badge = kycBadge(me);
  const id = clientId(me?.id);
  const phone = [me?.phone_dial, me?.phone].filter(Boolean).join(" ");
  const address = kyc.data?.case?.details.address;
  const addressText = address ? [address.line1, address.line2, address.city, address.postcode, countryName(address.country)].filter(Boolean).join(", ") : null;
  const locked = !!(me?.identity_locked ?? kyc.data?.identity_locked);
  const support = menu.data?.brand.support_email || SUPPORT_FALLBACK;

  const copyId = async () => {
    await Clipboard.setStringAsync(id);
    haptic.select();
    toast.show({ title: t("mobileProfile.copied", { what: t("profile.stat.clientId") }) });
  };

  const refresh = React.useCallback(() => Promise.all([refreshMe(), kyc.refresh()]), [kyc]);

  return (
    <StackScreen eyebrow={t("profile.title")} title={me?.name || t("profile.title")} onRefresh={refresh} testID="screen-profile">
      <View style={{ paddingHorizontal: GUTTER, flexDirection: "row", gap: space[3] }}>
        <ColorBlock color="cream" style={{ flex: 1, padding: space[5], gap: space[2] }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text variant="label" color={colors.ink2}>
              {t("profile.stat.clientId")}
            </Text>
            <IconButton tone="ghost" size={32} accessibilityLabel={t("mobileProfile.copy")} icon={<Copy size={16} color={colors.ink} />} onPress={() => void copyId()} />
          </View>
          <Mono size={20} weight="bold" color={colors.ink} numberOfLines={1} adjustsFontSizeToFit>
            {id}
          </Mono>
        </ColorBlock>
        <ColorBlock color="periwinkle" style={{ flex: 1, padding: space[5], gap: space[2] }}>
          <View style={{ height: 32, justifyContent: "center" }}>
            <Text variant="label" color={colors.ink2}>
              {t("mobileProfile.profile.memberSinceLabel")}
            </Text>
          </View>
          <Display size="sm" color={colors.ink} numberOfLines={1} adjustsFontSizeToFit>
            {day(me?.created_at, { month: "short", year: "numeric" })}
          </Display>
        </ColorBlock>
      </View>

      <PressableScale
        onPress={() => router.push("/profile/verification")}
        onPressIn={() => void kyc.refresh()}
        scaleTo={0.985}
        testID="profile-kyc"
        accessibilityLabel={`${t("profile.kycCard.title")}: ${t(badge.label)}`}
        style={{ marginHorizontal: GUTTER, marginTop: space[4], flexDirection: "row", alignItems: "center", gap: space[3], padding: space[4], borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}
      >
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}>
          <IdCard size={19} color={colors.text2} />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text variant="headline" weight="700">
            {t("profile.kycCard.title")}
          </Text>
          <StatusChip label={t(badge.label)} tone={badge.tone} style={{ alignSelf: "flex-start" }} />
          <Text variant="caption" tone="tertiary">
            {badge.key === "verified" ? t("profile.kycCard.verified") : badge.key === "action" ? t("profile.kycCard.moreInfo") : badge.key === "review" ? t("profile.kycCard.pending") : t("profile.kycCard.unverified")}
          </Text>
        </View>
        <Chevron />
      </PressableScale>

      <SectionHeader title={t("profile.personal.title")} />
      <Group>
        <KeyValue label={t("profile.field.firstName")} value={me?.first_name || "—"} />
        <KeyValue label={t("profile.field.lastName")} value={me?.last_name || "—"} />
        <KeyValue label={t("profile.field.dob")} value={calendarDay(me?.date_of_birth)} />
        <KeyValue label={t("profile.field.country")} value={countryName(me?.country)} />
        <KeyValue label={t("profile.field.registered")} value={day(me?.created_at)} />
      </Group>
      <Note icon={Lock} style={{ marginHorizontal: GUTTER, marginTop: space[3] }}>
        {locked ? t("profile.personal.identityLocked") : t("profile.personal.identityUnlocked")}
      </Note>

      <SectionHeader title={t("mobileProfile.profile.contact")} />
      <Group>
        <KeyValue
          label={t("common.email")}
          value={
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <Text variant="callout" weight="600" numberOfLines={1}>
                {me?.email}
              </Text>
              {me?.email_verified ? <StatusChip label={t("common.verified")} tone="mint" /> : <StatusChip label={t("profile.notVerified")} tone="gold" />}
            </View>
          }
        />
        <KeyValue label={t("common.phone")} value={phone ? <Text variant="callout" weight="600" style={{ writingDirection: "ltr" }}>{phone}</Text> : t("mobileProfile.profile.phoneNone")} />
        <KeyValue label={t("mobileProfile.profile.addressLabel")} value={addressText ?? t("mobileProfile.profile.addressNone")} />
      </Group>

      <SectionHeader title={t("mobileProfile.profile.rules.title")} />
      <Group>
        {(
          [
            [UserRound, "mobileProfile.profile.rules.name"],
            [Phone, "mobileProfile.profile.rules.phone"],
            [MapPin, "mobileProfile.profile.rules.address"],
            [Mail, "mobileProfile.profile.rules.email"],
          ] as const
        ).map(([Icon, key]) => (
          <View key={key} style={{ flexDirection: "row", gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3] }}>
            <Icon size={17} color={colors.text3} style={{ marginTop: 2 }} />
            <Text variant="caption" tone="secondary" style={{ flex: 1, lineHeight: 18 }}>
              {t(key)}
            </Text>
          </View>
        ))}
      </Group>
      <View style={{ paddingHorizontal: GUTTER, marginTop: space[3] }}>
        <Button label={t("profile.personal.requestCorrection")} variant="secondary" icon={<MessageCircle size={18} color={colors.text} />} onPress={() => correction.current?.present()} testID="profile-correction" />
      </View>

      <SectionHeader title={t("mobileProfile.more.group.account")} />
      <Group>
        <MenuRow
          icon={KeyRound}
          title={t("security.page.title")}
          hint={t("mobileProfile.profile.links.securityHint")}
          onPress={() => router.push("/profile/security")}
          onPressIn={() => {
            prefetch(QK.sessions, fetchSessions, { persist: true });
            prefetch(QK.logins, fetchLogins, { persist: true });
          }}
        />
        <MenuRow icon={Bell} title={t("profile.notifCard.title")} hint={t("mobileProfile.profile.links.notificationsHint")} onPress={() => router.push("/profile/notifications")} onPressIn={() => prefetch(QK.prefs, fetchPrefs, { persist: true })} />
      </Group>

      <ChoiceSheet
        ref={correction}
        title={t("mobileProfile.profile.correction.title")}
        body={t("mobileProfile.profile.correction.body")}
        choices={[
          {
            key: "chat",
            icon: MessageCircle,
            title: t("mobileProfile.profile.correction.chat"),
            hint: t("mobileProfile.profile.correction.chatHint"),
            onPress: () => {
              correction.current?.dismiss();
              router.push("/support");
            },
          },
          {
            key: "email",
            icon: Mail,
            title: t("mobileProfile.profile.correction.email"),
            hint: `${t("mobileProfile.profile.correction.emailHint")} · ${support}`,
            onPress: () => {
              correction.current?.dismiss();
              const subject = encodeURIComponent(t("mobileProfile.profile.correction.subject", { id }));
              void Linking.openURL(`mailto:${support}?subject=${subject}`).catch(() => toast.show({ title: support }));
            },
          },
        ]}
      />
    </StackScreen>
  );
}
