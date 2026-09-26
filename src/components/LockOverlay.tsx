import * as LocalAuthentication from 'expo-local-authentication';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';

import { makeStyles, usePreferences } from '@/providers/Preferences';
import { fonts, spacing, type } from '@/theme';
import { Icon } from './Icon';
import { PressableScale } from './ui';

const RELOCK_AFTER_MS = 30_000;

export const lockSupported = Platform.OS !== 'web';

/** Whether the device can authenticate the user (biometrics or passcode). */
export async function canUseDeviceLock() {
  if (!lockSupported) return false;
  const [hardware, enrolled, level] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.getEnrolledLevelAsync(),
  ]);
  return (hardware && enrolled) || level !== LocalAuthentication.SecurityLevel.NONE;
}

export async function authenticate(prompt: string) {
  const result = await LocalAuthentication.authenticateAsync({ promptMessage: prompt, disableDeviceFallback: false });
  return result.success;
}

/**
 * Full-screen lock shown over the app when "lock" is enabled: on launch and after returning from
 * the background for more than 30 seconds. Prompts for Face ID / fingerprint / passcode.
 */
export function LockOverlay() {
  const s = useStyles();
  const { prefs, t, theme } = usePreferences();
  const enabled = prefs.lock && lockSupported;
  const [locked, setLocked] = useState(enabled);
  const backgroundedAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    if (await authenticate(t('lock.prompt'))) setLocked(false);
  }, [t]);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') backgroundedAt.current = Date.now();
      if (state === 'active' && backgroundedAt.current && Date.now() - backgroundedAt.current > RELOCK_AFTER_MS) setLocked(true);
    });
    return () => sub.remove();
  }, [enabled]);

  // Prompt automatically whenever the lock appears.
  useEffect(() => {
    if (!locked || !enabled) return;
    let active = true;
    authenticate(t('lock.prompt')).then((ok) => {
      if (active && ok) setLocked(false);
    });
    return () => {
      active = false;
    };
  }, [locked, enabled, t]);

  if (!enabled || !locked) return null;
  return (
    <LinearGradient colors={theme.colors.heroGradient} style={[StyleSheet.absoluteFill, s.root]}>
      <View style={s.icon}>
        <Icon name="lock" size={34} color="#FFFFFF" strokeWidth={2.2} />
      </View>
      <Text style={s.title}>{t('lock.title')}</Text>
      <Text style={s.body}>{t('lock.body')}</Text>
      <PressableScale onPress={unlock} style={s.button} accessibilityRole="button" accessibilityLabel={t('lock.unlock')}>
        <Icon name="fingerprint" size={20} color="#0A1F5C" strokeWidth={2.2} />
        <Text style={s.buttonText}>{t('lock.unlock')}</Text>
      </PressableScale>
    </LinearGradient>
  );
}

const useStyles = makeStyles(() => ({
  root: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, zIndex: 100 },
  icon: {
    width: 84,
    height: 84,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { fontFamily: fonts.extrabold, fontSize: 26, color: '#FFFFFF' },
  body: { ...type.body, color: 'rgba(255,255,255,0.8)', marginTop: spacing.sm },
  button: {
    marginTop: spacing.xl,
    height: 54,
    paddingHorizontal: spacing.xl,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  buttonText: { fontFamily: fonts.bold, fontSize: 16, color: '#0A1F5C' },
}));
