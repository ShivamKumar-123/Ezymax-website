import React, { useRef, useEffect } from 'react';
import { Image } from 'react-native';
import LottieView from 'lottie-react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeStack from './HomeStack';
import MarketsStack from './MarketsStack';
import TradeStack from './TradeStack';
import FundsStack from './FundsStack';
import { BottomNavPill } from '../components/vantage';
import { vantage } from '../theme/vantageTheme';

// Active theme is already applied (index.js) before this module loads, so the
// branch below picks the right Home icon at evaluation time.
const LIGHT_THEME = vantage.isDark === false;

// Light theme uses the brand-coloured logo; dark theme uses the white cut-out.
const HOME_ICON = LIGHT_THEME
  ? require('../../assets/swisscresta-homebar.png')
  : require('../../assets/swisscresta-homebar-white.png');

// Each theme has its own Lottie set — the f04024 variants are the brand-red
// icons used on the light theme.
const LOTTIE = LIGHT_THEME
  ? {
      MarketsTab: require('../../assets/market f04024.json'),
      TradeTab:   require('../../assets/trade f04024.json'),
      FundsTab:   require('../../assets/funds f04024.json'),
    }
  : {
      MarketsTab: require('../../assets/market.json'),
      TradeTab:   require('../../assets/trade.json'),
      FundsTab:   require('../../assets/funds.json'),
    };

const LOTTIE_SIZE = { width: 28, height: 28 };

// Plays the animation ONCE when its tab becomes active (i.e. on tap). Otherwise
// it sits on the first frame — no autonomous movement without a click.
function TabLottieIcon({ source, active }) {
  const ref = useRef(null);
  useEffect(() => {
    if (active) {
      ref.current?.reset?.();
      ref.current?.play?.();
    } else {
      ref.current?.reset?.();
    }
  }, [active]);
  return (
    <LottieView
      ref={ref}
      source={source}
      autoPlay={false}
      loop={false}
      style={[LOTTIE_SIZE, !active && { opacity: 0.45 }]}
    />
  );
}

const Tab = createBottomTabNavigator();

const TAB_META = {
  HomeTab:    { label: 'Home' },
  MarketsTab: { label: 'Markets' },
  TradeTab:   { label: 'Trade' },
  FundsTab:   { label: 'Funds' },
};

function VantageTabBar({ state, navigation }) {
  const activeKey = state.routes[state.index].name;
  const tabs = state.routes.map((r) => {
    const m = TAB_META[r.name];
    if (r.name === 'HomeTab') {
      return {
        key: r.name,
        label: m.label,
        icon:         <Image source={HOME_ICON} style={{ width: 22, height: 22 }} resizeMode="contain" />,
        iconInactive: <Image source={HOME_ICON} style={{ width: 22, height: 22, opacity: 0.4 }} resizeMode="contain" />,
      };
    }
    const src = LOTTIE[r.name];
    return {
      key: r.name,
      label: m.label,
      // Single persistent icon — plays only when it becomes active (on tap).
      renderIcon: (active) => <TabLottieIcon source={src} active={active} />,
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
