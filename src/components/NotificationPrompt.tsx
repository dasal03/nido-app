import { useEffect, useState } from 'react';
import { AppState, Linking, Pressable, Text, View } from 'react-native';

import { makeStyles, usePreferences, useTheme } from '@/providers/Preferences';
import { ensureNotificationPermission, getNotificationPermission, type NotificationPermission } from '@/services/notifications';
import { radius, spacing, type } from '@/theme';
import { Icon } from './Icon';
import { PressableScale, tap } from './ui';

/** Home card suggesting to turn on notifications (requests, reminders) while they're off. */
export function NotificationPrompt() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t, prefs, setPref } = usePreferences();
  const [permission, setPermission] = useState<NotificationPermission | null>(null);

  useEffect(() => {
    const check = () =>
      getNotificationPermission()
        .then(setPermission)
        .catch(() => {});
    check();
    const sub = AppState.addEventListener('change', (state) => state === 'active' && check());
    return () => sub.remove();
  }, []);

  if (prefs.notifPromptDismissed || !permission || permission === 'granted' || permission === 'unsupported') return null;

  const enable = async () => {
    if (permission === 'blocked') return Linking.openSettings().catch(() => {});
    if (await ensureNotificationPermission()) {
      tap('success');
      setPermission('granted');
    } else {
      setPermission(await getNotificationPermission());
    }
  };

  return (
    <View style={s.card}>
      <View style={s.icon}>
        <Icon name="bell" size={20} color={colors.accent} />
      </View>
      <View style={{ flex: 1, gap: spacing.sm }}>
        <View>
          <Text style={s.title}>{t('notifPrompt.title')}</Text>
          <Text style={s.body}>{t(permission === 'blocked' ? 'notifPrompt.blockedBody' : 'notifPrompt.body')}</Text>
        </View>
        <PressableScale onPress={enable} style={s.cta} scaleTo={0.95}>
          <Text style={s.ctaText}>{t(permission === 'blocked' ? 'notifPrompt.openSettings' : 'notifPrompt.enable')}</Text>
        </PressableScale>
      </View>
      <Pressable onPress={() => setPref('notifPromptDismissed', true)} hitSlop={10} accessibilityLabel={t('common.close')}>
        <Icon name="close" size={18} color={colors.textSubtle} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md - 4,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md - 2,
    ...elevation,
  },
  icon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.bodyStrong, color: colors.text },
  body: { ...type.small, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    height: 34,
    justifyContent: 'center',
  },
  ctaText: { ...type.smallStrong, color: colors.onPrimary },
}));
