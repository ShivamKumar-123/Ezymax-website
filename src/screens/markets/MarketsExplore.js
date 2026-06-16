import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import {
  Card,
  CategoryTabs,
  QuickActionTile,
  SpotlightCard,
  MoversBars,
  InstrumentRow,
} from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';
import { topRisers, topFallers, bySegment, MARQUEE_SPOTLIGHT } from '../../utils/marketMovers';

const SEGMENT_OPTIONS = [
  { value: 'overview',    label: 'Overview' },
  { value: 'indices',     label: 'Indices' },
  { value: 'forex',       label: 'Forex' },
  { value: 'crypto',      label: 'Crypto' },
  { value: 'metals',      label: 'Metals' },
  { value: 'shares',      label: 'Shares' },
];

export default function MarketsExplore({
  segment,
  onChangeSegment,
  instruments,
  pricesBySymbol,
  sparksBySymbol,
  moversDirection,
  onChangeMoversDirection,
  onPressInstrument,
}) {
  const nav = useNavigation();

  const spotlightItems = useMemo(() => {
    return MARQUEE_SPOTLIGHT.map((sym) => {
      const p = pricesBySymbol[sym] || {};
      const i = instruments.find((x) => String(x.symbol || '').toUpperCase() === sym);
      return {
        symbol: sym,
        subtitle: i?.display_name || i?.name || sym,
        price: p.bid != null ? Number(p.bid) : (p.price != null ? Number(p.price) : 0),
        changePct: p.change_pct != null ? Number(p.change_pct) : (p.changePct != null ? Number(p.changePct) : 0),
      };
    });
  }, [pricesBySymbol, instruments]);

  const movers = useMemo(() => {
    const fn = moversDirection === 'down' ? topFallers : topRisers;
    return fn(pricesBySymbol, 5).map((p) => ({
      symbol: String(p.symbol || '').toUpperCase(),
      changePct: Number(p.change_pct ?? p.changePct ?? 0),
    }));
  }, [pricesBySymbol, moversDirection]);

  const essentials = useMemo(() => {
    return bySegment(instruments, segment).slice(0, 20);
  }, [instruments, segment]);

  return (
    <View>
      <CategoryTabs
        value={segment}
        onChange={onChangeSegment}
        options={SEGMENT_OPTIONS}
      />

      <View style={styles.section}>
        <SpotlightCard brandLabel="Cresta" items={spotlightItems} />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Market Movers</Text>
          <Pressable onPress={onChangeMoversDirection} hitSlop={8} accessibilityRole="button">
            <Text style={styles.sectionAction}>{moversDirection === 'up' ? 'Top risers' : 'Top fallers'} ⇄</Text>
          </Pressable>
        </View>
        <Card>
          {movers.length === 0 ? (
            <Text style={styles.empty}>No movers yet.</Text>
          ) : (
            <MoversBars items={movers} direction={moversDirection} />
          )}
        </Card>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Essentials</Text>
          <Pressable onPress={() => onChangeSegment('overview')} hitSlop={8} accessibilityRole="button">
            <Ionicons name="chevron-forward" size={20} color={vantage.textMuted} />
          </Pressable>
        </View>
        {essentials.length === 0 ? (
          <Text style={styles.empty}>No instruments in this segment.</Text>
        ) : essentials.map((i) => {
          const sym = String(i.symbol || '').toUpperCase();
          const p = pricesBySymbol[sym] || {};
          return (
            <InstrumentRow
              key={sym}
              symbol={sym}
              name={i.display_name || i.name || sym}
              subtitle={i.description || undefined}
              price={p.bid != null ? Number(p.bid) : (p.price != null ? Number(p.price) : null)}
              changePct={p.change_pct != null ? Number(p.change_pct) : (p.changePct != null ? Number(p.changePct) : null)}
              sparkData={sparksBySymbol[sym] || []}
              onPress={() => onPressInstrument(sym)}
              upColor="#FBAA45"
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  quickRow: { flexDirection: 'row', paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.md },
  section: { paddingHorizontal: space.lg, paddingVertical: space.sm },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.sm },
  sectionTitle: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy },
  sectionAction: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },
  empty: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, padding: space.md, textAlign: 'center' },
});
