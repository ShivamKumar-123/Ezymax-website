import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, TextInput, Keyboard, Platform, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import {
  Screen,
  BuySellSplit,
  IconButton,
  PillButton,
  showToast,
} from '../../components/vantage';
import { BOTTOM_NAV_PILL_HEIGHT } from '../../components/vantage/BottomNavPill';
import SymbolPicker from '../trade/SymbolPicker';
import AccountSwitcher from '../trade/AccountSwitcher';
import { useAccount } from '../../context/AccountContext';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';
import * as SecureStore from 'expo-secure-store';
import ApiService from '../../services/ApiService';
import webSocketService from '../../services/WebSocketService';
import { CHART_URL, API_URL } from '../../config';
import { toTradingViewSymbol } from '../../lib/tradingViewSymbols';
import { handleTradeError } from '../../utils/tradeErrors';
import { getInstruments } from '../../utils/instrumentsCache';
import { getWatchlist, addToWatchlist, removeFromWatchlist } from '../../utils/watchlistStorage';

const TIMEFRAMES = [
  { key: 'Tick', tv: '1',  label: 'Tick' },
  { key: '1m',   tv: '1',  label: '1m' },
  { key: '15m',  tv: '15', label: '15m' },
  { key: '1h',   tv: '60', label: '1h' },
  { key: '1D',   tv: 'D',  label: '1D' },
  { key: '1W',   tv: 'W',  label: '1W' },
];

const TABS = [
  { key: 'chart',    label: 'Chart' },
  { key: 'orders',   label: 'Orders' },
  { key: 'info',     label: 'Info' },
];

// Best-effort TradingView symbol mapping for the embedded widget.
// Broker-symbol → backend chart-symbol overrides for the self-hosted charting
// library datafeed (e.g. NASDAQ 100 is served as the broker's NDX feed).
const CHART_SYMBOL_ALIAS = {
  NAS100: 'NDX',
};

// Chart symbol mapping lives in ../../lib/tradingViewSymbols (toTradingViewSymbol),
// ported 1:1 from the website so the app charts the exact same feed per symbol.

