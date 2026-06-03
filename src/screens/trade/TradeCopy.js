import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Card, SegmentedTabs, CategoryTabs, SymbolIcon } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';
import ApiService from '../../services/ApiService';

const SORT_OPTIONS = [
  { value: 'most_copied',     label: 'Most Copied' },
  { value: 'highest_return',  label: 'Highest Return' },
  { value: 'highest_win_rate',label: 'Highest Win Rate' },
];

export default function TradeCopy() {
  const nav = useNavigation();
  const [tab, setTab] = useState('discover');
  const [sort, setSort] = useState('most_copied');
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await ApiService.getLeaderboard({ sort, limit: 30 });
        const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
        if (!cancelled) setProviders(list);
      } catch (_) {
        if (!cancelled) setProviders([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sort]);

  const top1 = providers[0];
  const rest = providers.slice(1);

  return (
    <View>
      <Card style={styles.becomeCard} onPress={() => nav.navigate('Business')}>
        <View style={styles.becomeRow}>
          <View style={[styles.iconCircle, { backgroundColor: vantage.accentMuted }]}>
            <Ionicons name="radio-outline" size={22} color={vantage.accent} />
          </View>
          <Text style={styles.becomeTxt}>Become a Signal Provider</Text>
          <Ionicons name="chevron-forward" size={18} color={vantage.textMuted} />
        </View>
      </Card>

      <View style={{ paddingHorizontal: space.lg }}>
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'discover',  label: 'Discover' },
            { value: 'community', label: 'Community' },
          ]}
        />
      </View>

      {tab === 'discover' ? (
        <>
          {top1 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Best Overall Strategy</Text>
              <Card onPress={() => nav.navigate('StrategyDetail', { providerId: top1.id || top1.provider_id })}>
                <BigStrategyRow item={top1} />
              </Card>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Leaderboards</Text>
            <CategoryTabs value={sort} onChange={setSort} options={SORT_OPTIONS} />
            {loading ? (
              <Text style={styles.empty}>Loading…</Text>
            ) : rest.length === 0 ? (
              <Text style={styles.empty}>No strategies yet.</Text>
            ) : rest.map((p) => (
              <Pressable
                key={p.id || p.provider_id || p.name}
                onPress={() => nav.navigate('StrategyDetail', { providerId: p.id || p.provider_id })}
                android_ripple={{ color: vantage.bgPressed }}
                style={styles.row}
              >
                <StrategyMiniRow item={p} />
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <View style={styles.section}>
          <Text style={styles.empty}>Community feed coming soon.</Text>
        </View>
      )}
    </View>
  );
}

function BigStrategyRow({ item }) {
  const ret = Number(item.total_return_pct ?? item.return_30d ?? item.roi_30d ?? 0);
  const positive = ret >= 0;
  const aum = item.total_aum ?? item.aum ?? item.aum_usd ?? null;
  const displayName = item.provider_name || item.name || 'Strategy';
  const displayCategory = item.strategy_info?.category || item.category || null;
  return (
    <View style={bigStyles.wrap}>
      <View style={bigStyles.head}>
        <SymbolIcon symbol={displayName.slice(0, 2).toUpperCase()} size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={bigStyles.name}>{displayName}</Text>
          {displayCategory ? (
            <View style={bigStyles.badge}><Text style={bigStyles.badgeTxt}>{displayCategory}</Text></View>
          ) : null}
        </View>
        {item.is_full ? <Text style={bigStyles.full}>Full</Text> : null}
      </View>
      <View style={bigStyles.statsRow}>
        <View style={{ flex: 1 }}>
          <Text style={bigStyles.lab}>30D Return</Text>
          <Text style={[bigStyles.val, { color: positive ? vantage.up : vantage.down }]}>
            {`${positive ? '+' : ''}${ret.toFixed(2)}%`}
          </Text>
        </View>
        {aum != null ? (
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={bigStyles.lab}>AUM (USD)</Text>
            <Text style={bigStyles.aum}>{Number(aum).toLocaleString('en-US', { maximumFractionDigits: 2 })}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function StrategyMiniRow({ item }) {
  const ret = Number(item.total_return_pct ?? item.return_30d ?? item.roi_30d ?? 0);
  const positive = ret >= 0;
  const aum = item.total_aum ?? item.aum ?? item.aum_usd ?? null;
  const displayName = item.provider_name || item.name || 'Strategy';
  const followers = item.followers_count ?? item.follower_count ?? null;
  return (
    <View style={miniStyles.row}>
      <SymbolIcon symbol={displayName.slice(0, 2).toUpperCase()} size={36} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={miniStyles.name} numberOfLines={1}>{displayName}</Text>
        {followers != null ? (
          <Text style={miniStyles.sub} numberOfLines={1}>{followers} followers</Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {aum != null ? <Text style={miniStyles.aum}>{Number(aum).toLocaleString('en-US', { maximumFractionDigits: 0 })} USD</Text> : null}
        <Text style={[miniStyles.ret, { color: positive ? vantage.up : vantage.down }]}>
          {`${positive ? '+' : ''}${ret.toFixed(2)}%`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  becomeCard: { margin: space.lg },
  becomeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  iconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  becomeTxt: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.semibold },
  section: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm },
  sectionTitle: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, marginBottom: space.sm },
  empty: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, padding: space.lg, textAlign: 'center' },
  row: { paddingVertical: space.sm },
});

const bigStyles = StyleSheet.create({
  wrap: { padding: space.sm, gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  name: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy },
  badge: { alignSelf: 'flex-start', backgroundColor: vantage.bgPressed, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.sm, marginTop: 2 },
  badgeTxt: { color: vantage.textSecondary, fontFamily, fontSize: sizes.micro, fontWeight: weights.medium },
  full: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold, backgroundColor: vantage.bgPressed, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.sm },
  statsRow: { flexDirection: 'row' },
  lab: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  val: { fontFamily, fontSize: sizes.h1, fontWeight: weights.heavy, marginTop: 2 },
  aum: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, marginTop: 2 },
});

const miniStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  name: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold },
  sub: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2 },
  aum: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.bold },
  ret: { fontFamily, fontSize: sizes.label, fontWeight: weights.bold, marginTop: 2 },
});
