// An attachment inside a message: images as a thumbnail (loaded with the session: the files are private) that
// opens full screen, PDFs as a file row that opens in the share sheet. Images are cached in memory only
// (the service marks them private, no-store).
import * as React from "react";
import { ActivityIndicator, Modal, Platform, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FileText, X } from "lucide-react-native";
import { useT } from "@/i18n";
import { apiHeaders, apiUrl } from "@/lib/api";
import { onSignOut } from "@/session";
import { IconButton, PressableScale, Text, toast } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import type { Attachment } from "../api";
import { openAttachment } from "../files";

let headersCache: Record<string, string> | null = null;
onSignOut(() => {
  headersCache = null;
});

/** The session headers for image sources (fetched once, cleared on sign-out). */
function useAuthHeaders() {
  const [h, setH] = React.useState(headersCache);
  React.useEffect(() => {
    if (headersCache) return;
    let live = true;
    void apiHeaders().then((x) => {
      headersCache = x;
      if (live) setH(x);
    });
    return () => {
      live = false;
    };
  }, []);
  return h;
}

export function useAttachmentSource(id: number) {
  const headers = useAuthHeaders();
  return React.useMemo(() => (headers ? { uri: apiUrl(`support/attachments/${id}`), headers, cacheKey: `support-attachment-${id}` } : null), [headers, id]);
}

function ImageViewer({ id, name, onClose }: { id: number; name: string; onClose: () => void }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const source = useAttachmentSource(id);
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent transparent={false}>
      <View style={{ flex: 1, backgroundColor: "#000", paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View style={{ height: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: space[3], gap: space[2] }}>
          <Text variant="callout" weight="600" numberOfLines={1} style={{ flex: 1 }}>
            {name}
          </Text>
          <IconButton tone="surface" accessibilityLabel={t("mobile.a11y.close")} icon={<X size={20} color={colors.text} />} onPress={onClose} />
        </View>
        {source ? <Image source={source} style={{ flex: 1 }} contentFit="contain" cachePolicy="memory" transition={0} accessibilityLabel={name} /> : <ActivityIndicator color={colors.text2} style={{ flex: 1 }} />}
      </View>
    </Modal>
  );
}

export const AttachmentView = React.memo(function AttachmentView({ a, mine }: { a: Attachment; mine: boolean }) {
  const t = useT();
  const [viewing, setViewing] = React.useState(false);
  const [opening, setOpening] = React.useState(false);
  const mime = a.mime ?? "application/octet-stream";
  const name = a.name ?? t("mobileAi.support.attachment");
  const source = useAttachmentSource(a.id);

  if (mime.startsWith("image/"))
    return (
      <>
        <PressableScale onPress={() => setViewing(true)} scaleTo={0.98} accessibilityLabel={t("mobileAi.support.openImage", { name })} testID={`support-attachment-${a.id}`} style={{ width: 220, height: 160, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line }}>
          {source ? <Image source={source} style={{ width: 220, height: 160 }} contentFit="cover" cachePolicy="memory" transition={0} recyclingKey={String(a.id)} accessibilityLabel={name} /> : null}
        </PressableScale>
        {viewing ? <ImageViewer id={a.id} name={name} onClose={() => setViewing(false)} /> : null}
      </>
    );

  const open = async () => {
    if (opening) return;
    setOpening(true);
    const ok = await openAttachment(a.id, name, mime, name);
    setOpening(false);
    if (!ok && Platform.OS !== "web") toast.show({ title: t("mobileAi.support.openFailed"), tone: "error" });
  };
  const kb = Math.max(1, Math.round((a.size ?? 0) / 1024));
  return (
    <PressableScale
      onPress={() => void open()}
      scaleTo={0.98}
      accessibilityLabel={t("mobileAi.support.openFile", { name })}
      testID={`support-attachment-${a.id}`}
      style={{ minHeight: 56, maxWidth: 260, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[3], paddingVertical: space[2], borderRadius: radius.md, backgroundColor: colors.surface2, borderWidth: 1, borderColor: mine ? colors.ember : colors.line }}
    >
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" }}>{opening ? <ActivityIndicator color={colors.text2} /> : <FileText size={18} color={colors.ember} />}</View>
      <View style={{ flexShrink: 1 }}>
        <Text variant="callout" weight="600" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="caption" tone="tertiary">
          {t("support.attachmentSize", { size: kb })}
        </Text>
      </View>
    </PressableScale>
  );
});
