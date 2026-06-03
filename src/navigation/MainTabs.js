import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeStack from './HomeStack';
import MarketsStack from './MarketsStack';
import TradeStack from './TradeStack';
import FundsStack from './FundsStack';
import { BottomNavPill } from '../components/vantage';
import { vantage } from '../theme/vantageTheme';

const Tab = createBottomTabNavigator();

const TAB_META = {
  HomeTab:    { label: 'Home',    iconActive: 'triangle',         iconInactive: 'triangle-outline' },
  MarketsTab: { label: 'Markets', iconActive: 'bar-chart',        iconInactive: 'bar-chart-outline' },
  TradeTab:   { label: 'Trade',   iconActive: 'swap-horizontal',  iconInactive: 'swap-horizontal-outline' },
  FundsTab:   { label: 'Funds',   iconActive: 'pie-chart',        iconInactive: 'pie-chart-outline' },
};

function VantageTabBar({ state, navigation }) {
  const activeKey = state.routes[state.index].name;
  const tabs = state.routes.map((r) => {
    const m = TAB_META[r.name];
    return {
      key: r.name,
      label: m.label,
      icon:         <Ionicons name={m.iconActive}   size={18} color={vantage.textPrimary} />,
      iconInactive: <Ionicons name={m.iconInactive} size={18} color={vantage.textMuted} />,
    };
  });

  return (
    <BottomNavPill
      tabs={tabs}
      activeKey={activeKey}
      onChange={(k) => navigation.navigate(k)}
    />
  );
}

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <VantageTabBar {...props} />}
    >
      <Tab.Screen name="HomeTab"    component={HomeStack} />
      <Tab.Screen name="MarketsTab" component={MarketsStack} />
      <Tab.Screen name="TradeTab"   component={TradeStack} />
      <Tab.Screen name="FundsTab"   component={FundsStack} />
    </Tab.Navigator>
  );
}
