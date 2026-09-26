import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { backend } from '@/services/backend';
import { Icon } from './Icon';
import { useConfirm } from './ConfirmDialog';
import { PressableScale } from './ui';

/** Round red sign-out button; asks for confirmation first. */
export function LogoutButton() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useT();
  const confirm = useConfirm();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('settings.logout')}
      scaleTo={0.88}
      onPress={() => confirm(t('settings.logoutTitle'), t('settings.logoutBody'), t('settings.logout'), backend.logout, { icon: 'logout' })}
      style={s.button}>
      <Icon name="logout" size={19} color={colors.danger} />
    </PressableScale>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  button: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' },
}));
