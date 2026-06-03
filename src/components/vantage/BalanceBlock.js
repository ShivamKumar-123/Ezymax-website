import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';

export default function BalanceBlock({
  label,
  amount,
  currency = 'USD',
  hidden,
  onToggleHide,
  subLabel,
  subAmount,
  subPositive,
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.labRow}>
        <Text style={styles.label}>{label}</Text>
        {onToggleHide ? (
          <Pressable onPress={onToggleHide} hitSlop={10} accessibilityRole="button" accessibilityLabel={hidden ? 'Show balance' : 'Hide balance'}>
            <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={14} color={vantage.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.amtRow}>
        <Text style={styles.amount}>
          {hidden ? '••••••' : formatMoney(amount)}
        </Text>
        <View style={styles.ccyChip}>
          <Text style={styles.ccyTxt}>{currency} ▾</Text>
        </View>
      </View>
      {subLabel ? (
        <View style={styles.subRow}>
          <Text style={styles.subLab}>{subLabel}</Text>
          <Text style={[styles.subAmt, { color: subPositive ? vantage.up : vantage.down }]}>
            {hidden ? '••' : (subAmount != null ? formatSigned(subAmount) : '—')}
          </Text>
          <Text style={styles.subLab}>{currency}</Text>
        </View>
      ) : null}
    </View>
  );
}

function formatMoney(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatSigned(v) {
  const sign = v >= 0 ? '+' : '−';
  return sign + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const styles = StyleSheet.create({
  wrap: { gap: 4, paddingVertical: space.sm },
  labRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  label: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  amtRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  amount: { color: vantage.textPrimary, fontFamily, fontSize: sizes.hero, fontWeight: weights.heavy },
  ccyChip: { backgroundColor: vantage.bgRaised, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: 6 },
  ccyTxt: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 2 },
  subLab: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  subAmt: { fontFamily, fontSize: sizes.body, fontWeight: weights.bold },
});
