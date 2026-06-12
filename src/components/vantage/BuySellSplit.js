import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';

export default function BuySellSplit({
  bid,
  ask,
  spreadPoints,
  side,
  onChange,
  changePoints,
}) {
  return (
    <View>
      <View style={styles.row}>
        <Pressable
          onPress={() => onChange('sell')}
          style={[styles.half, styles.left, { backgroundColor: side === 'sell' ? vantage.sellBtn : vantage.sellBtnDim }]}
          accessibilityRole="button"
          accessibilityState={{ selected: side === 'sell' }}
        >
          <Text style={styles.lab}>Sell</Text>
          <Text style={styles.price}>{formatPrice(bid)}</Text>
        </Pressable>
        <View style={styles.chip}>
          <Text style={styles.chipTxt}>{spreadPoints != null ? spreadPoints : '—'}</Text>
        </View>
        <Pressable
          onPress={() => onChange('buy')}
          style={[styles.half, styles.right, { backgroundColor: side === 'buy' ? vantage.buyBtn : vantage.buyBtnDim }]}
          accessibilityRole="button"
          accessibilityState={{ selected: side === 'buy' }}
        >
          <Text style={styles.lab}>Buy</Text>
          <Text style={styles.price}>{formatPrice(ask)}</Text>
        </Pressable>
      </View>
      <View style={styles.changeRow}>
        <View style={styles.changeBar}>
          <View style={[styles.changeSeg, styles.segLeft, { backgroundColor: vantage.buyBtn }]} />
          <View style={[styles.changeSeg, styles.segRight, { backgroundColor: vantage.sellBtn }]} />
        </View>
        <View style={styles.changeMarker}>
          <Text style={[styles.changeArrow, { color: (changePoints ?? 0) >= 0 ? vantage.buyBtn : vantage.sellBtn }]}>
            {(changePoints ?? 0) >= 0 ? '▲' : '▼'}
          </Text>
          <Text style={styles.changeNum}>{changePoints != null ? Math.abs(changePoints) : 0}</Text>
        </View>
      </View>
    </View>
  );
}

function formatPrice(p) {
  if (p == null) return '—';
  if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return p.toFixed(5);
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch', height: 58, position: 'relative' },
  half: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
  left:  { borderTopLeftRadius: radius.lg, borderBottomLeftRadius: radius.lg },
  right: { borderTopRightRadius: radius.lg, borderBottomRightRadius: radius.lg },
  chip: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: [{ translateX: -22 }, { translateY: -12 }],
    width: 44, height: 24,
    backgroundColor: vantage.spreadChip,
    borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: vantage.borderStrong,
    zIndex: 1,
  },
  chipTxt: { color: vantage.textPrimary, fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
  lab: { color: vantage.textPrimary, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },
  price: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.heavy, marginTop: 1 },
  changeRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.sm, gap: space.sm },
  changeBar: { flex: 1, height: 3, flexDirection: 'row', borderRadius: 2, overflow: 'hidden' },
  changeSeg: { flex: 1, height: 3 },
  segLeft: { borderTopLeftRadius: 2, borderBottomLeftRadius: 2 },
  segRight: { borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  changeMarker: { alignItems: 'center', minWidth: 20 },
  changeArrow: { fontFamily, fontSize: 9, lineHeight: 11 },
  changeNum: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro, fontWeight: weights.semibold },
});
