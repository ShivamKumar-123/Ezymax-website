// "Share P&L" for a closed trade: a branded matte card (the Kalks mark, the symbol, the side, the result in % and in
// money, the close date) drawn with Skia and sent as a PNG through the phone's share sheet. It never shows a balance,
// equity, account number or volume. The client's referral code (the partner programme's, with its link as a QR
// code) is added when the partner API has one and the reader keeps it on.
import * as React from "react";
import { useWindowDimensions, View } from "react-native";
import { useFormat, useLocale, useT } from "@/i18n";
import { apiGet } from "@/lib/api";
import { fmtMoney, fmtPct, fmtPrice } from "@/lib/format";
import { useQuery } from "@/lib/query";
import { instrument } from "@/market/instruments";
import { useSession } from "@/session";
import { Button, Checkbox, Display, Sheet, Text, toast, type SheetRef } from "@/ui";
import { space } from "@/theme/tokens";
import { PARTNER_KEYS } from "@/features/partner/api";
import { sharePng } from "@/features/partner/share";
import type { Dashboard } from "@/features/partner/types";
import { fetchMenu, QK } from "@/features/profile/api";
import type { EngDeal } from "../../trading/types";
import { ShareCardCanvas, type CardText, type ShareCardHandle } from "./canvas";
import { referralLink, shareFileName, shareTrade, type ShareTrade } from "./pnl";

export type ShareSheetHandle = { open: (deal: EngDeal, currency: string) => void };

export const ShareSheet = React.forwardRef<ShareSheetHandle>(function ShareSheet(_, ref) {
  const sheet = React.useRef<SheetRef>(null);
  const [trade, setTrade] = React.useState<{ key: number; trade: ShareTrade } | null>(null);
  React.useImperativeHandle(ref, () => ({
    open: (d, currency) => {
      setTrade({ key: d.id, trade: shareTrade(d, currency, instrument(d.symbol).digits) });
      requestAnimationFrame(() => sheet.current?.present());
    },
  }));
  return (
    <Sheet ref={sheet} scrollable onDismiss={() => setTrade(null)}>
      {trade ? <ShareBody key={trade.key} trade={trade.trade} done={() => sheet.current?.dismiss()} /> : null}
    </Sheet>
  );
});

/** The partner dashboard (same key and answer as the Partner screens): the client's referral code and link base. */
const fetchPartner = () => apiGet<Dashboard>("partner");

function ShareBody({ trade, done }: { trade: ShareTrade; done: () => void }) {
  const t = useT();
  const fmt = useFormat();
  const { rtl } = useLocale();
  const { width } = useWindowDimensions();
  const viewer = useSession((s) => !!s.viewer);
  // the broker's switches and brand (the More tab's menu, kept on the phone)
  const menu = useQuery(QK.menu, fetchMenu, { persist: true, staleMs: 5 * 60_000 }).data;
  // the partner programme's code, when the broker runs it (a view-only login never shares the owner's code)
  const partner = useQuery<Dashboard>(!viewer && menu?.modules?.ib !== false ? PARTNER_KEYS.dash : null, fetchPartner, { persist: true, staleMs: 5 * 60_000 });
  const member = partner.data?.member;
  const code = member && (!member.status || member.status === "active") ? member.code : undefined;
  const link = referralLink(partner.data?.linkBase, code);
  const [withCode, setWithCode] = React.useState(true);
  const showCode = withCode && !!code;
  const brand = menu?.brand?.name || "Kalks";
  // where to find the broker: its website, else the Client Area's own address
  const site = hostOf(menu?.brand?.website) ?? hostOf(partner.data?.linkBase);

  const side = t(trade.side === "buy" ? "common.buy" : "common.sell");
  const text: CardText = React.useMemo(
    () => ({
      symbol: trade.symbol,
      side: side.toUpperCase(),
      prices: trade.open !== null ? `${fmtPrice(trade.open, trade.digits)} → ${fmtPrice(trade.close, trade.digits)}` : fmtPrice(trade.close, trade.digits),
      date: fmt.date(trade.time),
      resultLabel: t("mobilePortfolio.share.result"),
      pct: trade.pct !== null ? fmtPct(trade.pct) : null,
      money: fmtMoney(trade.net, { signed: true, currency: trade.currency }),
      up: Math.abs(trade.net) < 0.005 ? null : trade.net > 0,
      footerLabel: showCode ? t("mobilePortfolio.share.footerCode", { brand }) : site ? t("mobilePortfolio.share.footer", { brand }) : null,
      footerBig: showCode ? code! : (site ?? t("mobilePortfolio.share.footer", { brand })),
      footerSmall: showCode && link ? link.replace(/^https?:\/\//, "") : null,
      qr: showCode ? link : null,
      rtl,
    }),
    [trade, side, fmt, t, showCode, code, link, brand, site, rtl],
  );

  const card = React.useRef<ShareCardHandle>(null);
  const [ready, setReady] = React.useState(false);
  const onReady = React.useCallback(() => setReady(true), []);
  const [busy, setBusy] = React.useState(false);
  const share = async () => {
    setBusy(true);
    const bytes = await card.current?.png().catch(() => null);
    const shared = bytes ? await sharePng(bytes, shareFileName(trade), t("mobilePortfolio.share.title")).catch(() => false) : false;
    setBusy(false);
    if (!bytes) toast.show({ title: t("mobilePortfolio.share.failed"), tone: "error" });
    else if (!shared) toast.show({ title: t("mobilePortfolio.share.unavailable") });
    else done();
  };

  const previewW = Math.min(width - space[5] * 2, 340);
  return (
    <View style={{ gap: space[4] }}>
      <View style={{ gap: space[1] }}>
        <Display size="md">{t("mobilePortfolio.share.title")}</Display>
        <Text tone="secondary">{t("mobilePortfolio.share.body")}</Text>
      </View>
      <View style={{ alignItems: "center" }} accessible accessibilityRole="image" accessibilityLabel={t("mobilePortfolio.share.a11y", { symbol: trade.symbol, side, result: [text.pct, text.money].filter(Boolean).join(" · "), date: text.date })}>
        <ShareCardCanvas ref={card} text={text} width={previewW} onReady={onReady} />
      </View>
      {code ? (
        <Checkbox checked={withCode} onChange={setWithCode}>
          <Text variant="callout">{t("mobilePortfolio.share.withCode", { code })}</Text>
        </Checkbox>
      ) : null}
      <Button label={t("mobilePortfolio.share.action")} loading={busy} disabled={!ready} onPress={() => void share()} testID="share-pnl" />
    </View>
  );
}

/** "https://kalkstrade.com" -> "kalkstrade.com" */
function hostOf(url: string | undefined): string | null {
  const m = url ? /^https?:\/\/([^/:?#]+)/i.exec(url) : null;
  return m?.[1] ? m[1].toLowerCase() : null;
}
