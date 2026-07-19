import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { Screen, IconButton, CategoryTabs, showToast } from '../../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../../theme/vantageTheme';
import { BOTTOM_NAV_PILL_HEIGHT } from '../../../components/vantage/BottomNavPill';
import ApiService from '../../../services/api/ApiService';
import { TRADE_WEB_URL } from '../../../constants';

const FILTER_OPTIONS = [
  { value: 'all',         label: 'All' },
  { value: 'deposit',     label: 'Deposits' },
  { value: 'withdraw',    label: 'Withdrawals' },
  { value: 'transfer',    label: 'Transfers' },
];

const TX_PAGE = 50;

export default function TransactionHistoryScreen() {
  const nav = useNavigation();
  const [filter, setFilter] = useState('all');
  const [allItems, setAllItems] = useState([]);
  // Paged rendering of the (potentially 1000-row) ledger.
  const [shown, setShown] = useState(TX_PAGE);
  useEffect(() => { setShown(TX_PAGE); }, [filter]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Backend ignores per_page/type — it returns the full ledger, so we fetch
      // once and filter on the client.
      const res = await ApiService.getTransactions({ page: 1, perPage: 1000 });
      const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
      setAllItems(list);
    } catch (_) {
      setAllItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const items = useMemo(() => {
    if (filter === 'all') return allItems;
    return allItems.filter((tx) => String(tx.type || tx.kind || '').toLowerCase().includes(filter));
  }, [allItems, filter]);

  const exportPdf = useCallback(async () => {
    if (!items.length) { showToast({ kind: 'warn', message: 'No transactions to export' }); return; }
    setExporting(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: buildHtml(items, filter) });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Transactions PDF', UTI: 'com.adobe.pdf' });
      } else {
        showToast({ kind: 'info', message: `Saved to: ${uri}` });
      }
    } catch (e) {
      showToast({ kind: 'error', message: e?.message || 'Could not export PDF' });
    } finally {
      setExporting(false);
    }
  }, [items, filter]);

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <IconButton icon={<Ionicons name="chevron-back" size={22} color={vantage.textPrimary} />} accessibilityLabel="Back" onPress={() => nav.goBack()} />
        <Text style={styles.title}>Transactions</Text>
        <IconButton
          icon={<Ionicons name={exporting ? 'hourglass-outline' : 'download-outline'} size={20} color={vantage.accent} />}
          accessibilityLabel="Download PDF"
          onPress={exporting ? undefined : exportPdf}
        />
      </View>
      <CategoryTabs value={filter} onChange={setFilter} options={FILTER_OPTIONS} />
      <FlatList
        data={items.slice(0, shown)}
        contentContainerStyle={{ paddingBottom: BOTTOM_NAV_PILL_HEIGHT + space.huge }}
        keyExtractor={(item, idx) => String(item.id || item._id || idx)}
        renderItem={({ item }) => <Row tx={item} />}
        ListEmptyComponent={loading ? null : <Text style={styles.empty}>No transactions.</Text>}
        // Explicit pagination: a page of TX_PAGE rows and a visible
        // "Show more" button — the ledger can be 1000+ rows.
        ListFooterComponent={items.length > shown ? (
          <Pressable
            onPress={() => setShown((n) => n + TX_PAGE)}
            style={styles.showMoreBtn}
            accessibilityRole="button"
            accessibilityLabel="Show more transactions"
          >
            <Text style={styles.showMoreTxt}>
              Show more ({items.length - shown} remaining)
            </Text>
            <Ionicons name="chevron-down" size={16} color={vantage.textSecondary} />
          </Pressable>
        ) : items.length > TX_PAGE ? (
          <Text style={styles.pagingFooter}>All {items.length} transactions shown</Text>
        ) : null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={vantage.accent} colors={[vantage.accent]} />}
      />
    </Screen>
  );
}

function buildHtml(items, filter) {
  const rows = items.map((tx) => {
    const type = String(tx.type || tx.kind || '').toUpperCase();
    const method = tx.payment_method || tx.method || tx.gateway || tx.type || '';
    const amount = Number(tx.amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const status = tx.status || 'pending';
    let date = '';
    try { date = tx.created_at ? new Date(tx.created_at).toLocaleString() : ''; } catch (_) {}
    return `<tr><td>${date}</td><td>${type}</td><td>${method}</td><td style="text-align:right">${amount}</td><td>${status}</td></tr>`;
  }).join('');
  let now = '';
  try { now = new Date().toLocaleString(); } catch (_) {}
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  body{font-family:-apple-system,Roboto,Helvetica,sans-serif;padding:24px;color:#111}
  .brand{display:flex;align-items:center;justify-content:space-between;margin:0 0 12px}
  .brand img{height:34px}
  h1{font-size:20px;margin:0 0 4px}
  .sub{color:#666;font-size:12px;margin:0 0 16px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{border-bottom:1px solid #eee;padding:8px;text-align:left}
  th{background:#fafafa;text-transform:uppercase;font-size:10px;letter-spacing:.5px;color:#555}
</style></head><body>
  <div class="brand">
    <h1>SwissCresta — Transactions${filter !== 'all' ? ' · ' + filter : ''}</h1>
    <img src="${TRADE_WEB_URL}/marketing/swisscresta-logo.png" alt="" onerror="this.style.display='none'"/>
  </div>
  <p class="sub">Generated ${now} · ${items.length} records</p>
  <table>
    <thead><tr><th>Date</th><th>Type</th><th>Method</th><th>Amount (USD)</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body></html>`;
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
  let dateStr = '';
  try { dateStr = tx.created_at ? new Date(tx.created_at).toLocaleDateString() : ''; } catch (_) {}
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
  pagingFooter: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, textAlign: 'center', paddingVertical: space.md },
  showMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginHorizontal: space.lg, marginTop: space.sm, paddingVertical: space.md,
    borderWidth: 1, borderColor: vantage.border, borderRadius: radius.md, backgroundColor: vantage.bgRaised,
  },
  showMoreTxt: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingTop: space.sm, paddingBottom: space.xs },
  title: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, textAlign: 'center' },
  empty: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, padding: space.huge, textAlign: 'center' },
});

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomColor: vantage.border, borderBottomWidth: StyleSheet.hairlineWidth },
  method: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.semibold },
  date: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2 },
  amount: { fontFamily, fontSize: sizes.body, fontWeight: weights.heavy },
  status: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2, textTransform: 'capitalize' },
});
