// Certificates: a colour tile per certificate (lists) and the viewer sheet with the full art, drawn on the phone
// by Skia, shared as a 1080 × 1350 PNG (the post format) or as the public verify link.
import * as React from "react";
import { View, useWindowDimensions } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import * as Clipboard from "expo-clipboard";
import { Link2, Share2 } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT, type MessageKey } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { Button, ColorBlock, Display, Mono, PressableScale, Sheet, Text, toast, type SheetRef } from "@/ui";
import { colors, GUTTER, space, type BlockColor } from "@/theme/tokens";
import { certArt, certMoney, sharePng, shareLink, verifyUrl } from "../certificate";
import { fmtCertDate, sizeLabel } from "../format";
import type { Certificate } from "../types";
import { Tag } from "./bits";
import { CertificateCanvas, type CertificateCanvasHandle } from "./gauges";

export const KIND: Record<Certificate["kind"], { label: MessageKey; color: BlockColor }> = {
  pass: { label: "mobileProp.certs.kind.pass", color: "mint" },
  funded: { label: "mobileProp.certs.kind.funded", color: "gold" },
  payout: { label: "mobileProp.certs.kind.payout", color: "ember" },
};

export const CERT_TILE_HEIGHT = 208;

/** A certificate as a colour tile (fixed height, for lists and the Prop home strip). */
export const CertificateTile = React.memo(function CertificateTile({ c, onOpen, width }: { c: Certificate; onOpen: (c: Certificate) => void; width?: number }) {
  const t = useT();
  const k = KIND[c.kind] ?? KIND.pass;
  const big = c.kind === "payout" && c.amount !== null ? certMoney(c.amount) : certMoney(c.size);
  return (
    <PressableScale onPress={() => onOpen(c)} scaleTo={0.98} accessibilityLabel={`${t(k.label)} ${big}, ${c.planName}`} style={{ width, height: CERT_TILE_HEIGHT }}>
      <ColorBlock color={k.color} style={{ flex: 1, justifyContent: "space-between", opacity: c.revoked ? 0.55 : 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[2] }}>
          <Tag label={c.revoked ? t("mobileProp.certs.revoked") : t(k.label)} tone="ink" />
          <Mono size={11} weight="medium" color={colors.ink2}>
            {c.code}
          </Mono>
        </View>
        <View>
          <Display size="xl" color={colors.ink} numberOfLines={1} adjustsFontSizeToFit>
            {big}
          </Display>
          <Text variant="caption" color={colors.ink2} numberOfLines={1}>
            {c.phase && c.kind === "pass" ? `${c.phase} · ` : ""}
            {sizeLabel(c.size)} · {c.planName}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space[2] }}>
          <Text variant="callout" weight="700" color={colors.ink} numberOfLines={1} style={{ flexShrink: 1 }}>
            {c.traderName}
          </Text>
          <Text variant="caption" color={colors.ink2}>
            {fmtCertDate(c.issuedAt)}
          </Text>
        </View>
      </ColorBlock>
    </PressableScale>
  );
});

export type CertificateSheetHandle = { open: (c: Certificate) => void };

/** Viewer: the art, then share it as an image or share / copy the verify link. */
export const CertificateSheet = React.forwardRef<CertificateSheetHandle>(function CertificateSheet(_, ref) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const sheet = React.useRef<SheetRef>(null);
  const canvas = React.useRef<CertificateCanvasHandle>(null);
  const [cert, setCert] = React.useState<Certificate | null>(null);
  const [busy, setBusy] = React.useState(false);
  const art = React.useMemo(() => (cert ? certArt(cert) : null), [cert]);
  const width = Math.min(screenW, 520) - GUTTER * 2;

  React.useImperativeHandle(ref, () => ({
    open(c) {
      setCert(c);
      sheet.current?.present();
    },
  }));

  const shareImage = async () => {
    if (!cert || busy) return;
    setBusy(true);
    try {
      const png = await canvas.current?.png();
      if (!png) throw new Error("render");
      const ok = await sharePng(png, cert.code, t("mobileProp.certs.shareTitle"));
      if (!ok) toast.show({ title: t("mobileProp.certs.shareUnavailable"), tone: "error" });
    } catch (e) {
      // the share sheet was closed without sharing: not an error
      if ((e as Error)?.name !== "AbortError") toast.show({ title: t("mobileProp.certs.shareFailed"), tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet ref={sheet} scroll enableDynamicSizing topInset={insets.top + space[2]} onDismiss={() => setCert(null)}>
      <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: space[2], paddingBottom: Math.max(insets.bottom, space[4]) + space[4], gap: space[4] }} showsVerticalScrollIndicator={false}>
        {cert && art ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
              <Tag label={t(KIND[cert.kind]?.label ?? KIND.pass.label)} tone={KIND[cert.kind]?.color === "gold" ? "gold" : KIND[cert.kind]?.color === "ember" ? "ember" : "mint"} />
              {cert.revoked ? <Tag label={t("mobileProp.certs.revoked")} tone="ember" /> : null}
            </View>
            <View style={{ alignItems: "center" }} accessible accessibilityRole="image" accessibilityLabel={`${art.headline}: ${art.amount}, ${art.traderName}. ${art.issued}.`}>
              <CertificateCanvas ref={canvas} data={art} width={width} />
            </View>
            <View style={{ gap: 4 }}>
              <Text variant="headline">{cert.title}</Text>
              <Text variant="caption" tone="tertiary">
                {t("mobileProp.certs.meta", { plan: cert.planName, size: sizeLabel(cert.size), date: fmtCertDate(cert.issuedAt) })}
              </Text>
              <Mono size={12} tone="tertiary">
                {t("mobileProp.certs.number", { code: cert.code })}
              </Mono>
            </View>
            {cert.revoked ? (
              <Text variant="callout" tone="secondary">
                {t("mobileProp.certs.revokedBody")}
              </Text>
            ) : (
              <View style={{ gap: space[3] }}>
                <Button label={t("mobileProp.certs.shareImage")} loading={busy} onPress={() => void shareImage()} icon={<Share2 size={18} color={colors.ink} />} testID="prop-cert-share" />
                <View style={{ flexDirection: "row", gap: space[3] }}>
                  <Button
                    label={t("mobileProp.certs.shareLink")}
                    variant="secondary"
                    size="md"
                    style={{ flex: 1 }}
                    icon={<Link2 size={16} color={colors.text} />}
                    onPress={() => void shareLink(cert.code, t("mobileProp.certs.shareMessage")).catch(() => {})}
                  />
                  <Button
                    label={t("mobileProp.certs.copyLink")}
                    variant="secondary"
                    size="md"
                    style={{ flex: 1 }}
                    onPress={async () => {
                      await Clipboard.setStringAsync(verifyUrl(cert.code));
                      haptic.select();
                      toast.show({ title: t("mobileProp.certs.linkCopied") }, 1600);
                    }}
                  />
                </View>
              </View>
            )}
          </>
        ) : null}
      </BottomSheetScrollView>
    </Sheet>
  );
});
