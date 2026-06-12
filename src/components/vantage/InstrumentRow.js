import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
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
  // The price feed has no change field — derive movement from the sparkline
  // series (first vs last close) when an explicit changePct isn't supplied.
  let effChange = (changePct != null && Number.isFinite(changePct)) ? changePct : null;
  if (effChange == null && Array.isArray(sparkData) && sparkData.length >= 2) {
    const first = sparkData[0];
    const last = sparkData[sparkData.length - 1];
    if (first) effChange = ((last - first) / first) * 100;
  }
  const hasChange = effChange != null && Number.isFinite(effChange);
  const positive = (effChange ?? 0) >= 0;
  const sparkColor = positive ? vantage.up : vantage.down;
  const glowColor = positive ? vantage.up : vantage.down;
  const gradId = positive ? 'rowGlowUp' : 'rowGlowDown';

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: vantage.bgPressed }}
      accessibilityRole="button"
      style={styles.row}
    >
      {/* Right-anchored directional glow — only when we actually have a change value,
          otherwise the row stays clean black instead of a misleading green block. */}
      {hasChange ? (
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
          <Defs>
            <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={glowColor} stopOpacity="0" />
              <Stop offset="0.62" stopColor={glowColor} stopOpacity="0" />
              <Stop offset="1" stopColor={glowColor} stopOpacity="0.10" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradId})`} />
        </Svg>
      ) : null}

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
        <Text style={[styles.pct, { color: hasChange ? (positive ? vantage.up : vantage.down) : vantage.textMuted }]}>
          {hasChange ? `${positive ? '+' : ''}${effChange.toFixed(2)}%` : '—'}
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
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.lg,
    gap: space.md,
    position: 'relative',
    overflow: 'hidden',
  },
  left: { flex: 1, minWidth: 0 },
  name: { color: vantage.textPrimary, fontFamily, fontSize: 16, fontWeight: weights.bold },
  sub: { color: vantage.textMuted, fontFamily, fontSize: 12, marginTop: 2 },
  spark: { width: 64 },
  right: { alignItems: 'flex-end', minWidth: 90 },
  price: { color: vantage.textPrimary, fontFamily, fontSize: 16, fontWeight: weights.bold },
  pct: { fontFamily, fontSize: 12, marginTop: 2 },
});

export default memo(InstrumentRow);
