import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { GoalIcon } from '@/components/GoalIcon';
import { Icon } from '@/components/Icon';
import { TransactionRow } from '@/components/TransactionRow';
import { useConfirm } from '@/components/ConfirmDialog';
import { Button, Card, EmptyState, IconButton, ProgressBar, ScreenHeader } from '@/components/ui';
import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { backend } from '@/services/backend';
import { useMoney, useSavings } from '@/store/SavingsContext';
import { radius, spacing, type } from '@/theme';
import { formatShortDate, monthsUntil } from '@/utils/format';
import { goBack } from '@/utils/navigation';

export default function GoalDetailScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t, locale } = useT();
  const confirm = useConfirm();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { goals, transactions, savedFor, me, members, memberColor } = useSavings();
  const money = useMoney();
  const goal = goals.find((g) => g.id === id);

  if (!goal) return <Redirect href="/goals" />;

  const saved = savedFor(goal.id);
  const progress = goal.target > 0 ? saved / goal.target : 0;
  const remaining = Math.max(goal.target - saved, 0);
  const history = transactions.filter((tx) => tx.goalId === goal.id);
  const byMember: Record<string, number> = Object.fromEntries(members.map((m) => [m.id, 0]));
  for (const tx of history) if (tx.type === 'deposit') byMember[tx.by] = (byMember[tx.by] ?? 0) + tx.amount;
  const months = goal.deadline ? Math.max(monthsUntil(goal.deadline), 1) : 0;
  const done = remaining === 0;

  const openTransfer = (kind: 'deposit' | 'withdraw') => router.push({ pathname: '/transfer', params: { type: kind, goalId: goal.id } });
  const onDelete = () =>
    confirm(
      t('goal.deleteTitle', { name: goal.name }),
      saved > 0 ? t('goal.deleteWithMoney', { amount: money(saved) }) : t('goal.deleteNoMoney'),
      t('common.delete'),
      () => {
        goBack();
        backend.deleteGoal(goal.id);
      },
    );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScreenHeader onLeading={goBack} trailing={<IconButton icon="trash" label={t('goal.delete')} onPress={onDelete} />} />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <GoalIcon icon={goal.icon} color={goal.color} size={92} />
          <Text style={s.name}>{goal.name}</Text>
          <Text style={s.saved}>{money(saved)}</Text>
          <Text style={s.target}>{t('goal.savedOf', { target: money(goal.target) })}</Text>
        </View>

        <Card style={{ gap: spacing.sm + 4 }}>
          <View style={s.progressRow}>
            <Text style={[s.pct, { color: done ? colors.success : goal.color }]}>{Math.min(Math.round(progress * 100), 100)}%</Text>
            <Text style={s.remaining}>{done ? t('goal.achieved') : t('goal.remaining', { amount: money(remaining) })}</Text>
          </View>
          <ProgressBar progress={progress} color={done ? colors.success : goal.color} height={12} />
          {goal.deadline && (
            <View style={s.metaRow}>
              <Icon name="calendar" size={16} color={colors.textMuted} />
              <Text style={s.metaText}>{t('goal.targetDate', { date: formatShortDate(goal.deadline, locale) })}</Text>
            </View>
          )}
          {!done && months > 0 && (
            <View style={s.tip}>
              <Icon name="idea" size={17} color={colors.accent} />
              <Text style={s.tipText}>{t('goal.tip', { amount: money(remaining / months / 2) })}</Text>
            </View>
          )}
        </Card>

        <View style={s.actions}>
          <Button label={t('transfer.deposit')} icon="add" onPress={() => openTransfer('deposit')} style={{ flex: 1 }} />
          <Button
            label={t('transfer.withdraw')}
            icon="withdraw"
            variant="secondary"
            onPress={() => openTransfer('withdraw')}
            disabled={saved <= 0}
            style={{ flex: 1 }}
          />
        </View>

        <Text style={s.section}>{t('goal.byPerson')}</Text>
        <Card style={{ gap: spacing.md }}>
          {members.map((p) => (
            <View key={p.id} style={s.personRow}>
              <Avatar user={p} color={memberColor(p.id)} size={38} />
              <View style={{ flex: 1, gap: 6 }}>
                <View style={s.personTop}>
                  <Text style={s.personName}>{p.id === me.id ? t('common.you', { name: p.name }) : p.name}</Text>
                  <Text style={s.personAmount}>{money(byMember[p.id])}</Text>
                </View>
                <ProgressBar progress={goal.target > 0 ? byMember[p.id] / goal.target : 0} color={memberColor(p.id)} height={6} />
              </View>
            </View>
          ))}
        </Card>

        <Text style={s.section}>{t('goal.history')}</Text>
        <Card style={{ paddingVertical: spacing.xs }}>
          {history.length === 0 ? (
            <EmptyState icon="clock" title={t('goal.noHistoryTitle')} body={t('goal.noHistoryBody')} />
          ) : (
            history.map((tx, i) => <TransactionRow key={tx.id} tx={tx} showDivider={i > 0} />)
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  hero: { alignItems: 'center', marginBottom: spacing.lg },
  name: { ...type.h2, color: colors.text, marginTop: spacing.md },
  saved: { ...type.display, color: colors.text, marginTop: spacing.xs },
  target: { ...type.body, color: colors.textMuted },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  pct: { ...type.h1 },
  remaining: { ...type.bodyStrong, color: colors.textMuted },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { ...type.small, color: colors.textMuted },
  tip: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    padding: spacing.md - 4,
  },
  tipText: { ...type.small, color: colors.text, lineHeight: 19, flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.sm + 4, marginTop: spacing.md },
  section: { ...type.h2, color: colors.text, marginTop: spacing.lg + 4, marginBottom: spacing.sm + 4 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md - 4 },
  personTop: { flexDirection: 'row', justifyContent: 'space-between' },
  personName: { ...type.h3, fontSize: 15, color: colors.text },
  personAmount: { ...type.bodyStrong, color: colors.text },
}));
