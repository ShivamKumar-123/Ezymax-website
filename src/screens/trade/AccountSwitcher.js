import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Sheet, MenuRow } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';

export default function AccountSwitcher({ visible, onClose, accounts = [], selectedId, onSelect }) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Select account">
      {accounts.length === 0 ? (
        <Text style={styles.empty}>No accounts. Open one in Funds.</Text>
      ) : accounts.map((a) => {
        const id = a.id || a._id;
        const isSelected = id === selectedId;
        const label = `${a.is_demo ? 'Demo' : 'Live'} ${a.account_number || id}`;
        const balance = a.balance != null ? `${Number(a.balance).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${a.currency || 'USD'}` : '';
        return (
          <MenuRow
            key={id}
            icon={<Ionicons name={isSelected ? 'checkmark-circle' : 'card-outline'} size={20} color={isSelected ? vantage.accent : vantage.textPrimary} />}
            label={label}
            value={balance}
            onPress={() => { onSelect(a); onClose(); }}
          />
        );
      })}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  empty: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, padding: space.lg, textAlign: 'center' },
});
