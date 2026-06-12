import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { SegmentedTabs, Card, Sheet, PillButton, showToast } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';
import ApiService from '../../services/ApiService';

export default function PositionsList({ positions = [], orders = [], history = [], onChange }) {
  const [view, setView] = useState('positions');
  const [slTpTarget, setSlTpTarget] = useState(null);

  const handleClosePosition = useCallback(async (id) => {
    Alert.alert('Close position', 'Confirm closing this position?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close', style: 'destructive', onPress: async () => {
        try {
          await ApiService.closePosition(id);
          showToast({ kind: 'success', message: 'Position closed' });
          onChange?.();
        } catch (e) {
          showToast({ kind: 'error', message: e?.message || 'Close failed' });
        }
      } },
    ]);
  }, [onChange]);

  const handleCancelOrder = useCallback(async (id) => {
    try {
      await ApiService.cancelOrder(id);
      showToast({ kind: 'success', message: 'Order cancelled' });
      onChange?.();
    } catch (e) {
      showToast({ kind: 'error', message: e?.message || 'Cancel failed' });
    }
  }, [onChange]);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <SegmentedTabs
          value={view}
          onChange={setView}
          options={[
            { value: 'positions', label: `Positions (${positions.length})` },
            { value: 'pending',   label: `Pending (${orders.length})` },
            { value: 'history',   label: 'History' },
          ]}
        />
      </View>

      {view === 'positions' ? (
        positions.length === 0 ? (
          <Text style={styles.empty}>No open positions.</Text>
        ) : positions.map((p) => (
          <PositionRow
            key={p.id || p._id}
            position={p}
            onClose={() => handleClosePosition(p.id || p._id)}
            onSetSlTp={() => setSlTpTarget(p)}
          />
        ))
      ) : view === 'pending' ? (
        orders.length === 0 ? (
          <Text style={styles.empty}>No pending orders.</Text>
        ) : orders.map((o) => (
          <OrderRow key={o.id || o._id} order={o} onCancel={() => handleCancelOrder(o.id || o._id)} />
        ))
      ) : (
        history.length === 0 ? (
          <Text style={styles.empty}>No trade history.</Text>
        ) : history.map((h, i) => (
          <HistoryRow key={h.id || h._id || i} trade={h} />
        ))
      )}

      <SlTpSheet
        position={slTpTarget}
        onClose={() => setSlTpTarget(null)}
        onSaved={onChange}
      />
    </View>
  );
}

