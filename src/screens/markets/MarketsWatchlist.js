import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { InstrumentRow, CategoryTabs } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';
import { bySegment } from '../../utils/marketMovers';

const FILTER_OPTIONS = [
  { value: 'all',     label: 'All' },
  { value: 'indices', label: 'Indices' },
  { value: 'crypto',  label: 'Crypto' },
  { value: 'metals',  label: 'Metals' },
];

export default function MarketsWatchlist({
  pinnedSymbols = [],
  instruments = [],
  pricesBySymbol = {},
  sparksBySymbol = {},
  onPressInstrument,
  onEdit,
  onAdd,
}) {
  const nav = useNavigation();
  const [filter, setFilter] = useState('all');

  const visible = useMemo(() => {
    if (filter === 'all') return pinnedSymbols;
    const allowed = new Set(
      bySegment(instruments, filter).map((i) => String(i.symbol || '').toUpperCase())
    );
    return pinnedSymbols.filter((s) => allowed.has(String(s).toUpperCase()));
  }, [filter, pinnedSymbols, instruments]);

  return (
    <View>
      <View style={styles.filterRow}>
        <View style={{ flex: 1 }}>
          <CategoryTabs value={filter} onChange={setFilter} options={FILTER_OPTIONS} />
        </View>
        <Pressable onPress={onEdit || (() => {})} hitSlop={8} accessibilityRole="button" accessibilityLabel="Edit watchlist filters">
          <Ionicons name="options-outline" size={22} color={vantage.textMuted} />
        </Pressable>
      </View>

      {pinnedSymbols.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="bookmark-outline" size={48} color={vantage.textMuted} />
          <Text style={styles.emptyTitle}>No pinned instruments</Text>
          <Text style={styles.emptySub}>Tap + Add to pin symbols here.</Text>
        </View>
      ) : visible.length === 0 ? (
        <Text style={styles.emptyInline}>No pinned instruments in this category.</Text>
      ) : (
        visible.map((sym) => {
          const upper = String(sym).toUpperCase();
          const p = pricesBySymbol[upper] || pricesBySymbol[sym] || {};
          const inst = instruments.find((x) => String(x.symbol || '').toUpperCase() === upper);
          return (
            <InstrumentRow
              key={sym}
              symbol={upper}
              name={inst?.display_name || inst?.name || upper}
              subtitle={inst?.description || undefined}
              price={p.bid != null ? Number(p.bid) : (p.price != null ? Number(p.price) : null)}
              changePct={p.change_pct != null ? Number(p.change_pct) : (p.changePct != null ? Number(p.changePct) : null)}
              sparkData={sparksBySymbol[upper] || []}
              onPress={() => onPressInstrument(upper)}
            />
          );
        })
      )}

      <Pressable
        onPress={onAdd || (() => nav.navigate('WatchlistEdit'))}
        style={styles.addSymbol}
        accessibilityRole="button"
        accessibilityLabel="Add symbol to watchlist"
      >
        <Ionicons name="add" size={20} color={vantage.accent} />
        <Text style={styles.addSymbolTxt}>Add Symbol</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', alignItems: 'center', paddingRight: space.lg, gap: space.sm },
  emptyWrap: { alignItems: 'center', paddingVertical: space.huge, paddingHorizontal: space.xl, gap: space.sm },
  emptyTitle: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold },
  emptySub: { color: vantage.textMuted, fontFamily, fontSize: sizes.body },
  emptyInline: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, padding: space.lg, textAlign: 'center' },
  addSymbol: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs,
    marginHorizontal: space.lg, marginTop: space.lg,
    paddingVertical: space.md, borderRadius: radius.lg,
    borderWidth: 1, borderColor: vantage.accent, borderStyle: 'dashed',
  },
  addSymbolTxt: { color: vantage.accent, fontFamily, fontSize: sizes.body, fontWeight: weights.bold },
});
