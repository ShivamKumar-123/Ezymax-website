import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { StrategyCard } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';

// Each master card is one full screen-width (minus side padding) and the list
// snaps one card at a time.
const CARD_W = Dimensions.get('window').width - space.lg * 2;

// Copy-trade masters come from `/social/masters` with shape:
//   { _id, displayName, stats: { winRate, activeFollowers, totalProfitGenerated },
//     approvedCommissionPercentage }
// Leaderboard providers (alt source) use { provider_name, total_return_pct, aum }.
// mapItem normalises either into the card's props.
function mapItem(s) {
  const stats = s.stats || {};
  const name = s.provider_name || s.displayName || s.name || s.master_name || 'Master';

  const ret =
    typeof s.total_return_pct === 'number' ? s.total_return_pct
    : typeof s.return_30d === 'number' ? s.return_30d
    : typeof s.roi_30d === 'number' ? s.roi_30d
    : null;
  const winRate =
    typeof stats.winRate === 'number' ? stats.winRate
    : typeof s.win_rate === 'number' ? s.win_rate
    : null;

  // Prefer a real return; otherwise headline the win rate.
  let metricLabel = '30D Return';
  let metricValue = ret;
  let metricSigned = true;
  if (ret == null && winRate != null) {
    metricLabel = 'Win Rate';
    metricValue = winRate;
    metricSigned = false;
  }

  const followers =
    typeof stats.activeFollowers === 'number' ? stats.activeFollowers
    : typeof s.followers === 'number' ? s.followers
    : typeof s.followers_count === 'number' ? s.followers_count
    : typeof s.copiers === 'number' ? s.copiers
    : null;

  // Derive a risk band from the win rate when the backend doesn't send one.
  const riskScore =
    s.risk_score || s.riskLevel || s.risk
    || (winRate != null ? (winRate >= 70 ? 'Low' : winRate >= 55 ? 'Moderate' : 'High') : 'Moderate');

  const chartData =
    Array.isArray(s.equity_curve) ? s.equity_curve
    : Array.isArray(s.performance) ? s.performance
    : Array.isArray(s.chart) ? s.chart
    : null;

  return {
    id: s.id || s._id || s.provider_id || s.account_id,
    name,
    category: s.strategy_info?.category || s.category || s.segment || null,
    metricLabel,
    metricValue,
    metricSigned,
    followers,
    riskScore,
    winRate,
    chartData,
    full: !!s.is_full,
    avatarSeed: name.slice(0, 2).toUpperCase(),
  };
}

// Dev-only placeholders so the carousel can be previewed before `/social/masters`
// returns data. Never shown in production builds (__DEV__ === false).
const SAMPLE_MASTERS = [
  { _id: 'sample-1', displayName: 'Master Hong',   stats: { winRate: 78.4, activeFollowers: 1240, totalProfitGenerated: 182000 } },
  { _id: 'sample-2', displayName: 'MY CFD Master', stats: { winRate: 71.2, activeFollowers: 880,  totalProfitGenerated: 124000 } },
  { _id: 'sample-3', displayName: 'TradeDino',     stats: { winRate: 66.9, activeFollowers: 540,  totalProfitGenerated: 61000 } },
  { _id: 'sample-4', displayName: 'Alpha Forex',   stats: { winRate: 63.5, activeFollowers: 1020, totalProfitGenerated: 98000 } },
  { _id: 'sample-5', displayName: 'SteadyGains',   stats: { winRate: 59.1, activeFollowers: 310,  totalProfitGenerated: 36500 } },
  { _id: 'sample-6', displayName: 'NightHawk FX',  stats: { winRate: 54.0, activeFollowers: 150,  totalProfitGenerated: 8800 } },
];

export default function StrategyCarousel({ strategies = [], onSeeAll }) {
  const nav = useNavigation();

  const data = strategies.length > 0 ? strategies : (__DEV__ ? SAMPLE_MASTERS : []);

  const seeAll = onSeeAll || (() => nav.navigate('TradeTab', { screen: 'Trade' }));

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Copy Trade Masters</Text>
        <Pressable onPress={seeAll} hitSlop={8} accessibilityRole="button" accessibilityLabel="See all copy trade masters">
          <Text style={styles.viewAll}>View All</Text>
        </Pressable>
      </View>
      {data.length === 0 ? (
        <Text style={styles.empty}>No masters yet.</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
          snapToInterval={CARD_W + space.md}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
        >
          {data.map((raw) => {
            const s = mapItem(raw);
            return (
              <StrategyCard
                key={s.id || s.name}
                name={s.name}
                category={s.category}
                metricLabel={s.metricLabel}
                metricValue={s.metricValue}
                metricSigned={s.metricSigned}
                followers={s.followers}
                riskScore={s.riskScore}
                winRate={s.winRate}
                chartData={s.chartData}
                status={s.full ? 'full' : 'open'}
                avatarSymbol={s.avatarSeed}
                onPress={seeAll}
                width={CARD_W}
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
  viewAll: { color: vantage.accent, fontFamily, fontSize: sizes.body, fontWeight: weights.semibold },
  empty: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, paddingHorizontal: space.lg, paddingBottom: space.md },
  row: { gap: space.md, paddingHorizontal: space.lg, paddingBottom: space.sm },
});
