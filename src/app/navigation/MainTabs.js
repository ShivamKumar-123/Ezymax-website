import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Image, View } from 'react-native';
import LottieView from 'lottie-react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeStack from './HomeStack';
import MarketsStack from './MarketsStack';
import TradeStack from './TradeStack';
import FundsStack from './FundsStack';
import { BottomNavPill } from '../../components/vantage';
import { vantage } from '../../theme/vantageTheme';
import OnboardingTour from '../../components/onboarding/OnboardingTour';
import { hasSeenTour, markTourSeen } from '../../components/onboarding/tourStorage';

// Active theme is already applied (index.js) before this module loads, so the
// branch below picks the right Home icon at evaluation time.
const LIGHT_THEME = vantage.isDark === false;

// Light theme uses the brand-coloured logo; dark theme uses the white cut-out.
const HOME_ICON = LIGHT_THEME
  ? require('../../../assets/brand/swisscresta-homebar.png')
  : require('../../../assets/brand/swisscresta-homebar-white.png');

// Each theme has its own Lottie set — the *-active variants are the brand-red
// (#f04024) icons used on the light theme.
const LOTTIE = LIGHT_THEME
  ? {
      MarketsTab: require('../../../assets/animations/market-active.json'),
      TradeTab:   require('../../../assets/animations/trade-active.json'),
      FundsTab:   require('../../../assets/animations/funds-active.json'),
    }
  : {
      MarketsTab: require('../../../assets/animations/market.json'),
      TradeTab:   require('../../../assets/animations/trade.json'),
      FundsTab:   require('../../../assets/animations/funds.json'),
    };

// Root screen of each tab's stack — used to pop back to root on active re-tap.
const TAB_ROOT = { HomeTab: 'Home', MarketsTab: 'Markets', TradeTab: 'Trade', FundsTab: 'Funds' };

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

function VantageTabBar({ state, navigation, barRef }) {
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
    <View ref={barRef} collapsable={false}>
    <BottomNavPill
      tabs={tabs}
      activeKey={activeKey}
      onChange={(k) => {
        // Reset the tab's stack to its root when:
        //  • re-tapping the already-active tab (e.g. Home while the profile
        //    drawer is open returns Home), OR
        //  • opening Markets — it should ALWAYS show the instruments list, even
        //    if an instrument-detail chart was left open before switching away.
        if (k === activeKey || k === 'MarketsTab') {
          navigation.navigate(k, { screen: TAB_ROOT[k] });
        } else {
          navigation.navigate(k);
        }
      }}
    />
    </View>
  );
}

// ── First-run coach-mark tour ────────────────────────────────────────────────
// Shown once after the first login. The bottom bar's frame is measured and
// split into four equal segments so each tab gets its own spotlight; the
// welcome/done steps are centred cards without a target.
const TAB_TOUR_COPY = [
  { key: 'home',    title: 'Home',    text: 'Your dashboard — balance card, watchlist and quick actions live here.' },
  { key: 'markets', title: 'Markets', text: 'Browse every instrument, pin favourites to your watchlist and open an advanced chart with one tap.' },
  { key: 'trade',   title: 'Trade',   text: 'All your open positions with live P&L. Set SL/TP, partial-close or bulk-close — and review pending orders and history.' },
  { key: 'funds',   title: 'Funds',   text: 'Deposit, withdraw, transfer between accounts and download your transaction history.' },
];

function useFirstRunTour(barRef) {
  const [steps, setSteps] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (await hasSeenTour()) return;
      // Let the tab bar settle before measuring (first layout + animations).
      setTimeout(() => {
        if (cancelled || !barRef.current) return;
        barRef.current.measureInWindow((x, y, width, height) => {
          if (cancelled || !width || !height) return;
          const segW = width / TAB_TOUR_COPY.length;
          setSteps([
            {
              key: 'welcome',
              title: 'Welcome to SwissCresta',
              text: 'A quick 30-second tour of the essentials — you can skip any time.',
              target: null,
            },
            ...TAB_TOUR_COPY.map((c, i) => ({
              ...c,
              target: { x: x + i * segW, y, width: segW, height },
            })),
            {
              key: 'done',
              title: "You're all set",
              text: 'Tip: on any chart, drag the SL/TP buttons on your position line to set stop-loss and take-profit visually.',
              target: null,
            },
          ]);
        });
      }, 900);
    })();
    return () => { cancelled = true; };
  }, [barRef]);

  const done = useCallback(() => {
    setSteps(null);
    markTourSeen();
  }, []);

  return { steps, done };
}

export default function MainTabs() {
  const barRef = useRef(null);
  const { steps, done } = useFirstRunTour(barRef);

  return (
    <>
      <Tab.Navigator
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <VantageTabBar {...props} barRef={barRef} />}
      >
        <Tab.Screen name="HomeTab"    component={HomeStack} />
        <Tab.Screen name="MarketsTab" component={MarketsStack} />
        <Tab.Screen name="TradeTab"   component={TradeStack} />
        <Tab.Screen name="FundsTab"   component={FundsStack} />
      </Tab.Navigator>
      <OnboardingTour visible={!!steps} steps={steps || []} onDone={done} />
    </>
  );
}
