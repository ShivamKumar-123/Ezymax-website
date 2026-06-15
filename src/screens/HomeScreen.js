import React, { useEffect, useState, useCallback } from 'react';
import { ScrollView, RefreshControl, View, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Screen, BalanceBlock } from '../components/vantage';
import { vantage, space } from '../theme/vantageTheme';
import ApiService from '../services/ApiService';
import webSocketService from '../services/WebSocketService';
import { useHiddenBalance } from '../utils/hiddenBalance';
import { BOTTOM_NAV_PILL_HEIGHT } from '../components/vantage/BottomNavPill';

import HomeHeader from './home/HomeHeader';
import QuickActionsGrid from './home/QuickActionsGrid';
import BannerCarousel from './home/BannerCarousel';
import StrategyCarousel from './home/StrategyCarousel';
import WatchlistSection from './home/WatchlistSection';
import AccountSwitcher from './trade/AccountSwitcher';

export default function HomeScreen() {
  const nav = useNavigation();
  const { hidden, toggle: toggleHidden } = useHiddenBalance();

  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [perfDay, setPerfDay] = useState(null);
  const [strategies, setStrategies] = useState([]);
  const [banners, setBanners] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [pricesBySymbol, setPricesBySymbol] = useState({});
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [accountSummary, setAccountSummary] = useState(null);
  const [accountSheet, setAccountSheet] = useState(false);

  const fetchAll = useCallback(async () => {
    await Promise.allSettled([
      ApiService.getPortfolioSummary().then(setSummary).catch(() => setSummary(null)),
      // `/social/leaderboard` is the live copy-trade source (/social/masters 404s).
      ApiService.getLeaderboard({ sort: 'overall', limit: 10 }).then((res) => {
        const list = Array.isArray(res)
          ? res
          : (res?.items || res?.masters || []);
        setStrategies(Array.isArray(list) ? list : []);
      }).catch(() => setStrategies([])),
      ApiService.getBanners('dashboard').then((res) => {
        // Backend returns { banners: [...] }; keep array/items fallbacks too.
        const list = Array.isArray(res)
          ? res
          : (res?.banners || res?.items || []);
        setBanners(Array.isArray(list) ? list : []);
      }).catch(() => setBanners([])),
      ApiService.getAllPrices().then((res) => {
        const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
        const map = {};
        for (const p of list) {
          const sym = String(p.symbol || p.ticker || '').toUpperCase();
          if (sym) map[sym] = p;
        }
        setPricesBySymbol(map);
      }).catch(() => setPricesBySymbol({})),
      ApiService.getNotifications(1, 20).then((res) => {
        const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
        const unread = list.filter((n) => !n?.is_read && !n?.read).length;
        setUnreadNotifications(unread);
      }).catch(() => setUnreadNotifications(0)),
      ApiService.getAccounts().then((res) => {
        const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
        setAccounts(list);
        setSelectedAccount((cur) => cur || list.find((a) => a.is_active) || list[0] || null);
      }).catch(() => {}),
    ]);
  }, []);

  // Fetch live equity/PnL for the selected account.
  useEffect(() => {
    const id = selectedAccount?.id || selectedAccount?._id;
    if (!id) { setAccountSummary(null); return; }
    let cancelled = false;
    ApiService.getAccountSummary(id)
      .then((s) => { if (!cancelled) setAccountSummary(s); })
      .catch(() => { if (!cancelled) setAccountSummary(null); });
    return () => { cancelled = true; };
  }, [selectedAccount]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Subscribe to WS price ticks while this screen is mounted.
  useEffect(() => {
    if (typeof webSocketService?.onPriceUpdate !== 'function') return;

    const unsubscribe = webSocketService.onPriceUpdate((msg) => {
      if (!msg) return;
      const sym = String(msg.symbol || msg.s || '').toUpperCase();
      if (!sym) return;
      setPricesBySymbol((prev) => {
        const cur = prev[sym] || {};
        const bid = msg.bid != null ? Number(msg.bid) : cur.bid;
        const ask = msg.ask != null ? Number(msg.ask) : cur.ask;
        return { ...prev, [sym]: { ...cur, symbol: sym, bid, ask } };
      });
    });

    webSocketService.connectPriceStream?.();

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  const totalValue = summary?.total_equity ?? summary?.equity ?? summary?.balance ?? null;
  const todayPnl =
    summary?.pnl_breakdown?.today
      ?? summary?.today_pnl
      ?? perfDay?.profit
      ?? perfDay?.pnl
      ?? perfDay?.pl
      ?? null;

  // When an account is picked, show that account's equity/PnL; otherwise the
  // portfolio total across all accounts.
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
  const acctValue = selectedAccount
    ? (num(accountSummary?.equity) ?? num(accountSummary?.balance) ?? num(selectedAccount?.equity) ?? num(selectedAccount?.balance))
    : (typeof totalValue === 'number' ? totalValue : num(totalValue));
  const acctPnl = selectedAccount
    ? (num(accountSummary?.today_pnl) ?? num(accountSummary?.pnl) ?? num(accountSummary?.floating_pnl) ?? num(todayPnl))
    : (typeof todayPnl === 'number' ? todayPnl : num(todayPnl));
  const acctCurrency = selectedAccount?.currency || 'USD';
  const acctLabel = selectedAccount
    ? `${selectedAccount.is_demo ? 'Demo' : 'Live'} ${selectedAccount.account_number || selectedAccount.id || ''}`.trim()
    : 'All accounts';

  return (
    <Screen edges={['top']} glow>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: BOTTOM_NAV_PILL_HEIGHT + space.huge }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={vantage.accent} colors={[vantage.accent]} />
        }
      >
        <Pressable onLongPress={() => __DEV__ && nav.navigate('ComponentGallery')}>
          <HomeHeader unreadNotifications={unreadNotifications} />
        </Pressable>

        <Pressable
          style={styles.balanceWrap}
          onPress={() => nav.navigate('TradeTab')}
          accessibilityRole="button"
          accessibilityLabel="Open trade"
        >
          <BalanceBlock
            label="Total Value"
            amount={acctValue}
            currency={acctCurrency}
            hidden={hidden}
            onToggleHide={toggleHidden}
            subLabel="Today's PnL"
            subAmount={acctPnl}
            subPositive={acctPnl != null ? acctPnl >= 0 : true}
            accountLabel={acctLabel}
            onPickAccount={() => setAccountSheet(true)}
            onAddAccount={() => nav.navigate('Accounts', { action: 'open' })}
          />
        </Pressable>

        <QuickActionsGrid />

        {/* Admin-uploaded promo banners — shown just above Copy Trade Masters. */}
        <BannerCarousel banners={banners} onPressFallback={() => nav.navigate('TradeTab')} />

        <StrategyCarousel strategies={strategies} onSeeAll={() => nav.navigate('TradeTab')} />

        <WatchlistSection
          pricesBySymbol={pricesBySymbol}
          onSeeAll={() => nav.navigate('MarketsTab')}
        />
      </ScrollView>

      <AccountSwitcher
        visible={accountSheet}
        onClose={() => setAccountSheet(false)}
        accounts={accounts}
        selectedId={selectedAccount?.id || selectedAccount?._id}
        onSelect={setSelectedAccount}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {},
  balanceWrap: { paddingHorizontal: space.lg, paddingBottom: space.sm },
});
