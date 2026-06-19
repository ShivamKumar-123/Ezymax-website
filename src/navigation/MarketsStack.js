import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MarketsScreen from '../screens/MarketsScreen';
import InstrumentDetailScreen from '../screens/markets/InstrumentDetailScreen';
import WatchlistEditScreen from '../screens/markets/WatchlistEditScreen';

const Stack = createNativeStackNavigator();

export default function MarketsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000000' }, animation: 'slide_from_right', animationDuration: 250 }}>
      <Stack.Screen name="Markets" component={MarketsScreen} />
      <Stack.Screen name="InstrumentDetail" component={InstrumentDetailScreen} />
      <Stack.Screen name="WatchlistEdit" component={WatchlistEditScreen} />
    </Stack.Navigator>
  );
}
