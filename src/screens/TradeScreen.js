import React, { useEffect, useState, useCallback } from 'react';
import { ScrollView, RefreshControl, View, StyleSheet } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';

import { Screen, SegmentedTabs } from '../components/vantage';
import { vantage, space } from '../theme/vantageTheme';
import ApiService from '../services/ApiService';
import webSocketService from '../services/WebSocketService';
import { BOTTOM_NAV_PILL_HEIGHT } from '../components/vantage/BottomNavPill';

import TradeCFDs from './trade/TradeCFDs';
import TradeCopy from './trade/TradeCopy';

const DEFAULT_SYMBOL = 'EURUSD';

export default function TradeScreen() {
  const nav = useNavigation();
  const route = useRoute();
  const [view, setView] = useState('cfds');

  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [accountSummary, setAccountSummary] = useState(null);
  const [symbol, setSymbol] = useState(route.params?.symbol || DEFAULT_SYMBOL);
  const [tick, setTick] = useState(null);
  const [positions, setPositions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const accountId = selectedAccount?.id || selectedAccount?._id;

  useEffect(() => {
    if (route.params?.symbol) setSymbol(String(route.params.symbol).toUpperCase());
  }, [route.params?.symbol]);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await ApiService.getAccounts();
      const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
      setAccounts(list);
      if (!selectedAccount && list[0]) setSelectedAccount(list[0]);
    } catch (_) { setAccounts([]); }
  }, [selectedAccount]);

  const refreshAccountData = useCallback(async () => {
    if (!accountId) return;
    const [summary, pos, ords] = await Promise.allSettled([
      ApiService.getAccountSummary(accountId),
      ApiService.getPositions(accountId, 'open'),
      ApiService.getOrders(accountId, 'pending'),
    ]);
    if (summary.status === 'fulfilled') setAccountSummary(summary.value);
    if (pos.status === 'fulfilled') {
      const list = Array.isArray(pos.value) ? pos.value : (Array.isArray(pos.value?.items) ? pos.value.items : []);
      setPositions(list);
    }
    if (ords.status === 'fulfilled') {
      const list = Array.isArray(ords.value) ? ords.value : (Array.isArray(ords.value?.items) ? ords.value.items : []);
      setOrders(list);
    }
  }, [accountId]);

  const refreshTick = useCallback(async () => {
    if (!symbol) return;
    try {
      const res = await ApiService.getAllPrices();
      const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
      const t = list.find((p) => String(p.symbol || p.ticker || '').toUpperCase() === symbol.toUpperCase());
      if (t) setTick(t);
    } catch (_) {}
  }, [symbol]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  useEffect(() => { refreshAccountData(); }, [refreshAccountData]);
  useEffect(() => { refreshTick(); }, [refreshTick]);

  useFocusEffect(useCallback(() => {
    refreshAccountData();
    refreshTick();
  }, [refreshAccountData, refreshTick]));

  useEffect(() => {
    if (typeof webSocketService?.onPriceUpdate !== 'function') return;
    const unsubscribe = webSocketService.onPriceUpdate((msg) => {
      if (!msg) return;
      const sym = String(msg.symbol || msg.s || '').toUpperCase();
      if (sym !== symbol.toUpperCase()) return;
      setTick((prev) => ({
        ...(prev || {}),
        symbol: sym,
        bid: msg.bid != null ? Number(msg.bid) : prev?.bid,
        ask: msg.ask != null ? Number(msg.ask) : prev?.ask,
      }));
    });
    webSocketService.connectPriceStream?.();
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [symbol]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([loadAccounts(), refreshAccountData(), refreshTick()]);
    setRefreshing(false);
  }, [loadAccounts, refreshAccountData, refreshTick]);

  return (
    <Screen edges={['top']}>
      <View style={styles.headerWrap}>
        <SegmentedTabs
          value={view}
          onChange={setView}
          options={[
            { value: 'cfds', label: 'CFDs' },
            { value: 'copy', label: 'Copy' },
          ]}
        />
      </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: BOTTOM_NAV_PILL_HEIGHT + space.huge }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={vantage.accent} colors={[vantage.accent]} />
        }
        keyboardShouldPersistTaps="handled"
      >
        {view === 'cfds' ? (
          <TradeCFDs
            accounts={accounts}
            selectedAccount={selectedAccount}
            onSelectAccount={setSelectedAccount}
            symbol={symbol}
            onSelectSymbol={setSymbol}
            tick={tick}
            accountSummary={accountSummary}
            positions={positions}
            orders={orders}
            onChange={refreshAccountData}
          />
        ) : (
          <TradeCopy />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerWrap: { paddingHorizontal: space.lg, paddingTop: space.sm },
  scroll: {},
});
