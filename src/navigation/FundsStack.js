import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import FundsScreen from '../screens/funds/FundsScreen';
import DepositScreen from '../screens/funds/DepositScreen';
import DepositRazorpay from '../screens/funds/DepositRazorpay';
import DepositOnchain from '../screens/funds/DepositOnchain';
import DepositManual from '../screens/funds/DepositManual';
import DepositOxapay from '../screens/funds/DepositOxapay';
import DepositLocalBanking from '../screens/funds/DepositLocalBanking';
import RazorpayCheckout from '../screens/funds/RazorpayCheckout';
import WithdrawScreen from '../screens/funds/WithdrawScreen';
import WithdrawCrypto from '../screens/funds/WithdrawCrypto';
import WithdrawManual from '../screens/funds/WithdrawManual';
import TransferScreen from '../screens/funds/TransferScreen';
import TransactionHistoryScreen from '../screens/funds/TransactionHistoryScreen';

const Stack = createNativeStackNavigator();

export default function FundsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000000' }, animation: 'slide_from_right', animationDuration: 250 }}>
      <Stack.Screen name="Funds" component={FundsScreen} />
      <Stack.Screen name="Deposit" component={DepositScreen} />
      <Stack.Screen name="DepositRazorpay" component={DepositRazorpay} />
      <Stack.Screen name="DepositOnchain" component={DepositOnchain} />
      <Stack.Screen name="DepositManual" component={DepositManual} />
      <Stack.Screen name="DepositOxapay" component={DepositOxapay} />
      <Stack.Screen name="DepositLocalBanking" component={DepositLocalBanking} />
      <Stack.Screen name="RazorpayCheckout" component={RazorpayCheckout} />
      <Stack.Screen name="Withdraw" component={WithdrawScreen} />
      <Stack.Screen name="WithdrawCrypto" component={WithdrawCrypto} />
      <Stack.Screen name="WithdrawManual" component={WithdrawManual} />
      <Stack.Screen name="Transfer" component={TransferScreen} />
      <Stack.Screen name="TransactionHistory" component={TransactionHistoryScreen} />
    </Stack.Navigator>
  );
}
