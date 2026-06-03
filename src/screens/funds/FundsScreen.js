import React, { useEffect, useState, useCallback } from 'react';
import { ScrollView, RefreshControl, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { Screen, BalanceBlock, QuickActionTile } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';
import ApiService from '../../services/ApiService';
import { useHiddenBalance } from '../../utils/hiddenBalance';
import { BOTTOM_NAV_PILL_HEIGHT } from '../../components/vantage/BottomNavPill';

export default function FundsScreen() {
  const nav = useNavigation();
  const { hidden, toggle } = useHiddenBalance();

  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState([]);

  const fetchAll = useCallback(async () => {
    await Promise.allSettled([
      ApiService.getWalletSummary().then(setSummary).catch(() => setSummary(null)),
      ApiService.getTransactions({ page: 1, perPage: 5 }).then((res) => {
        const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
        setRecent(list);
      }).catch(() => setRecent([])),
    ]);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  const total = summary?.total_balance ?? summary?.balance ?? summary?.total_equity ?? null;
  // Backend `/wallet/summary` doesn't currently split main vs trading — hide the split unless those fields exist.
  const main = summary?.main_balance ?? summary?.main_wallet ?? summary?.main_wallet_balance ?? null;
  const trading = summary?.trading_balance ?? summary?.total_equity ?? null;
  const showSplit = main != null && trading != null && main !== trading;

  return (
    <Screen edges={['top']}>
      <View style={styles.headerWrap}>
        <Text style={styles.title}>Funds</Text>
      </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: BOTTOM_NAV_PILL_HEIGHT + space.huge }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={vantage.accent} colors={[vantage.accent]} />}
      >
        <View style={styles.balanceWrap}>
          <BalanceBlock
            label="Total Balance"
            amount={typeof total === 'number' ? total : null}
            currency="USD"
            hidden={hidden}
            onToggleHide={toggle}
          />
          {showSplit ? (
            <View style={styles.splitRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.splitLab}>Main Wallet</Text>
                <Text style={styles.splitVal}>{hidden ? '••••' : Number(main).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.splitLab}>Trading</Text>
                <Text style={styles.splitVal}>{hidden ? '••••' : Number(trading).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.tilesRow}>
          <QuickActionTile icon={<Ionicons name="arrow-down-circle" size={26} color={vantage.up} />} label="Deposit" onPress={() => nav.navigate('Deposit')} />
          <QuickActionTile icon={<Ionicons name="arrow-up-circle" size={26} color={vantage.down} />} label="Withdraw" onPress={() => nav.navigate('Withdraw')} />
          <QuickActionTile icon={<Ionicons name="swap-horizontal" size={26} color={vantage.textPrimary} />} label="Transfer" onPress={() => nav.navigate('Transfer')} />
          <QuickActionTile icon={<Ionicons name="receipt-outline" size={26} color={vantage.textPrimary} />} label="History" onPress={() => nav.navigate('TransactionHistory')} />
        </View>

        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {recent.length === 0 ? (
            <Text style={styles.empty}>No transactions yet.</Text>
          ) : recent.map((t) => <TxRow key={t.id || t._id || `${t.created_at}-${t.amount}`} tx={t} />)}
        </View>
      </ScrollView>
    </Screen>
  );
}

function TxRow({ tx }) {
  const t = String(tx.type || tx.kind || '').toLowerCase();
  const isDeposit = t.includes('deposit');
  const isWithdraw = t.includes('withdraw');
  const sign = isDeposit ? '+' : (isWithdraw ? '−' : '');
  const color = isDeposit ? vantage.up : (isWithdraw ? vantage.down : vantage.textPrimary);
  const amount = Math.abs(Number(tx.amount ?? 0));
  const method = tx.payment_method || tx.method || tx.gateway || tx.type || 'Transaction';
  const status = String(tx.status || '').toLowerCase();
  const dateStr = tx.created_at ? new Date(tx.created_at).toLocaleDateString() : (tx.timestamp ? new Date(tx.timestamp).toLocaleDateString() : '');

  return (
    <View style={txStyles.row}>
      <Ionicons
        name={isDeposit ? 'arrow-down-circle' : isWithdraw ? 'arrow-up-circle' : 'swap-horizontal'}
        size={22} color={color}
      />
      <View style={{ flex: 1, marginLeft: space.md }}>
        <Text style={txStyles.method}>{String(method).toUpperCase()}</Text>
        <Text style={txStyles.date}>{dateStr}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[txStyles.amount, { color }]}>{sign}${amount.toFixed(2)}</Text>
        <Text style={[txStyles.status, status === 'completed' ? { color: vantage.up } : status === 'failed' ? { color: vantage.down } : null]}>
          {status || 'pending'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrap: { paddingHorizontal: space.lg, paddingTop: space.sm },
  title: { color: vantage.textPrimary, fontFamily, fontSize: sizes.hero, fontWeight: weights.heavy },
  scroll: {},
  balanceWrap: { paddingHorizontal: space.lg, paddingTop: space.md },
  splitRow: { flexDirection: 'row', gap: space.lg, marginTop: space.md, padding: space.md, backgroundColor: vantage.bgElevated, borderRadius: 12 },
  splitLab: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  splitVal: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold, marginTop: 2 },
  tilesRow: { flexDirection: 'row', paddingHorizontal: space.lg, paddingVertical: space.lg, gap: space.md },
  recentSection: { paddingHorizontal: space.lg, paddingTop: space.md },
  sectionTitle: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, marginBottom: space.sm },
  empty: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, padding: space.lg, textAlign: 'center' },
});

const txStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm, borderBottomColor: vantage.border, borderBottomWidth: StyleSheet.hairlineWidth },
  method: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.semibold },
  date: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2 },
  amount: { fontFamily, fontSize: sizes.body, fontWeight: weights.heavy },
  status: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2, textTransform: 'capitalize' },
});
