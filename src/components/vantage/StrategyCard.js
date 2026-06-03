import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Card from './Card';
import SymbolIcon from './SymbolIcon';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';

export default function StrategyCard({
  name,
  category,
  return30d,
  aum,
  status,
  avatarSymbol,
  onPress,
  width = 220,
}) {
  const positive = (return30d ?? 0) >= 0;
  return (
    <Card onPress={onPress} style={{ width }} padding={space.lg}>
      <View style={styles.head}>
        <SymbolIcon symbol={avatarSymbol || name?.slice(0, 2) || '??'} size={36} />
        <View style={styles.headText}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {category ? <View style={styles.badge}><Text style={styles.badgeTxt}>{category}</Text></View> : null}
        </View>
        {status === 'full' ? <View style={styles.full}><Text style={styles.fullTxt}>Full</Text></View> : null}
      </View>
      <View style={styles.stats}>
        <Text style={styles.lab}>30D Return</Text>
        <Text style={[styles.val, { color: positive ? vantage.up : vantage.down }]}>
          {return30d != null ? `${positive ? '+' : ''}${return30d.toFixed(2)}%` : '—'}
        </Text>
      </View>
      {aum != null ? (
        <View style={styles.stats}>
          <Text style={styles.lab}>AUM</Text>
          <Text style={styles.aum}>${formatAum(aum)}</Text>
        </View>
      ) : null}
    </Card>
  );
}

function formatAum(v) {
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toFixed(2);
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  headText: { flex: 1, minWidth: 0 },
  name: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.heavy },
  badge: { alignSelf: 'flex-start', backgroundColor: vantage.bgPressed, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.sm, marginTop: 2 },
  badgeTxt: { color: vantage.textSecondary, fontFamily, fontSize: sizes.micro, fontWeight: weights.medium },
  full: { backgroundColor: vantage.bgPressed, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.sm },
  fullTxt: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro, fontWeight: weights.semibold },
  stats: { marginTop: space.sm },
  lab: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  val: { fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy },
  aum: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold },
});
