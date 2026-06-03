import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { StrategyCard } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';

// Backend `/social/leaderboard` items have shape:
//   { id, user_id, provider_name, total_return_pct, max_drawdown_pct,
//     sharpe_ratio, followers_count, performance_fee_pct, min_investment,
//     description, strategy_info, created_at, is_copying }
function mapItem(s) {
  return {
    id: s.id || s.provider_id || s.account_id,
    name: s.provider_name || s.name || s.display_name || 'Strategy',
    category: s.strategy_info?.category || s.category || s.segment || null,
    return30d:
      typeof s.total_return_pct === 'number' ? s.total_return_pct
      : typeof s.return_30d === 'number' ? s.return_30d
      : typeof s.roi_30d === 'number' ? s.roi_30d
      : null,
    aum: typeof s.aum === 'number' ? s.aum
      : typeof s.aum_usd === 'number' ? s.aum_usd
      : typeof s.total_aum === 'number' ? s.total_aum
      : null,
    full: !!s.is_full,
    avatarSeed: (s.provider_name || s.name || 'ST').slice(0, 2).toUpperCase(),
  };
}

export default function StrategyCarousel({ strategies = [], onSeeAll }) {
  const nav = useNavigation();

  const open = (id) => {
    if (!id) return;
    nav.navigate('TradeTab', { screen: 'StrategyDetail', params: { providerId: id } });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Best Overall Strategies</Text>
        <Pressable onPress={onSeeAll || (() => nav.navigate('TradeTab', { screen: 'Trade' }))} hitSlop={8} accessibilityRole="button" accessibilityLabel="See all strategies">
          <Ionicons name="chevron-forward" size={20} color={vantage.textMuted} />
        </Pressable>
      </View>
      {strategies.length === 0 ? (
        <Text style={styles.empty}>No strategies yet.</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {strategies.map((raw) => {
            const s = mapItem(raw);
            return (
              <StrategyCard
                key={s.id || s.name}
                name={s.name}
                category={s.category}
                return30d={s.return30d}
                aum={s.aum}
                status={s.full ? 'full' : 'open'}
                avatarSymbol={s.avatarSeed}
                onPress={() => open(s.id)}
              />
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: space.md },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  heading: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy },
  empty: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, paddingHorizontal: space.lg, paddingBottom: space.md },
  row: { gap: space.md, paddingHorizontal: space.lg, paddingBottom: space.sm },
});
