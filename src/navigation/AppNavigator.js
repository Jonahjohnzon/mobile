import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import RootTabs from './RootNavigator';
import DetailsScreen from '../screens/DetailsScreen';
import BrowseScreen from '../screens/BrowseScreen';
import ActorScreen from '../screens/ActorScreen';
import StreamScreen from '../screens/StreamScreen';
import TelestreamScreen from '../screens/TelestreamScreen';
import HistoryScreen from '../screens/HistoryScreen';
import WishlistScreen from '../screens/WishlistScreen';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import StreamBScreen from '../screens/StreamBScreen';
import { colors } from '../constants/theme';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="Tabs" component={RootTabs} />
      <Stack.Screen name="Details" component={DetailsScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="Browse" component={BrowseScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="Actor" component={ActorScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="History" component={HistoryScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="Wishlist" component={WishlistScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="SignUp" component={SignUpScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Stream" component={StreamScreen} options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="BStream" component={StreamBScreen} options={{ presentation: 'fullScreenModal' }} />
    </Stack.Navigator>
  );
}