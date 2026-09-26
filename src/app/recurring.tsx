import { router } from 'expo-router';
import { ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { GoalIcon } from '@/components/GoalIcon';
import { IconButton, Button, Card, EmptyState, ScreenHeader, useConfirm } from '@/components/ui';
import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { backend } from '@/services/backend';
import { useMoney, useSavings } from '@/store/SavingsContext';
import type { Frequency, RecurringRule } from '@/store/types';
import { spacing, type } from '@/theme';
import { formatShortDate } from '@/utils/format';
import { goBack } from '@/utils/navigation';

const FREQUENCY_EVERY: Record<Frequency, 'recurring.everyWeekly' | 'recurring.everyBiweekly' | 'recurring.everyMonthly'> = {
  weekly: 'recurring.everyWeekly',
  biweekly: 'recurring.everyBiweekly',
  monthly: 'recurring.everyMonthly',
};

export default function RecurringScreen() {
  const s = useStyles();
  const { t } = useT();
  const { couple } = useSavings();
  const rules = [...couple.recurring].sort((a, b) => a.nextDate.localeCompare(b.nextDate));

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScreenHeader title={t('recurring.title')} onLeading={goBack} trailing={<IconButton icon="add" label={t('recurring.new')} onPress={() => router.push('/new-recurring')} />} />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.intro}>{t('recurring.subtitle')}</Text>
        {rules.length === 0 ? (
          <>
            <EmptyState icon="repeat" title={t('recurring.emptyTitle')} body={t('recurring.emptyBody')} />
            <Button label={t('recurring.new')} icon="add" onPress={() => router.push('/new-recurring')} />
          </>
        ) : (
          <View style={{ gap: spacing.sm + 4 }}>
            {rules.map((rule) => (
              <RuleCard key={rule.id} rule={rule} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RuleCard({ rule }: { rule: RecurringRule }) {
  const s = useStyles();
  const { colors } = useTheme();
  const { t, locale } = useT();
  const { goals, me, member, memberColor } = useSavings();
  const money = useMoney();
  const confirm = useConfirm();
  const goal = goals.find((g) => g.id === rule.goalId);
  const mine = rule.by === me.id;
  const owner = member(rule.by);

  return (
    <Card style={[s.card, !rule.active && { opacity: 0.6 }]}>
      <View style={s.row}>
        <GoalIcon icon={goal?.icon ?? 'wallet'} color={goal?.color ?? '#5B6475'} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={s.amount}>{money(rule.amount)}</Text>
          <Text style={s.meta} numberOfLines={1}>
            {t(FREQUENCY_EVERY[rule.frequency])} · {goal?.name ?? t('common.commonFund')}
          </Text>
        </View>
        {mine ? (
          <Switch
            value={rule.active}
            onValueChange={(v) => backend.setRecurringActive(rule.id, v)}
            trackColor={{ true: colors.accent, false: colors.border }}
            thumbColor="#FFFFFF"
          />
        ) : (
          <Avatar user={owner} color={memberColor(rule.by)} size={30} />
        )}
      </View>
      <View style={s.footer}>
        <Text style={s.next}>
          {rule.active ? t('recurring.next', { date: formatShortDate(rule.nextDate, locale) }) : t('recurring.paused')}
          {!mine && ` · ${t('recurring.byPartner', { name: owner.name })}`}
        </Text>
        {mine && (
          <IconButton
            icon="trash"
            label={t('common.delete')}
            onPress={() => confirm(t('recurring.deleteTitle'), t('recurring.deleteBody'), t('common.delete'), () => backend.deleteRecurring(rule.id))}
          />
        )}
      </View>
    </Card>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2, gap: spacing.md },
  intro: { ...type.body, color: colors.textMuted, lineHeight: 21 },
  card: { gap: spacing.sm + 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md - 4 },
  amount: { ...type.h3, fontSize: 18, fontFamily: type.h2.fontFamily, color: colors.text },
  meta: { ...type.small, color: colors.textMuted, marginTop: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  next: { ...type.smallStrong, color: colors.textMuted, flex: 1 },
}));
