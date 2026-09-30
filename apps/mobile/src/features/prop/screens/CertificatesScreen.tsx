// Certificates (/prop/certificates): every passed phase, funded account and payout, as colour tiles; the viewer
// draws the full certificate and shares it as an image or a verify link.
import * as React from "react";
import { RefreshControl, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useT } from "@/i18n";
import { EmptyState, Screen, Skeleton, Text, useBottomInset } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { useCertificates } from "../api";
import type { Certificate } from "../types";
import { LoadState, StackHeader, useRefresh } from "../components/bits";
import { CertificateSheet, CertificateTile, type CertificateSheetHandle } from "../components/Certificates";

export function CertificatesScreen() {
  const t = useT();
  const router = useRouter();
  const bottom = useBottomInset(false);
  const q = useCertificates();
  const sheet = React.useRef<CertificateSheetHandle>(null);
  const open = React.useCallback((c: Certificate) => sheet.current?.open(c), []);
  const { refreshing, onRefresh } = useRefresh(q.refresh);
  const list = q.data?.certificates ?? [];

  const header = (
    <StackHeader
      eyebrow={t("mobileProp.home.eyebrow")}
      title={t("mobileProp.certs.title")}
      fallback="/prop"
      sub={
        <Text tone="secondary" style={{ marginTop: space[1] }}>
          {t("mobileProp.certs.subtitle")}
        </Text>
      }
    />
  );

  return (
    <Screen scroll={false} tabBar={false}>
      {!q.data && q.loading ? (
        <>
          {header}
          <View style={{ paddingHorizontal: GUTTER, gap: space[3] }}>
            <Skeleton h={208} r={radius.block} />
            <Skeleton h={208} r={radius.block} />
          </View>
        </>
      ) : !q.data ? (
        <>
          {header}
          <LoadState error={q.error} onRetry={() => void onRefresh()} />
        </>
      ) : (
        <FlashList
          data={list}
          keyExtractor={(c) => c.code}
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: GUTTER, paddingBottom: space[3] }}>
              <CertificateTile c={item} onOpen={open} />
            </View>
          )}
          ListHeaderComponent={header}
          ListEmptyComponent={<EmptyState illustration="propPassed" title={t("mobileProp.certs.emptyTitle")} body={t("mobileProp.certs.emptyBody")} action={t("mobileProp.certs.emptyAction")} onAction={() => router.navigate("/prop")} />}
          contentContainerStyle={{ paddingBottom: bottom + space[6] }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />}
        />
      )}
      <CertificateSheet ref={sheet} />
    </Screen>
  );
}
