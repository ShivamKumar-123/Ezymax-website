import React, { useEffect, useState, useCallback, useContext } from 'react';
import { ScrollView, RefreshControl, View, StyleSheet, Pressable, Text, Image } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { AuthContext } from '../context/AuthContext';
import { Screen, BalanceBlock } from '../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../theme/vantageTheme';
import ApiService from '../services/ApiService';
import webSocketService from '../services/WebSocketService';
import { useHiddenBalance } from '../utils/hiddenBalance';
import { BOTTOM_NAV_PILL_HEIGHT } from '../components/vantage/BottomNavPill';

import { useAccount } from '../context/AccountContext';
import HomeHeader from './home/HomeHeader';
import QuickActionsGrid from './home/QuickActionsGrid';
import StrategyCarousel from './home/StrategyCarousel';
import WatchlistSection from './home/WatchlistSection';
import AccountSwitcher from './trade/AccountSwitcher';

export default function HomeScreen() {
  const nav = useNavigation();
  const { user } = useContext(AuthContext) || {};
  const { hidden, toggle: toggleHidden } = useHiddenBalance();

  // Cardholder name shown on the card (falls back to the email handle).
  const cardName = (
    [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim()
    || (user?.email ? user.email.split('@')[0] : 'Cardholder')
  );

  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [perfDay, setPerfDay] = useState(null);
  const [strategies, setStrategies] = useState([]);
  const [banners, setBanners] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [pricesBySymbol, setPricesBySymbol] = useState({});
  // Global account selection — synced across Home / Trade / instrument detail.
  const { accounts, selectedAccount, selectAccount, refreshAccounts } = useAccount();
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
      refreshAccounts(),
    ]);
  }, [refreshAccounts]);

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

  // Live prices via polling (every 2s while focused) — reliable real-time
  // movement for the watchlist even if the price WebSocket isn't delivering.
  const refreshPrices = useCallback(async () => {
    try {
      const res = await ApiService.getAllPrices();
      const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
      const map = {};
      for (const p of list) {
        const sym = String(p.symbol || p.ticker || '').toUpperCase();
        if (sym) map[sym] = p;
      }
      setPricesBySymbol(map);
    } catch (_) {}
  }, []);
  useFocusEffect(useCallback(() => {
    const id = setInterval(refreshPrices, 500);
    return () => clearInterval(id);
  }, [refreshPrices]));

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
    <Screen edges={['top']} glow={false}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: BOTTOM_NAV_PILL_HEIGHT + space.huge }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={vantage.accent} colors={[vantage.accent]} />
        }
      >
        <Pressable onLongPress={() => __DEV__ && nav.navigate('ComponentGallery')}>
          <HomeHeader
            unreadNotifications={unreadNotifications}
            accountLabel={acctLabel}
            onPickAccount={() => setAccountSheet(true)}
          />
        </Pressable>

        {/* Card section — card.png as background only; balance text kept on top. */}
        <Pressable
          style={styles.cardWrap}
          onPress={() => nav.navigate('FundsTab', { screen: 'Funds' })}
          accessibilityRole="button"
          accessibilityLabel="Open funds"
        >
          {/* Slight zoom crops only the black padding/rounded corners so the wave
              pattern fills (fits) the whole card. Lower scale = more wave shown. */}
          <Image source={require('../../assets/card.png')} style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.2 }] }]} resizeMode="cover" />
          <View style={styles.cardOverlay}>
            <BalanceBlock
              showControls={false}
              light
              amount={acctValue}
              currency={acctCurrency}
              hidden={hidden}
              subLabel="Today's PnL"
              subAmount={acctPnl}
              subPositive={acctPnl != null ? acctPnl >= 0 : true}
              subColor="#FFFFFF"
            />
          </View>
          {/* SwissCresta logo — top-right. */}
          <Image source={require('../../assets/swisscresta-homebar-white.png')} style={styles.cardLogo} resizeMode="contain" />
          {/* Cardholder name — bottom-left. */}
          <Text style={styles.cardName} numberOfLines={1}>{cardName}</Text>
          {/* Card chip — bottom-right. */}
          <Image source={require('../../assets/chip.png')} style={styles.chip} resizeMode="contain" />
        </Pressable>

        <QuickActionsGrid />

        <StrategyCarousel strategies={strategies} onSeeAll={() => nav.navigate('TradeTab', { screen: 'Trade', params: { tradeView: 'copy' } })} />

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
        onSelect={selectAccount}
        onAddAccount={() => nav.navigate('Accounts', { action: 'open' })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {},

  // Card section — shows card.png exactly as the file (rounded card, chip,
  // surrounding padding). Aspect ratio matches the image and `contain` shows the
  // whole image (chip included) with no zoom/crop. No extra border/radius/bg.
  cardWrap: {
    alignSelf: 'center',
    width: '90%',
    marginVertical: space.sm,
    aspectRatio: 1581 / 995,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    borderRadius: 30,
  },
  // Cardholder name — bottom-left of the card (matches the marked spot).
  cardName: {
    position: 'absolute',
    left: space.xl,
    bottom: space.xxl + 8,
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    maxWidth: '60%',
  },
  // Card chip — bottom-right of the card (matches the marked spot).
  chip: {
    position: 'absolute',
    right: space.xxl,
    bottom: space.xxl,
    width: 84,
    height: 56,
  },
  // SwissCresta logo — top-right of the card.
  cardLogo: {
    position: 'absolute',
    top: space.sm,
    right: space.sm,
    width: 60,
    height: 60,
  },
  // Balance overlay pinned to the top-left of the card, with room from the edges.
  cardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
  },
});
