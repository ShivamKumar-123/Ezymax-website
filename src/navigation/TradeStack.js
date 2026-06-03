import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TradeScreen from '../screens/TradeScreen';
import StrategyDetailScreen from '../screens/trade/StrategyDetailScreen';

const Stack = createNativeStackNavigator();

export default function TradeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000' } }}>
      <Stack.Screen name="Trade" component={TradeScreen} />
      <Stack.Screen name="StrategyDetail" component={StrategyDetailScreen} />
    </Stack.Navigator>
  );
}
