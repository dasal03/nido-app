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

import { BiometricOffer } from '@/components/BiometricOffer';
import { ConfirmProvider } from '@/components/ConfirmDialog';
import { CelebrationWatcher } from '@/game/Celebrations';
import { NotificationSync } from '@/game/NotificationSync';
import { RequestNotifier } from '@/game/RequestNotifier';
import { PreferencesProvider, usePreferences, useTheme } from '@/providers/Preferences';
import { AppProvider, useSession } from '@/store/SavingsContext';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootStack() {
  const { user, couple } = useSession();
  const { colors, dark } = useTheme();
  const { prefs, setPref } = usePreferences();
  const linked = !!user && !!couple;
  // Anyone who has signed in on this device doesn't need the welcome slides again.
  useEffect(() => {
    if (user && !prefs.onboarded) setPref('onboarded', true);
  }, [user, prefs.onboarded, setPref]);

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
        <Stack.Protected guard={!user && !prefs.onboarded}>
          <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={!user && prefs.onboarded}>
          <Stack.Screen name="login" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Screen name="legal" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        {/* Deep link target (nido://invite?code=…); redirects according to the session state. */}
        <Stack.Screen name="invite" options={{ animation: 'none' }} />
      </Stack>
      {linked && <CelebrationWatcher />}
      {linked && <NotificationSync />}
      {linked && <RequestNotifier />}
      {user && <BiometricOffer />}
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
          <ConfirmProvider>
            <RootStack />
          </ConfirmProvider>
        </AppProvider>
      </PreferencesProvider>
    </SafeAreaProvider>
  );
}
