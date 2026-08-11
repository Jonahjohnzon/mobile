import 'react-native-gesture-handler';
import './global.css';

import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';

import AppNavigator from './src/navigation/AppNavigator';
import { colors, navTheme } from './src/constants/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    BebasNeue_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    JetBrainsMono_500Medium,
  });

  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) setReady(true);
  }, [fontsLoaded, fontError]);

  const onLayout = useCallback(async () => {
    if (ready) await SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      {/*
        Android is edge-to-edge only now — there's no real "status bar background"
        to paint anymore. The status bar area is transparent and shows whatever
        sits underneath it, so this root View's backgroundColor is what actually
        gives the illusion of a colored status bar. Every screen/header that
        reaches the top edge needs to use this same color, or you'll see a
        mismatched strip at the very top.
      */}
      <View style={{ flex: 1, backgroundColor: colors.bg }} onLayout={onLayout}>
        {/*
          Only `style` (icon color: "light" | "dark" | "auto") still does
          anything on Android under edge-to-edge. `backgroundColor` and
          `translucent` are deprecated no-ops as of recent Expo SDKs — setting
          them does nothing in production and can trigger a prebuild warning.
        */}
        <StatusBar style="light" />
        <NavigationContainer theme={navTheme}>
          <AppNavigator />
        </NavigationContainer>
      </View>
    </SafeAreaProvider>
  );
}