export default function InstrumentDetailScreen() {
  const nav = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const initialSymbol = String(route.params?.symbol || 'XAUUSD').toUpperCase();

  const [symbol, setSymbol] = useState(initialSymbol);
  // Re-sync when navigated here again with a different symbol — the screen may
  // already be in the stack (e.g. opened from the home watchlist), so without
  // this it would keep showing the first instrument.
  useEffect(() => {
    const s = route.params?.symbol;
    if (s) setSymbol(String(s).toUpperCase());
  }, [route.params?.symbol]);
  // Remember the last instrument viewed → the Trade tab defaults to it.
  useEffect(() => { if (symbol) SecureStore.setItemAsync('lastSymbol', symbol).catch(() => {}); }, [symbol]);
  const [tab, setTab] = useState('chart');
  const [tf, setTf] = useState('1m');
  const [chartFull, setChartFull] = useState(false);   // fullscreen chart toggle
  const [instrument, setInstrument] = useState(null);
  const [tick, setTick] = useState(null);
  const [bars1D, setBars1D] = useState([]);
  const [bars1W, setBars1W] = useState([]);
  const [bars1M, setBars1M] = useState([]);
  const [pinned, setPinned] = useState(false);
  // Global account selection — synced with Home & Trade.
  const { accounts, selectedAccount: activeAccount, selectAccount } = useAccount();
  const [acctSheet, setAcctSheet] = useState(false);
  const [myPositions, setMyPositions] = useState([]);
  const [authToken, setAuthToken] = useState('');
  const [side, setSide] = useState('sell');
  const [lots, setLots] = useState(0.01);
  const [submitting, setSubmitting] = useState(false);
  const [footerH, setFooterH] = useState(330);
  const [kbHeight, setKbHeight] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Lift the (absolutely-positioned) footer above the keyboard when typing Lots.
  // Edge-to-edge (Expo SDK 54 default) breaks Android `adjustResize`, so the
  // footer won't move on its own — we translate it up by the keyboard height.
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, (e) => setKbHeight(e?.endCoordinates?.height || 0));
    const hide = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Load instrument metadata + initial pin state + accounts
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [list, watchlist] = await Promise.allSettled([
        getInstruments(),
        getWatchlist(),
      ]);
      if (cancelled) return;
      if (list.status === 'fulfilled') {
        const found = (list.value || []).find((i) => String(i.symbol || '').toUpperCase() === symbol);
        setInstrument(found || null);
      }
      if (watchlist.status === 'fulfilled') setPinned((watchlist.value || []).includes(symbol));
    })();
    return () => { cancelled = true; };
  }, [symbol]);

  // Refresh tick + bars
  const refresh = useCallback(async () => {
    const [prices, b1d, b1w, b1m] = await Promise.allSettled([
      ApiService.getAllPrices(),
      ApiService.getBars(symbol, { resolution: '60', limit: 24 }),
      ApiService.getBars(symbol, { resolution: 'D',  limit: 7 }),
      ApiService.getBars(symbol, { resolution: 'D',  limit: 30 }),
    ]);
    if (prices.status === 'fulfilled') {
      const arr = Array.isArray(prices.value) ? prices.value : (Array.isArray(prices.value?.items) ? prices.value.items : []);
      const t = arr.find((x) => String(x.symbol || x.ticker || '').toUpperCase() === symbol);
      if (t) setTick(t);
    }
    // Backend ignores `limit` and returns full history — keep the most recent
    // bars so the OHLC / 1D-1W-1M figures reflect the intended window.
    const arrOr = (s) => Array.isArray(s) ? s : [];
    if (b1d.status === 'fulfilled') setBars1D(arrOr(b1d.value).slice(-24));
    if (b1w.status === 'fulfilled') setBars1W(arrOr(b1w.value).slice(-7));
    if (b1m.status === 'fulfilled') setBars1M(arrOr(b1m.value).slice(-30));
  }, [symbol]);

  useEffect(() => { refresh(); }, [refresh]);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  // Live ticks
  useEffect(() => {
    if (typeof webSocketService?.onPriceUpdate !== 'function') return;
    const unsub = webSocketService.onPriceUpdate((msg) => {
      if (!msg) return;
      const sym = String(msg.symbol || msg.s || '').toUpperCase();
      if (sym !== symbol) return;
      setTick((prev) => ({
        ...(prev || {}),
        symbol: sym,
        bid: msg.bid != null ? Number(msg.bid) : prev?.bid,
        ask: msg.ask != null ? Number(msg.ask) : prev?.ask,
      }));
    });
    webSocketService.connectPriceStream?.();
    return () => { if (typeof unsub === 'function') unsub(); };
  }, [symbol]);

  // Derived
  const bid = tick?.bid != null ? Number(tick.bid) : null;
  const ask = tick?.ask != null ? Number(tick.ask) : null;
  const change = tick?.change != null ? Number(tick.change) : null;
  const changePct = tick?.change_pct != null ? Number(tick.change_pct) : null;
  const spread = bid != null && ask != null ? Math.round((ask - bid) * 100000) : null;

  const ohlc = useMemo(() => {
    if (!bars1D.length) return { open: null, high: null, low: null, close: null };
    const sorted = [...bars1D].sort((a, b) => (a.time || 0) - (b.time || 0));
    const first = sorted[0] || {};
    const last  = sorted[sorted.length - 1] || {};
    const high  = Math.max(...sorted.map((b) => Number(b.high ?? b.h ?? 0)).filter(Number.isFinite));
    const low   = Math.min(...sorted.map((b) => Number(b.low  ?? b.l ?? 0)).filter((v) => Number.isFinite(v) && v > 0));
    return {
      open:  Number(first.open  ?? first.o ?? null),
      close: Number(last.close  ?? last.c ?? null),
      high:  Number.isFinite(high) ? high : null,
      low:   Number.isFinite(low)  ? low  : null,
    };
  }, [bars1D]);

  const pctFor = (bars) => {
    if (!bars?.length) return null;
    const sorted = [...bars].sort((a, b) => (a.time || 0) - (b.time || 0));
    const first = Number(sorted[0]?.close ?? sorted[0]?.c ?? 0);
    const last  = Number(sorted[sorted.length - 1]?.close ?? sorted[sorted.length - 1]?.c ?? 0);
    if (!first) return null;
    return (last - first) / first * 100;
  };
  const pct1D = changePct ?? pctFor(bars1D);
  const pct1W = pctFor(bars1W);
  const pct1M = pctFor(bars1M);
  // 1-day absolute change — tick's field, else derived from the day's bars
  // (first vs last close) so the header shows real movement, not a static "—".
  const dayChangeAbs = change ?? (bars1D.length ? (() => {
    const s = [...bars1D].sort((a, b) => (a.time || 0) - (b.time || 0));
    const f = Number(s[0]?.close ?? s[0]?.c);
    const l = Number(s[s.length - 1]?.close ?? s[s.length - 1]?.c);
    return Number.isFinite(f) && Number.isFinite(l) ? l - f : null;
  })() : null);
  const positive = (pct1D ?? 0) >= 0;

  // 1h Low/High range
  const range1h = useMemo(() => {
    if (!bars1D.length) return null;
    const lastHour = bars1D.slice(-1)[0];
    if (!lastHour) return null;
    const low = Number(lastHour.low ?? lastHour.l ?? 0);
    const high = Number(lastHour.high ?? lastHour.h ?? 0);
    if (!(low > 0) || !(high > 0)) return null;
    const cur = bid ?? Number(lastHour.close ?? lastHour.c ?? low);
    const pos = (cur - low) / (high - low || 1);
    return { low, high, posPct: Math.max(0, Math.min(1, pos)) };
  }, [bars1D, bid]);

  const togglePin = useCallback(async () => {
    if (pinned) {
      await removeFromWatchlist(symbol);
      setPinned(false);
      showToast({ kind: 'info', message: `${symbol} removed from watchlist` });
    } else {
      await addToWatchlist(symbol);
      setPinned(true);
      showToast({ kind: 'success', message: `${symbol} added to watchlist` });
    }
  }, [pinned, symbol]);

  // Open positions for THIS symbol on the selected account (shown in Orders tab).
  useEffect(() => {
    const id = activeAccount?.id || activeAccount?._id;
    if (!id || activeAccount?.is_active === false) { setMyPositions([]); return; }
    let cancelled = false;
    ApiService.getPositions(id, 'open')
      .then((res) => {
        const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
        if (!cancelled) setMyPositions(list.filter((p) => String(p.symbol || '').toUpperCase() === symbol));
      })
      .catch(() => { if (!cancelled) setMyPositions([]); });
    return () => { cancelled = true; };
  }, [activeAccount, symbol]);

  const placeOrder = useCallback(async () => {
    if (!activeAccount || !(lots > 0)) return;
    setSubmitting(true);
    try {
      await ApiService.placeOrder({
        account_id: activeAccount.id || activeAccount._id,
        symbol,
        side,
        order_type: 'market',
        lots: Number(lots),
      });
      showToast({ kind: 'success', message: `${side.toUpperCase()} ${lots} ${symbol} placed` });
    } catch (e) {
      handleTradeError(e?.message, 'Order failed');
    } finally {
      setSubmitting(false);
    }
  }, [activeAccount, lots, side, symbol]);

  const tvSym = toTradingViewSymbol(symbol);
  const interval = (TIMEFRAMES.find((x) => x.key === tf) || TIMEFRAMES[1]).tv;
  const chartHtml = useMemo(() => buildTvHtml(tvSym, interval, vantage.isDark), [tvSym, interval]);

  // Auth token for the self-hosted charting-library datafeed (bars endpoint).
  useEffect(() => {
    let m = true;
    SecureStore.getItemAsync('token').then((t) => { if (m) setAuthToken(t || ''); }).catch(() => {});
    return () => { m = false; };
  }, []);

  // When a self-hosted charting library is configured, use it (real charts for
  // all backend-tracked symbols). Otherwise fall back to the TradingView widget.
  const chartSource = useMemo(() => {
    if (CHART_URL) {
      const q = new URLSearchParams({
        symbol: CHART_SYMBOL_ALIAS[symbol] || symbol,
        interval,
        theme: vantage.isDark ? 'dark' : 'light',
        api: API_URL,
        token: authToken || '',
      });
      return { uri: `${CHART_URL}?${q.toString()}` };
    }
    return { html: chartHtml, baseUrl: 'https://www.tradingview.com' };
  }, [symbol, interval, authToken, chartHtml]);

  return (
    <Screen edges={['top']}>
      <Header
        symbol={symbol}
        pinned={pinned}
        onBack={() => nav.goBack()}
        onSymbolPress={() => setPickerOpen(true)}
        onPin={togglePin}
        onAlert={() => showToast({ kind: 'info', message: 'Alerts coming soon' })}
        onShare={() => showToast({ kind: 'info', message: 'Share coming soon' })}
      />

      <SymbolPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(sym) => setSymbol(String(sym).toUpperCase())}
      />

      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={styles.tabCell} accessibilityRole="tab" accessibilityState={{ selected: tab === t.key }}>
            <Text style={[styles.tabLabel, tab === t.key && { color: vantage.textPrimary, fontWeight: weights.heavy }]}>
              {t.label}
            </Text>
            <View style={[styles.tabUnderline, tab === t.key && { backgroundColor: vantage.accent }]} />
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: footerH + space.lg }}>
        {tab === 'chart' ? (
          <>
            <View style={styles.heroRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroPrice}>{bid != null ? bid.toLocaleString('en-US', { maximumFractionDigits: 5 }) : '—'}</Text>
                <Text style={[styles.heroChange, { color: pct1D == null ? vantage.textMuted : positive ? vantage.up : vantage.down }]}>
                  {dayChangeAbs != null ? `${positive ? '+' : '−'}${Math.abs(dayChangeAbs).toFixed(2)}` : '—'}
                  {' '}
                  {pct1D != null ? `(${positive ? '+' : '−'}${Math.abs(pct1D).toFixed(2)}%) 1D` : ''}
                </Text>
                <Text style={styles.heroTime}>{new Date().toLocaleString('en-GB', { hour12: false })}</Text>
              </View>
              <View style={styles.ohlcGrid}>
                <Cell label="Open"  value={fmt(ohlc.open)} />
                <Cell label="High"  value={fmt(ohlc.high)} />
                <Cell label="Close" value={fmt(ohlc.close)} />
                <Cell label="Low"   value={fmt(ohlc.low)} />
              </View>
            </View>

            <View style={styles.chartWrap}>
              <WebView
                source={chartSource}
                style={styles.chart}
                javaScriptEnabled
                domStorageEnabled
                allowsInlineMediaPlayback
                startInLoadingState={false}
                originWhitelist={['*']}
                onError={() => {}}
              />
              <Pressable onPress={() => setChartFull(true)} style={styles.fsBtn} hitSlop={8} accessibilityLabel="Fullscreen chart">
                <Ionicons name="expand-outline" size={18} color={vantage.textPrimary} />
              </Pressable>
            </View>

            <Modal
              visible={chartFull}
              animationType="slide"
              onRequestClose={() => setChartFull(false)}
              supportedOrientations={['portrait', 'landscape']}
            >
              <View style={styles.fsContainer}>
                {/* Safe-area padding so the chart's top toolbar isn't hidden
                    behind the device status bar / notch. */}
                <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
                  <WebView
                    source={chartSource}
                    style={{ flex: 1, backgroundColor: vantage.bg }}
                    javaScriptEnabled
                    domStorageEnabled
                    allowsInlineMediaPlayback
                    originWhitelist={['*']}
                    onError={() => {}}
                  />
                </View>
                <Pressable
                  onPress={() => setChartFull(false)}
                  style={[styles.fsClose, { top: insets.top + 10 }]}
                  hitSlop={12}
                  accessibilityLabel="Exit fullscreen"
                >
                  <Ionicons name="close" size={22} color="#fff" />
                </Pressable>
              </View>
            </Modal>
          </>
        ) : tab === 'orders' ? (
          <View style={{ padding: space.lg }}>
            {myPositions.length > 0 ? (
              <>
                <Text style={styles.ordTitle}>Your {symbol} positions</Text>
                {myPositions.map((p) => {
                  const pside = String(p.side || '').toLowerCase();
                  const pl = p.profit ?? p.profit_loss ?? p.pnl ?? null;
                  const plPos = pl == null ? true : Number(pl) >= 0;
                  return (
                    <View key={p.id || p._id} style={styles.ordRow}>
                      <Text style={[styles.ordSide, { color: pside === 'buy' ? vantage.up : vantage.down }]}>
                        {pside.toUpperCase()} {p.volume ?? p.lots ?? '—'} @ {Number(p.open_price ?? 0).toFixed(5)}
                      </Text>
                      <Text style={[styles.ordPl, { color: plPos ? vantage.up : vantage.down }]}>
                        {pl != null ? `${plPos ? '+' : ''}${Number(pl).toFixed(2)}` : '—'}
                      </Text>
                    </View>
                  );
                })}
                <PillButton label="Manage in Trade" variant="primary" size="md" onPress={() => nav.navigate('TradeTab', { screen: 'Trade', params: { symbol, tradeView: 'cfds' } })} style={{ marginTop: space.md }} />
              </>
            ) : (
              <>
                <Text style={styles.empty}>No open {symbol} positions on this account.</Text>
                <PillButton label="Go to Trade" variant="primary" size="md" onPress={() => nav.navigate('TradeTab', { screen: 'Trade', params: { symbol, tradeView: 'cfds' } })} style={{ marginTop: space.md }} />
              </>
            )}
          </View>
        ) : (
          <View style={{ padding: space.lg }}>
            <InfoRow label="Symbol" value={symbol} />
            <InfoRow label="Name" value={instrument?.display_name || instrument?.name || '—'} />
            <InfoRow label="Segment" value={instrument?.segment || instrument?.category || '—'} />
            <InfoRow label="Bid" value={bid != null ? bid.toFixed(5) : '—'} />
            <InfoRow label="Ask" value={ask != null ? ask.toFixed(5) : '—'} />
            <InfoRow label="Spread (pts)" value={spread != null ? String(spread) : '—'} last />
          </View>
        )}
      </ScrollView>

      <View
        style={[styles.footer, {
          bottom: kbHeight,
          paddingBottom: kbHeight > 0 ? space.md : BOTTOM_NAV_PILL_HEIGHT + insets.bottom + space.sm,
        }]}
        onLayout={(e) => setFooterH(e.nativeEvent.layout.height)}
      >
        <Pressable onPress={() => setAcctSheet(true)} style={styles.acctRow} accessibilityRole="button" accessibilityLabel="Switch account">
          <Ionicons name="wallet-outline" size={14} color={vantage.textSecondary} />
          <Text style={styles.acctTxt} numberOfLines={1}>
            {activeAccount ? `${activeAccount.is_demo ? 'Demo' : 'Live'} ${activeAccount.account_number || activeAccount.id || ''}` : 'Select account'}
          </Text>
          <Ionicons name="chevron-down" size={14} color={vantage.textMuted} />
        </Pressable>
        <View style={styles.lotsBar}>
          <Text style={styles.lotsLabel}>Lots</Text>
          <LotsField value={lots} onChange={setLots} />
        </View>
        <BuySellSplit
          bid={bid}
          ask={ask}
          spreadPoints={spread}
          side={side}
          onChange={setSide}
        />
        <View style={styles.freeMarginRow}>
          <Text style={styles.freeMarginLab}>Free Margin:</Text>
          <Text style={styles.freeMarginVal}>
            {activeAccount?.balance != null ? `${Number(activeAccount.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${activeAccount.currency || 'USD'}` : '—'}
          </Text>
        </View>
        <PillButton
          label={submitting ? 'Placing…' : `${side === 'buy' ? 'Buy' : 'Sell'} ${lots} ${symbol}`}
          variant={side === 'buy' ? 'buy' : 'sell'}
          size="md"
          loading={submitting}
          disabled={!activeAccount || !(lots > 0) || submitting}
          onPress={placeOrder}
          style={{ marginTop: space.xs, minHeight: 42, paddingVertical: space.sm }}
        />
      </View>

      <AccountSwitcher
        visible={acctSheet}
        onClose={() => setAcctSheet(false)}
        accounts={accounts}
        selectedId={activeAccount?.id || activeAccount?._id}
        onSelect={selectAccount}
      />
    </Screen>
  );
}

