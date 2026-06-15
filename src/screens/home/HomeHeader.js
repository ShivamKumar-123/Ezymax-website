import React, { useContext, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { useNavigation } from '@react-navigation/native';

import { AuthContext } from '../../context/AuthContext';
import { IconButton } from '../../components/vantage';
import SymbolPicker from '../trade/SymbolPicker';
import { vantage, space } from '../../theme/vantageTheme';

const AVATAR_ANIM = require('../../../assets/avatar f04024.json');

export default function HomeHeader({ unreadNotifications = 0 }) {
  const nav = useNavigation();
  const { user } = useContext(AuthContext) || {};
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => nav.navigate('ProfileMenu')}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Open profile menu"
      >
        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, styles.avatarFallback]}>
            <LottieView source={AVATAR_ANIM} autoPlay loop style={styles.avatarAnim} />
          </View>
        </View>
      </Pressable>

      <View style={{ flex: 1 }} />

      <IconButton
        icon={<Ionicons name="search" size={18} color={vantage.textPrimary} />}
        accessibilityLabel="Search"
        onPress={() => setSearchOpen(true)}
      />
      <IconButton
        icon={<Ionicons name="notifications-outline" size={18} color={vantage.textPrimary} />}
        badgeColor={unreadNotifications > 0 ? vantage.down : undefined}
        accessibilityLabel="Notifications"
        onPress={() => nav.navigate('Notifications')}
      />

      <SymbolPicker
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={(sym) => nav.navigate('MarketsTab', { screen: 'InstrumentDetail', params: { symbol: sym } })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.md,
    gap: space.xs,
  },
  avatarWrap: { padding: 2 },
  avatar: {
    width: 36, height: 36, borderRadius: 18, overflow: 'hidden',
  },
  avatarFallback: {
    backgroundColor: vantage.bgRaised,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarAnim: { width: 30, height: 30 },
});
