import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NestAvatars } from '@/components/Avatar';
import { GoalIcon } from '@/components/GoalIcon';
import { Icon } from '@/components/Icon';
import { Card, EmptyState, PressableScale, ProgressBar, ScreenHeader } from '@/components/ui';
import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { useSession, type Nest } from '@/store/SavingsContext';
import { radius, spacing, type } from '@/theme';
import { formatMoney, formatShortDate } from '@/utils/format';
import { goBack } from '@/utils/navigation';

/** Read-only history of nests the user unlinked from. */
export default function ArchivedScreen() {
  const s = useStyles();
  const { t } = useT();
  const { archived } = useSession();

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScreenHeader title={t('archived.title')} onLeading={goBack} />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {archived.length === 0 ? (
          <EmptyState icon="archive" title={t('archived.emptyTitle')} body={t('archived.emptyBody')} />
        ) : (
          archived.map((nest) => <ArchivedNest key={nest.couple.id} nest={nest} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ArchivedNest({ nest }: { nest: Nest }) {
  const s = useStyles();
  const { colors } = useTheme();
  const { t, locale } = useT();
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const { couple, members } = nest;
  const money = (n: number) => formatMoney(n, couple.currency);
  const signed = (goalId?: string | null) =>
    couple.transactions
      .filter((tx) => goalId === undefined || tx.goalId === goalId)
      .reduce((sum, tx) => sum + (tx.type === 'deposit' ? tx.amount : -tx.amount), 0);
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? t('family.formerMember');
  if (!user) return null;

  return (
    <Card style={{ gap: spacing.md }}>
      <PressableScale onPress={() => setOpen((o) => !o)} scaleTo={0.99} haptic={false} style={s.header}>
        <NestAvatars users={members} size={38} ring={colors.surface} />
        <View style={{ flex: 1 }}>
          <Text style={s.name} numberOfLines={1}>
            {nest.name}
          </Text>
          <Text style={s.meta}>{t('archived.on', { date: formatShortDate(couple.archivedAt ?? couple.createdAt, locale) })}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.balance}>{money(signed())}</Text>
          <Text style={s.meta}>{t('archived.movements', { n: couple.transactions.length })}</Text>
        </View>
      </PressableScale>

      {open && (
        <View style={{ gap: spacing.md }}>
          <View style={s.readOnly}>
            <Icon name="lock" size={12} color={colors.textMuted} />
            <Text style={s.readOnlyText}>{t('archived.readOnly')}</Text>
          </View>
          {couple.goals.map((g) => (
            <View key={g.id} style={s.goal}>
              <GoalIcon icon={g.icon} color={g.color} size={34} />
              <View style={{ flex: 1, gap: 4 }}>
                <View style={s.goalTop}>
                  <Text style={s.goalName} numberOfLines={1}>
                    {g.name}
                  </Text>
                  <Text style={s.goalAmount}>
                    {money(signed(g.id))} / {money(g.target)}
                  </Text>
                </View>
                <ProgressBar progress={signed(g.id) / g.target} color={g.color} height={5} />
              </View>
            </View>
          ))}
          <View style={s.divider} />
          {couple.transactions.slice(0, 30).map((tx) => (
            <View key={tx.id} style={s.tx}>
              <Text style={s.txWho} numberOfLines={1}>
                {name(tx.by)} · {couple.goals.find((g) => g.id === tx.goalId)?.name ?? t('common.commonFund')}
              </Text>
              <Text style={[s.txAmount, { color: tx.type === 'deposit' ? colors.success : colors.text }]}>
                {tx.type === 'deposit' ? '+' : '−'}
                {money(tx.amount)}
              </Text>
              <Text style={s.txDate}>{formatShortDate(tx.date, locale)}</Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md - 4 },
  name: { ...type.bodyStrong, color: colors.text },
  meta: { ...type.small, fontSize: 12, color: colors.textMuted, marginTop: 1 },
  balance: { ...type.bodyStrong, color: colors.text },
  readOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  readOnlyText: { ...type.tiny, color: colors.textMuted },
  goal: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  goalTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  goalName: { ...type.smallStrong, color: colors.text, flexShrink: 1 },
  goalAmount: { ...type.small, fontSize: 12, color: colors.textMuted },
  divider: { height: 1, backgroundColor: colors.border },
  tx: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  txWho: { ...type.small, color: colors.text, flex: 1 },
  txAmount: { ...type.smallStrong },
  txDate: { ...type.small, fontSize: 11, color: colors.textSubtle, width: 76, textAlign: 'right' },
}));
