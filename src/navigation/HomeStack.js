import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../screens/HomeScreen';
import ComponentGalleryScreen from '../screens/_dev/ComponentGalleryScreen';
import ProfileMenuScreen from '../screens/profile/ProfileMenuScreen';

// Legacy screens — reached from Profile menu until they're rewritten in Vantage style.
import KycScreen from '../screens/KycScreen';
import AccountsScreen from '../screens/AccountsScreen';
import PortfolioScreen from '../screens/PortfolioScreen';
import IBScreen from '../screens/IBScreen';
import BusinessScreen from '../screens/BusinessScreen';
import PammScreen from '../screens/PammScreen';
import AcademyScreen from '../screens/AcademyScreen';
import RiskCalculatorScreen from '../screens/RiskCalculatorScreen';
import EconomicCalendarScreen from '../screens/EconomicCalendarScreen';
import OrderBookScreen from '../screens/OrderBookScreen';
import SupportScreen from '../screens/SupportScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import InstructionsScreen from '../screens/InstructionsScreen';

const Stack = createNativeStackNavigator();

export default function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000000' }, animation: 'slide_from_right', animationDuration: 250 }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="ProfileMenu" component={ProfileMenuScreen} options={{ animation: 'slide_from_left' }} />

      <Stack.Screen name="Kyc" component={KycScreen} />
      <Stack.Screen name="Accounts" component={AccountsScreen} />
      <Stack.Screen name="Portfolio" component={PortfolioScreen} />
      <Stack.Screen name="IB" component={IBScreen} />
      <Stack.Screen name="Business" component={BusinessScreen} />
      <Stack.Screen name="Pamm" component={PammScreen} />
      <Stack.Screen name="Academy" component={AcademyScreen} />
      <Stack.Screen name="RiskCalculator" component={RiskCalculatorScreen} />
      <Stack.Screen name="EconomicCalendar" component={EconomicCalendarScreen} />
      <Stack.Screen name="OrderBook" component={OrderBookScreen} />
      <Stack.Screen name="Support" component={SupportScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Instructions" component={InstructionsScreen} />

      {__DEV__ ? <Stack.Screen name="ComponentGallery" component={ComponentGalleryScreen} /> : null}
    </Stack.Navigator>
  );
}
