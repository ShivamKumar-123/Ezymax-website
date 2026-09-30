// A view-only login's sign-in details, shown once after it is created or given a new password (the gateway never
// shows the password again). Each value copies on its own; "Copy all" copies the three lines.
import * as React from "react";
import { View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { AlertTriangle, Copy } from "lucide-react-native";
import { useT } from "@/i18n";
import { API_BASE } from "@/lib/config";
import { cachedConfig } from "@/market/config";
import { Button, Display, IconButton, Mono, Sheet, Text, toast, type SheetRef } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";

export type Creds = { username: string; password: string; label: string };

export const CredentialsSheet = React.forwardRef<SheetRef, { creds: Creds | null; onDone: () => void }>(function CredentialsSheet({ creds, onDone }, ref) {
  const t = useT();
  const inner = React.useRef<SheetRef>(null);
  React.useImperativeHandle(ref, () => inner.current as SheetRef, []);
  const page = `${(cachedConfig()?.clientAreaUrl ?? API_BASE).replace(/\/+$/, "")}/login`;
  const rows: [string, string, string][] = creds
    ? [
        ["page", t("security.creds.page"), page],
        ["viewer-id", t("security.creds.viewerId"), creds.username],
        ["password", t("security.creds.password"), creds.password],
      ]
    : [];
  const copy = async (what: string, value: string) => {
    await Clipboard.setStringAsync(value);
    toast.show({ title: t("mobileProfile.copied", { what }) });
  };
  return (
    <Sheet ref={inner} onDismiss={onDone} enablePanDownToClose={false}>
      <View style={{ gap: space[3], paddingTop: space[2] }} testID="viewer-creds">
        <Display size="md">{t("security.creds.title")}</Display>
        {creds ? <Text tone="secondary">{t("security.creds.description", { label: creds.label })}</Text> : null}
        {rows.map(([id, label, value]) => (
          <View key={id} style={{ flexDirection: "row", alignItems: "center", gap: space[3], paddingStart: space[4], paddingEnd: space[1], paddingVertical: space[2], borderRadius: radius.md, backgroundColor: colors.surface2 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label" tone="tertiary">
                {label}
              </Text>
              <Mono size={15} weight="medium" selectable testID={`viewer-cred-${id}`} style={{ writingDirection: "ltr" }}>
                {value}
              </Mono>
            </View>
            <IconButton tone="ghost" accessibilityLabel={`${t("mobileProfile.copy")} ${label}`} icon={<Copy size={18} color={colors.text2} />} onPress={() => void copy(label, value)} />
          </View>
        ))}
        <View style={{ flexDirection: "row", gap: space[2], alignItems: "flex-start" }}>
          <AlertTriangle size={16} color={colors.gold} style={{ marginTop: 1 }} />
          <Text variant="caption" tone="gold" style={{ flex: 1 }}>
            {t("security.creds.warning")}
          </Text>
        </View>
        <Button
          label={t("mobileProfile.viewers.copyAll")}
          variant="secondary"
          icon={<Copy size={18} color={colors.text} />}
          onPress={() => {
            void Clipboard.setStringAsync(rows.map(([, l, v]) => `${l}: ${v}`).join("\n"));
            toast.show({ title: t("mobileProfile.viewers.credsCopied") });
          }}
        />
        <Button label={t("security.creds.saved")} onPress={() => inner.current?.dismiss()} testID="viewer-creds-done" />
      </View>
    </Sheet>
  );
});
