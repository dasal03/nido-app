import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { useMoney, useSavings } from '@/store/SavingsContext';
import type { Goal } from '@/store/types';
import { radius, spacing, type } from '@/theme';
import { GoalIcon } from './GoalIcon';
import { Icon } from './Icon';
import { PressableScale, ProgressBar } from './ui';

function useGoalProgress(goal: Goal) {
  const { savedFor } = useSavings();
  const saved = savedFor(goal.id);
  return { saved, progress: goal.target > 0 ? saved / goal.target : 0 };
}

/** Compact tile used in the home carousel. */
export function GoalTile({ goal }: { goal: Goal }) {
  const s = useStyles();
  const money = useMoney();
  const { saved, progress } = useGoalProgress(goal);
  return (
    <PressableScale onPress={() => router.push(`/goal/${goal.id}`)} style={s.tile}>
      <View style={s.tileTop}>
        <GoalIcon icon={goal.icon} color={goal.color} />
        <Text style={[s.pct, { color: goal.color }]}>{Math.min(Math.round(progress * 100), 100)}%</Text>
      </View>
      <Text style={s.tileName} numberOfLines={1}>
        {goal.name}
      </Text>
      <Text style={s.tileAmount} numberOfLines={1}>
        {money(saved, { compact: true })}
      </Text>
      <Text style={s.tileTarget} numberOfLines={1}>
        / {money(goal.target, { compact: true })}
      </Text>
      <View style={{ marginTop: spacing.sm + 4 }}>
        <ProgressBar progress={progress} color={goal.color} height={6} />
      </View>
    </PressableScale>
  );
}

/** Full-width row used on the Goals tab. */
export function GoalRow({ goal }: { goal: Goal }) {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useT();
  const money = useMoney();
  const { saved, progress } = useGoalProgress(goal);
  const done = progress >= 1;
  return (
    <PressableScale onPress={() => router.push(`/goal/${goal.id}`)} style={s.row} scaleTo={0.98}>
      <View style={s.rowTop}>
        <GoalIcon icon={goal.icon} color={goal.color} size={48} />
        <View style={{ flex: 1 }}>
          <Text style={s.rowName} numberOfLines={1}>
            {goal.name}
          </Text>
          <Text style={s.rowMeta}>{t('goals.ofAmount', { saved: money(saved), target: money(goal.target) })}</Text>
        </View>
        {done ? (
          <View style={s.doneBadge}>
            <Icon name="check" size={14} color={colors.success} strokeWidth={3} />
            <Text style={s.doneText}>{t('goals.done')}</Text>
          </View>
        ) : (
          <Text style={[s.pct, { color: goal.color }]}>{Math.round(progress * 100)}%</Text>
        )}
      </View>
      <ProgressBar progress={progress} color={done ? colors.success : goal.color} />
    </PressableScale>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  tile: { width: 164, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, ...elevation },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md - 2 },
  tileName: { ...type.smallStrong, color: colors.textMuted },
  tileAmount: { ...type.h2, color: colors.text, marginTop: 2 },
  tileTarget: { ...type.small, color: colors.textSubtle },
  row: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.md, ...elevation },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md - 2 },
  rowName: { ...type.h3, color: colors.text },
  rowMeta: { ...type.small, color: colors.textMuted, marginTop: 2 },
  pct: { ...type.smallStrong, fontSize: 14 },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.successSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  doneText: { ...type.tiny, color: colors.success },
}));