// Type-only Lots input — no +/- steppers, just tap and type the volume.
function LotsField({ value, onChange }) {
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  const commit = () => {
    setEditing(false);
    const n = Number(String(text).replace(',', '.'));
    if (Number.isFinite(n) && n > 0) onChange(Math.min(1000, Math.max(0.01, n)));
  };
  return (
    <TextInput
      style={styles.lotsInput}
      value={editing ? text : Number(value).toFixed(2)}
      onFocus={() => { setEditing(true); setText(Number(value).toFixed(2)); }}
      onChangeText={setText}
      onBlur={commit}
      onSubmitEditing={commit}
      keyboardType="decimal-pad"
      returnKeyType="done"
      selectTextOnFocus
      placeholder="0.00"
      placeholderTextColor={vantage.textMuted}
      accessibilityLabel="Lots volume"
    />
  );
}

function Header({ symbol, pinned, onBack, onSymbolPress, onPin, onAlert, onShare }) {
  return (
    <View style={styles.header}>
      <IconButton icon={<Ionicons name="chevron-back" size={22} color={vantage.textPrimary} />} accessibilityLabel="Back" onPress={onBack} />
      <Pressable
        style={styles.symbolWrap}
        onPress={onSymbolPress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Change symbol"
      >
        <Text style={styles.symbolTxt}>{symbol}</Text>
        <Ionicons name="chevron-down" size={16} color={vantage.textPrimary} />
      </Pressable>
      <View style={{ flex: 1 }} />
      <Pressable onPress={onPin} hitSlop={8} accessibilityRole="button" accessibilityLabel={pinned ? 'Unpin' : 'Pin to watchlist'} style={styles.hdrIcon}>
        <Ionicons name={pinned ? 'star' : 'star-outline'} size={22} color={pinned ? vantage.accent : vantage.textPrimary} />
      </Pressable>
      <Pressable onPress={onAlert} hitSlop={8} accessibilityRole="button" accessibilityLabel="Set alert" style={styles.hdrIcon}>
        <Ionicons name="notifications-outline" size={22} color={vantage.textPrimary} />
      </Pressable>
      <Pressable onPress={onShare} hitSlop={8} accessibilityRole="button" accessibilityLabel="Share" style={styles.hdrIcon}>
        <Ionicons name="share-outline" size={22} color={vantage.textPrimary} />
      </Pressable>
    </View>
  );
}

function Cell({ label, value }) {
  return (
    <View style={styles.ohlcCell}>
      <Text style={styles.ohlcLab}>{label}</Text>
      <Text style={styles.ohlcVal}>{value}</Text>
    </View>
  );
}

function PeriodCell({ label, pct }) {
  const has = pct != null && Number.isFinite(pct);
  const positive = has && pct >= 0;
  return (
    <View style={styles.periodCell}>
      <Text style={styles.periodLab}>{label}</Text>
      <Text style={[styles.periodVal, { color: !has ? vantage.textMuted : positive ? vantage.up : vantage.down }]}>
        {has ? `${positive ? '+' : ''}${pct.toFixed(2)}%` : '—'}
      </Text>
    </View>
  );
}

function RangeBar({ range }) {
  if (!range) return null;
  return (
    <View style={styles.rangeWrap}>
      <View style={styles.rangeRow}>
        <Text style={styles.rangeLab}>Low</Text>
        <Text style={styles.rangeLab}>High</Text>
      </View>
      <View style={styles.rangeTrack}>
        <View style={[styles.rangeMarker, { left: `${range.posPct * 100}%` }]}>
          <Ionicons name="caret-down" size={12} color={vantage.textPrimary} />
        </View>
      </View>
      <View style={styles.rangeRow}>
        <Text style={styles.rangeVal}>{fmt(range.low)}</Text>
        <Text style={[styles.rangeLab, { fontSize: sizes.label }]}>1h</Text>
        <Text style={styles.rangeVal}>{fmt(range.high)}</Text>
      </View>
    </View>
  );
}

function InfoRow({ label, value, last }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoBorder]}>
      <Text style={styles.infoLab}>{label}</Text>
      <Text style={styles.infoVal} selectable>{value}</Text>
    </View>
  );
}

