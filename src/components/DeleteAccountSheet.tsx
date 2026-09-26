import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { backend } from '@/services/backend';
import { disableBiometricLogin } from '@/services/biometrics';
import { radius, spacing, type } from '@/theme';
import { useAction } from '@/utils/useAction';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { Button, ErrorBanner, TextField } from './ui';

/** Permanently deletes the account after re-entering the password. */
export function DeleteAccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useT();
  const [password, setPassword] = useState('');
  const [shown, setShown] = useState(false);
  const remove = useAction(async () => {
    await backend.deleteAccount(password);
    await disableBiometricLogin().catch(() => {});
  });
  // Clear the field each time the sheet opens.
  if (visible && !shown) {
    setShown(true);
    setPassword('');
    remove.setError(null);
  }
  if (!visible && shown) setShown(false);

  const points = ['deleteAccount.point1', 'deleteAccount.point2', 'deleteAccount.point3'] as const;

  return (
    <Sheet visible={visible} onClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ gap: spacing.md }}>
        <View style={s.head}>
          <View style={s.icon}>
            <Icon name="trash" size={26} color={colors.danger} />
          </View>
          <Text style={s.title}>{t('deleteAccount.title')}</Text>
          <Text style={s.body}>{t('deleteAccount.body')}</Text>
        </View>
        <View style={s.points}>
          {points.map((key) => (
            <View key={key} style={s.point}>
              <Icon name="alert" size={16} color={colors.textMuted} />
              <Text style={s.pointText}>{t(key)}</Text>
            </View>
          ))}
        </View>
        <TextField
          label={t('deleteAccount.password')}
          icon="lock"
          value={password}
          onChangeText={setPassword}
          secure
          autoComplete="current-password"
        />
        <ErrorBanner message={remove.error} />
        <Button
          label={t('deleteAccount.cta')}
          variant="danger"
          icon="trash"
          onPress={() => remove.run()}
          loading={remove.loading}
          disabled={!password}
        />
        <Button label={t('common.cancel')} variant="secondary" onPress={onClose} />
      </KeyboardAvoidingView>
    </Sheet>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  head: { alignItems: 'center', gap: spacing.xs },
  icon: {
    width: 60,
    height: 60,
    borderRadius: 22,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: { ...type.h2, color: colors.text, textAlign: 'center' },
  body: { ...type.small, color: colors.textMuted, textAlign: 'center', lineHeight: 19 },
  points: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md - 2, gap: spacing.sm },
  point: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  pointText: { ...type.small, color: colors.text, flex: 1, lineHeight: 19 },
}));
