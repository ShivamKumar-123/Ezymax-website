import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import SymbolIcon from './SymbolIcon';
import Sparkline from './Sparkline';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';

function InstrumentRow({
  symbol,
  name,
  subtitle,
  price,
  changePct,
  sparkData,
  onPress,
  rightExtra,
}) {
  const positive = (changePct ?? 0) >= 0;
  const sparkColor = positive ? vantage.up : vantage.down;
  const rowTint = positive ? vantage.upMuted : vantage.downMuted;

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: vantage.bgPressed }}
      accessibilityRole="button"
      style={styles.row}
    >
      <View style={[styles.tint, { backgroundColor: rowTint }]} />
      <SymbolIcon symbol={symbol} size={40} />
      <View style={styles.left}>
        <Text style={styles.name} numberOfLines={1}>{name || symbol}</Text>
        {subtitle ? <Text style={styles.sub} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <View style={styles.spark}>
        <Sparkline data={sparkData || []} color={sparkColor} width={64} height={28} />
      </View>
      <View style={styles.right}>
        <Text style={styles.price}>{formatPrice(price)}</Text>
        <Text style={[styles.pct, { color: positive ? vantage.up : vantage.down }]}>
          {changePct != null ? `${positive ? '+' : ''}${changePct.toFixed(2)}%` : '—'}
        </Text>
      </View>
      {rightExtra}
    </Pressable>
  );
}

function formatPrice(p) {
  if (p == null || !Number.isFinite(p)) return '—';
  if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(2);
  return p.toFixed(5);
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    gap: space.md,
    position: 'relative',
  },
  tint: { ...StyleSheet.absoluteFillObject, opacity: 0.6 },
  left: { flex: 1, minWidth: 0 },
  name: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold },
  sub: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2 },
  spark: { width: 64 },
  right: { alignItems: 'flex-end', minWidth: 90 },
  price: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold },
  pct: { fontFamily, fontSize: sizes.label, marginTop: 2 },
});

export default memo(InstrumentRow);
