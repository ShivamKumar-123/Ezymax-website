import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Screen, IconButton, CategoryTabs } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';
import ApiService from '../../services/ApiService';

const FILTER_OPTIONS = [
  { value: 'all',         label: 'All' },
  { value: 'deposit',     label: 'Deposits' },
  { value: 'withdrawal',  label: 'Withdrawals' },
  { value: 'transfer',    label: 'Transfers' },
];

export default function TransactionHistoryScreen() {
  const nav = useNavigation();
  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPage = useCallback(async (p, replace = false) => {
    setLoading(true);
    try {
      const type = filter === 'all' ? null : filter;
      const res = await ApiService.getTransactions({ page: p, perPage: 30, type });
      const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
      setItems((prev) => replace ? list : [...prev, ...list]);
      setHasMore(list.length === 30);
    } catch (_) {
      if (replace) setItems([]);
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchPage(1, true);
  }, [filter, fetchPage]);

  const onEndReached = useCallback(() => {
    if (loading || !hasMore) return;
    const next = page + 1;
    setPage(next);
    fetchPage(next);
  }, [loading, hasMore, page, fetchPage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    await fetchPage(1, true);
    setRefreshing(false);
  }, [fetchPage]);

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <IconButton icon={<Ionicons name="chevron-back" size={22} color={vantage.textPrimary} />} accessibilityLabel="Back" onPress={() => nav.goBack()} />
        <Text style={styles.title}>Transactions</Text>
        <View style={{ width: 40 }} />
      </View>
      <CategoryTabs value={filter} onChange={setFilter} options={FILTER_OPTIONS} />
      <FlatList
        data={items}
        keyExtractor={(item, idx) => String(item.id || item._id || idx)}
        renderItem={({ item }) => <Row tx={item} />}
        ListEmptyComponent={loading ? null : <Text style={styles.empty}>No transactions.</Text>}
        ListFooterComponent={loading && page > 1 ? <Text style={styles.loading}>Loading…</Text> : null}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={vantage.accent} colors={[vantage.accent]} />}
      />
    </Screen>
  );
}

function Row({ tx }) {
  const t = String(tx.type || tx.kind || '').toLowerCase();
  const isDeposit = t.includes('deposit');
  const isWithdraw = t.includes('withdraw');
  const color = isDeposit ? vantage.up : (isWithdraw ? vantage.down : vantage.textPrimary);
  const sign = isDeposit ? '+' : (isWithdraw ? '−' : '');
  const amount = Math.abs(Number(tx.amount ?? 0));
  const method = tx.payment_method || tx.method || tx.gateway || tx.type || 'Transaction';
  const status = String(tx.status || '').toLowerCase();
  const dateStr = tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '';
  return (
    <View style={rowStyles.row}>
      <Ionicons name={isDeposit ? 'arrow-down-circle' : isWithdraw ? 'arrow-up-circle' : 'swap-horizontal'} size={22} color={color} />
      <View style={{ flex: 1, marginLeft: space.md }}>
        <Text style={rowStyles.method}>{String(method).toUpperCase()}</Text>
        <Text style={rowStyles.date}>{dateStr}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[rowStyles.amount, { color }]}>{sign}${amount.toFixed(2)}</Text>
        <Text style={[rowStyles.status, status === 'completed' && { color: vantage.up }, status === 'failed' && { color: vantage.down }]}>{status || 'pending'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingTop: space.sm, paddingBottom: space.xs },
  title: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, textAlign: 'center' },
  empty: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, padding: space.huge, textAlign: 'center' },
  loading: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, padding: space.md, textAlign: 'center' },
});

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomColor: vantage.border, borderBottomWidth: StyleSheet.hairlineWidth },
  method: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.semibold },
  date: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2 },
  amount: { fontFamily, fontSize: sizes.body, fontWeight: weights.heavy },
  status: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2, textTransform: 'capitalize' },
});