function fmt(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(5);
}

function buildTvHtml(tvSymbol, interval, isDark = true) {
  // TradingView Advanced Chart widget via iframe-style embed.
  const bg = isDark ? '#000000' : '#FFFFFF';
  const cfg = {
    autosize: true,
    symbol: tvSymbol,
    interval,
    timezone: 'Etc/UTC',
    theme: isDark ? 'dark' : 'light',
    style: '1',
    locale: 'en',
    enable_publishing: false,
    backgroundColor: bg,
    gridColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    hide_top_toolbar: false,
    hide_legend: false,
    save_image: false,
    studies: ['MASimple@tv-basicstudies', 'Volume@tv-basicstudies'],
    show_popup_button: false,
    container_id: 'tv-container',
  };
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{height:100%;width:100%;background:${bg};overflow:hidden}#tv-container{height:100%;width:100%}</style>
</head><body>
<div id="tv-container"></div>
<script src="https://s3.tradingview.com/tv.js"></script>
<script>
try {
  new TradingView.widget(${JSON.stringify(cfg)});
} catch (e) {
  document.body.innerHTML = '<div style="color:#888;font-family:system-ui;padding:20px;text-align:center">Chart unavailable</div>';
}
</script>
</body></html>`;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: space.sm, paddingTop: space.sm, paddingBottom: space.xs,
    gap: space.xs,
  },
  symbolWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  symbolTxt: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy },
  hdrIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  tabRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: vantage.border },
  tabCell: { flex: 1, alignItems: 'center', paddingVertical: space.sm },
  tabLabel: { color: vantage.textMuted, fontFamily, fontSize: sizes.h3 },
  tabUnderline: { height: 2, width: 36, borderRadius: 1, marginTop: space.xs },

  heroRow: { flexDirection: 'row', paddingHorizontal: space.lg, paddingVertical: space.sm, gap: space.md },
  heroPrice: { color: vantage.textPrimary, fontFamily, fontSize: sizes.hero, fontWeight: weights.heavy },
  heroChange: { fontFamily, fontSize: sizes.body, fontWeight: weights.bold, marginTop: 2 },
  heroTime: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2 },

  ohlcGrid: { width: 160, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'flex-start' },
  ohlcCell: { width: '50%', paddingVertical: 2 },
  ohlcLab: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro },
  ohlcVal: { color: vantage.textPrimary, fontFamily, fontSize: sizes.label, fontWeight: weights.bold },

  tfRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingBottom: space.sm },
  tfCell: { paddingVertical: space.xs },
  tfTxt: { color: vantage.textMuted, fontFamily, fontSize: sizes.body },
  tfMore: { marginLeft: 'auto' },

  chartWrap: { height: 380, marginHorizontal: space.sm, backgroundColor: vantage.bg, borderRadius: radius.md, overflow: 'hidden' },
  chart: { flex: 1, backgroundColor: vantage.bg },
  fsBtn: {
    // Bottom-right: clear of TradingView's top-anchored toolbar + indicator
    // dialog close (X) (top-right) and the TradingView logo (bottom-left).
    position: 'absolute', bottom: 10, right: 10,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: vantage.bgElevated, borderWidth: 1, borderColor: vantage.border,
    alignItems: 'center', justifyContent: 'center',
  },
  fsContainer: { flex: 1, backgroundColor: vantage.bg },
  fsClose: {
    position: 'absolute', right: 14,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },

  acctRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', backgroundColor: vantage.bgRaised, borderWidth: 1, borderColor: vantage.border, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 6, marginBottom: space.xs, maxWidth: '70%' },
  acctTxt: { color: vantage.textPrimary, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold, flexShrink: 1 },

  periodRow: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: vantage.border, marginTop: space.md },
  periodCell: { flex: 1, alignItems: 'center', paddingVertical: space.md, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: vantage.border },
  periodLab: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  periodVal: { fontFamily, fontSize: sizes.body, fontWeight: weights.bold, marginTop: 2 },

  rangeWrap: { paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: vantage.border },
  rangeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rangeLab: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro },
  rangeVal: { color: vantage.textPrimary, fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
  rangeTrack: { height: 4, backgroundColor: vantage.bgRaised, borderRadius: 2, marginVertical: space.sm, position: 'relative' },
  rangeMarker: { position: 'absolute', top: -10, marginLeft: -6, alignItems: 'center' },

  empty: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, textAlign: 'center', padding: space.lg },
  ordTitle: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, fontWeight: weights.bold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: space.sm },
  ordRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: vantage.border },
  ordSide: { fontFamily, fontSize: sizes.body, fontWeight: weights.bold },
  ordPl: { fontFamily, fontSize: sizes.body, fontWeight: weights.heavy },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.sm },
  infoBorder: { borderBottomColor: vantage.border, borderBottomWidth: StyleSheet.hairlineWidth },
  infoLab: { color: vantage.textMuted, fontFamily, fontSize: sizes.body },
  infoVal: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.bold },

  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: vantage.bg,
    paddingHorizontal: space.lg, paddingTop: space.xs,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: vantage.border,
    gap: space.xs,
  },
  lotsBar: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  lotsLabel: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, width: 50 },
  lotsInput: {
    flex: 1,
    height: 42,
    backgroundColor: vantage.bgRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: vantage.border,
    paddingHorizontal: space.md,
    color: vantage.textPrimary,
    fontFamily,
    fontSize: sizes.h3,
    fontWeight: weights.bold,
    textAlign: 'center',
  },
  freeMarginRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  freeMarginLab: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  freeMarginVal: { color: vantage.textPrimary, fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
});
