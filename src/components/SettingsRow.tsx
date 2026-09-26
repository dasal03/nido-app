import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { makeStyles, useTheme } from '@/providers/Preferences';
import { spacing, type } from '@/theme';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './ui';

/** Grouped-list row with a tinted icon, label, optional hint/value and chevron. */
export function SettingsRow({
  icon,
  label,
  hint,
  value,
  onPress,
  danger,
  divider,
  trailing,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  divider?: boolean;
  trailing?: ReactNode;
}) {
  const s = useStyles();
  const { colors } = useTheme();
  const tint = danger ? colors.danger : colors.accent;
  return (
    <PressableScale disabled={!onPress} onPress={onPress} scaleTo={0.985} style={[s.row, divider && s.divider]}>
      <View style={[s.icon, { backgroundColor: danger ? colors.dangerSoft : colors.accentSoft }]}>
        <Icon name={icon} size={18} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.label, danger && { color: colors.danger }]}>{label}</Text>
        {hint && (
          <Text style={s.hint} numberOfLines={1}>
            {hint}
          </Text>
        )}
      </View>
      {value && <Text style={s.value}>{value}</Text>}
      {trailing ?? (onPress && !danger && <Icon name="chevron" size={18} color={colors.textSubtle} />)}
    </PressableScale>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md - 4, paddingVertical: spacing.sm + 5 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { ...type.bodyStrong, fontFamily: type.small.fontFamily, fontSize: 15, color: colors.text },
  hint: { ...type.small, color: colors.textMuted, marginTop: 1 },
  value: { ...type.bodyStrong, color: colors.textMuted },
}));
