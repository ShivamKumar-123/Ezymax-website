// A phase certificate: the service's certificate image (SVG, fetched once and kept on the phone) drawn natively at
// its exact aspect ratio, with Share, Copy link and the public verification page.
import * as React from "react";
import { Share, View, useWindowDimensions } from "react-native";
import { SvgXml } from "react-native-svg";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { Award, Share2, ShieldCheck } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { API_BASE } from "@/lib/config";
import { useMe } from "@/session";
import { Button, PressableScale, Skeleton, Text, toast } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { useCertificateSvg } from "../api";
import { useRetryOnReconnect } from "../hooks";

export const CERT_ASPECT = 1600 / 1131;

/** The public verification page (the service's link when the list has it, else the Client Area's). */
export const verifyUrl = (code: string, url?: string) => url || `${API_BASE}/certificate/${code}`;

export function CertificateImage({ code, width, n }: { code: string; width: number; n: number }) {
  const t = useT();
  const q = useCertificateSvg(code);
  useRetryOnReconnect(q);
  const h = Math.round(width / CERT_ASPECT);
  const frame = { width, height: h, borderRadius: radius.sm, overflow: "hidden" as const, backgroundColor: colors.bgRaised, borderWidth: 1, borderColor: colors.line };
  // the image couldn't be loaded (offline, service trouble): the certificate itself still stands, tap to try again
  if (!q.data && q.error)
    return (
      <PressableScale onPress={() => void q.refresh()} scaleTo={0.985} accessibilityLabel={`${t("mobileAcademy.cert.imageA11y", { n })}. ${t("mobile.action.retry")}`} style={[frame, { alignItems: "center", justifyContent: "center", gap: space[2] }]}>
        <Award size={30} color={colors.text3} />
        <Text variant="caption" tone="tertiary" style={{ fontVariant: ["tabular-nums"] }}>
          {code}
        </Text>
      </PressableScale>
    );
  return (
    <View style={frame} accessible accessibilityRole="image" accessibilityLabel={t("mobileAcademy.cert.imageA11y", { n })}>
      {q.data ? <SvgXml xml={q.data} width={width - 2} height={h - 2} /> : <Skeleton w={width - 2} h={h - 2} r={0} />}
    </View>
  );
}

export function CertificateActions({ code, url, n, title }: { code: string; url?: string; n: number; title: string }) {
  const t = useT();
  const me = useMe();
  const link = verifyUrl(code, url);
  const share = async () => {
    try {
      // the link is part of the message (one copy of it in every share target, on iOS and Android alike)
      await Share.share({ message: t("mobileAcademy.cert.shareText", { brand: me?.tenant?.name ?? "Kalks", n, title, url: link }) });
    } catch {
      // dismissed
    }
  };
  const copy = async () => {
    try {
      await Clipboard.setStringAsync(link);
      toast.show({ title: t("academy.toast.linkCopied"), tone: "success" });
    } catch {
      toast.show({ title: t("academy.toast.copyFailed"), tone: "error" });
    }
  };
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
      <Button label={t("mobileAcademy.cert.share")} size="sm" variant="secondary" full={false} icon={<Share2 size={15} color={colors.text} />} onPress={() => void share()} />
      <Button label={t("academy.cert.copyLink")} size="sm" variant="ghost" full={false} onPress={() => void copy()} />
      <Button label={t("academy.cert.verify")} size="sm" variant="ghost" full={false} icon={<ShieldCheck size={15} color={colors.text} />} onPress={() => void WebBrowser.openBrowserAsync(link).catch(() => {})} />
    </View>
  );
}

/** Certificate block: image, "code · issued date", actions. */
export function CertificateCard({ code, issuedAt, n, title, url, scorePct, testID }: { code: string; issuedAt: string; n: number; title: string; url?: string; scorePct?: number; testID?: string }) {
  const t = useT();
  const fmt = useFormat();
  const { width } = useWindowDimensions();
  // screen gutter, card padding and the image's 1 pt border
  const w = Math.min(width, 720) - 2 * GUTTER - 2 * space[4] - 2;
  return (
    <View testID={testID} style={{ borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: space[4], gap: space[3] }}>
      <CertificateImage code={code} width={w} n={n} />
      <View style={{ gap: 2 }}>
        <Text variant="headline" weight="700">
          {t("academy.phaseTitle", { n, title })}
        </Text>
        <Text variant="caption" tone="tertiary" style={{ fontVariant: ["tabular-nums"] }}>
          {[t("academy.cert.codeIssued", { code, date: fmt.date(issuedAt) }), scorePct !== undefined ? t("academy.cert.examScore", { pct: scorePct }) : null].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <CertificateActions code={code} url={url} n={n} title={title} />
    </View>
  );
}
