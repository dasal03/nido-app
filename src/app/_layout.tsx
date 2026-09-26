import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LockOverlay } from '@/components/LockOverlay';
import { CelebrationWatcher } from '@/game/Celebrations';
import { NotificationSync } from '@/game/NotificationSync';
import { PreferencesProvider, useTheme } from '@/providers/Preferences';
import { AppProvider, useSession } from '@/store/SavingsContext';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootStack() {
  const { user, couple } = useSession();
  const { colors, dark } = useTheme();
  const linked = !!user && !!couple;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
        <Stack.Protected guard={linked}>
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="goal/[id]" />
          <Stack.Screen name="edit-profile" />
          <Stack.Screen name="add-partner" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="pet" />
          <Stack.Screen name="recurring" />
          <Stack.Screen name="new-recurring" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="archived" />
          <Stack.Screen name="transfer" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="new-goal" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="currency" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        </Stack.Protected>
        <Stack.Protected guard={!!user && !couple}>
          <Stack.Screen name="link" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={!user}>
          <Stack.Screen name="login" options={{ animation: 'fade' }} />
        </Stack.Protected>
        {/* Deep link target (nido://invite?code=…); redirects according to the session state. */}
        <Stack.Screen name="invite" options={{ animation: 'none' }} />
      </Stack>
      {linked && <CelebrationWatcher />}
      {linked && <NotificationSync />}
      {user && <LockOverlay />}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;
  return (
    <SafeAreaProvider>
      <PreferencesProvider>
        <AppProvider>
          <RootStack />
        </AppProvider>
      </PreferencesProvider>
    </SafeAreaProvider>
  );
}
