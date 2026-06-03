import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { SegmentedTabs, Card, showToast } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';
import ApiService from '../../services/ApiService';

export default function PositionsList({ positions = [], orders = [], onChange }) {
  const [view, setView] = useState('positions');

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
          ]}
        />
      </View>

      {view === 'positions' ? (
        positions.length === 0 ? (
          <Text style={styles.empty}>No open positions.</Text>
        ) : positions.map((p) => (
          <PositionRow key={p.id || p._id} position={p} onClose={() => handleClosePosition(p.id || p._id)} />
        ))
      ) : (
        orders.length === 0 ? (
          <Text style={styles.empty}>No pending orders.</Text>
        ) : orders.map((o) => (
          <OrderRow key={o.id || o._id} order={o} onCancel={() => handleCancelOrder(o.id || o._id)} />
        ))
      )}
    </View>
  );
}

function PositionRow({ position, onClose }) {
  const side = String(position.side || '').toLowerCase();
  const pl = position.profit ?? position.profit_loss ?? position.pl ?? null;
  const plPositive = pl == null ? true : Number(pl) >= 0;
  return (
    <Card style={styles.card}>
      <View style={styles.cardRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sym}>{position.symbol}</Text>
          <Text style={[styles.side, { color: side === 'buy' ? vantage.up : vantage.down }]}>
            {side.toUpperCase()} {position.volume ?? position.lots ?? '—'} @ {Number(position.open_price ?? position.openPrice ?? 0).toFixed(5)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.pl, { color: plPositive ? vantage.up : vantage.down }]}>
            {pl != null ? `${plPositive ? '+' : ''}${Number(pl).toFixed(2)}` : '—'} USD
          </Text>
          <Pressable onPress={onClose} hitSlop={8} style={styles.actionBtn}>
            <Ionicons name="close-circle-outline" size={20} color={vantage.textMuted} />
            <Text style={styles.actionTxt}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Card>
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
  pl: { fontFamily, fontSize: sizes.h3, fontWeight: weights.heavy },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.sm },
  actionTxt: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
});
