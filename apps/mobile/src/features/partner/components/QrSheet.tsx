// A link's QR code in a bottom sheet: big enough to scan from the phone at an event, with the link, share (the link
// or the QR as a PNG for flyers and chats) and copy.
import * as React from "react";
import { View } from "react-native";
import { Copy, Image as ImageIcon, Share2 } from "lucide-react-native";
import { useT } from "@/i18n";
import { Button, Display, Mono, Sheet, Text, toast, type SheetRef } from "@/ui";
import { colors, space } from "@/theme/tokens";
import { qrPng } from "../qr";
import { copyText, shareLink, sharePng } from "../share";
import { shortUrl } from "../format";
import { QrCode } from "./QrCode";

export type QrTarget = { url: string; title: string; fileBase: string; message: string };

export const QrSheet = React.forwardRef<SheetRef, { target: QrTarget | null }>(function QrSheet({ target }, ref) {
  const t = useT();
  const [busy, setBusy] = React.useState(false);
  const saveImage = React.useCallback(async () => {
    if (!target) return;
    setBusy(true);
    const png = qrPng(target.url);
    const ok = png ? await sharePng(png, `${target.fileBase}.png`, target.title) : false;
    setBusy(false);
    if (!ok) toast.show({ title: t("mobilePartner.qr.shareFailed"), tone: "error" });
  }, [target, t]);
  return (
    <Sheet ref={ref}>
      {target ? (
        <View style={{ alignItems: "center", gap: space[4], paddingTop: space[2] }}>
          <View style={{ alignSelf: "stretch", gap: 2 }}>
            <Text variant="label" tone="ember">
              {t("mobilePartner.qr.eyebrow")}
            </Text>
            <Display size="md" numberOfLines={1}>
              {target.title}
            </Display>
          </View>
          <QrCode value={target.url} size={236} label={t("mobilePartner.qr.a11y", { link: shortUrl(target.url) })} />
          <Mono size={13} tone="secondary" numberOfLines={1} style={{ writingDirection: "ltr" }}>
            {shortUrl(target.url)}
          </Mono>
          <Text variant="caption" tone="tertiary" align="center" style={{ maxWidth: 300 }}>
            {t("mobilePartner.qr.hint")}
          </Text>
          <View style={{ alignSelf: "stretch", gap: space[2], marginTop: space[1] }}>
            <Button label={t("mobilePartner.action.shareLink")} icon={<Share2 size={18} color={colors.ink} />} onPress={() => void shareLink(target.url, target.message, target.title)} />
            <View style={{ flexDirection: "row", gap: space[2] }}>
              <Button label={t("mobilePartner.qr.shareImage")} variant="secondary" size="md" loading={busy} icon={<ImageIcon size={17} color={colors.text} />} onPress={saveImage} style={{ flex: 1 }} />
              <Button label={t("common.copy")} variant="secondary" size="md" icon={<Copy size={17} color={colors.text} />} onPress={() => void copyText(target.url, t("mobilePartner.toast.linkCopied"), shortUrl(target.url))} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      ) : (
        <View style={{ height: 1 }} />
      )}
    </Sheet>
  );
});
