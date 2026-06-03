import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';

import {
  BuySellSplit,
  NumberStepper,
  DiscreteSlider,
  CheckboxRow,
  PillButton,
  Card,
  showToast,
} from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';
import ApiService from '../../services/ApiService';

const ORDER_TYPES = ['market', 'limit', 'stop'];
const LOT_PRESETS = [0.01, 0.1, 0.5, 1, 5];

export default function OrderTicket({ accountId, symbol, tick, onPlaced }) {
  const [side, setSide] = useState('sell');
  const [orderType, setOrderType] = useState('market');
  const [volume, setVolume] = useState(0.1);
  const [limitPrice, setLimitPrice] = useState('');
  const [tpSlEnabled, setTpSlEnabled] = useState(false);
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const bid = tick?.bid != null ? Number(tick.bid) : null;
  const ask = tick?.ask != null ? Number(tick.ask) : null;
  const spread = (bid != null && ask != null) ? Math.round((ask - bid) * 100000) : null;

  const canSubmit = useMemo(() => {
    if (!accountId || !symbol) return false;
    if (!(volume > 0)) return false;
    if (orderType !== 'market' && !(Number(limitPrice) > 0)) return false;
    if (tpSlEnabled) {
      if (stopLoss && !(Number(stopLoss) > 0)) return false;
      if (takeProfit && !(Number(takeProfit) > 0)) return false;
    }
    return true;
  }, [accountId, symbol, volume, orderType, limitPrice, tpSlEnabled, stopLoss, takeProfit]);

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const payload = {
      account_id: accountId,
      symbol,
      side,
      order_type: orderType,
      volume: Number(volume),
    };
    if (orderType !== 'market') payload.price = Number(limitPrice);
    if (tpSlEnabled) {
      if (stopLoss) payload.stop_loss = Number(stopLoss);
      if (takeProfit) payload.take_profit = Number(takeProfit);
    }
    try {
      await ApiService.placeOrder(payload);
      showToast({ kind: 'success', message: `${side.toUpperCase()} ${volume} ${symbol} placed` });
      onPlaced?.();
    } catch (e) {
      showToast({ kind: 'error', message: e?.message || 'Order failed' });
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, accountId, symbol, side, orderType, volume, limitPrice, tpSlEnabled, stopLoss, takeProfit, onPlaced]);

  return (
    <View style={styles.wrap}>
      <BuySellSplit
        bid={bid}
        ask={ask}
        spreadPoints={spread}
        side={side}
        onChange={setSide}
      />

      <View style={styles.typeRow}>
        {ORDER_TYPES.map((t) => (
          <Pressable
            key={t}
            onPress={() => setOrderType(t)}
            style={[styles.typeChip, orderType === t && styles.typeChipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: orderType === t }}
          >
            <Text style={[styles.typeTxt, orderType === t && { color: vantage.textPrimary, fontWeight: weights.bold }]}>
              {t.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      {orderType !== 'market' ? (
        <View style={styles.field}>
          <Text style={styles.label}>{orderType === 'limit' ? 'Limit price' : 'Stop price'}</Text>
          <TextInput
            value={limitPrice}
            onChangeText={setLimitPrice}
            keyboardType="decimal-pad"
            placeholder="0.00000"
            placeholderTextColor={vantage.textMuted}
            style={styles.input}
          />
        </View>
      ) : null}

      <View style={styles.field}>
        <NumberStepper
          label="Volume (lots)"
          value={volume}
          onChange={setVolume}
          min={0.01}
          max={1000}
          step={0.01}
          precision={2}
        />
        <View style={{ height: space.md }} />
        <DiscreteSlider value={LOT_PRESETS.includes(volume) ? volume : null} onChange={setVolume} stops={LOT_PRESETS} />
      </View>

      <CheckboxRow label="TP / SL" checked={tpSlEnabled} onChange={setTpSlEnabled} />
      {tpSlEnabled ? (
        <View style={styles.tpSlRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Stop Loss</Text>
            <TextInput
              value={stopLoss}
              onChangeText={setStopLoss}
              keyboardType="decimal-pad"
              placeholder="0.00000"
              placeholderTextColor={vantage.textMuted}
              style={styles.input}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Take Profit</Text>
            <TextInput
              value={takeProfit}
              onChangeText={setTakeProfit}
              keyboardType="decimal-pad"
              placeholder="0.00000"
              placeholderTextColor={vantage.textMuted}
              style={styles.input}
            />
          </View>
        </View>
      ) : null}

      <Card style={styles.infoCard}>
        <InfoRow label="Symbol" value={symbol || '—'} />
        <InfoRow label="Side" value={side.toUpperCase()} valueColor={side === 'buy' ? vantage.up : vantage.down} />
        <InfoRow label="Volume" value={`${volume} lots`} />
        <InfoRow label="Type" value={orderType.toUpperCase()} last />
      </Card>

      <PillButton
        label={submitting ? 'Placing…' : `${side === 'buy' ? 'Buy' : 'Sell'} ${symbol || ''}`}
        variant={side === 'buy' ? 'buy' : 'sell'}
        size="lg"
        loading={submitting}
        disabled={!canSubmit || submitting}
        onPress={submit}
        style={{ marginTop: space.lg }}
      />
    </View>
  );
}

function InfoRow({ label, value, valueColor, last }) {
  return (
    <View style={[infoStyles.row, !last && infoStyles.border]}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={[infoStyles.value, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.md },
  typeRow: { flexDirection: 'row', gap: space.sm },
  typeChip: {
    flex: 1, paddingVertical: space.sm, paddingHorizontal: space.md,
    backgroundColor: vantage.bgElevated,
    borderRadius: radius.pill,
    borderWidth: 1, borderColor: vantage.border,
    alignItems: 'center',
  },
  typeChipActive: { backgroundColor: vantage.bgRaised, borderColor: vantage.accent },
  typeTxt: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  field: { gap: space.xs },
  label: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label },
  input: {
    backgroundColor: vantage.bgRaised,
    borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: space.md,
    color: vantage.textPrimary, fontFamily, fontSize: sizes.h3, fontWeight: weights.bold,
  },
  tpSlRow: { flexDirection: 'row', gap: space.md },
  infoCard: { marginTop: space.sm },
});

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space.sm },
  border: { borderBottomColor: vantage.border, borderBottomWidth: StyleSheet.hairlineWidth },
  label: { color: vantage.textMuted, fontFamily, fontSize: sizes.body },
  value: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.bold },
});
