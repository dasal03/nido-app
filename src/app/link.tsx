import { useState } from 'react';
import { Pressable, Text } from 'react-native';

import { AuthShell } from '@/components/AuthShell';
import { DeleteAccountSheet } from '@/components/DeleteAccountSheet';
import { Icon } from '@/components/Icon';
import { LinkForm } from '@/components/LinkForm';
import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { backend } from '@/services/backend';
import { useSession } from '@/store/SavingsContext';
import { spacing, type } from '@/theme';

/** First-run linking screen, shown while the user has no nest yet. */
export default function LinkScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useT();
  const { user } = useSession();
  const [deleting, setDeleting] = useState(false);
  if (!user) return null;

  return (
    <AuthShell title={t('link.title', { name: user.name })} subtitle={t('link.subtitle')}>
      <LinkForm />
      <Pressable onPress={() => backend.logout()} style={s.logout} accessibilityRole="button">
        <Icon name="logout" size={16} color={colors.textMuted} />
        <Text style={s.logoutText}>{t('settings.logout')}</Text>
      </Pressable>
      <Pressable onPress={() => setDeleting(true)} style={s.logout} accessibilityRole="button">
        <Text style={[s.logoutText, { color: colors.danger, fontSize: 13 }]}>{t('deleteAccount.title')}</Text>
      </Pressable>
      <DeleteAccountSheet visible={deleting} onClose={() => setDeleting(false)} />
    </AuthShell>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: spacing.sm },
  logoutText: { ...type.bodyStrong, color: colors.textMuted },
}));
