import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { showToast } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';

import AccountSwitcher from './AccountSwitcher';
import SymbolPicker from './SymbolPicker';
import OrderTicket from './OrderTicket';
import PositionsList from './PositionsList';

export default function TradeCFDs({
  accounts,
  selectedAccount,
  onSelectAccount,
  symbol,
  onSelectSymbol,
  tick,
  accountSummary,
  positions,
  orders,
  onChange,
}) {
  const [accountSheet, setAccountSheet] = useState(false);
  const [symbolSheet, setSymbolSheet] = useState(false);

  const equity = accountSummary?.equity ?? accountSummary?.balance ?? null;

  return (
    <View>
      <Pressable onPress={() => setAccountSheet(true)} style={styles.accountRow} accessibilityRole="button">
        <View style={{ flex: 1 }}>
          <Text style={styles.tagLine}>{selectedAccount?.is_demo ? 'Demo' : 'Live'} #{selectedAccount?.account_number || selectedAccount?.id || '—'}</Text>
          <Text style={styles.equityValue}>
            {equity != null ? Number(equity).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'} {selectedAccount?.currency || 'USD'}
          </Text>
          <Text style={styles.tagSub}>Equity</Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={vantage.textMuted} />
      </Pressable>

      <Pressable onPress={() => setSymbolSheet(true)} style={styles.symbolRow} accessibilityRole="button">
        <Text style={styles.symbolName}>{symbol || 'Select symbol'}</Text>
        <Ionicons name="chevron-down" size={18} color={vantage.textMuted} />
        <View style={{ flex: 1 }} />
      </Pressable>

      <OrderTicket
        accountId={selectedAccount?.id || selectedAccount?._id}
        symbol={symbol}
        tick={tick}
        onPlaced={onChange}
      />

      <PositionsList positions={positions} orders={orders} onChange={onChange} />

      <AccountSwitcher
        visible={accountSheet}
        onClose={() => setAccountSheet(false)}
        accounts={accounts}
        selectedId={selectedAccount?.id || selectedAccount?._id}
        onSelect={onSelectAccount}
      />
      <SymbolPicker
        visible={symbolSheet}
        onClose={() => setSymbolSheet(false)}
        onSelect={onSelectSymbol}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  accountRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: vantage.bgElevated,
    margin: space.lg, padding: space.lg, borderRadius: 16,
  },
  tagLine: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },
  equityValue: { color: vantage.textPrimary, fontFamily, fontSize: sizes.hero, fontWeight: weights.heavy, marginTop: 2 },
  tagSub: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2 },
  symbolRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    paddingHorizontal: space.lg, paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: vantage.border,
  },
  symbolName: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy },
});
