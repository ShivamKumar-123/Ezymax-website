// USDT network choice: two big blocks side by side (BEP20 / TRC20). The chosen one turns cream; a network the
// broker has paused is shown dimmed and can't be picked. Everything shown comes from the wallet config.
import * as React from "react";
import { View } from "react-native";
import { Check } from "lucide-react-native";
import { useT } from "@/i18n";
import { Display, PressableScale, Text } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { CHAIN_LABEL, type Chain, type ChainConfig } from "../api";
import { fmtAmount } from "../lib/money";

export function NetworkPicker({ chains, value, onChange, mode, disabled }: { chains: ChainConfig[]; value: Chain | null; onChange: (c: Chain) => void; mode: "deposit" | "withdraw"; disabled?: boolean }) {
  const t = useT();
  return (
    <View style={{ flexDirection: "row", gap: space[3] }} accessibilityRole="radiogroup">
      {chains.map((c) => {
        const enabled = mode === "deposit" ? c.deposits_enabled : c.withdrawals_enabled;
        const on = c.chain === value;
        const fg = on ? colors.ink : colors.text;
        const sub = on ? colors.ink2 : colors.text3;
        const detail =
          mode === "deposit"
            ? t("mobileWallet.network.depositDetail", { min: fmtAmount(c.min_deposit), count: c.confirmations })
            : Number(c.withdraw_fee) > 0
              ? t("mobileWallet.network.networkFee", { fee: fmtAmount(c.withdraw_fee) })
              : t("mobileWallet.network.noNetworkFee");
        return (
          <PressableScale
            key={c.chain}
            disabled={!enabled || disabled}
            haptics="select"
            onPress={() => onChange(c.chain)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, disabled: !enabled || disabled }}
            accessibilityLabel={`USDT ${CHAIN_LABEL[c.chain].short}, ${CHAIN_LABEL[c.chain].name}`}
            testID={`network-${c.chain}`}
            style={{ flex: 1, minHeight: 124, borderRadius: radius.lg + 2, padding: space[4], gap: space[1], backgroundColor: on ? colors.cream : colors.surface, borderWidth: 1, borderColor: on ? colors.cream : colors.line }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Display size="sm" color={fg}>
                {CHAIN_LABEL[c.chain].short}
              </Display>
              {on ? (
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" }}>
                  <Check size={14} color={colors.cream} strokeWidth={3} />
                </View>
              ) : null}
            </View>
            <Text variant="callout" weight="600" color={fg} numberOfLines={1}>
              {CHAIN_LABEL[c.chain].name}
            </Text>
            <View style={{ flex: 1 }} />
            <Text variant="caption" color={sub} numberOfLines={2}>
              {enabled ? detail : t("mobileWallet.network.paused")}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}
