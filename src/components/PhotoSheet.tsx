import { Text, View } from 'react-native';

import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import type { User } from '@/store/types';
import { radius, spacing, type } from '@/theme';
import { Avatar } from './Avatar';
import { Icon, type IconName } from './Icon';
import { Sheet } from './Sheet';
import { PressableScale } from './ui';

export type PhotoAction = 'library' | 'camera' | 'remove';

/** Bottom sheet to choose where the profile photo comes from. */
export function PhotoSheet({
  visible,
  user,
  onClose,
  onSelect,
}: {
  visible: boolean;
  user: User;
  onClose: () => void;
  onSelect: (action: PhotoAction) => void;
}) {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useT();

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={s.header}>
        <Avatar user={user} color={colors.me} size={64} />
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{t('photo.title')}</Text>
          <Text style={s.subtitle}>{t('photo.subtitle')}</Text>
        </View>
      </View>
      <View style={s.tiles}>
        <Tile icon="image" label={t('photo.library')} hint={t('photo.libraryHint')} onPress={() => onSelect('library')} />
        <Tile icon="camera" label={t('photo.camera')} hint={t('photo.cameraHint')} onPress={() => onSelect('camera')} />
      </View>
      {user.photo && (
        <PressableScale onPress={() => onSelect('remove')} style={s.remove} scaleTo={0.98}>
          <Icon name="trash" size={18} color={colors.danger} />
          <Text style={s.removeText}>{t('photo.remove')}</Text>
        </PressableScale>
      )}
    </Sheet>
  );
}

function Tile({ icon, label, hint, onPress }: { icon: IconName; label: string; hint: string; onPress: () => void }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <PressableScale containerStyle={{ flex: 1 }} onPress={onPress} style={s.tile} scaleTo={0.96}>
      <View style={s.tileIcon}>
        <Icon name={icon} size={24} color={colors.accent} />
      </View>
      <Text style={s.tileLabel}>{label}</Text>
      <Text style={s.tileHint}>{hint}</Text>
    </PressableScale>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  title: { ...type.h2, color: colors.text },
  subtitle: { ...type.small, color: colors.textMuted, marginTop: 2 },
  tiles: { flexDirection: 'row', gap: spacing.sm + 4, alignItems: 'stretch' },
  // flexGrow (not flex: 1) so the tile keeps its content height and both tiles match the taller one.
  tile: {
    flexGrow: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 6,
    minHeight: 132,
  },
  tileIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  tileLabel: { ...type.bodyStrong, color: colors.text },
  tileHint: { ...type.small, fontSize: 12, color: colors.textMuted, lineHeight: 16 },
  remove: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerSoft,
    marginTop: spacing.md,
  },
  removeText: { ...type.bodyStrong, color: colors.danger },
}));
