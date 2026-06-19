import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { SegmentedTabs, Card, Sheet, PillButton, showToast, showAppAlert } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';
import ApiService from '../../services/ApiService';
import { isSoftTradeError, handleTradeError } from '../../utils/tradeErrors';

export default function PositionsList({ positions = [], orders = [], history = [], account, accountSummary, onChange }) {
  const [view, setView] = useState('positions');
  const [slTpTarget, setSlTpTarget] = useState(null);
  // Themed close-confirm flows. We track the position *id* (not the object) so
  // the open sheet always re-reads the latest `positions` prop → live P&L.
  const [closeId, setCloseId] = useState(null);
  const [closeAllOpen, setCloseAllOpen] = useState(false);

  const confirmCloseOne = useCallback(async () => {
    if (!closeId) return;
    try {
      await ApiService.closePosition(closeId);
      showToast({ kind: 'success', message: 'Position closed' });
      onChange?.();
    } catch (e) {
      // MAM-mirrored / market-closed responses surface as a calm info popup
      // instead of a red error.
      handleTradeError(e?.message, 'Close failed');
    } finally {
      setCloseId(null);
    }
  }, [closeId, onChange]);

  const confirmCloseAll = useCallback(async () => {
    const ids = positions.map((p) => p.id || p._id).filter(Boolean);
    if (!ids.length) { setCloseAllOpen(false); return; }
    const results = await Promise.allSettled(ids.map((id) => ApiService.closePosition(id)));
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const rejected = results.filter((r) => r.status === 'rejected');
    // MAM-mirrored / closed-market positions are "skipped", not failures.
    const skipped = rejected.filter((r) => isSoftTradeError(r.reason?.message)).length;
    const failed = rejected.length - skipped;

    setCloseAllOpen(false);
    onChange?.();

    if (failed > 0) {
      // Only genuine failures use the red error toast.
      showToast({ kind: 'error', message: `Closed ${ok}${skipped ? `, ${skipped} skipped` : ''}, ${failed} failed` });
    } else if (skipped > 0) {
      // Managed (MAM) / market-closed positions can't be closed here — show a
      // calm themed popup, not an error.
      showAppAlert({
        title: 'Some positions skipped',
        message: ok > 0
          ? `Closed ${ok} position(s). ${skipped} couldn't be closed here because they're managed (MAM) trades or the market is closed.`
          : `These ${skipped} position(s) can't be closed here — they're managed (MAM) trades or the market is closed.`,
      });
    } else {
      showToast({ kind: 'success', message: 'All positions closed' });
    }
  }, [positions, onChange]);

  const closingPos = closeId
    ? positions.find((p) => String(p.id || p._id) === String(closeId)) || null
    : null;

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
      <AccountSummaryCard account={account} summary={accountSummary} openCount={positions.length} closedCount={history.length} />

      <View style={styles.headerRow}>
        <SegmentedTabs
          value={view}
          onChange={setView}
          options={[
            { value: 'positions', label: `Positions (${positions.length})` },
            { value: 'pending',   label: `Pending (${orders.length})` },
            { value: 'history',   label: `History (${history.length})` },
          ]}
        />
      </View>

      {view === 'positions' ? (
        positions.length === 0 ? (
          <Text style={styles.empty}>No open positions.</Text>
        ) : (
          <>
            <View style={styles.closeAllRow}>
              <Pressable onPress={() => setCloseAllOpen(true)} style={styles.closeAllBtn} accessibilityRole="button" accessibilityLabel="Close all positions">
                <Ionicons name="close-circle-outline" size={16} color={vantage.down} />
                <Text style={styles.closeAllTxt}>Close all ({positions.length})</Text>
              </Pressable>
            </View>
            {positions.map((p) => (
              <PositionRow
                key={p.id || p._id}
                position={p}
                onClose={() => setCloseId(p.id || p._id)}
                onSetSlTp={() => setSlTpTarget(p)}
              />
            ))}
          </>
        )
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

      <CloseConfirmSheet
        position={closingPos}
        onCancel={() => setCloseId(null)}
        onConfirm={confirmCloseOne}
      />

      <CloseAllSheet
        visible={closeAllOpen}
        positions={positions}
        onCancel={() => setCloseAllOpen(false)}
        onConfirm={confirmCloseAll}
      />
    </View>
  );
}

// Helper — pull a position's live P&L regardless of which field the API used.
function plOf(p) {
  if (!p) return null;
  const v = p.profit ?? p.profit_loss ?? p.pl ?? p.pnl ?? null;
  return v == null ? null : Number(v);
}

// Themed close-confirm sheet with a big, live-updating P&L. Because the parent
// re-derives `position` from the latest props on every refresh tick, the P&L
// shown here keeps moving while the sheet is open.
function CloseConfirmSheet({ position, onCancel, onConfirm }) {
  const [closing, setClosing] = useState(false);
  const side = String(position?.side || '').toLowerCase();
  const pl = plOf(position);
  const plPositive = pl == null ? true : pl >= 0;
  const lots = position?.volume ?? position?.lots ?? position?.quantity ?? '—';
  const open = Number(position?.open_price ?? position?.openPrice ?? 0);
  const current = position?.current_price ?? position?.currentPrice ?? null;

  const confirm = useCallback(async () => {
    setClosing(true);
    try { await onConfirm(); } finally { setClosing(false); }
  }, [onConfirm]);

  return (
    <Sheet visible={!!position} onClose={onCancel} title="Close position">
      {position ? (
        <View style={sheetStyles.wrap}>
          <View style={sheetStyles.head}>
            <Text style={styles.sym}>{position.symbol}</Text>
            <Text style={[styles.side, { color: side === 'buy' ? vantage.up : vantage.down }]}>
              {side.toUpperCase()} {lots} @ {open ? open.toFixed(5) : '—'}
            </Text>
          </View>

          <View style={closeStyles.plBox}>
            <Text style={closeStyles.plLab}>Live P&L</Text>
            <Text style={[closeStyles.plBig, { color: plPositive ? vantage.up : vantage.down }]}>
              {pl != null ? `${plPositive ? '+' : ''}${pl.toFixed(2)} USD` : '—'}
            </Text>
            {current != null ? (
              <Text style={closeStyles.plSub}>Current {Number(current).toFixed(5)}</Text>
            ) : null}
          </View>

          <Text style={sheetStyles.hint}>This closes the position at the current market price.</Text>

          <PillButton
            label={closing ? 'Closing…' : 'Close position'}
            variant="sell"
            size="lg"
            loading={closing}
            disabled={closing}
            onPress={confirm}
            style={{ marginTop: space.lg }}
          />
          <Pressable onPress={onCancel} disabled={closing} style={closeStyles.cancel} accessibilityRole="button">
            <Text style={closeStyles.cancelTxt}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}
    </Sheet>
  );
}

// Close-all confirm sheet — shows the combined live P&L across every open
// position and closes them all at market on confirm.
function CloseAllSheet({ visible, positions, onCancel, onConfirm }) {
  const [closing, setClosing] = useState(false);
  const total = (positions || []).reduce((sum, p) => sum + (plOf(p) ?? 0), 0);
  const positive = total >= 0;

  const confirm = useCallback(async () => {
    setClosing(true);
    try { await onConfirm(); } finally { setClosing(false); }
  }, [onConfirm]);

  return (
    <Sheet visible={visible} onClose={onCancel} title={`Close all (${positions?.length || 0})`}>
      <View style={sheetStyles.wrap}>
        <View style={closeStyles.plBox}>
          <Text style={closeStyles.plLab}>Total live P&L</Text>
          <Text style={[closeStyles.plBig, { color: positive ? vantage.up : vantage.down }]}>
            {`${positive ? '+' : ''}${total.toFixed(2)} USD`}
          </Text>
        </View>

        <Text style={sheetStyles.hint}>
          This closes all {positions?.length || 0} open position(s) at the current market price.
        </Text>

        <PillButton
          label={closing ? 'Closing…' : `Close all ${positions?.length || 0} positions`}
          variant="sell"
          size="lg"
          loading={closing}
          disabled={closing || !(positions?.length > 0)}
          onPress={confirm}
          style={{ marginTop: space.lg }}
        />
        <Pressable onPress={onCancel} disabled={closing} style={closeStyles.cancel} accessibilityRole="button">
          <Text style={closeStyles.cancelTxt}>Cancel</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

const closeStyles = StyleSheet.create({
  plBox: {
    alignItems: 'center',
    backgroundColor: vantage.bgRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: vantage.border,
    paddingVertical: space.lg,
    marginBottom: space.md,
  },
  plLab: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  plBig: { fontFamily, fontSize: sizes.hero, fontWeight: weights.heavy, marginTop: 4 },
  plSub: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 4 },
  cancel: { alignItems: 'center', paddingVertical: space.md, marginTop: space.xs },
  cancelTxt: { color: vantage.textSecondary, fontFamily, fontSize: sizes.body, fontWeight: weights.semibold },
});

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
          <Text style={[styles.side, { color: side === 'buy' ? vantage.up : vantage.down, fontWeight: weights.bold }]}>
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

// Account snapshot above the positions/history tabs — balance, equity, margin.
function AccountSummaryCard({ account, summary, openCount, closedCount }) {
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
  const fmt2 = (v) => (v == null ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const ccy = account?.currency || 'USD';
  const balance = num(summary?.balance) ?? num(account?.balance);
  const equity = num(summary?.equity) ?? balance;
  const usedMargin = num(summary?.margin) ?? num(summary?.used_margin) ?? num(summary?.margin_used);
  const freeMargin = num(summary?.free_margin) ?? (equity != null && usedMargin != null ? equity - usedMargin : equity);
  const marginLevel = num(summary?.margin_level);
  const label = account ? `${account.is_demo ? 'Demo' : 'Live'} ${account.account_number || account.id || ''}`.trim() : 'No account';
  return (
    <Card style={styles.summary}>
      <View style={styles.sumTop}>
        <Text style={styles.sumAcct} numberOfLines={1}>{label}</Text>
        <Text style={styles.sumCounts}>{openCount} open · {closedCount} closed</Text>
      </View>
      <View style={styles.sumGrid}>
        <SumCell label="Balance" value={`${fmt2(balance)} ${ccy}`} />
        <SumCell label="Equity" value={`${fmt2(equity)} ${ccy}`} />
        <SumCell label="Used Margin" value={fmt2(usedMargin)} />
        <SumCell label="Free Margin" value={fmt2(freeMargin)} />
        {marginLevel != null ? <SumCell label="Margin Level" value={`${fmt2(marginLevel)}%`} /> : null}
      </View>
    </Card>
  );
}

function SumCell({ label, value }) {
  return (
    <View style={styles.sumCell}>
      <Text style={styles.sumLab}>{label}</Text>
      <Text style={styles.sumVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm },
  summary: { marginBottom: space.sm },
  sumTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.sm, gap: space.sm },
  sumAcct: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.heavy, flexShrink: 1 },
  sumCounts: { color: vantage.textMuted, fontFamily, fontSize: sizes.label },
  sumGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.sm },
  sumCell: { width: '33%' },
  sumLab: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro },
  sumVal: { color: vantage.textPrimary, fontFamily, fontSize: sizes.label, fontWeight: weights.bold, marginTop: 2 },
  headerRow: { paddingBottom: space.sm },
  closeAllRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: space.sm },
  closeAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: space.xs,
    paddingVertical: space.xs, paddingHorizontal: space.md,
    borderRadius: radius.pill, borderWidth: 1, borderColor: vantage.down,
  },
  closeAllTxt: { color: vantage.down, fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
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
  slTpBtn: { borderColor: '#FBA945' },
  slTpTxt: { color: vantage.accent, fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
  closeBtn: { borderColor: '#FBA945' },
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
