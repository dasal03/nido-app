import { Text, View } from 'react-native';

import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { backend } from '@/services/backend';
import { useMoney, useSavings } from '@/store/SavingsContext';
import { radius, spacing, type } from '@/theme';
import { GoalIcon } from './GoalIcon';
import { Icon } from './Icon';
import { PressableScale, tap } from './ui';

/** Cards for the signed-in user's recurring contributions that are due: confirm or skip in one tap. */
export function DueContributions() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useT();
  const { couple, goals, me } = useSavings();
  const money = useMoney();
  const now = new Date().toISOString();
  const due = couple.recurring.filter((r) => r.active && r.by === me.id && r.nextDate <= now);

  if (due.length === 0) return null;
  return (
    <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
      {due.map((rule) => {
        const goal = goals.find((g) => g.id === rule.goalId);
        return (
          <View key={rule.id} style={s.card}>
            <View style={s.top}>
              <GoalIcon icon={goal?.icon ?? 'wallet'} color={goal?.color ?? '#5B6475'} size={40} />
              <View style={{ flex: 1 }}>
                <View style={s.kickerRow}>
                  <Icon name="repeat" size={12} color={colors.accent} />
                  <Text style={s.kicker}>{t('recurring.due')}</Text>
                </View>
                <Text style={s.title} numberOfLines={1}>
                  {t('recurring.dueBody', { amount: money(rule.amount), dest: goal?.name ?? t('common.commonFund') })}
                </Text>
              </View>
            </View>
            <View style={s.actions}>
              <PressableScale containerStyle={{ flex: 1 }} style={s.skip} onPress={() => backend.skipRecurring(rule.id)}>
                <Text style={s.skipText}>{t('recurring.skip')}</Text>
              </PressableScale>
              <PressableScale
                containerStyle={{ flex: 1 }}
                style={s.confirm}
                onPress={async () => {
                  await backend.confirmRecurring(rule.id);
                  tap('success');
                }}>
                <Icon name="check" size={16} color={colors.onPrimary} strokeWidth={2.6} />
                <Text style={s.confirmText}>{t('recurring.confirm')}</Text>
              </PressableScale>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.md - 2, borderWidth: 1.5, borderColor: colors.accent, ...elevation },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md - 4 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  kicker: { ...type.tiny, color: colors.accent, textTransform: 'uppercase' },
  title: { ...type.bodyStrong, color: colors.text, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  skip: { height: 42, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  skipText: { ...type.bodyStrong, fontSize: 14, color: colors.textMuted },
  confirm: { height: 42, borderRadius: radius.pill, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  confirmText: { ...type.bodyStrong, fontSize: 14, color: colors.onPrimary },
}));
