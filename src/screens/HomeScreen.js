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
import PromoBanner from './home/PromoBanner';
import StrategyCarousel from './home/StrategyCarousel';
import WatchlistSection from './home/WatchlistSection';

export default function HomeScreen() {
  const nav = useNavigation();
  const { hidden, toggle: toggleHidden } = useHiddenBalance();

  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [perfDay, setPerfDay] = useState(null);
  const [strategies, setStrategies] = useState([]);
  const [banner, setBanner] = useState(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [pricesBySymbol, setPricesBySymbol] = useState({});

  const fetchAll = useCallback(async () => {
    await Promise.allSettled([
      ApiService.getPortfolioSummary().then(setSummary).catch(() => setSummary(null)),
      ApiService.getLeaderboard({ sort: 'overall', limit: 10 }).then((res) => {
        const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
        setStrategies(list);
      }).catch(() => setStrategies([])),
      ApiService.getBanners('dashboard').then((res) => {
        const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
        setBanner(list[0] || null);
      }).catch(() => setBanner(null)),
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
    ]);
  }, []);

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

  return (
    <Screen edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: BOTTOM_NAV_PILL_HEIGHT + space.huge }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={vantage.accent} colors={[vantage.accent]} />
        }
      >
        <Pressable onLongPress={() => __DEV__ && nav.navigate('ComponentGallery')}>
          <HomeHeader unreadNotifications={unreadNotifications} />
        </Pressable>

        <View style={styles.balanceWrap}>
          <BalanceBlock
            label="Total Value"
            amount={typeof totalValue === 'number' ? totalValue : null}
            currency="USD"
            hidden={hidden}
            onToggleHide={toggleHidden}
            subLabel="Today's PnL"
            subAmount={typeof todayPnl === 'number' ? todayPnl : null}
            subPositive={typeof todayPnl === 'number' ? todayPnl >= 0 : true}
          />
        </View>

        <QuickActionsGrid />

        {banner ? (
          <PromoBanner banner={banner} onPress={() => nav.navigate('TradeTab')} />
        ) : null}

        <StrategyCarousel strategies={strategies} onSeeAll={() => nav.navigate('TradeTab')} />

        <WatchlistSection
          pricesBySymbol={pricesBySymbol}
          onSeeAll={() => nav.navigate('MarketsTab')}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {},
  balanceWrap: { paddingHorizontal: space.lg, paddingBottom: space.sm },
});