function SlTpSheet({ position, onClose, onSaved }) {
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!position) return;
    const curSl = position.stop_loss ?? position.sl ?? '';
    const curTp = position.take_profit ?? position.tp ?? '';
    setSl(curSl ? String(curSl) : '');
    setTp(curTp ? String(curTp) : '');
  }, [position]);

  const save = useCallback(async () => {
    if (!position) return;
    setSaving(true);
    try {
      await ApiService.modifyPosition(position.id || position._id, {
        stop_loss: sl ? Number(sl) : null,
        take_profit: tp ? Number(tp) : null,
      });
      showToast({ kind: 'success', message: 'SL/TP updated' });
      onSaved?.();
      onClose();
    } catch (e) {
      showToast({ kind: 'error', message: e?.message || 'Update failed' });
    } finally {
      setSaving(false);
    }
  }, [position, sl, tp, onSaved, onClose]);

  const side = String(position?.side || '').toLowerCase();
  const current = position?.current_price ?? position?.currentPrice ?? null;

  return (
    <Sheet visible={!!position} onClose={onClose} title="Set SL / TP">
      {position ? (
        <View style={sheetStyles.wrap}>
          <View style={sheetStyles.head}>
            <Text style={styles.sym}>{position.symbol}</Text>
            <Text style={[styles.side, { color: side === 'buy' ? vantage.up : vantage.down }]}>
              {side.toUpperCase()} {position.volume ?? position.lots ?? '—'}
              {current != null ? `  ·  ${Number(current).toFixed(5)}` : ''}
            </Text>
          </View>

          <Text style={sheetStyles.label}>Stop Loss</Text>
          <TextInput
            value={sl}
            onChangeText={(t) => setSl(t.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="0.00000"
            placeholderTextColor={vantage.textMuted}
            style={sheetStyles.input}
          />

          <Text style={[sheetStyles.label, { marginTop: space.md }]}>Take Profit</Text>
          <TextInput
            value={tp}
            onChangeText={(t) => setTp(t.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="0.00000"
            placeholderTextColor={vantage.textMuted}
            style={sheetStyles.input}
          />

          <Text style={sheetStyles.hint}>Leave a field blank to remove that level.</Text>

          <PillButton
            label={saving ? 'Saving…' : 'Save SL / TP'}
            variant="primary"
            size="lg"
            loading={saving}
            disabled={saving}
            onPress={save}
            style={{ marginTop: space.lg }}
          />
        </View>
      ) : null}
    </Sheet>
  );
}

function PositionRow({ position, onClose, onSetSlTp }) {
  const side = String(position.side || '').toLowerCase();
  const pl = position.profit ?? position.profit_loss ?? position.pl ?? position.pnl ?? null;
  const plPositive = pl == null ? true : Number(pl) >= 0;
  const lots = position.volume ?? position.lots ?? position.quantity ?? '—';
  const open = Number(position.open_price ?? position.openPrice ?? 0);
  const current = position.current_price ?? position.currentPrice ?? null;
  const commission = position.commission ?? 0;
  const swap = position.swap ?? 0;

  return (
    <Card style={styles.card}>
      <View style={styles.cardRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sym}>{position.symbol}</Text>
          <Text style={[styles.side, { color: side === 'buy' ? vantage.up : vantage.down }]}>
            {side.toUpperCase()} {lots} @ {open ? open.toFixed(5) : '—'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.plLabel}>P&L</Text>
          <Text style={[styles.pl, { color: plPositive ? vantage.up : vantage.down }]}>
            {pl != null ? `${plPositive ? '+' : ''}${Number(pl).toFixed(2)}` : '—'} USD
          </Text>
        </View>
      </View>

      <View style={styles.metaGrid}>
        {current != null ? <Meta label="Current" value={Number(current).toFixed(5)} /> : null}
        <Meta label="Commission" value={`${Number(commission).toFixed(2)} USD`} />
        <Meta label="Swap" value={`${Number(swap).toFixed(2)} USD`} />
      </View>

      <View style={styles.btnRow}>
        <Pressable onPress={onSetSlTp} style={[styles.actionPill, styles.slTpBtn]} accessibilityRole="button" accessibilityLabel="Set stop loss / take profit">
          <Ionicons name="options-outline" size={16} color={vantage.accent} />
          <Text style={styles.slTpTxt}>SL/TP</Text>
        </Pressable>
        <Pressable onPress={onClose} style={[styles.actionPill, styles.closeBtn]} accessibilityRole="button">
          <Ionicons name="close-circle-outline" size={16} color={vantage.down} />
          <Text style={styles.closeTxt}>Close position</Text>
        </Pressable>
      </View>
    </Card>
  );
}

function HistoryRow({ trade }) {
  const side = String(trade.side || '').toLowerCase();
  const pnl = trade.pnl ?? trade.profit ?? trade.realized_pnl ?? null;
  const pnlPositive = pnl == null ? true : Number(pnl) >= 0;
  const lots = trade.lots ?? trade.volume ?? trade.quantity ?? '—';
  const open = Number(trade.open_price ?? 0);
  const close = Number(trade.close_price ?? 0);
  let dateStr = '';
  try {
    if (trade.close_time) {
      dateStr = new Date(trade.close_time).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    }
  } catch (_) {}

  return (
    <Card style={styles.card}>
      <View style={styles.cardRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sym}>{trade.symbol}</Text>
          <Text style={[styles.side, { color: side === 'buy' ? vantage.up : vantage.down }]}>
            {side.toUpperCase()} {lots} @ {open ? open.toFixed(5) : '—'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.plLabel}>P&L</Text>
          <Text style={[styles.pl, { color: pnlPositive ? vantage.up : vantage.down }]}>
            {pnl != null ? `${pnlPositive ? '+' : ''}${Number(pnl).toFixed(2)}` : '—'} USD
          </Text>
        </View>
      </View>
      <View style={styles.metaGrid}>
        <Meta label="Close price" value={close ? close.toFixed(5) : '—'} />
        <Meta label="Commission" value={`${Number(trade.commission ?? 0).toFixed(2)} USD`} />
        <Meta label="Swap" value={`${Number(trade.swap ?? 0).toFixed(2)} USD`} />
        {dateStr ? <Meta label="Closed" value={dateStr} /> : null}
      </View>
    </Card>
  );
}

function Meta({ label, value }) {
  return (
    <View style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function OrderRow({ order, onCancel }) {
  const side = String(order.side || '').toLowerCase();
  return (
    <Card style={styles.card}>
      <View style={styles.cardRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sym}>{order.symbol}</Text>
          <Text style={[styles.side, { color: side === 'buy' ? vantage.up : vantage.down }]}>
            {(order.order_type || 'limit').toUpperCase()} {side.toUpperCase()} {order.volume ?? order.lots ?? '—'} @ {Number(order.price ?? 0).toFixed(5)}
          </Text>
        </View>
        <Pressable onPress={onCancel} hitSlop={8} style={styles.actionBtn}>
          <Ionicons name="trash-outline" size={20} color={vantage.down} />
          <Text style={[styles.actionTxt, { color: vantage.down }]}>Cancel</Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm },
  headerRow: { paddingBottom: space.sm },
  empty: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, textAlign: 'center', padding: space.lg },
  card: { marginBottom: space.sm },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  sym: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold },
  side: { fontFamily, fontSize: sizes.label, fontWeight: weights.semibold, marginTop: 2 },
  plLabel: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro },
  pl: { fontFamily, fontSize: sizes.h3, fontWeight: weights.heavy, marginTop: 1 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.sm },
  actionTxt: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },

  metaGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: space.lg,
    marginTop: space.md, paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: vantage.border,
  },
  meta: { minWidth: 80 },
  metaLabel: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro },
  metaValue: { color: vantage.textPrimary, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold, marginTop: 2 },
  btnRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  actionPill: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs,
    paddingVertical: space.sm, borderRadius: 10, borderWidth: 1,
  },
  slTpBtn: { borderColor: vantage.accent },
  slTpTxt: { color: vantage.accent, fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
  closeBtn: { borderColor: vantage.down },
  closeTxt: { color: vantage.down, fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
});

const sheetStyles = StyleSheet.create({
  wrap: { paddingBottom: space.md },
  head: { marginBottom: space.lg },
  label: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, marginBottom: space.sm },
  input: {
    backgroundColor: vantage.bgRaised, borderRadius: radius.md, borderWidth: 1, borderColor: vantage.border,
    paddingHorizontal: space.md, paddingVertical: space.md,
    color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.bold,
  },
  hint: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro, marginTop: space.sm },
});
