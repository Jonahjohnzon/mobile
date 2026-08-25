import 'react-native-gesture-handler';
import './global.css';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import { useFonts, BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import AppNavigator from './src/navigation/AppNavigator';
import { colors, navTheme } from './src/constants/theme';
import { checkAuth } from './src/lib/authCheck';

SplashScreen.preventAutoHideAsync().catch(() => {});

async function checkForOtaUpdate() {
  // No-op in Expo Go / dev builds — updates only work in release builds
  if (__DEV__ || !Updates.isEnabled) return;

  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      // Reload immediately so the new JS bundle is applied right away.
      // If you'd rather prompt the user first, swap this for a confirm dialog.
      await Updates.reloadAsync();
    }
  } catch (e) {
    // Fail silently — don't block app usage if the update check fails
    console.log('OTA update check failed:', e);
  }
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    BebasNeue_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    JetBrainsMono_500Medium,
  });

  const [ready, setReady] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (fontsLoaded || fontError) setReady(true);
  }, [fontsLoaded, fontError]);

  const onLayout = useCallback(async () => {
    if (ready) await SplashScreen.hideAsync();
  }, [ready]);

  useEffect(() => {
    if (ready) {
      checkAuth();
      checkForOtaUpdate();
    }
  }, [ready]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        checkAuth();
        checkForOtaUpdate();
      }
      appState.current = nextState;
    });
    return () => subscription.remove();
  }, []);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: colors.bg }} onLayout={onLayout}>
        <StatusBar style="light" />
        <NavigationContainer theme={navTheme}>
          <AppNavigator />
        </NavigationContainer>
      </View>
    </SafeAreaProvider>
  );
}