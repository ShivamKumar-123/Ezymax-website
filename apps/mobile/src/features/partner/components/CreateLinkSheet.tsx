// New campaign link: a name (the link's slug follows it unless one is typed), optional UTM tags, and a live preview
// of the link. The server checks the name, the slug (1–40 letters, digits, - or _, unique per partner) and the
// 100-link limit; the created link is copied at once.
import * as React from "react";
import { View } from "react-native";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { useT } from "@/i18n";
import { SheetTextField } from "@/features/accounts/components/SheetInputs";
import { Button, Display, FormError, Mono, PressableScale, Sheet, Text, toast, type SheetRef } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { createCampaign, partnerError } from "../api";
import { campaignLink, shortUrl, SLUG_RE, slugOf } from "../format";
import { useSheetWrite } from "../sheet";
import { copyText } from "../share";

export function CreateLinkSheet({ sheetRef, base, code, onCreated }: { sheetRef: React.RefObject<SheetRef | null>; base: string; code: string; onCreated?: () => void }) {
  const t = useT();
  // one link at a time; closed while the server answers, the form stays and a refusal brings the sheet back
  const w = useSheetWrite(sheetRef);
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [utm, setUtm] = React.useState({ source: "", medium: "", campaign: "" });
  const [showUtm, setShowUtm] = React.useState(false);
  const [err, setErr] = React.useState<{ field?: string; message: string } | null>(null);

  const reset = React.useCallback(() => {
    if (w.sending()) return;
    setName("");
    setSlug("");
    setUtm({ source: "", medium: "", campaign: "" });
    setShowUtm(false);
    setErr(null);
  }, [w.sending]);

  const eff = slug.trim() ? slug.trim().toLowerCase() : slugOf(name);
  const slugOk = !slug.trim() || SLUG_RE.test(slug.trim());
  const link = eff ? campaignLink(base, code, eff) : null;
  const fieldErr = (f: string) => (err?.field === f ? err.message : null);
  const can = !!name.trim() && !!eff && slugOk && !w.busy;

  const submit = async () => {
    if (!can) return;
    const r = await w.run(async () => {
      setErr(null);
      return createCampaign({ name: name.trim(), slug: slug.trim() || undefined, utmSource: utm.source.trim() || undefined, utmMedium: utm.medium.trim() || undefined, utmCampaign: utm.campaign.trim() || undefined });
    });
    if (!r) return;
    if (!r.ok) {
      const field = r.error.field ?? (r.error.code === "exists" ? "slug" : undefined);
      setErr({ field, message: partnerError(r.error) });
      if (field === "utmSource" || field === "utmMedium" || field === "utmCampaign") setShowUtm(true);
      w.bringBack();
      return;
    }
    const url = campaignLink(base, code, r.data.slug);
    const copied = await copyText(url, t("mobilePartner.links.created"), shortUrl(url));
    if (!copied) toast.show({ title: t("mobilePartner.links.created"), body: shortUrl(url), tone: "success" });
    onCreated?.();
    if (w.shown.current) sheetRef.current?.dismiss();
    else reset();
  };

  return (
    <Sheet ref={sheetRef} onDismiss={reset} enablePanDownToClose={!w.busy} {...w.sheetProps}>
      <View style={{ gap: space[4], paddingTop: space[2] }}>
        <View style={{ gap: 2 }}>
          <Text variant="label" tone="ember">
            {t("mobilePartner.links.newEyebrow")}
          </Text>
          <Display size="md">{t("mobilePartner.links.newTitle")}</Display>
        </View>
        <SheetTextField label={t("mobilePartner.links.name")} value={name} onChangeText={setName} placeholder={t("mobilePartner.links.namePlaceholder")} maxLength={60} error={fieldErr("name")} returnKeyType="next" autoCapitalize="sentences" testID="link-name" />
        <SheetTextField
          label={t("mobilePartner.links.slug")}
          value={slug}
          onChangeText={setSlug}
          placeholder={slugOf(name) || t("mobilePartner.links.slugPlaceholder")}
          maxLength={40}
          autoCapitalize="none"
          autoCorrect={false}
          mono
          error={fieldErr("slug") ?? (slugOk ? null : t("mobilePartner.links.slugInvalid"))}
          hint={t("mobilePartner.links.slugHint")}
        />
        <PressableScale onPress={() => setShowUtm((v) => !v)} scaleTo={1} haptics="select" accessibilityState={{ expanded: showUtm }} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text variant="callout" weight="700" tone="secondary">
            {t("mobilePartner.links.utm")}
          </Text>
          {showUtm ? <ChevronUp size={18} color={colors.text3} /> : <ChevronDown size={18} color={colors.text3} />}
        </PressableScale>
        {showUtm ? (
          <View style={{ gap: space[3] }}>
            <SheetTextField label="utm_source" value={utm.source} onChangeText={(v) => setUtm((u) => ({ ...u, source: v }))} placeholder="youtube" maxLength={60} autoCapitalize="none" autoCorrect={false} error={fieldErr("utmSource")} />
            <SheetTextField label="utm_medium" value={utm.medium} onChangeText={(v) => setUtm((u) => ({ ...u, medium: v }))} placeholder="video" maxLength={60} autoCapitalize="none" autoCorrect={false} error={fieldErr("utmMedium")} />
            <SheetTextField label="utm_campaign" value={utm.campaign} onChangeText={(v) => setUtm((u) => ({ ...u, campaign: v }))} placeholder="gold-webinar" maxLength={60} autoCapitalize="none" autoCorrect={false} error={fieldErr("utmCampaign")} />
          </View>
        ) : null}
        <View style={{ borderRadius: radius.md, backgroundColor: colors.surface2, padding: space[4], gap: 4 }}>
          <Text variant="label" tone="tertiary">
            {t("mobilePartner.links.yourLink")}
          </Text>
          <Mono size={13} numberOfLines={2} style={{ writingDirection: "ltr" }}>
            {link ? shortUrl(link) : t("mobilePartner.links.enterName")}
          </Mono>
        </View>
        {err && !err.field ? <FormError message={err.message} /> : null}
        <Button label={w.busy ? t("mobilePartner.links.creating") : t("mobilePartner.links.create")} onPress={submit} disabled={!can} loading={w.busy} testID="link-create" />
      </View>
    </Sheet>
  );
}
