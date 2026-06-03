import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { Screen, Card, PillButton, SymbolIcon, IconButton, StatCard, showToast } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';
import ApiService from '../../services/ApiService';

export default function StrategyDetailScreen() {
  const nav = useNavigation();
  const route = useRoute();
  const providerId = route.params?.providerId;

  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await ApiService.getLeaderboard({ limit: 50 });
        const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
        const found = list.find((p) => (p.id || p.provider_id) === providerId);
        if (!cancelled) setProvider(found || null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [providerId]);

  if (loading) {
    return (
      <Screen edges={['top']}>
        <BackHeader onBack={() => nav.goBack()} />
        <Text style={styles.empty}>Loading…</Text>
      </Screen>
    );
  }

  if (!provider) {
    return (
      <Screen edges={['top']}>
        <BackHeader onBack={() => nav.goBack()} />
        <Text style={styles.empty}>Strategy not found.</Text>
      </Screen>
    );
  }

  const ret30 = Number(provider.total_return_pct ?? provider.return_30d ?? provider.roi_30d ?? 0);
  const positive30 = ret30 >= 0;
  const aum = provider.total_aum ?? provider.aum ?? provider.aum_usd ?? null;
  const followers = provider.followers_count ?? provider.follower_count ?? null;
  const winRate = provider.win_rate ?? null;
  const drawdown = provider.max_drawdown_pct ?? provider.max_drawdown ?? provider.drawdown ?? null;
  const displayName = provider.provider_name || provider.name || 'Strategy';
  const displayCategory = provider.strategy_info?.category || provider.category || provider.description || null;

  return (
    <Screen edges={['top']}>
      <BackHeader onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.huge }}>
        <View style={styles.head}>
          <SymbolIcon symbol={displayName.slice(0, 2).toUpperCase()} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{displayName}</Text>
            {displayCategory ? <Text style={styles.sub} numberOfLines={2}>{displayCategory}</Text> : null}
            {followers != null ? <Text style={styles.sub}>{followers} followers</Text> : null}
          </View>
          {provider.is_full ? <Text style={styles.full}>Full</Text> : null}
        </View>

        <View style={styles.statsRow}>
          <StatCard label="30D Return" value={`${positive30 ? '+' : ''}${ret30.toFixed(2)}%`} delta={`${positive30 ? 'Gain' : 'Loss'}`} deltaPositive={positive30} />
          {aum != null ? <StatCard label="AUM (USD)" value={Number(aum).toLocaleString('en-US', { maximumFractionDigits: 0 })} /> : null}
          {winRate != null ? <StatCard label="Win Rate" value={`${Number(winRate).toFixed(1)}%`} /> : null}
          {drawdown != null ? <StatCard label="Max Drawdown" value={`${Number(drawdown).toFixed(2)}%`} /> : null}
        </View>

        <Card style={{ marginTop: space.lg }}>
          <Row label="Strategy ID" value={String(provider.id || provider.provider_id || '—')} />
          <Row label="Category" value={provider.category || '—'} />
          <Row label="Allocations" value={provider.allocation_count != null ? String(provider.allocation_count) : '—'} last />
        </Card>

        <PillButton
          label={provider.is_full ? 'Strategy is full' : 'Copy Strategy'}
          variant="primary"
          size="lg"
          disabled={!!provider.is_full}
          onPress={() => showToast({ kind: 'info', message: 'Copy flow coming soon' })}
          style={{ marginTop: space.xl }}
        />
      </ScrollView>
    </Screen>
  );
}

function BackHeader({ onBack }) {
  return (
    <View style={styles.header}>
      <IconButton icon={<Ionicons name="chevron-back" size={22} color={vantage.textPrimary} />} accessibilityLabel="Back" onPress={onBack} />
    </View>
  );
}

function Row({ label, value, last }) {
  return (
    <View style={[rowStyles.row, !last && rowStyles.border]}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.sm, paddingTop: space.sm },
  empty: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, padding: space.huge, textAlign: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  name: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h1, fontWeight: weights.heavy },
  sub: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2 },
  full: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold, backgroundColor: vantage.bgPressed, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: 6 },
  statsRow: { flexDirection: 'row', gap: space.md, marginTop: space.lg, flexWrap: 'wrap' },
});

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.sm },
  border: { borderBottomColor: vantage.border, borderBottomWidth: StyleSheet.hairlineWidth },
  label: { color: vantage.textMuted, fontFamily, fontSize: sizes.body },
  value: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.bold },
});
